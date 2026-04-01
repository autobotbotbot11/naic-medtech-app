from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
APP_DIR = ROOT / "app"

if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from naic_builder.config import DB_PATH
from naic_builder.database import Base, SessionLocal, engine
from naic_builder.services import ensure_reference_seed


def main() -> None:
    if DB_PATH.exists():
        DB_PATH.unlink()

    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        ensure_reference_seed(session)

    print(f"Reset runtime DB at: {DB_PATH}")


if __name__ == "__main__":
    main()
