from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func, desc
from .db import Session
from .models import Player, Plate, InventoryItem, Ledger, ChatMessage, MarketListing, Announcement
from .security import verify_telegram_init_data
from .game import make_plate_code, sell_price

router = APIRouter()

async def identity(init_data: str):
    try:
        user = verify_telegram_init_data(init_data)
        return int(user["id"]), user
    except Exception:
        raise HTTPException(401, "Открой Nomerki через Telegram")

@router.get("/api/regions")
async def regions():
    return {"regions":[
      {"code":"UA","name":"Украина","flag":"🇺🇦","areas":["AA","AB","AC","AE","AH","AI","AM","AO","AP","AT","AX","BA","BB","BC","BE","BH","BI","BK","BM","BO","BT","BX","CA","CB","CE"]},
      {"code":"CN","name":"Китай","flag":"🇨🇳"},{"code":"RU","name":"Россия","flag":"🇷🇺"},
      {"code":"EU","name":"Европа","flag":"🇪🇺"},{"code":"DE","name":"Германия","flag":"🇩🇪"},
      {"code":"US","name":"США","flag":"🇺🇸"},{"code":"GB","name":"Британия","flag":"🇬🇧"},
      {"code":"FR","name":"Франция","flag":"🇫🇷"},{"code":"JP","name":"Япония","flag":"🇯🇵"},
      {"code":"PL","name":"Польша","flag":"🇵🇱"},{"code":"AE","name":"ОАЭ","flag":"🇦🇪"}]}

class GenerateBody(BaseModel):
    region: str = Field(min_length=2, max_length=12)
    area: str | None = Field(default=None, max_length=4)

@router.post("/api/generator")
async def generator(body: GenerateBody, x_telegram_init_data: str = Header(default="")):
    uid,user=await identity(x_telegram_init_data)
    cost=15000
    async with Session() as db:
        async with db.begin():
            p=(await db.execute(select(Player).where(Player.telegram_id==uid).with_for_update())).scalar_one_or_none()
            if not p: raise HTTPException(404,"Профиль не найден")
            if p.balance<cost: raise HTTPException(400,"Нужно 15 000 ₽ для генерации")
            p.balance-=cost
            code=make_plate_code(body.region)
            if body.region=="UA" and body.area:
                code=f"{body.area} {code.split(' ')[1]} {code.split(' ')[2]}"
            plate=Plate(code=code,region=body.region,category="Генератор",rarity="Обычный",talisman=False,buff={})
            db.add(plate); await db.flush()
            item=InventoryItem(owner_id=uid,plate_id=plate.id)
            db.add(item); db.add(Ledger(player_id=uid,delta=-cost,reason="generator"))
            await db.flush()
            return {"code":code,"region":body.region,"item_id":item.id,"balance":p.balance,"cost":cost}

@router.post("/api/garage/reset")
async def reset_garage(x_telegram_init_data: str = Header(default="")):
    uid,_=await identity(x_telegram_init_data)
    async with Session() as db:
        async with db.begin():
            rows=(await db.execute(select(InventoryItem).where(InventoryItem.owner_id==uid).with_for_update())).scalars().all()
            count=len(rows)
            ids=[row.id for row in rows]
            if ids:
                listings=(await db.execute(select(MarketListing).where(MarketListing.item_id.in_(ids)).with_for_update())).scalars().all()
                for listing in listings: await db.delete(listing)
            for row in rows: await db.delete(row)
    return {"ok":True,"deleted":count}

class ChatBody(BaseModel):
    message: str = Field(min_length=1,max_length=500)

@router.get("/api/chat")
async def chat(x_telegram_init_data: str = Header(default="")):
    await identity(x_telegram_init_data)
    async with Session() as db:
        rows=(await db.execute(select(ChatMessage).order_by(desc(ChatMessage.id)).limit(80))).scalars().all()
        return {"messages":[{"id":x.id,"telegram_id":x.player_id,"username":x.username,"message":x.message,"created_at":x.created_at.isoformat() if x.created_at else None} for x in reversed(rows)]}

@router.post("/api/chat")
async def send_chat(body: ChatBody,x_telegram_init_data: str = Header(default="")):
    uid,user=await identity(x_telegram_init_data)
    message=" ".join(body.message.split()).strip()
    if not message: raise HTTPException(400,"Пустое сообщение")
    async with Session() as db:
        async with db.begin():
            recent=(await db.execute(select(ChatMessage).where(ChatMessage.player_id==uid).order_by(desc(ChatMessage.id)).limit(1))).scalar_one_or_none()
            if recent and recent.created_at and datetime.now(timezone.utc)-recent.created_at.replace(tzinfo=timezone.utc)<timedelta(seconds=3):
                raise HTTPException(429,"Не так быстро — подожди 3 секунды")
            row=ChatMessage(player_id=uid,username=(user.get("username") or user.get("first_name") or "Коллекционер")[:64],message=message)
            db.add(row); await db.flush()
            return {"ok":True,"id":row.id}

class ListingBody(BaseModel):
    item_id: int = Field(gt=0)
    price: int = Field(ge=1000,le=1000000000)

@router.get("/api/market")
async def market(x_telegram_init_data: str = Header(default="")):
    await identity(x_telegram_init_data)
    async with Session() as db:
        rows=(await db.execute(select(MarketListing,InventoryItem,Plate,Player).join(InventoryItem,InventoryItem.id==MarketListing.item_id).join(Plate,Plate.id==InventoryItem.plate_id).join(Player,Player.telegram_id==MarketListing.seller_id).order_by(desc(MarketListing.id)).limit(100))).all()
        return {"listings":[{"id":l.id,"item_id":i.id,"code":p.code,"region":p.region,"rarity":p.rarity,"price":l.price,"seller_id":l.seller_id,"seller":pl.username or "Коллекционер"} for l,i,p,pl in rows]}

