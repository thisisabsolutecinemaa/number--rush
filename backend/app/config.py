from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    bot_token: str
    database_url: str = "postgresql+asyncpg://numberrush:numberrush@db:5432/numberrush"
    webapp_url: str = "https://example.invalid"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
