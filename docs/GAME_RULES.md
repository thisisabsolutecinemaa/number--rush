# Game rules / decisions

## Economy
- Starting grant: 100,000 play-money rubles once per Telegram account.
- Spin price: 5,000 play-money rubles.
- Ten-spin bundle: 50,000 play-money rubles.
- No real-money purchases are implemented in this MVP.

## Rarity table (initial proposal; weights are server-side)
- Common: 70.0000%
- Uncommon: 20.0000%
- Rare: 7.0000%
- Epic: 2.6999%
- Legendary: 0.3000%
- Mythic: 0.0100%
- Secret: excluded from standard spins; event/admin release only.
- Absolute: 0.001% (10 in 1,000,000), subject to final product decision.

These weights are a draft and must be reconciled with the requested “Absolute 0.001% base / 1% at luck x5” rule before public launch. Luck must be computed on the server and must not silently alter displayed odds.

## Talisman equip rule
One equipped talisman per rarity, not one total. Different rarity tiers can be equipped simultaneously. The five tiers are Epic, Legendary, Mythic, Secret, Absolute. A replacement unequips the existing talisman of the same rarity only.

## Anti-cheat
- The browser is untrusted. Hiding or disabling DevTools is not security.
- Telegram initData is verified server-side.
- Randomness uses Python `secrets`, not browser JavaScript.
- Balance and item ownership are server-side.
- All economy changes get ledger entries.
- Admin commands must be separately authenticated and audited.