@router.post("/api/market")
async def list_market(body: ListingBody,x_telegram_init_data: str = Header(default="")):
    uid,_=await identity(x_telegram_init_data)
    async with Session() as db:
        async with db.begin():
            item=(await db.execute(select(InventoryItem).where(InventoryItem.id==body.item_id,InventoryItem.owner_id==uid).with_for_update())).scalar_one_or_none()
            if not item: raise HTTPException(404,"Номер не найден")
            if item.equipped: raise HTTPException(400,"Сначала сними талисман")
            exists=await db.scalar(select(MarketListing.id).where(MarketListing.item_id==item.id))
            if exists: raise HTTPException(409,"Номер уже на рынке")
            db.add(MarketListing(item_id=item.id,seller_id=uid,price=body.price))
    return {"ok":True}

class BuyBody(BaseModel):
    listing_id: int = Field(gt=0)

@router.post("/api/market/buy")
async def buy_market(body: BuyBody,x_telegram_init_data: str = Header(default="")):
    buyer,_=await identity(x_telegram_init_data)
    async with Session() as db:
        async with db.begin():
            listing=(await db.execute(select(MarketListing).where(MarketListing.id==body.listing_id).with_for_update())).scalar_one_or_none()
            if not listing: raise HTTPException(404,"Объявление уже продано")
            if listing.seller_id==buyer: raise HTTPException(400,"Нельзя купить собственный номер")
            b=(await db.execute(select(Player).where(Player.telegram_id==buyer).with_for_update())).scalar_one()
            s=(await db.execute(select(Player).where(Player.telegram_id==listing.seller_id).with_for_update())).scalar_one()
            if b.balance<listing.price: raise HTTPException(400,"Недостаточно средств")
            item=await db.get(InventoryItem,listing.item_id)
            if not item: raise HTTPException(404,"Номер больше не существует")
            b.balance-=listing.price
            fee=max(1,listing.price//20)
            s.balance+=listing.price-fee
            item.owner_id=buyer
            db.add(Ledger(player_id=buyer,delta=-listing.price,reason="market_buy"))
            db.add(Ledger(player_id=s.telegram_id,delta=listing.price-fee,reason="market_sale"))
            await db.delete(listing)
            return {"ok":True,"balance":b.balance,"fee":fee}

@router.get("/api/leaderboard")
async def leaderboard(x_telegram_init_data: str = Header(default="")):
    await identity(x_telegram_init_data)
    async with Session() as db:
        rows=(await db.execute(select(Player.telegram_id,Player.username,Player.balance,func.count(InventoryItem.id).label("items")).outerjoin(InventoryItem,InventoryItem.owner_id==Player.telegram_id).group_by(Player.telegram_id).order_by(desc("items"),desc(Player.balance)).limit(50))).all()
        return {"players":[{"telegram_id":r.telegram_id,"username":r.username or "Коллекционер","balance":r.balance,"items":r.items} for r in rows]}

@router.get("/api/announcements")
async def announcements():
    async with Session() as db:
        rows=(await db.execute(select(Announcement).order_by(desc(Announcement.id)).limit(30))).scalars().all()
        return {"announcements":[{"id":a.id,"title":a.title,"body":a.body,"created_at":a.created_at.isoformat() if a.created_at else None} for a in rows]}

class AnnouncementBody(BaseModel):
    title: str = Field(min_length=2,max_length=100)
    body: str = Field(min_length=2,max_length=1000)

@router.post("/api/announcements")
async def publish_announcement(body: AnnouncementBody,x_telegram_init_data: str = Header(default="")):
    uid,_=await identity(x_telegram_init_data)
    if uid!=8415813092: raise HTTPException(403,"Доступ запрещён")
    async with Session() as db:
        row=Announcement(title=body.title.strip(),body=body.body.strip(),created_by=uid)
        db.add(row); await db.commit()
    return {"ok":True}

@router.get("/api/progress")
async def progress(x_telegram_init_data: str = Header(default="")):
    uid,_=await identity(x_telegram_init_data)
    async with Session() as db:
        p=await db.get(Player,uid)
        items=await db.scalar(select(func.count()).select_from(InventoryItem).where(InventoryItem.owner_id==uid)) or 0
        rare=await db.scalar(select(func.count()).select_from(InventoryItem).join(Plate,Plate.id==InventoryItem.plate_id).where(InventoryItem.owner_id==uid,Plate.rarity.in_(["Легендарный","Мифический","Секретный","Абсолют"]))) or 0
        return {"spins":p.spins,"items":items,"rare":rare,"achievements":[{"id":"first_spin","title":"Первый запуск","done":p.spins>=1},{"id":"collector_10","title":"Коллекционер","done":items>=10},{"id":"legend_hunter","title":"Охотник за редкостями","done":rare>=1},{"id":"spin_100","title":"Сотня запусков","done":p.spins>=100}],"tasks":[{"id":"spin_1","title":"Открой один номер","progress":min(p.spins,1),"target":1,"reward":1000,"done":p.spins>=1},{"id":"spin_10","title":"Сделай 10 прокруток","progress":min(p.spins,10),"target":10,"reward":5000,"done":p.spins>=10},{"id":"garage_5","title":"Собери 5 номеров","progress":min(items,5),"target":5,"reward":2500,"done":items>=5}]}
