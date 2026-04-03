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


def migrate_form_definitions_tree_first_shape(connection) -> None:
    connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
    try:
        connection.exec_driver_sql(
            """
            CREATE TABLE form_definitions_new (
                id INTEGER NOT NULL PRIMARY KEY,
                slug VARCHAR(120) NOT NULL,
                name VARCHAR(255) NOT NULL,
                library_parent_node_key TEXT,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL
            )
            """
        )
        connection.exec_driver_sql(
            """
            INSERT INTO form_definitions_new (
                id,
                slug,
                name,
                library_parent_node_key,
                created_at,
                updated_at
            )
            SELECT
                id,
                slug,
                name,
                library_parent_node_key,
                created_at,
                updated_at
            FROM form_definitions
            """
        )
        connection.exec_driver_sql("DROP TABLE form_definitions")
        connection.exec_driver_sql("ALTER TABLE form_definitions_new RENAME TO form_definitions")
        connection.exec_driver_sql("CREATE UNIQUE INDEX ix_form_definitions_slug ON form_definitions (slug)")
    finally:
        connection.exec_driver_sql("PRAGMA foreign_keys=ON")


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
        form_definition_info = {
            str(row[1]): row
            for row in connection.exec_driver_sql("PRAGMA table_info(form_definitions)").all()
        }
        needs_tree_first_rebuild = any(
            column in form_definition_info
            for column in ("group_name", "group_kind", "common_field_set_id", "group_order", "form_order")
        )
        if needs_tree_first_rebuild:
            migrate_form_definitions_tree_first_shape(connection)


def get_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
