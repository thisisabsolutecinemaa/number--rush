import hashlib, hmac
from urllib.parse import parse_qsl
from .config import settings

def verify_telegram_init_data(init_data: str) -> dict:
    if not init_data:
        raise ValueError("Missing Telegram initData")
    data = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = data.pop("hash", None)
    if not received_hash:
        raise ValueError("Missing Telegram signature")
    secret = hmac.new(b"WebAppData", settings.bot_token.encode(), hashlib.sha256).digest()
    check_string = "\n".join(f"{k}={v}" for k, v in sorted(data.items()))
    calculated = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(calculated, received_hash):
        raise ValueError("Invalid Telegram signature")
    import json, time
    auth_date = int(data.get("auth_date", "0"))
    if abs(time.time() - auth_date) > 86400:
        raise ValueError("Expired Telegram initData")
    user = json.loads(data["user"])
    return user
