from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from .db import engine, Session
from .models import Base, Player, Plate, InventoryItem, Admin, Ledger, GameEvent, MarketListing
from .game import seed_default_plates
from .security import verify_telegram_init_data
from .game import spin_once, equip_talisman, SPIN_COST, sell_price
from .social import router as social_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with Session() as db:
        await seed_default_plates(db)
    yield

app = FastAPI(title="Nomerki API", lifespan=lifespan)
app.include_router(social_router)
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

class SpinBody(BaseModel):
    region: str = "UA"

@app.post("/api/spin")
async def spin(body: SpinBody,x_telegram_init_data: str = Header(default="")):
    uid, user = await current_player(x_telegram_init_data)
    async with Session() as db:
        async with db.begin():
            player = (await db.execute(select(Player).where(Player.telegram_id == uid).with_for_update())).scalar_one()
            active_events=(await db.execute(select(GameEvent).where(GameEvent.expires_at>datetime.now(timezone.utc)))).scalars().all()
            effects=active_event_effects(active_events)
            spin_cost=max(0,int(SPIN_COST*(1-effects["discount"]/100)))
            try:
                item,plate=await spin_once(db,player,body.region,spin_cost,effects["luck"],effects["legend"],effects["mythic"])
            except ValueError as e:
                raise HTTPException(400, str(e))
            player.spins += 1
            cashback=int(spin_cost*effects["cashback"]/100)
            reward=effects["bonus"]+cashback
            if reward:
                player.balance+=reward
                db.add(Ledger(player_id=uid,delta=reward,reason="event_reward"))
            await db.flush()
            result={"item_id":item.id,"code":plate.code,"region":plate.region,"category":plate.category,
                    "rarity":plate.rarity,"talisman":plate.talisman,"buff":plate.buff,"balance":player.balance,
                    "sell_value":sell_price(plate.rarity)*effects["sell"],"spin_cost":spin_cost,
                    "event_reward":reward,"event_effects":effects}
        return result


