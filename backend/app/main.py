from contextlib import asynccontextmanager
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from .db import engine, Session
from .models import Base, Player, Plate, InventoryItem, Admin
from .security import verify_telegram_init_data
from .game import spin_once, equip_talisman, SPIN_COST

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(title="NUMBER RUSH API", lifespan=lifespan)

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
                      "buff": plate.buff, "balance": player.balance}
        return result

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
