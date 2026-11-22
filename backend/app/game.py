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
    pool = [(name, weight) for name, weight in RARITY_WEIGHTS if weight > 0]
    total = sum(weight for _, weight in pool)
    ticket = secrets.randbelow(total)
    rarity = next(name for name, weight in pool if (ticket := ticket - weight) < 0)
    plates = (await db.execute(select(Plate).where(Plate.rarity == rarity))).scalars().all()
    if not plates:
        raise ValueError(f"В пуле нет предметов редкости {rarity}; обратитесь к администратору")
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
