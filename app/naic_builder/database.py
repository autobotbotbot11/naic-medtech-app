from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import DATA_RUNTIME_DIR, DB_PATH


DATA_RUNTIME_DIR.mkdir(parents=True, exist_ok=True)


class Base(DeclarativeBase):
    pass


engine = create_engine(f"sqlite:///{DB_PATH}", future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def ensure_runtime_schema() -> None:
    Base.metadata.create_all(bind=engine)
    with engine.begin() as connection:
        columns = {
            str(row[1])
            for row in connection.exec_driver_sql("PRAGMA table_info(form_versions)").all()
        }
        if "block_schema_json" not in columns:
            connection.exec_driver_sql("ALTER TABLE form_versions ADD COLUMN block_schema_json TEXT")
        form_definition_columns = {
            str(row[1])
            for row in connection.exec_driver_sql("PRAGMA table_info(form_definitions)").all()
        }
        if "library_parent_node_key" not in form_definition_columns:
            connection.exec_driver_sql("ALTER TABLE form_definitions ADD COLUMN library_parent_node_key TEXT")


def get_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
