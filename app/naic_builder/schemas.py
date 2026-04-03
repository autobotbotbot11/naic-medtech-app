from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


def compact_optional_text(value: Any) -> str:
    return str(value or "").strip()


def normalize_form_save_payload_aliases(value: Any) -> Any:
    if not isinstance(value, dict):
        return value

    normalized = dict(value)
    if "form_schema" not in normalized and "schema" in normalized:
        normalized["form_schema"] = normalized.pop("schema")
    return normalized


class FormSavePayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    slug: str | None = None
    name: str = ""
    location_name: str | None = None
    library_parent_node_key: str | None = None
    library_new_container_name: str | None = None
    summary: str | None = None
    form_schema: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def move_schema_key(cls, value: Any) -> Any:
        return normalize_form_save_payload_aliases(value)
