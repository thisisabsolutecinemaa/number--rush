# NUMBER RUSH — MVP starter

Telegram Mini App + Telegram bot starter for a fictional license-plate collecting game.

## Stack
- FastAPI + SQLAlchemy async + PostgreSQL
- aiogram 3 Telegram bot
- React + TypeScript + Vite frontend
- Docker Compose

## Important game rules included
- New account starts with **100,000 ₽** (play-money only).
- 10 spins cost **50,000 ₽** (5,000 ₽ per spin).
- Plate collections include Ukraine, Poland, Russia, Europe, China, plus fictional special categories: МВД-style, taxi, diplomatic and military.
- Rarities: Common, Uncommon, Rare, Epic, Legendary, Mythic, Secret, Absolute.
- One equipped talisman per rarity; multiple different rarities can be equipped at once (up to five: Epic through Absolute).
- All balances, purchases, rolls, inventory and trades are server-authoritative.

## Run locally
1. Copy `.env.example` to `.env` and set `BOT_TOKEN` and `WEBAPP_URL`.
2. `docker compose up --build`
3. Open the bot and use its Mini App button after setting the public HTTPS URL in BotFather.

The frontend is served separately on port 5173 in development. For Telegram testing, expose it through HTTPS (for example, a development tunnel) and set `WEBAPP_URL`.

## MVP limitations
This is a secure foundation, not a finished commercial game. Before public launch, add migrations, rate limits at the proxy, monitoring, backups, moderation workflows, payment policy review, and independent security testing. Telegram WebApp `initData` is verified server-side. Never trust user IDs, balances, rarity, item IDs or prices sent by the browser.
