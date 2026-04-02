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
from .database import Base, engine
from .models import FormDefinition, FormVersion, LibraryNode
from .schemas import FormSavePayload


def load_reference_schema() -> dict[str, Any]:
    return json.loads(REFERENCE_SCHEMA_PATH.read_text(encoding="utf-8"))




def slugify(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    return normalized or "item"


def compact_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalize_items(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


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


def infer_block_field_type(field: dict[str, Any]) -> str:
    control = compact_text(field.get("control")) or "input"
    data_type = compact_text(field.get("data_type")) or "text"
    if control == "select":
        return "select"
    if data_type == "date_or_datetime":
        return "datetime"
    return data_type or "text"


def legacy_field_to_block(field: dict[str, Any]) -> dict[str, Any]:
    field_id = compact_text(field.get("id")) or f"blk_{slugify(field.get('name') or 'field')}"
    kind = "field_group" if compact_text(field.get("kind")) == "field_group" else "field"
    props: dict[str, Any] = {
        "key": compact_text(field.get("key")) or slugify(field.get("name") or field_id),
        "order": int(field.get("order") or 1),
    }

    notes = normalize_notes(field.get("notes"))
    if notes:
        props["notes"] = notes

    source = field.get("source")
    if isinstance(source, dict) and source:
        props["source"] = source

    if kind == "field_group":
        return {
            "id": field_id,
            "kind": "field_group",
            "name": compact_text(field.get("name")) or "Untitled Group",
            "props": props,
            "children": [
                legacy_field_to_block(child)
                for child in normalize_items(field.get("fields"))
                if isinstance(child, dict)
            ],
        }

    props["field_type"] = infer_block_field_type(field)
    props["control"] = compact_text(field.get("control")) or "input"
    props["data_type"] = compact_text(field.get("data_type")) or "text"
    props["required"] = bool(field.get("required") or False)

    unit_hint = compact_text(field.get("unit_hint"))
    if unit_hint:
        props["unit_hint"] = unit_hint

    normal_value = compact_text(field.get("normal_value"))
    if normal_value:
        props["normal_value"] = normal_value

    options = []
    for option in normalize_items(field.get("options")):
        if not isinstance(option, dict):
            continue
        label = compact_text(option.get("name"))
        if not label:
            continue
        options.append(
            {
                "id": compact_text(option.get("id")) or f"{field_id}.{slugify(label)}",
                "key": compact_text(option.get("key")) or slugify(label),
                "label": label,
                "order": int(option.get("order") or len(options) + 1),
            }
        )
    if options:
        props["options"] = options

    return {
        "id": field_id,
        "kind": "field",
        "name": compact_text(field.get("name")) or "Untitled Field",
        "props": props,
        "children": [],
    }


def legacy_section_to_block(section: dict[str, Any]) -> dict[str, Any]:
    section_id = compact_text(section.get("id")) or f"blk_{slugify(section.get('name') or 'section')}"
    props: dict[str, Any] = {
        "key": compact_text(section.get("key")) or slugify(section.get("name") or section_id),
        "order": int(section.get("order") or 1),
    }

    notes = normalize_notes(section.get("notes"))
    if notes:
        props["notes"] = notes

    source = section.get("source")
    if isinstance(source, dict) and source:
        props["source"] = source

    return {
        "id": section_id,
        "kind": "section",
        "name": compact_text(section.get("name")) or "Untitled Section",
        "props": props,
        "children": [
            legacy_field_to_block(field)
            for field in normalize_items(section.get("fields"))
            if isinstance(field, dict)
        ],
    }


def legacy_schema_to_block_schema(raw_schema: dict[str, Any]) -> dict[str, Any]:
    meta: dict[str, Any] = {
        "common_field_set_id": compact_text(raw_schema.get("common_field_set_id")) or "default_lab_request",
        "legacy_form_id": compact_text(raw_schema.get("id")),
        "legacy_form_key": compact_text(raw_schema.get("key")),
        "legacy_order": int(raw_schema.get("order") or 1),
    }

    notes = normalize_notes(raw_schema.get("notes"))
    if notes:
        meta["notes"] = notes

    source = raw_schema.get("source")
    if isinstance(source, dict) and source:
        meta["source"] = source

    blocks = [
        *[
            legacy_field_to_block(field)
            for field in normalize_items(raw_schema.get("fields"))
            if isinstance(field, dict)
        ],
        *[
            legacy_section_to_block(section)
            for section in normalize_items(raw_schema.get("sections"))
            if isinstance(section, dict)
        ],
    ]

    return {
        "schema_version": 1,
        "source_kind": "compat_legacy_fields_sections",
        "meta": meta,
        "blocks": blocks,
    }


def block_field_to_legacy_field(block: dict[str, Any], parent_id: str, order: int, used_keys: set[str]) -> dict[str, Any]:
    kind = compact_text(block.get("kind"))
    if kind not in {"field", "field_group"}:
        raise ValueError(f"Unsupported block kind for legacy field bridge: {kind or 'unknown'}")

    props = block.get("props") if isinstance(block.get("props"), dict) else {}
    raw_field: dict[str, Any] = {
        "id": compact_text(block.get("id")) or "",
        "key": compact_text(props.get("key")) or compact_text(block.get("name")),
        "name": compact_text(block.get("name")) or "Untitled Field",
        "kind": "field_group" if kind == "field_group" else "field",
        "order": int(props.get("order") or order),
    }

    notes = normalize_notes(props.get("notes"))
    if notes:
        raw_field["notes"] = notes

    source = props.get("source")
    if isinstance(source, dict) and source:
        raw_field["source"] = source

    if kind == "field_group":
        child_used: set[str] = set()
        raw_field["fields"] = [
            block_field_to_legacy_field(child, raw_field.get("id") or parent_id, child_order, child_used)
            for child_order, child in enumerate(normalize_items(block.get("children")), start=1)
            if isinstance(child, dict) and compact_text(child.get("kind")) in {"field", "field_group"}
        ]
        return normalize_field(raw_field, parent_id, order, used_keys)

    field_type = compact_text(props.get("field_type")) or "text"
    if field_type == "select":
        control = "select"
        data_type = "enum"
    elif field_type in {"date", "time", "datetime", "number", "text", "textarea"}:
        control = "input"
        data_type = field_type
    else:
        control = compact_text(props.get("control")) or "input"
        data_type = compact_text(props.get("data_type")) or "text"

    raw_field["control"] = control
    raw_field["data_type"] = data_type

    unit_hint = compact_text(props.get("unit_hint"))
    if unit_hint:
        raw_field["unit_hint"] = unit_hint

    normal_value = compact_text(props.get("normal_value"))
    if normal_value:
        raw_field["normal_value"] = normal_value

    options = []
    for option in normalize_items(props.get("options")):
        if not isinstance(option, dict):
            continue
        label = compact_text(option.get("label") or option.get("name"))
        if not label:
            continue
        options.append(
            {
                "id": compact_text(option.get("id")) or "",
                "key": compact_text(option.get("key")) or slugify(label),
                "name": label,
                "order": int(option.get("order") or len(options) + 1),
            }
        )
    if options:
        raw_field["options"] = options

    return normalize_field(raw_field, parent_id, order, used_keys)


def block_section_to_legacy_section(block: dict[str, Any], form_id: str, order: int, used_keys: set[str]) -> dict[str, Any]:
    if compact_text(block.get("kind")) != "section":
        raise ValueError("Only section blocks can be bridged into legacy sections.")

    props = block.get("props") if isinstance(block.get("props"), dict) else {}
    raw_section: dict[str, Any] = {
        "id": compact_text(block.get("id")) or "",
        "key": compact_text(props.get("key")) or compact_text(block.get("name")),
        "name": compact_text(block.get("name")) or "Untitled Section",
        "order": int(props.get("order") or order),
        "fields": [],
    }

    notes = normalize_notes(props.get("notes"))
    if notes:
        raw_section["notes"] = notes

    source = props.get("source")
    if isinstance(source, dict) and source:
        raw_section["source"] = source

    field_used: set[str] = set()
    raw_section["fields"] = [
        block_field_to_legacy_field(child, compact_text(raw_section.get("id")) or form_id, child_order, field_used)
        for child_order, child in enumerate(normalize_items(block.get("children")), start=1)
        if isinstance(child, dict) and compact_text(child.get("kind")) in {"field", "field_group"}
    ]

    return normalize_section(raw_section, form_id, order, used_keys)


def block_schema_to_legacy_schema(raw_schema: dict[str, Any]) -> dict[str, Any]:
    blocks = normalize_items(raw_schema.get("blocks"))
    meta = raw_schema.get("meta") if isinstance(raw_schema.get("meta"), dict) else {}
    form_id = compact_text(meta.get("legacy_form_id")) or "form.compat"
    used_field_keys: set[str] = set()
    used_section_keys: set[str] = set()

    fields: list[dict[str, Any]] = []
    sections: list[dict[str, Any]] = []
    for order, block in enumerate(blocks, start=1):
        if not isinstance(block, dict):
            continue
        kind = compact_text(block.get("kind"))
        if kind in {"field", "field_group"}:
            fields.append(block_field_to_legacy_field(block, form_id, order, used_field_keys))
            continue
        if kind == "section":
            sections.append(block_section_to_legacy_section(block, form_id, len(sections) + 1, used_section_keys))
            continue
        if kind in {"note", "divider", "table", "repeater", "columns"}:
            continue
        raise ValueError(f"Unsupported block kind for current compatibility bridge: {kind or 'unknown'}")

    legacy: dict[str, Any] = {
        "common_field_set_id": compact_text(meta.get("common_field_set_id")) or "default_lab_request",
        "fields": fields,
        "sections": sections,
    }

    notes = normalize_notes(meta.get("notes"))
    if notes:
        legacy["notes"] = notes

    source = meta.get("source")
    if isinstance(source, dict) and source:
        legacy["source"] = source

    return legacy


def coerce_legacy_schema(raw_schema: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(raw_schema, dict):
        return {}
    if "blocks" in raw_schema and "fields" not in raw_schema and "sections" not in raw_schema:
        return block_schema_to_legacy_schema(raw_schema)
    return raw_schema


def normalize_block_schema_storage(
    raw_schema: dict[str, Any],
    *,
    normalized_schema: dict[str, Any],
) -> dict[str, Any]:
    if isinstance(raw_schema, dict) and "blocks" in raw_schema and "fields" not in raw_schema and "sections" not in raw_schema:
        block_schema = json.loads(json.dumps(raw_schema))
    else:
        block_schema = legacy_schema_to_block_schema(normalized_schema)

    block_schema["schema_version"] = int(block_schema.get("schema_version") or 1)
    block_schema["source_kind"] = compact_text(block_schema.get("source_kind")) or "compat_legacy_fields_sections"
    block_schema["blocks"] = normalize_items(block_schema.get("blocks"))

    meta = block_schema.get("meta") if isinstance(block_schema.get("meta"), dict) else {}
    meta["common_field_set_id"] = compact_text(normalized_schema.get("common_field_set_id")) or "default_lab_request"
    meta["legacy_form_id"] = compact_text(normalized_schema.get("id"))
    meta["legacy_form_key"] = compact_text(normalized_schema.get("key"))
    meta["legacy_order"] = int(normalized_schema.get("order") or 1)

    notes = normalize_notes(normalized_schema.get("notes"))
    if notes:
        meta["notes"] = notes
    else:
        meta.pop("notes", None)

    source = normalized_schema.get("source")
    if isinstance(source, dict) and source:
        meta["source"] = source
    else:
        meta.pop("source", None)

    block_schema["meta"] = meta
    return block_schema


def normalize_form_schema(
    raw_schema: dict[str, Any],
    *,
    slug: str,
    name: str,
    form_order: int,
    group_name: str,
) -> dict[str, Any]:
    raw_schema = coerce_legacy_schema(raw_schema)
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

    schema = json.loads(version.schema_json)
    if compact_text(version.block_schema_json):
        try:
            block_schema = json.loads(version.block_schema_json)
        except json.JSONDecodeError:
            block_schema = legacy_schema_to_block_schema(schema)
    else:
        block_schema = legacy_schema_to_block_schema(schema)

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
        "schema": schema,
        "block_schema": block_schema,
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


def split_library_groups(session: Session) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    grouped_forms = list_grouped_forms(session)
    reference = load_reference_schema()
    reference_group_names = {
        compact_text(group.get("name")).lower()
        for group in reference.get("groups", [])
        if compact_text(group.get("name"))
    }

    official_groups: list[dict[str, Any]] = []
    extra_groups: list[dict[str, Any]] = []

    for group in grouped_forms:
        token = compact_text(group.get("name")).lower()
        if token in reference_group_names:
            official_groups.append(group)
        else:
            extra_groups.append(group)

    return official_groups, extra_groups


def container_node_key(name: str) -> str:
    return f"container:{slugify(name or 'unassigned')}"


def form_node_key(slug: str) -> str:
    return f"form:{slug}"


def ensure_library_tree(session: Session) -> None:
    Base.metadata.create_all(bind=engine)
    definitions = session.scalars(
        select(FormDefinition)
        .options(selectinload(FormDefinition.versions), selectinload(FormDefinition.library_node))
        .order_by(FormDefinition.group_order, FormDefinition.form_order, FormDefinition.name)
    ).all()

    nodes = session.scalars(select(LibraryNode)).all()
    nodes_by_key = {node.node_key: node for node in nodes}
    changed = False

    for definition in definitions:
        group_name = compact_text(definition.group_name) or "Unassigned"
        group_kind = compact_text(definition.group_kind) or "category"
        parent_id = None

        if group_kind != "standalone_form":
            container_key = container_node_key(group_name)
            container = nodes_by_key.get(container_key)
            if container is None:
                container = LibraryNode(
                    node_key=container_key,
                    kind="container",
                    name=group_name,
                    node_order=int(definition.group_order or 999),
                    archived=False,
                )
                session.add(container)
                session.flush()
                nodes_by_key[container_key] = container
                changed = True
            else:
                if container.kind != "container":
                    container.kind = "container"
                    changed = True
                if container.name != group_name:
                    container.name = group_name
                    changed = True
                if container.node_order != int(definition.group_order or 999):
                    container.node_order = int(definition.group_order or 999)
                    changed = True
                if container.archived:
                    container.archived = False
                    changed = True
            parent_id = container.id

        node_key = form_node_key(definition.slug)
        form_node = nodes_by_key.get(node_key)
        if form_node is None:
            form_node = LibraryNode(
                node_key=node_key,
                kind="form",
                name=definition.name,
                parent_id=parent_id,
                node_order=int(definition.form_order or 1),
                archived=False,
                form_definition_id=definition.id,
            )
            session.add(form_node)
            nodes_by_key[node_key] = form_node
            changed = True
            continue

        if form_node.kind != "form":
            form_node.kind = "form"
            changed = True
        if form_node.name != definition.name:
            form_node.name = definition.name
            changed = True
        if form_node.parent_id != parent_id:
            form_node.parent_id = parent_id
            changed = True
        if form_node.node_order != int(definition.form_order or 1):
            form_node.node_order = int(definition.form_order or 1)
            changed = True
        if form_node.archived:
            form_node.archived = False
            changed = True
        if form_node.form_definition_id != definition.id:
            form_node.form_definition_id = definition.id
            changed = True

    if changed:
        session.commit()


def list_library_tree(session: Session) -> list[dict[str, Any]]:
    ensure_library_tree(session)
    nodes = session.scalars(
        select(LibraryNode)
        .options(selectinload(LibraryNode.form_definition).selectinload(FormDefinition.versions))
        .order_by(LibraryNode.parent_id, LibraryNode.node_order, LibraryNode.name)
    ).all()

    children_by_parent: dict[int | None, list[LibraryNode]] = {}
    for node in nodes:
        children_by_parent.setdefault(node.parent_id, []).append(node)

    def serialize_node(node: LibraryNode) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "id": node.node_key,
            "kind": node.kind,
            "name": node.name,
            "order": node.node_order,
            "archived": node.archived,
            "children": [serialize_node(child) for child in children_by_parent.get(node.id, [])],
        }
        if node.kind == "form" and node.form_definition is not None:
            version = current_version(node.form_definition)
            payload["form"] = {
                "slug": node.form_definition.slug,
                "name": node.form_definition.name,
                "current_version_number": version.version_number if version else 0,
            }
        return payload

    return [serialize_node(node) for node in children_by_parent.get(None, [])]


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
                    block_schema_json=json.dumps(legacy_schema_to_block_schema(normalized_schema), ensure_ascii=False),
                    source="seed",
                    is_current=True,
                )
                session.add(version)

        session.commit()
        ensure_library_tree(session)
    except IntegrityError:
        session.rollback()
        if session.scalar(select(FormDefinition.id).limit(1)) is None:
            raise


def ensure_block_schema_storage(session: Session) -> None:
    versions = session.scalars(select(FormVersion)).all()
    changed = False

    for version in versions:
        if compact_text(version.block_schema_json):
            continue
        schema = json.loads(version.schema_json)
        version.block_schema_json = json.dumps(legacy_schema_to_block_schema(schema), ensure_ascii=False)
        changed = True

    if changed:
        session.commit()


def create_form(session: Session, payload: FormSavePayload) -> dict[str, Any]:
    raw_schema = coerce_legacy_schema(payload.form_schema)
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
    stored_block_schema = normalize_block_schema_storage(payload.form_schema, normalized_schema=normalized_schema)

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
        block_schema_json=json.dumps(stored_block_schema, ensure_ascii=False),
        source="builder",
        is_current=True,
    )
    session.add(version)
    session.commit()
    ensure_library_tree(session)
    session.expire_all()
    return serialize_form(get_form_or_none(session, slug))


def update_form(session: Session, slug: str, payload: FormSavePayload) -> dict[str, Any]:
    definition = get_form_or_none(session, slug)
    if definition is None:
        raise KeyError(slug)

    raw_schema = coerce_legacy_schema(payload.form_schema)
    name = compact_text(payload.name or raw_schema.get("name")) or definition.name
    normalized_schema = normalize_form_schema(
        raw_schema,
        slug=definition.slug,
        name=name,
        form_order=payload.form_order,
        group_name=payload.group_name,
    )
    stored_block_schema = normalize_block_schema_storage(payload.form_schema, normalized_schema=normalized_schema)

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
        block_schema_json=json.dumps(stored_block_schema, ensure_ascii=False),
        source="builder",
        is_current=True,
    )
    session.add(version)
    session.commit()
    ensure_library_tree(session)
    session.expire_all()
    return serialize_form(get_form_or_none(session, slug))
