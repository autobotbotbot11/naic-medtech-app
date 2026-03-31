from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class FormSavePayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    slug: str | None = None
    name: str = ""
    group_name: str
    group_kind: Literal["category", "standalone_form"] = "category"
    group_order: int = 999
    form_order: int = 1
    summary: str | None = None
    form_schema: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def move_schema_key(cls, value: Any) -> Any:
        if isinstance(value, dict) and "form_schema" not in value and "schema" in value:
            normalized = dict(value)
            normalized["form_schema"] = normalized.pop("schema")
            return normalized
        return value
