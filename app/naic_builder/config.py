from __future__ import annotations

import os
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
APP_DIR = ROOT_DIR / "app"
PACKAGE_DIR = APP_DIR / "naic_builder"
TEMPLATES_DIR = PACKAGE_DIR / "templates"
STATIC_DIR = PACKAGE_DIR / "static"
DATA_SOURCE_DIR = ROOT_DIR / "data" / "source"
DATA_RUNTIME_DIR = ROOT_DIR / "data" / "runtime"
RECORD_UPLOADS_DIR = DATA_RUNTIME_DIR / "uploads" / "records"
CLINIC_UPLOADS_DIR = DATA_RUNTIME_DIR / "uploads" / "clinic"
USER_UPLOADS_DIR = DATA_RUNTIME_DIR / "uploads" / "users"
DB_PATH = DATA_RUNTIME_DIR / "naic_medtech.db"
REFERENCE_SCHEMA_PATH = ROOT_DIR / "artifacts" / "schema" / "naic_medtech_app_schema.json"

APP_TITLE = "NAIC Medtech Builder"
SESSION_SECRET = os.environ.get("NAIC_SESSION_SECRET") or "naic-medtech-dev-session-secret"
