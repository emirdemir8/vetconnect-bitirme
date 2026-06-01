from __future__ import annotations

import pathlib
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.utils.security import get_current_user

router = APIRouter(prefix="/files", tags=["files"])

UPLOAD_DIR = pathlib.Path(__file__).resolve().parents[1] / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB


def _detect_mime_from_bytes(data: bytes) -> str | None:
    try:
        import magic  # type: ignore

        m = magic.Magic(mime=True)
        return m.from_buffer(data)
    except Exception:
        return None


@router.post("/upload")
async def upload(
    file: UploadFile = File(...),
    current=Depends(get_current_user),
):
    head = await file.read(2048)
    await file.seek(0)

    detected = _detect_mime_from_bytes(head)
    content_type = detected or (file.content_type or "application/octet-stream")

    allowed = {"image/png", "image/jpeg", "application/pdf"}
    if content_type not in allowed:
        raise HTTPException(status_code=415, detail=f"Unsupported type: {content_type}")

    ext = pathlib.Path(file.filename or "").suffix.lower()
    if ext not in {".png", ".jpg", ".jpeg", ".pdf"}:
        ext = {
            "image/png": ".png",
            "image/jpeg": ".jpg",
            "application/pdf": ".pdf",
        }.get(content_type, "")

    safe_name = f"{uuid.uuid4().hex}{ext}"
    out_path = UPLOAD_DIR / safe_name

    total = 0
    try:
        with out_path.open("wb") as f:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_UPLOAD_BYTES:
                    f.close()
                    out_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large (max {MAX_UPLOAD_BYTES // (1024 * 1024)} MB).",
                    )
                f.write(chunk)
    except HTTPException:
        raise
    except Exception:
        out_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Upload could not be saved.")

    return {"filename": safe_name, "content_type": content_type, "size_bytes": out_path.stat().st_size}
