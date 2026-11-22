import asyncio
import os

from aiogram import Bot, Dispatcher
from aiogram.filters import CommandStart
from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    WebAppInfo,
)

TOKEN = os.getenv("BOT_TOKEN")
WEBAPP_URL = os.getenv(
    "WEBAPP_URL",
    "https://number-rush-rrhx.netlify.app",
)

if not TOKEN:
    raise RuntimeError("BOT_TOKEN environment variable is required")

if not WEBAPP_URL.startswith("https://"):
    raise RuntimeError("WEBAPP_URL must be an HTTPS URL")

dp = Dispatcher()


@dp.message(CommandStart())
async def start(message: Message):
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🚘 Играть",
                    web_app=WebAppInfo(url=WEBAPP_URL),
                )
            ]
        ]
    )
    await message.answer(
        "Добро пожаловать в NUMBER RUSH!\n"
        "Собирай автомобильные номера, открывай редкости и торгуй с игроками.\n"
        "Твой стартовый баланс — 100 000 игровых ₽.",
        reply_markup=keyboard,
    )


async def main():
    bot = Bot(TOKEN)
    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
