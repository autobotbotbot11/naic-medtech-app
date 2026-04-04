from __future__ import annotations

from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
APP_DIR = ROOT_DIR / "app"
PACKAGE_DIR = APP_DIR / "naic_builder"
TEMPLATES_DIR = PACKAGE_DIR / "templates"
STATIC_DIR = PACKAGE_DIR / "static"
DATA_SOURCE_DIR = ROOT_DIR / "data" / "source"
DATA_RUNTIME_DIR = ROOT_DIR / "data" / "runtime"
RECORD_UPLOADS_DIR = DATA_RUNTIME_DIR / "uploads" / "records"
DB_PATH = DATA_RUNTIME_DIR / "naic_medtech.db"
REFERENCE_SCHEMA_PATH = ROOT_DIR / "artifacts" / "schema" / "naic_medtech_app_schema.json"

APP_TITLE = "NAIC Medtech Builder"
