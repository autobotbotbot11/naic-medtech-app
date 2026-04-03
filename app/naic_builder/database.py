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


def migrate_form_definitions_legacy_columns_nullable(connection) -> None:
    connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
    try:
        connection.exec_driver_sql(
            """
            CREATE TABLE form_definitions_new (
                id INTEGER NOT NULL PRIMARY KEY,
                slug VARCHAR(120) NOT NULL,
                name VARCHAR(255) NOT NULL,
                group_name VARCHAR(255),
                group_kind VARCHAR(40),
                group_order INTEGER,
                form_order INTEGER,
                library_parent_node_key TEXT,
                common_field_set_id VARCHAR(120),
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
                group_name,
                group_kind,
                group_order,
                form_order,
                library_parent_node_key,
                common_field_set_id,
                created_at,
                updated_at
            )
            SELECT
                id,
                slug,
                name,
                group_name,
                group_kind,
                group_order,
                form_order,
                library_parent_node_key,
                common_field_set_id,
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
        legacy_nullable_targets = ("group_name", "group_kind", "group_order", "form_order")
        if any(int(form_definition_info[column][3] or 0) == 1 for column in legacy_nullable_targets if column in form_definition_info):
            migrate_form_definitions_legacy_columns_nullable(connection)


def get_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
