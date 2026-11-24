from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import BigInteger, Integer, String, Boolean, DateTime, ForeignKey, JSON, func, UniqueConstraint

class Base(DeclarativeBase): pass

class Player(Base):
    __tablename__ = "players"
    telegram_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    username: Mapped[str | None] = mapped_column(String(64), nullable=True)
    balance: Mapped[int] = mapped_column(BigInteger, default=100_000, nullable=False)
    spins: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())

class Plate(Base):
    __tablename__ = "plates"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(24), nullable=False)
    region: Mapped[str] = mapped_column(String(32), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    rarity: Mapped[str] = mapped_column(String(16), nullable=False)
    talisman: Mapped[bool] = mapped_column(Boolean, default=False)
    buff: Mapped[dict] = mapped_column(JSON, default=dict)

class InventoryItem(Base):
    __tablename__ = "inventory_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("players.telegram_id"), index=True)
    plate_id: Mapped[int] = mapped_column(ForeignKey("plates.id"))
    equipped: Mapped[bool] = mapped_column(Boolean, default=False)
    acquired_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())

class Ledger(Base):
    __tablename__ = "ledger"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    player_id: Mapped[int] = mapped_column(BigInteger, index=True)
    delta: Mapped[int] = mapped_column(BigInteger)
    reason: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())

class Admin(Base):
    __tablename__ = "admins"
    telegram_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)

class SpinRequest(Base):
    __tablename__ = "spin_requests"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    player_id: Mapped[int] = mapped_column(BigInteger, index=True)
    result_item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id"))
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GameEvent(Base):
    __tablename__ = "game_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_type: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(80), nullable=False)
    expires_at: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False)
    created_by: Mapped[int] = mapped_column(BigInteger, nullable=False)


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    player_id: Mapped[int] = mapped_column(BigInteger, index=True)
    username: Mapped[str] = mapped_column(String(64), default="Коллекционер")
    message: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

class MarketListing(Base):
    __tablename__ = "market_listings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id"), unique=True)
    seller_id: Mapped[int] = mapped_column(BigInteger, index=True)
    price: Mapped[int] = mapped_column(BigInteger, nullable=False)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

class Announcement(Base):
    __tablename__ = "announcements"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    body: Mapped[str] = mapped_column(String(1000), nullable=False)
    created_by: Mapped[int] = mapped_column(BigInteger, nullable=False)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class TaskClaim(Base):
    __tablename__ = "task_claims"
    __table_args__ = (UniqueConstraint("player_id", "task_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    player_id: Mapped[int] = mapped_column(BigInteger, index=True)
    task_id: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Operator(Base):
    __tablename__ = "sim_operators"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    country: Mapped[str] = mapped_column(String(48), nullable=False)
    country_code: Mapped[str] = mapped_column(String(3), nullable=False)
    prefixes: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    custom: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    price: Mapped[int] = mapped_column(BigInteger, default=5000, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
