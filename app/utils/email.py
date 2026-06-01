from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

log = logging.getLogger(__name__)


def send_email(to_address: str, subject: str, body_text: str) -> bool:
    """SMTP yapılandırılmışsa düz metin e-posta gönderir.

    Yapılandırma yoksa ya da gönderim başarısızsa False döner (çağıran taraf
    geliştirme ortamında token'ı yine de kullanabilir).
    """
    if not settings.smtp_configured:
        return False
    msg = EmailMessage()
    msg["From"] = settings.smtp_from
    msg["To"] = to_address
    msg["Subject"] = subject
    msg.set_content(body_text)
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            if settings.smtp_tls:
                server.starttls()
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
        return True
    except Exception as e:  # pragma: no cover - ağ/erişim hatalarını yut
        log.warning("E-posta gönderilemedi (%s): %s", to_address, e)
        return False
