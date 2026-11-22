import secrets
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from .models import Plate, Player, InventoryItem, Ledger

RARITY_WEIGHTS = [
    ("Обычный", 800_000),
    ("Необычный", 150_000),
    ("Редкий", 40_000),
    ("Эпический", 9_000),
    ("Легендарный", 999),
    ("Мифический", 1),
    ("Секретный", 0),
    ("Абсолют", 0),
]
# Обычная прокрутка: 80% обычные, 15% необычные, 4% редкие,
# 0.9% эпические, 0.0999% легендарные, 0.0001% мифические.
# Секретные и абсолютные номера выдаются только событиями/администратором.
SPIN_COST = 5_000

SELL_PRICES = {
    "Обычный": 500,
    "Необычный": 1_500,
    "Редкий": 5_000,
    "Эпический": 15_000,
    "Легендарный": 50_000,
    "Мифический": 150_000,
    "Секретный": 500_000,
    "Абсолют": 1_000_000,
}

def sell_price(rarity: str) -> int:
    return SELL_PRICES.get(rarity, 500)


def make_plate_code(region: str) -> str:
    letters="ABCDEFGHJKLMNPRSTUVWXYZ"
    digits="0123456789"
    pick=lambda chars,count:"".join(secrets.choice(chars) for _ in range(count))
    if region=="CN": return f"{secrets.choice(['京','沪','粤','浙','苏','川','鲁','鄂','闽','津'])}{pick(letters,1)}·{pick(digits,5)}"
    if region=="RU":
        area=secrets.choice(["77","97","99","177","197","199","777","799","50","150","750","78","98","178","198"])
        return f"{pick(letters,1)} {pick(digits,3)} {pick(letters,2)} {area}"
    if region=="EU": return f"{pick(letters,2)} · {pick(digits,3)} · {pick(letters,2)}"
    return f"{pick(letters,2)} {pick(digits,4)} {pick(letters,2)}"

async def spin_once(db: AsyncSession,player: Player,region: str="UA",cost: int=SPIN_COST,luck_multiplier: int=1):
    if player.balance<cost: raise ValueError("Недостаточно игровых рублей")
    weights=[(name,weight*(luck_multiplier if name in {"Редкий","Эпический","Легендарный","Мифический"} else 1)) for name,weight in RARITY_WEIGHTS if weight>0]
    ticket=secrets.randbelow(sum(weight for _,weight in weights))
    rarity=next(name for name,weight in weights if (ticket:=ticket-weight)<0)
    region=region if region in {"UA","CN","RU","EU"} else "UA"
    code=make_plate_code(region)
    for _ in range(30):
        exists=await db.execute(select(Plate.id).where(Plate.code==code))
        if exists.scalar_one_or_none() is None: break
        code=make_plate_code(region)
    else: raise ValueError("Не удалось создать уникальный номер. Повторите попытку.")
    names={"UA":"Украина","CN":"Китай","RU":"Россия","EU":"Европа"}
    talisman=rarity in {"Эпический","Легендарный","Мифический","Секретный","Абсолют"}
    plate=Plate(code=code,region=names[region],category="Случайная комбинация",rarity=rarity,talisman=talisman,buff={"luck":1} if talisman else {})
    db.add(plate)
    await db.flush()
    player.balance-=cost
    db.add(Ledger(player_id=player.telegram_id,delta=-cost,reason="spin"))
    item=InventoryItem(owner_id=player.telegram_id,plate_id=plate.id)
    db.add(item)
    await db.flush()
    return item,plate

async def equip_talisman(db: AsyncSession, player: Player, item_id: int):
    from .models import Plate
    item = (await db.execute(
        select(InventoryItem).where(
            InventoryItem.id == item_id,
            InventoryItem.owner_id == player.telegram_id
        ).with_for_update()
    )).scalar_one_or_none()
    if not item:
        raise ValueError("Предмет не найден в вашем инвентаре")
    plate = await db.get(Plate, item.plate_id)
    if not plate.talisman or plate.rarity not in {"Эпический","Легендарный","Мифический","Секретный","Абсолют"}:
        raise ValueError("Этот предмет нельзя экипировать как талисман")
    current = (await db.execute(
        select(InventoryItem, Plate).join(Plate, Plate.id == InventoryItem.plate_id)
        .where(InventoryItem.owner_id == player.telegram_id, InventoryItem.equipped.is_(True))
        .with_for_update()
    )).all()
    for equipped_item, equipped_plate in current:
        if equipped_plate.rarity == plate.rarity:
            equipped_item.equipped = False
    item.equipped = True


async def seed_default_plates(db: AsyncSession):
    defaults = {
        "Обычный": [("AA 1042 KT","Украина","Стандарт"),("B 5821 AB","Европа","Стандарт"),("粤 B·28461","Китай","Стандарт"),("М 417 КР 199","Россия","Стандарт")],
        "Необычный": [("AA 7777 BI","Украина","Красивый"),("沪 A·66888","Китай","Красивый"),("А 707 АА 77","Россия","Красивый")],
        "Редкий": [("KA 0001 BC","Украина","Коллекционный"),("京 A·88888","Китай","Коллекционный"),("Е 001 КХ 777","Россия","Коллекционный")],
        "Эпический": [("VIP 0001","Международный","VIP"),("粤 Z·99999","Китай","VIP"),("А 001 МР 77","Россия","VIP")],
        "Легендарный": [("AA 0001 AA","Украина","Легендарный"),("88888","Китай","Легендарный")],
        "Мифический": [("A 000 AA","Европа","Мифический"),("777777","Китай","Мифический")],
        "Абсолют": [("NR 0001","NUMBER RUSH","Абсолют")]
    }
    existing = set((await db.execute(select(Plate.rarity).distinct())).scalars().all())
    for rarity, entries in defaults.items():
        if rarity not in existing:
            for code, region, category in entries:
                db.add(Plate(code=code, region=region, category=category, rarity=rarity,
                             talisman=rarity in {"Эпический","Легендарный","Мифический","Абсолют"},
                             buff={"luck": 1} if rarity in {"Эпический","Легендарный","Мифический","Абсолют"} else {}))
    await db.commit()
