from __future__ import annotations

import os
import pathlib


def _load_dotenv_if_present() -> None:
    root = pathlib.Path(__file__).resolve().parents[2]
    env_path = root / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        os.environ.setdefault(key, value)


class Settings:
    def __init__(self) -> None:
        _load_dotenv_if_present()
        self.mongo_uri: str = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        self.mongo_db: str = os.getenv("MONGO_DB", "appdb")

        # Geliştirme için varsayılan secret; production'da .env ile JWT_SECRET verin
        self.jwt_secret: str = os.getenv("JWT_SECRET", "dev-secret-change-in-production")
        self.jwt_alg: str = os.getenv("JWT_ALG", "HS256")
        self.access_token_expire_minutes: int = int(
            os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
        )


settings = Settings()
