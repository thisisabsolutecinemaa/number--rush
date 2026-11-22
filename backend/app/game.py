import secrets
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from .models import Plate, Player, InventoryItem, Ledger

RARITY_WEIGHTS = [
    ("Обычный", 700_000),
    ("Необычный", 200_000),
    ("Редкий", 70_000),
    ("Эпический", 26_890),
    ("Легендарный", 3_000),  # 0.30%
    ("Мифический", 100),    # 0.01%
    ("Секретный", 0),       # event/admin pool; not in normal spin
    ("Абсолют", 10),        # 0.001%
]
# Weights are integer tickets out of 1,000,000. Secret is intentionally excluded.
SPIN_COST = 5_000

async def spin_once(db: AsyncSession, player: Player):
    if player.balance < SPIN_COST:
        raise ValueError("Недостаточно игровых рублей")
    available = (await db.execute(select(Plate.rarity).distinct())).scalars().all()
    available_set = set(available)
    pool = [(name, weight) for name, weight in RARITY_WEIGHTS if weight > 0 and name in available_set]
    if not pool:
        raise ValueError("Пул номеров пока пуст. Попробуйте позже.")
    total = sum(weight for _, weight in pool)
    ticket = secrets.randbelow(total)
    rarity = next(name for name, weight in pool if (ticket := ticket - weight) < 0)
    plates = (await db.execute(select(Plate).where(Plate.rarity == rarity))).scalars().all()
    plate = secrets.choice(plates)
    player.balance -= SPIN_COST
    db.add(Ledger(player_id=player.telegram_id, delta=-SPIN_COST, reason="spin"))
    item = InventoryItem(owner_id=player.telegram_id, plate_id=plate.id)
    db.add(item)
    await db.flush()
    return item, plate

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
