from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


class FormSavePayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    slug: str | None = None
    name: str = ""
    location_name: str | None = None
    group_name: str = ""
    library_parent_node_key: str | None = None
    library_new_container_name: str | None = None
    summary: str | None = None
    form_schema: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def move_schema_key(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value

        normalized = dict(value)
        if "form_schema" not in normalized and "schema" in normalized:
            normalized["form_schema"] = normalized.pop("schema")

        location_name = str(normalized.get("location_name") or "").strip()
        group_name = str(normalized.get("group_name") or "").strip()
        if location_name and not group_name:
            normalized["group_name"] = location_name
        elif group_name and "location_name" not in normalized:
            normalized["location_name"] = group_name

        return normalized
