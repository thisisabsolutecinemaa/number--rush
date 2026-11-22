import asyncio, os
from aiogram import Bot, Dispatcher
from aiogram.filters import CommandStart
from aiogram.types import Message, WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton

TOKEN = os.getenv("BOT_TOKEN")
WEBAPP_URL = os.environ["t.me/NumberRush1bot/rushgame"]

dp = Dispatcher()

@dp.message(CommandStart())
async def start(message: Message):
    keyboard = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="🚘 Играть", web_app=WebAppInfo(url=WEBAPP_URL))
    ]])
    await message.answer(
        "Добро пожаловать в NUMBER RUSH!"
        "Собирай автомобильные номера, открывай редкости и торгуй с игроками."
        "Твой стартовый баланс — 100 000 игровых ₽.",
        reply_markup=keyboard
    )

async def main():
    bot = Bot(TOKEN)
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
