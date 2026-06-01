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


_DEV_JWT_SECRETS = frozenset(
    {
        "dev-secret-change-in-production",
        "your-secret-key-here",
        "",
    }
)


class Settings:
    def __init__(self) -> None:
        _load_dotenv_if_present()
        self.env: str = os.getenv("ENV", "development").strip().lower()
        self.mongo_uri: str = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        self.mongo_db: str = os.getenv("MONGO_DB", "appdb")

        self.jwt_secret: str = os.getenv("JWT_SECRET", "dev-secret-change-in-production")
        self.jwt_alg: str = os.getenv("JWT_ALG", "HS256")
        self.access_token_expire_minutes: int = int(
            os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
        )

        self.auth_register_limit: str = os.getenv("AUTH_REGISTER_LIMIT", "10/hour")
        self.auth_login_limit: str = os.getenv("AUTH_LOGIN_LIMIT", "5/minute")

        # Ters proxy/yük dengeleyici arkasında ise istemci IP'sini X-Forwarded-For'dan al.
        self.trust_proxy: bool = os.getenv("TRUST_PROXY", "").strip() == "1"

        self.trusted_hosts: list[str] = [
            h.strip() for h in os.getenv("TRUSTED_HOSTS", "").split(",") if h.strip()
        ]
        self.force_https: bool = os.getenv("FORCE_HTTPS", "").strip() == "1"

        # Uygulamanın herkese açık adresi (parola sıfırlama linkleri bununla kurulur)
        self.app_base_url: str = os.getenv("APP_BASE_URL", "http://localhost:5173").strip().rstrip("/")

        # Parola sıfırlama token süresi (dakika)
        self.password_reset_expire_minutes: int = int(
            os.getenv("PASSWORD_RESET_EXPIRE_MINUTES", "30")
        )

        # SMTP (parola sıfırlama e-postası). Boşsa e-posta gönderilmez; geliştirmede link yanıtta döner.
        self.smtp_host: str = os.getenv("SMTP_HOST", "").strip()
        self.smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user: str = os.getenv("SMTP_USER", "").strip()
        self.smtp_password: str = os.getenv("SMTP_PASSWORD", "")
        self.smtp_from: str = os.getenv("SMTP_FROM", "").strip() or (os.getenv("SMTP_USER", "").strip())
        self.smtp_tls: bool = os.getenv("SMTP_TLS", "1").strip() != "0"

        # İsteğe bağlı: sahip özeti için OpenAI uyumlu Chat Completions API
        self.openai_api_key: str = os.getenv("OPENAI_API_KEY", "").strip()
        self.openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"
        raw_base = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").strip().rstrip("/")
        self.openai_base_url: str = raw_base or "https://api.openai.com/v1"

    @property
    def is_production(self) -> bool:
        return self.env in ("production", "prod")

    @property
    def smtp_configured(self) -> bool:
        return bool(self.smtp_host and self.smtp_from)

    def cors_origins_list(self) -> list[str]:
        extra = [s.strip() for s in os.getenv("CORS_ORIGINS", "").split(",") if s.strip()]
        if self.is_production:
            return extra
        base: list[str] = []
        for port in (3000, 5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180):
            base.append(f"http://127.0.0.1:{port}")
            base.append(f"http://localhost:{port}")
        out: list[str] = []
        seen: set[str] = set()
        for o in base + extra:
            if o not in seen:
                seen.add(o)
                out.append(o)
        return out

    def validate(self) -> None:
        """Sunucu ayağa kalkmadan önce çağırın (üretim koruması)."""
        if not self.is_production:
            return
        if self.jwt_secret in _DEV_JWT_SECRETS or len(self.jwt_secret) < 32:
            raise RuntimeError(
                "Üretim (ENV=production): JWT_SECRET en az 32 karakter ve varsayılan "
                "değerlerden farklı olmalı (.env dosyasında ayarlayın)."
            )
        if not self.cors_origins_list():
            raise RuntimeError(
                "Üretim (ENV=production): CORS_ORIGINS zorunludur; virgülle frontend URL'lerini yazın."
            )


settings = Settings()
