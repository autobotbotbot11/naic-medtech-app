from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class FormDefinition(Base):
    __tablename__ = "form_definitions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    group_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    group_kind: Mapped[str | None] = mapped_column(String(40), nullable=True)
    group_order: Mapped[int | None] = mapped_column(Integer, nullable=True)
    form_order: Mapped[int | None] = mapped_column(Integer, nullable=True)
    library_parent_node_key: Mapped[str | None] = mapped_column(String(160), nullable=True)
    common_field_set_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
    )

    versions: Mapped[list["FormVersion"]] = relationship(
        back_populates="form",
        cascade="all, delete-orphan",
        order_by="FormVersion.version_number",
    )
    library_node: Mapped["LibraryNode | None"] = relationship(
        back_populates="form_definition",
        uselist=False,
    )


class FormVersion(Base):
    __tablename__ = "form_versions"
    __table_args__ = (UniqueConstraint("form_id", "version_number", name="uq_form_version"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    form_id: Mapped[int] = mapped_column(ForeignKey("form_definitions.id"))
    version_number: Mapped[int] = mapped_column(Integer)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    schema_json: Mapped[str] = mapped_column(Text)
    block_schema_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(40), default="builder")
    is_current: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    form: Mapped[FormDefinition] = relationship(back_populates="versions")


class LibraryNode(Base):
    __tablename__ = "library_nodes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    node_key: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    kind: Mapped[str] = mapped_column(String(40))
    name: Mapped[str] = mapped_column(String(255))
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("library_nodes.id"), nullable=True)
    node_order: Mapped[int] = mapped_column(Integer, default=1)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    form_definition_id: Mapped[int | None] = mapped_column(
        ForeignKey("form_definitions.id"),
        nullable=True,
        unique=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
    )

    parent: Mapped["LibraryNode | None"] = relationship(
        "LibraryNode",
        remote_side="LibraryNode.id",
        back_populates="children",
    )
    children: Mapped[list["LibraryNode"]] = relationship(
        "LibraryNode",
        back_populates="parent",
    )
    form_definition: Mapped[FormDefinition | None] = relationship(
        back_populates="library_node",
    )