# 150 global events with server-side effects for every player.
_EVENT_FAMILIES = [
 ("luck","ЗОЛОТАЯ УДАЧА","Шанс редких номеров ×{v}","luck"),
 ("discount","ЦЕНОПАД","Прокрутка дешевле на {v}%","discount"),
 ("sell","ЧЁРНЫЙ РЫНОК","Продажа номеров ×{v}","sell"),
 ("jackpot","ДЕНЕЖНЫЙ ДОЖДЬ","Бонус за прокрутку: {v} ₽","jackpot"),
 ("legend","ОХОТА ЗА ЛЕГЕНДОЙ","Шанс легендарных+ ×{v}","legend"),
 ("mythic","МИФИЧЕСКИЙ РАЗЛОМ","Шанс мифических+ ×{v}","mythic"),
 ("cashback","КЭШБЭК","Возврат цены прокрутки: {v}%","cashback"),
 ("combo","ЗОЛОТОЙ КОМБО","Удача ×{v}, продажа ×{s}","combo"),
 ("collector","ДЕНЬ КОЛЛЕКЦИОНЕРА","Бонус {v} ₽, продажа ×{s}","collector"),
 ("rush","НОЧНОЙ RUSH","Скидка {v}%, удача ×{s}","rush"),
 ("vip","VIP-ПЕРЕПОЛОХ","Удача ×{v}, бонус {s} ₽","vip"),
 ("auction","АУКЦИОННЫЙ БУМ","Продажа ×{v}, бонус {s} ₽","auction"),
 ("festival","ФЕСТИВАЛЬ НОМЕРОВ","Скидка {v}%, продажа ×{s}","festival"),
 ("storm","ШТОРМ РЕДКОСТИ","Удача ×{v}, скидка {s}%","storm"),
 ("universe","РАЗЛОМ ВСЕЛЕННОЙ","Удача ×{v}, продажа ×{s}","universe"),
]
EVENT_CATALOG = {}
for fi, (family,label,description,mode) in enumerate(_EVENT_FAMILIES):
    for level in range(1,11):
        code=f"e{fi*10+level:03d}"
        if mode in {"luck","legend","mythic"}:
            value=level*(2 if mode=="luck" else 3 if mode=="legend" else 5)
            effect={"luck":value}
            if mode=="legend": effect={"legend":value}
            if mode=="mythic": effect={"mythic":value}
            desc=description.format(v=f"×{value}")
        elif mode=="discount":
            value=level*9; effect={"discount":value}; desc=description.format(v=value)
        elif mode=="sell":
            value=level+1; effect={"sell":value}; desc=description.format(v=f"×{value}")
        elif mode=="jackpot":
            value=level*2500; effect={"bonus":value}; desc=description.format(v=f"{value:,}".replace(",", " "))
        elif mode=="cashback":
            value=level*5; effect={"cashback":value}; desc=description.format(v=value)
        elif mode=="combo":
            value,sell=level*2,level+1; effect={"luck":value,"sell":sell}; desc=description.format(v=f"×{value}",s=f"×{sell}")
        elif mode=="collector":
            value,sell=level*1500,level+1; effect={"bonus":value,"sell":sell}; desc=description.format(v=f"{value:,}".replace(",", " "),s=f"×{sell}")
        elif mode=="rush":
            value,luck=level*8,level+1; effect={"discount":value,"luck":luck}; desc=description.format(v=value,s=f"×{luck}")
        elif mode=="vip":
            luck,bonus=level*3,level*5000; effect={"luck":luck,"bonus":bonus}; desc=description.format(v=f"×{luck}",s=f"{bonus:,}".replace(",", " "))
        elif mode=="auction":
            sell,bonus=level+2,level*3000; effect={"sell":sell,"bonus":bonus}; desc=description.format(v=f"×{sell}",s=f"{bonus:,}".replace(",", " "))
        elif mode=="festival":
            discount,sell=level*5,level+1; effect={"discount":discount,"sell":sell}; desc=description.format(v=discount,s=f"×{sell}")
        elif mode=="storm":
            luck,discount=level*4,level*4; effect={"luck":luck,"discount":discount}; desc=description.format(v=f"×{luck}",s=discount)
        else:
            luck,sell=level*4,level+1; effect={"luck":luck,"sell":sell}; desc=description.format(v=f"×{luck}",s=f"×{sell}")
        EVENT_CATALOG[code]={"code":code,"title":f"{label} · УРОВЕНЬ {level}","description":desc,"effect":effect,"family":family}

def active_event_effects(events):
    effects={"luck":1,"legend":1,"mythic":1,"sell":1,"discount":0,"bonus":0,"cashback":0}
    legacy={"luck":{"luck":3},"discount":{"discount":50},"double_sell":{"sell":2}}
    for event in events:
        spec=EVENT_CATALOG.get(event.event_type)
        values=spec["effect"] if spec else legacy.get(event.event_type,{})
        for key,value in values.items():
            if key in {"luck","legend","mythic","sell"}: effects[key]=min(100,effects[key]*value)
            elif key in {"discount","cashback"}: effects[key]=min(90,effects[key]+value)
            elif key=="bonus": effects[key]=min(1000000,effects[key]+value)
    effects["discount"]=min(95,effects["discount"])
    return effects


ADMIN_ID=8415813092

async def admin_user(init_data: str):
    uid,_=await current_player(init_data)
    if uid!=ADMIN_ID: raise HTTPException(403,"Доступ запрещён")
    return uid

@app.get("/api/admin")
async def admin_dashboard(x_telegram_init_data: str=Header(default="")):
    await admin_user(x_telegram_init_data)
    async with Session() as db:
        players=await db.scalar(select(func.count()).select_from(Player))
        items=await db.scalar(select(func.count()).select_from(InventoryItem))
        events=(await db.execute(select(GameEvent).where(GameEvent.expires_at>datetime.now(timezone.utc)))).scalars().all()
        return {"players":players or 0,"items":items or 0,"events":[{"id":e.id,"type":e.event_type,"title":e.title,"expires_at":e.expires_at.isoformat()} for e in events]}

