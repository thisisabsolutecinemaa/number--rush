from contextlib import asynccontextmanager
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import select
from .db import engine, Session
from .models import Base, Player, Plate, InventoryItem, Admin, Ledger
from .game import seed_default_plates
from .security import verify_telegram_init_data
from .game import spin_once, equip_talisman, SPIN_COST, sell_price

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with Session() as db:
        await seed_default_plates(db)
    yield

app = FastAPI(title="NUMBER RUSH API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://number-rush-rrhx.netlify.app",
        "https://number-rush-game.onrender.com",
        "http://localhost:5173",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

async def current_player(init_data: str):
    try:
        user = verify_telegram_init_data(init_data)
    except Exception as e:
        raise HTTPException(401, str(e))
    async with Session() as db:
        player = await db.get(Player, int(user["id"]))
        if not player:
            player = Player(telegram_id=int(user["id"]), username=user.get("username"), balance=100_000)
            db.add(player)
            await db.commit()
        return int(user["id"]), user

@app.get("/api/me")
async def me(x_telegram_init_data: str = Header(default="")):
    uid, user = await current_player(x_telegram_init_data)
    async with Session() as db:
        p = await db.get(Player, uid)
        return {"telegram_id": uid, "username": p.username, "balance": p.balance, "spins": p.spins}

@app.post("/api/spin")
async def spin(x_telegram_init_data: str = Header(default="")):
    uid, user = await current_player(x_telegram_init_data)
    async with Session() as db:
        async with db.begin():
            player = (await db.execute(select(Player).where(Player.telegram_id == uid).with_for_update())).scalar_one()
            try:
                item, plate = await spin_once(db, player)
            except ValueError as e:
                raise HTTPException(400, str(e))
            player.spins += 1
            await db.flush()
            result = {"item_id": item.id, "code": plate.code, "region": plate.region,
                      "category": plate.category, "rarity": plate.rarity, "talisman": plate.talisman,
                      "buff": plate.buff, "balance": player.balance, "sell_value": sell_price(plate.rarity)}
        return result


class SellBody(BaseModel):
    item_id: int = Field(gt=0)

def owned_item_query(uid: int, item_id: int):
    return select(InventoryItem, Plate).join(Plate, Plate.id == InventoryItem.plate_id).where(
        InventoryItem.id == item_id, InventoryItem.owner_id == uid
    ).with_for_update()

@app.post("/api/sell")
async def sell_one(body: SellBody, x_telegram_init_data: str = Header(default="")):
    uid, _ = await current_player(x_telegram_init_data)
    async with Session() as db:
        async with db.begin():
            player = (await db.execute(select(Player).where(Player.telegram_id == uid).with_for_update())).scalar_one()
            row = (await db.execute(owned_item_query(uid, body.item_id))).first()
            if not row:
                raise HTTPException(404, "Номер не найден в гараже")
            item, plate = row
            if item.equipped:
                raise HTTPException(400, "Сначала снимите экипированный талисман")
            amount = sell_price(plate.rarity)
            player.balance += amount
            db.add(Ledger(player_id=uid, delta=amount, reason="sell"))
            await db.delete(item)
    return {"ok": True, "sold": 1, "amount": amount, "balance": player.balance}

@app.post("/api/sell-all")
async def sell_all(x_telegram_init_data: str = Header(default="")):
    uid, _ = await current_player(x_telegram_init_data)
    async with Session() as db:
        async with db.begin():
            player = (await db.execute(select(Player).where(Player.telegram_id == uid).with_for_update())).scalar_one()
            rows = (await db.execute(
                select(InventoryItem, Plate).join(Plate, Plate.id == InventoryItem.plate_id)
                .where(InventoryItem.owner_id == uid, InventoryItem.equipped.is_(False))
                .with_for_update()
            )).all()
            amount = sum(sell_price(plate.rarity) for _, plate in rows)
            for item, _ in rows:
                await db.delete(item)
            if amount:
                player.balance += amount
                db.add(Ledger(player_id=uid, delta=amount, reason="sell_all"))
    return {"ok": True, "sold": len(rows), "amount": amount, "balance": player.balance}

class EquipBody(BaseModel):
    item_id: int = Field(gt=0)

@app.post("/api/equip")
async def equip(body: EquipBody, x_telegram_init_data: str = Header(default="")):
    uid, _ = await current_player(x_telegram_init_data)
    async with Session() as db:
        async with db.begin():
            player = (await db.execute(select(Player).where(Player.telegram_id == uid).with_for_update())).scalar_one()
            try:
                await equip_talisman(db, player, body.item_id)
            except ValueError as e:
                raise HTTPException(400, str(e))
    return {"ok": True}

@app.get("/api/inventory")
async def inventory(x_telegram_init_data: str = Header(default="")):
    uid, _ = await current_player(x_telegram_init_data)
    async with Session() as db:
        rows = (await db.execute(select(InventoryItem, Plate).join(Plate, Plate.id == InventoryItem.plate_id)
                                 .where(InventoryItem.owner_id == uid))).all()
        return [{"item_id": i.id, "code": p.code, "region": p.region, "category": p.category,
                 "rarity": p.rarity, "talisman": p.talisman, "equipped": i.equipped, "buff": p.buff}
                for i,p in rows]

@app.get("/api/health")
async def health():
    return {"ok": True}
