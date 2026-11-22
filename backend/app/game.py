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

async def spin_once(db: AsyncSession, player: Player):
    if player.balance < SPIN_COST:
        raise ValueError("Недостаточно игровых рублей")

    owned_codes = (
        select(Plate.code)
        .join(InventoryItem, InventoryItem.plate_id == Plate.id)
        .where(InventoryItem.owner_id == player.telegram_id)
    )
    available_query = select(Plate).where(~Plate.code.in_(owned_codes))
    available_plates = (await db.execute(available_query)).scalars().all()
    if not available_plates:
        raise ValueError("Все доступные номера уже собраны. Новые номера скоро появятся.")

    by_rarity = {}
    for plate in available_plates:
        by_rarity.setdefault(plate.rarity, []).append(plate)

    pool = [
        (name, weight)
        for name, weight in RARITY_WEIGHTS
        if weight > 0 and by_rarity.get(name)
    ]
    if not pool:
        raise ValueError("Для новых номеров пока не настроены шансы выпадения.")

    total = sum(weight for _, weight in pool)
    ticket = secrets.randbelow(total)
    rarity = next(name for name, weight in pool if (ticket := ticket - weight) < 0)
    plate = secrets.choice(by_rarity[rarity])

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