class AdminEventBody(BaseModel):
    event_type: str
    duration_minutes: int=Field(default=30,ge=1,le=1440)

@app.post("/api/admin/event")
async def admin_start_event(body: AdminEventBody,x_telegram_init_data: str=Header(default="")):
    uid=await admin_user(x_telegram_init_data)
    spec=EVENT_CATALOG.get(body.event_type)
    legacy_titles={"luck":"УДАЧНЫЙ ЧАС · x3 шанс редких номеров","discount":"БЕЗУМНАЯ СКИДКА · прокрутка за 2 500 ₽","double_sell":"СКУПЩИК · двойная цена продажи"}
    if not spec and body.event_type not in legacy_titles: raise HTTPException(400,"Неизвестный эвент")
    title=spec["title"] if spec else legacy_titles[body.event_type]
    async with Session() as db:
        event=GameEvent(event_type=body.event_type,title=title,expires_at=datetime.now(timezone.utc)+timedelta(minutes=body.duration_minutes),created_by=uid)
        db.add(event)
        await db.commit()
        return {"ok":True,"title":event.title}

@app.get("/api/events")
async def public_events():
    async with Session() as db:
        events=(await db.execute(select(GameEvent).where(GameEvent.expires_at>datetime.now(timezone.utc)))).scalars().all()
        return {"events":[{"title":e.title,"expires_at":e.expires_at.isoformat(),"description":EVENT_CATALOG.get(e.event_type,{}).get("description","Глобальный бонус действует для всех")} for e in events]}

@app.get("/api/admin/event-catalog")
async def admin_event_catalog(x_telegram_init_data: str=Header(default="")):
    await admin_user(x_telegram_init_data)
    return {"events":list(EVENT_CATALOG.values())}

@app.post("/api/admin/event/stop")
async def admin_stop_events(x_telegram_init_data: str=Header(default="")):
    await admin_user(x_telegram_init_data)
    async with Session() as db:
        events=(await db.execute(select(GameEvent).where(GameEvent.expires_at>datetime.now(timezone.utc)))).scalars().all()
        for event in events: event.expires_at=datetime.now(timezone.utc)
        await db.commit()
    return {"ok":True,"stopped":len(events)}

class AdminGrantBody(BaseModel):
    telegram_id: int=Field(gt=0)
    amount: int=Field(gt=0,le=1000000000)

@app.post("/api/admin/grant")
async def admin_grant(body: AdminGrantBody,x_telegram_init_data: str=Header(default="")):
    uid=await admin_user(x_telegram_init_data)
    async with Session() as db:
        player=await db.get(Player,body.telegram_id)
        if not player: raise HTTPException(404,"Игрок не найден")
        player.balance+=body.amount
        db.add(Ledger(player_id=body.telegram_id,delta=body.amount,reason=f"admin:{uid}"))
        await db.commit()
        return {"ok":True,"balance":player.balance}

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
            active_events=(await db.execute(select(GameEvent).where(GameEvent.expires_at>datetime.now(timezone.utc)))).scalars().all()
            amount=sell_price(plate.rarity)*active_event_effects(active_events)["sell"]
            player.balance += amount
            db.add(Ledger(player_id=uid, delta=amount, reason="sell"))
            listing=(await db.execute(select(MarketListing).where(MarketListing.item_id==item.id).with_for_update())).scalar_one_or_none()
            if listing: await db.delete(listing)
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
            active_events=(await db.execute(select(GameEvent).where(GameEvent.expires_at>datetime.now(timezone.utc)))).scalars().all()
            multiplier=active_event_effects(active_events)["sell"]
            amount=sum(sell_price(plate.rarity)*multiplier for _,plate in rows)
            ids=[item.id for item,_ in rows]
            if ids:
                listings=(await db.execute(select(MarketListing).where(MarketListing.item_id.in_(ids)).with_for_update())).scalars().all()
                for listing in listings: await db.delete(listing)
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
