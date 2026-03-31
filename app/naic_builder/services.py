from __future__ import annotations

import json
import re
from collections import OrderedDict
from datetime import timezone
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .config import REFERENCE_SCHEMA_PATH
from .models import FormDefinition, FormVersion
from .schemas import FormSavePayload


def load_reference_schema() -> dict[str, Any]:
    return json.loads(REFERENCE_SCHEMA_PATH.read_text(encoding="utf-8"))


def slugify(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    return normalized or "item"


def compact_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalize_notes(raw_notes: Any) -> list[str]:
    notes: list[str] = []
    for note in raw_notes or []:
        text = compact_text(note)
        if text and text not in notes:
            notes.append(text)
    return notes


def unique_key(base: str, used: set[str]) -> str:
    key = slugify(base)
    candidate = key
    suffix = 2
    while candidate in used:
        candidate = f"{key}_{suffix}"
        suffix += 1
    used.add(candidate)
    return candidate


def normalize_options(raw_options: Any, field_id: str) -> list[dict[str, Any]]:
    options = raw_options or []
    normalized: list[dict[str, Any]] = []
    used: set[str] = set()

    for index, option in enumerate(options, start=1):
        if isinstance(option, dict):
            name = compact_text(option.get("name"))
            key_source = compact_text(option.get("key")) or name
        else:
            name = compact_text(option)
            key_source = name
        if not name:
            continue
        key = unique_key(key_source, used)
        normalized.append(
            {
                "id": f"{field_id}.{key}",
                "key": key,
                "name": name,
                "order": index,
            }
        )

    return normalized


def normalize_field(field: dict[str, Any], parent_id: str, order: int, used_keys: set[str]) -> dict[str, Any]:
    name = compact_text(field.get("name")) or f"Untitled Field {order}"
    key = unique_key(compact_text(field.get("key")) or name, used_keys)
    field_id = f"{parent_id}.{key}"
    kind = "field_group" if compact_text(field.get("kind")) == "field_group" else "field"

    normalized: dict[str, Any] = {
        "id": field_id,
        "key": key,
        "name": name,
        "kind": kind,
        "order": order,
    }

    notes = normalize_notes(field.get("notes"))
    if notes:
        normalized["notes"] = notes

    source = field.get("source")
    if isinstance(source, dict) and source:
        normalized["source"] = source

    if kind == "field_group":
        child_used: set[str] = set()
        normalized["fields"] = [
            normalize_field(child, field_id, child_order, child_used)
            for child_order, child in enumerate(field.get("fields") or [], start=1)
            if isinstance(child, dict)
        ]
        return normalized

    options = normalize_options(field.get("options"), field_id)
    control = compact_text(field.get("control")) or ("select" if options else "input")
    data_type = compact_text(field.get("data_type")) or ("enum" if control == "select" else "text")

    normalized["control"] = control
    normalized["data_type"] = data_type

    unit_hint = compact_text(field.get("unit_hint"))
    if unit_hint:
        normalized["unit_hint"] = unit_hint

    normal_value = compact_text(field.get("normal_value"))
    if normal_value:
        normalized["normal_value"] = normal_value

    if options:
        normalized["options"] = options

    return normalized


def normalize_section(section: dict[str, Any], form_id: str, order: int, used_keys: set[str]) -> dict[str, Any]:
    name = compact_text(section.get("name")) or f"Untitled Section {order}"
    key = unique_key(compact_text(section.get("key")) or name, used_keys)
    section_id = f"{form_id}.{key}"
    field_used: set[str] = set()

    normalized: dict[str, Any] = {
        "id": section_id,
        "key": key,
        "name": name,
        "order": order,
        "fields": [
            normalize_field(field, section_id, field_order, field_used)
            for field_order, field in enumerate(section.get("fields") or [], start=1)
            if isinstance(field, dict)
        ],
    }

    notes = normalize_notes(section.get("notes"))
    if notes:
        normalized["notes"] = notes

    source = section.get("source")
    if isinstance(source, dict) and source:
        normalized["source"] = source

    return normalized


def normalize_form_schema(
    raw_schema: dict[str, Any],
    *,
    slug: str,
    name: str,
    form_order: int,
    group_name: str,
) -> dict[str, Any]:
    form_id = f"{slugify(group_name)}.{slug}"
    field_used: set[str] = set()
    section_used: set[str] = set()

    normalized: dict[str, Any] = {
        "id": form_id,
        "key": slug,
        "name": compact_text(name) or "Untitled Form",
        "order": form_order,
        "common_field_set_id": compact_text(raw_schema.get("common_field_set_id")) or "default_lab_request",
        "fields": [
            normalize_field(field, form_id, field_order, field_used)
            for field_order, field in enumerate(raw_schema.get("fields") or [], start=1)
            if isinstance(field, dict)
        ],
        "sections": [
            normalize_section(section, form_id, section_order, section_used)
            for section_order, section in enumerate(raw_schema.get("sections") or [], start=1)
            if isinstance(section, dict)
        ],
    }

    notes = normalize_notes(raw_schema.get("notes"))
    if notes:
        normalized["notes"] = notes

    source = raw_schema.get("source")
    if isinstance(source, dict) and source:
        normalized["source"] = source

    return normalized


def current_version(definition: FormDefinition) -> FormVersion | None:
    for version in definition.versions:
        if version.is_current:
            return version
    return definition.versions[-1] if definition.versions else None


def serialize_form(definition: FormDefinition) -> dict[str, Any]:
    version = current_version(definition)
    if version is None:
        raise ValueError(f"Form '{definition.slug}' has no versions.")

    return {
        "slug": definition.slug,
        "name": definition.name,
        "group_name": definition.group_name,
        "group_kind": definition.group_kind,
        "group_order": definition.group_order,
        "form_order": definition.form_order,
        "common_field_set_id": definition.common_field_set_id,
        "current_version_number": version.version_number,
        "summary": version.summary,
        "updated_at": definition.updated_at.astimezone(timezone.utc).isoformat(),
        "schema": json.loads(version.schema_json),
    }


def get_form_or_none(session: Session, slug: str) -> FormDefinition | None:
    return session.scalar(
        select(FormDefinition)
        .where(FormDefinition.slug == slug)
        .options(selectinload(FormDefinition.versions))
    )


def list_grouped_forms(session: Session) -> list[dict[str, Any]]:
    definitions = session.scalars(
        select(FormDefinition)
        .options(selectinload(FormDefinition.versions))
        .order_by(FormDefinition.group_order, FormDefinition.form_order, FormDefinition.name)
    ).all()

    grouped: OrderedDict[tuple[str, str, int], dict[str, Any]] = OrderedDict()
    for definition in definitions:
        key = (definition.group_name, definition.group_kind, definition.group_order)
        group = grouped.setdefault(
            key,
            {
                "name": definition.group_name,
                "kind": definition.group_kind,
                "order": definition.group_order,
                "forms": [],
            },
        )
        version = current_version(definition)
        group["forms"].append(
            {
                "slug": definition.slug,
                "name": definition.name,
                "form_order": definition.form_order,
                "current_version_number": version.version_number if version else 0,
                "updated_at": definition.updated_at.astimezone(timezone.utc).isoformat(),
            }
        )

    return list(grouped.values())


def next_available_slug(session: Session, preferred: str) -> str:
    base = slugify(preferred)
    slug = base
    suffix = 2
    while session.scalar(select(FormDefinition.id).where(FormDefinition.slug == slug)) is not None:
        slug = f"{base}_{suffix}"
        suffix += 1
    return slug


def ensure_reference_seed(session: Session) -> None:
    existing = session.scalar(select(FormDefinition.id).limit(1))
    if existing is not None:
        return

    reference = load_reference_schema()
    try:
        for group in reference.get("groups", []):
            group_name = compact_text(group.get("name"))
            group_kind = compact_text(group.get("kind")) or "category"
            group_order = int(group.get("order") or 999)

            for form in group.get("forms", []):
                slug = compact_text(form.get("key")) or slugify(form.get("name"))
                name = compact_text(form.get("name")) or "Untitled Form"
                form_order = int(form.get("order") or 1)
                normalized_schema = normalize_form_schema(
                    form,
                    slug=slug,
                    name=name,
                    form_order=form_order,
                    group_name=group_name,
                )

                definition = FormDefinition(
                    slug=slug,
                    name=name,
                    group_name=group_name,
                    group_kind=group_kind,
                    group_order=group_order,
                    form_order=form_order,
                    common_field_set_id=normalized_schema.get("common_field_set_id"),
                )
                session.add(definition)
                session.flush()

                version = FormVersion(
                    form_id=definition.id,
                    version_number=1,
                    summary="Seeded from current reference schema.",
                    schema_json=json.dumps(normalized_schema, ensure_ascii=False),
                    source="seed",
                    is_current=True,
                )
                session.add(version)

        session.commit()
    except IntegrityError:
        session.rollback()
        if session.scalar(select(FormDefinition.id).limit(1)) is None:
            raise


def create_form(session: Session, payload: FormSavePayload) -> dict[str, Any]:
    raw_schema = payload.form_schema
    slug = next_available_slug(
        session,
        payload.slug or raw_schema.get("key") or payload.name or "untitled_form",
    )
    name = compact_text(payload.name or raw_schema.get("name")) or "Untitled Form"
    normalized_schema = normalize_form_schema(
        raw_schema,
        slug=slug,
        name=name,
        form_order=payload.form_order,
        group_name=payload.group_name,
    )

    definition = FormDefinition(
        slug=slug,
        name=name,
        group_name=compact_text(payload.group_name) or "Unassigned",
        group_kind=payload.group_kind,
        group_order=payload.group_order,
        form_order=payload.form_order,
        common_field_set_id=normalized_schema.get("common_field_set_id"),
    )
    session.add(definition)
    session.flush()

    version = FormVersion(
        form_id=definition.id,
        version_number=1,
        summary=compact_text(payload.summary) or "Initial builder version.",
        schema_json=json.dumps(normalized_schema, ensure_ascii=False),
        source="builder",
        is_current=True,
    )
    session.add(version)
    session.commit()
    return serialize_form(get_form_or_none(session, slug))


def update_form(session: Session, slug: str, payload: FormSavePayload) -> dict[str, Any]:
    definition = get_form_or_none(session, slug)
    if definition is None:
        raise KeyError(slug)

    raw_schema = payload.form_schema
    name = compact_text(payload.name or raw_schema.get("name")) or definition.name
    normalized_schema = normalize_form_schema(
        raw_schema,
        slug=definition.slug,
        name=name,
        form_order=payload.form_order,
        group_name=payload.group_name,
    )

    next_version = (current_version(definition).version_number if current_version(definition) else 0) + 1
    for version in definition.versions:
        version.is_current = False

    definition.name = name
    definition.group_name = compact_text(payload.group_name) or definition.group_name
    definition.group_kind = payload.group_kind
    definition.group_order = payload.group_order
    definition.form_order = payload.form_order
    definition.common_field_set_id = normalized_schema.get("common_field_set_id")

    version = FormVersion(
        form_id=definition.id,
        version_number=next_version,
        summary=compact_text(payload.summary) or f"Builder update v{next_version}.",
        schema_json=json.dumps(normalized_schema, ensure_ascii=False),
        source="builder",
        is_current=True,
    )
    session.add(version)
    session.commit()
    return serialize_form(get_form_or_none(session, slug))
