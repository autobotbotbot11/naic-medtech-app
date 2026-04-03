from __future__ import annotations

import json
import re
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
    meta.pop("common_field_set_id", None)
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


def stable_form_schema_id(slug: str) -> str:
    return f"form.{slugify(slug or 'compat')}"


def normalize_form_schema(
    raw_schema: dict[str, Any],
    *,
    slug: str,
    name: str,
    form_order: int,
) -> dict[str, Any]:
    raw_schema = coerce_legacy_schema(raw_schema)
    form_id = stable_form_schema_id(slug)
    field_used: set[str] = set()
    section_used: set[str] = set()

    normalized: dict[str, Any] = {
        "id": form_id,
        "key": slug,
        "name": compact_text(name) or "Untitled Form",
        "order": form_order,
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


def serialize_form_location(definition: FormDefinition) -> dict[str, Any]:
    form_node = definition.library_node
    parent_node = form_node.parent if form_node is not None else None

    if parent_node is None:
        return {
            "location_name": "Top level",
            "location_path_label": "Top level",
            "location_node_key": None,
            "location_kind": "top_level",
        }

    path: list[str] = []
    cursor = parent_node
    while cursor is not None:
        path.append(compact_text(cursor.name) or "Untitled Folder")
        cursor = cursor.parent
    path.reverse()

    location_name = path[-1] if path else compact_text(parent_node.name) or "Untitled Folder"
    location_path_label = " / ".join(path) if path else location_name
    return {
        "location_name": location_name,
        "location_path_label": location_path_label,
        "location_node_key": compact_text(parent_node.node_key) or None,
        "location_kind": "folder",
    }


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

    location = serialize_form_location(definition)
    return {
        "slug": definition.slug,
        "name": definition.name,
        "location_name": location["location_name"],
        "location_path_label": location["location_path_label"],
        "location_node_key": location["location_node_key"],
        "location_kind": location["location_kind"],
        "library_parent_node_key": definition.library_parent_node_key,
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
        .options(
            selectinload(FormDefinition.versions),
            selectinload(FormDefinition.library_node).selectinload(LibraryNode.parent),
        )
    )


def list_container_choices(session: Session) -> list[dict[str, Any]]:
    tree = list_library_tree(session)
    choices: list[dict[str, Any]] = []

    def walk(nodes: list[dict[str, Any]], path: list[str]) -> None:
        for node in nodes:
            if compact_text(node.get("kind")) != "container" or node.get("archived"):
                continue
            current_path = [*path, compact_text(node.get("name")) or "Untitled Folder"]
            children = node.get("children", [])
            next_form_order = max((int(child.get("order") or 0) for child in children), default=0) + 1
            choices.append(
                {
                    "node_key": compact_text(node.get("id")),
                    "name": compact_text(node.get("name")) or "Untitled Folder",
                    "path_label": " / ".join(current_path),
                    "depth": len(path),
                    "order": int(node.get("order") or 999),
                    "next_form_order": next_form_order,
                }
            )
            walk(children, current_path)

    walk(tree, [])
    return choices


def list_form_choices(session: Session) -> list[dict[str, Any]]:
    tree = list_library_tree(session)
    choices: list[dict[str, Any]] = []

    def walk(nodes: list[dict[str, Any]], path: list[str]) -> None:
        for node in nodes:
            if node.get("archived"):
                continue
            kind = compact_text(node.get("kind"))
            if kind == "container":
                current_path = [*path, compact_text(node.get("name")) or "Untitled Folder"]
                walk(node.get("children", []), current_path)
                continue
            if kind != "form":
                continue
            form = node.get("form") or {}
            form_name = compact_text(form.get("name")) or compact_text(node.get("name")) or "Untitled Form"
            current_path = [*path, form_name]
            choices.append(
                {
                    "slug": compact_text(form.get("slug")),
                    "name": form_name,
                    "location_label": " / ".join(path) or "Top level",
                    "path_label": " / ".join(current_path),
                    "depth": len(path),
                    "order": int(node.get("order") or 1),
                    "current_version_number": int(form.get("current_version_number") or 1),
                }
            )

    walk(tree, [])
    return choices


def next_available_container_node_key(session: Session, preferred: str) -> str:
    base = f"container:{slugify(preferred or 'folder')}"
    key = base
    suffix = 2
    while session.scalar(select(LibraryNode.id).where(LibraryNode.node_key == key)) is not None:
        key = f"{base}_{suffix}"
        suffix += 1
    return key


def ensure_container_node(
    session: Session,
    name: str,
    parent_node_key: str | None = None,
) -> LibraryNode:
    container_name = compact_text(name) or "Untitled Folder"
    parent_key = compact_text(parent_node_key)
    parent_id: int | None = None

    if parent_key:
        parent = session.scalar(select(LibraryNode).where(LibraryNode.node_key == parent_key))
        if parent is not None and parent.kind == "container":
            parent_id = parent.id
            if parent.archived:
                parent.archived = False

    query = select(LibraryNode).where(
        LibraryNode.kind == "container",
        LibraryNode.name == container_name,
    )
    if parent_id is None:
        query = query.where(LibraryNode.parent_id.is_(None))
    else:
        query = query.where(LibraryNode.parent_id == parent_id)

    existing = session.scalar(query.order_by(LibraryNode.id))
    if existing is not None:
        if existing.archived:
            existing.archived = False
        return existing

    sibling_query = select(LibraryNode).where(LibraryNode.parent_id == parent_id) if parent_id is not None else select(LibraryNode).where(LibraryNode.parent_id.is_(None))
    next_order = max((node.node_order for node in session.scalars(sibling_query).all()), default=0) + 1
    container = LibraryNode(
        node_key=next_available_container_node_key(session, container_name),
        kind="container",
        name=container_name,
        parent_id=parent_id,
        node_order=next_order,
        archived=False,
    )
    session.add(container)
    session.flush()
    return container


def create_container(
    session: Session,
    name: str,
    parent_node_key: str | None = None,
) -> LibraryNode:
    container_name = compact_text(name)
    if not container_name:
        raise ValueError("Name the folder before you continue.")

    parent_key = compact_text(parent_node_key)
    parent_id: int | None = None
    if parent_key:
        parent = session.scalar(select(LibraryNode).where(LibraryNode.node_key == parent_key))
        if parent is None or parent.kind != "container":
            raise ValueError("Parent folder not found.")
        parent_id = parent.id

    existing_query = select(LibraryNode).where(
        LibraryNode.kind == "container",
        LibraryNode.name == container_name,
    )
    if parent_id is None:
        existing_query = existing_query.where(LibraryNode.parent_id.is_(None))
    else:
        existing_query = existing_query.where(LibraryNode.parent_id == parent_id)

    existing = session.scalar(existing_query.limit(1))
    if existing is not None:
        raise ValueError("A folder with this name already exists here.")

    container = ensure_container_node(session, container_name, parent_key or None)
    session.commit()
    return container


def get_container_or_none(session: Session, node_key: str) -> LibraryNode | None:
    key = compact_text(node_key)
    if not key:
        return None
    node = session.scalar(select(LibraryNode).where(LibraryNode.node_key == key))
    if node is None or node.kind != "container":
        return None
    return node


def next_node_order(session: Session, parent_id: int | None, *, exclude_node_id: int | None = None) -> int:
    query = (
        select(LibraryNode).where(LibraryNode.parent_id == parent_id)
        if parent_id is not None
        else select(LibraryNode).where(LibraryNode.parent_id.is_(None))
    )
    siblings = session.scalars(query).all()
    return max(
        (
            node.node_order
            for node in siblings
            if exclude_node_id is None or node.id != exclude_node_id
        ),
        default=0,
    ) + 1


def resolve_target_container(session: Session, parent_node_key: str | None) -> LibraryNode | None:
    target_key = compact_text(parent_node_key)
    if not target_key:
        return None
    target = get_container_or_none(session, target_key)
    if target is None:
        raise ValueError("Folder not found.")
    if target.archived:
        target.archived = False
    return target


def upsert_form_node_location(
    session: Session,
    definition: FormDefinition,
    *,
    parent_node_key: str | None,
    node_order: int | None = None,
) -> LibraryNode:
    target_parent = resolve_target_container(session, parent_node_key)
    target_parent_id = target_parent.id if target_parent is not None else None
    desired_order = int(node_order or 1)
    node_key = form_node_key(definition.slug)

    form_node = definition.library_node or session.scalar(
        select(LibraryNode).where(LibraryNode.form_definition_id == definition.id)
    )
    if form_node is None:
        form_node = session.scalar(select(LibraryNode).where(LibraryNode.node_key == node_key))

    if form_node is None:
        form_node = LibraryNode(
            node_key=node_key,
            kind="form",
            name=definition.name,
            parent_id=target_parent_id,
            node_order=desired_order,
            archived=False,
            form_definition_id=definition.id,
        )
        session.add(form_node)
        session.flush()
    else:
        form_node.kind = "form"
        form_node.name = definition.name
        form_node.parent_id = target_parent_id
        form_node.node_order = desired_order
        form_node.archived = False
        form_node.form_definition_id = definition.id

    definition.library_parent_node_key = target_parent.node_key if target_parent is not None else None
    return form_node


def new_definition_compat_shell(
    *,
    slug: str,
    name: str,
    parent_node_key: str | None = None,
) -> FormDefinition:
    return FormDefinition(
        slug=slug,
        name=name,
        library_parent_node_key=parent_node_key,
        common_field_set_id=None,
    )


def sync_definition_legacy_location_fields(
    session: Session,
    definition: FormDefinition,
    *,
    form_node: LibraryNode | None = None,
) -> bool:
    node = form_node or definition.library_node or session.scalar(
        select(LibraryNode).where(LibraryNode.form_definition_id == definition.id)
    )
    if node is None:
        return False

    parent_container = None
    if node.parent_id is not None:
        parent_container = session.scalar(select(LibraryNode).where(LibraryNode.id == node.parent_id))

    derived_parent_key = parent_container.node_key if parent_container is not None and parent_container.kind == "container" else None
    derived_group_name = parent_container.name if parent_container is not None and parent_container.kind == "container" else definition.name
    derived_group_kind = "category" if parent_container is not None and parent_container.kind == "container" else "standalone_form"
    derived_group_order = int(parent_container.node_order or 999) if parent_container is not None and parent_container.kind == "container" else 999
    derived_form_order = int(node.node_order or 1)

    changed = False
    if compact_text(definition.library_parent_node_key) != compact_text(derived_parent_key):
        definition.library_parent_node_key = derived_parent_key
        changed = True
    if compact_text(definition.group_name) != compact_text(derived_group_name):
        definition.group_name = derived_group_name
        changed = True
    if compact_text(definition.group_kind) != derived_group_kind:
        definition.group_kind = derived_group_kind
        changed = True
    if int(definition.group_order or 999) != derived_group_order:
        definition.group_order = derived_group_order
        changed = True
    if int(definition.form_order or 1) != derived_form_order:
        definition.form_order = derived_form_order
        changed = True
    if definition.common_field_set_id is not None:
        definition.common_field_set_id = None
        changed = True

    return changed


def legacy_definition_location_hint(definition: FormDefinition) -> dict[str, Any]:
    group_name = compact_text(definition.group_name) or definition.name or "Untitled Form"
    group_kind = compact_text(definition.group_kind) or "category"
    return {
        "legacy_parent_name": group_name,
        "legacy_parent_order": int(definition.group_order or 999),
        "legacy_form_order": int(definition.form_order or 1),
        "legacy_is_standalone": group_kind == "standalone_form",
    }


def container_is_inside(session: Session, candidate: LibraryNode | None, ancestor_id: int) -> bool:
    current = candidate
    while current is not None:
        if current.id == ancestor_id:
            return True
        if current.parent_id is None:
            return False
        current = session.scalar(select(LibraryNode).where(LibraryNode.id == current.parent_id))
    return False


def descendant_container_keys(session: Session, node_key: str) -> set[str]:
    container = get_container_or_none(session, node_key)
    if container is None:
        return set()

    nodes = session.scalars(
        select(LibraryNode).where(LibraryNode.kind == "container")
    ).all()
    children_by_parent: dict[int | None, list[LibraryNode]] = {}
    for node in nodes:
        children_by_parent.setdefault(node.parent_id, []).append(node)

    descendants: set[str] = set()

    def walk(parent_id: int) -> None:
        for child in children_by_parent.get(parent_id, []):
            descendants.add(child.node_key)
            walk(child.id)

    walk(container.id)
    return descendants


def list_move_target_choices(
    session: Session,
    *,
    exclude_node_key: str | None = None,
) -> list[dict[str, Any]]:
    excluded = {compact_text(exclude_node_key)} if compact_text(exclude_node_key) else set()
    if exclude_node_key:
        excluded.update(descendant_container_keys(session, exclude_node_key))
    return [
        option
        for option in list_container_choices(session)
        if option["node_key"] not in excluded
    ]


def move_container(
    session: Session,
    node_key: str,
    parent_node_key: str | None,
) -> LibraryNode:
    ensure_library_tree(session)
    container = get_container_or_none(session, node_key)
    if container is None:
        raise ValueError("Folder not found.")

    target_parent = resolve_target_container(session, parent_node_key)
    target_parent_id = target_parent.id if target_parent is not None else None

    if target_parent is not None:
        if target_parent.id == container.id:
            raise ValueError("A folder cannot be moved inside itself.")
        if container_is_inside(session, target_parent, container.id):
            raise ValueError("A folder cannot be moved inside one of its own child folders.")

    duplicate_query = select(LibraryNode).where(
        LibraryNode.kind == "container",
        LibraryNode.name == container.name,
        LibraryNode.id != container.id,
    )
    if target_parent_id is None:
        duplicate_query = duplicate_query.where(LibraryNode.parent_id.is_(None))
    else:
        duplicate_query = duplicate_query.where(LibraryNode.parent_id == target_parent_id)

    duplicate = session.scalar(duplicate_query.limit(1))
    if duplicate is not None:
        raise ValueError("A folder with this name already exists there.")

    if container.parent_id != target_parent_id:
        container.parent_id = target_parent_id
        container.node_order = next_node_order(session, target_parent_id, exclude_node_id=container.id)

    if container.archived:
        container.archived = False

    session.commit()
    ensure_library_tree(session)
    session.expire_all()
    moved = get_container_or_none(session, node_key)
    if moved is None:
        raise ValueError("Folder not found.")
    return moved


def move_form(
    session: Session,
    slug: str,
    parent_node_key: str | None,
) -> FormDefinition:
    ensure_library_tree(session)
    definition = session.scalar(
        select(FormDefinition)
        .where(FormDefinition.slug == slug)
        .options(selectinload(FormDefinition.versions), selectinload(FormDefinition.library_node))
    )
    if definition is None:
        raise ValueError("Form not found.")

    target_parent = resolve_target_container(session, parent_node_key)
    target_parent_id = target_parent.id if target_parent is not None else None
    form_node = definition.library_node or session.scalar(
        select(LibraryNode).where(LibraryNode.form_definition_id == definition.id)
    )
    if form_node is None:
        raise ValueError("Form node not found.")

    desired_order = (
        int(form_node.node_order or 1)
        if form_node.parent_id == target_parent_id
        else next_node_order(session, target_parent_id, exclude_node_id=form_node.id)
    )
    upsert_form_node_location(
        session,
        definition,
        parent_node_key=target_parent.node_key if target_parent is not None else None,
        node_order=desired_order,
    )
    sync_definition_legacy_location_fields(session, definition, form_node=form_node)

    session.commit()
    ensure_library_tree(session)
    session.expire_all()
    moved = get_form_or_none(session, slug)
    if moved is None:
        raise ValueError("Form not found.")
    return moved


def rename_container(
    session: Session,
    node_key: str,
    name: str,
) -> LibraryNode:
    container = get_container_or_none(session, node_key)
    if container is None:
        raise ValueError("Folder not found.")

    container_name = compact_text(name)
    if not container_name:
        raise ValueError("Name the folder before you continue.")

    existing_query = select(LibraryNode).where(
        LibraryNode.kind == "container",
        LibraryNode.name == container_name,
        LibraryNode.id != container.id,
    )
    if container.parent_id is None:
        existing_query = existing_query.where(LibraryNode.parent_id.is_(None))
    else:
        existing_query = existing_query.where(LibraryNode.parent_id == container.parent_id)

    existing = session.scalar(existing_query.limit(1))
    if existing is not None:
        raise ValueError("A folder with this name already exists here.")

    container.name = container_name
    if container.archived:
        container.archived = False
    session.commit()
    return container


def delete_container(session: Session, node_key: str) -> None:
    container = get_container_or_none(session, node_key)
    if container is None:
        raise ValueError("Folder not found.")

    child_node = session.scalar(select(LibraryNode.id).where(LibraryNode.parent_id == container.id).limit(1))
    if child_node is not None:
        raise ValueError("This folder is not empty yet. Move or remove the items inside it first.")

    session.delete(container)
    session.commit()


def resolve_form_location_metadata(
    session: Session,
    *,
    form_name: str,
    location_name: str,
    library_parent_node_key: str | None,
    library_new_container_name: str | None,
    existing_definition: FormDefinition | None = None,
) -> dict[str, Any]:
    resolved_parent_key = compact_text(library_parent_node_key) or None
    pending_container_name = compact_text(library_new_container_name) or None
    explicit_location_name = compact_text(location_name)
    compact_form_name = compact_text(form_name)

    if pending_container_name:
        resolved_parent_key = ensure_container_node(session, pending_container_name, resolved_parent_key).node_key
    elif (
        not resolved_parent_key
        and explicit_location_name
        and explicit_location_name not in {"Top level", "Unassigned", compact_form_name}
    ):
        resolved_parent_key = ensure_container_node(session, explicit_location_name, None).node_key

    target_parent = resolve_target_container(session, resolved_parent_key)
    existing_node = existing_definition.library_node if existing_definition is not None else None

    if target_parent is not None:
        if existing_node is not None and existing_node.parent_id == target_parent.id:
            resolved_form_order = int(existing_node.node_order or 1)
        else:
            resolved_form_order = next_node_order(
                session,
                target_parent.id,
                exclude_node_id=existing_node.id if existing_node is not None else None,
            )

        return {
            "resolved_parent_key": target_parent.node_key,
            "resolved_parent_name": target_parent.name,
            "resolved_parent_order": int(target_parent.node_order or 999),
            "resolved_form_order": resolved_form_order,
        }

    if existing_node is not None and existing_node.parent_id is None:
        resolved_form_order = int(existing_node.node_order or 1)
    else:
        resolved_form_order = next_node_order(
            session,
            None,
            exclude_node_id=existing_node.id if existing_node is not None else None,
        )

    return {
        "resolved_parent_key": None,
        "resolved_parent_name": None,
        "resolved_parent_order": 999,
        "resolved_form_order": resolved_form_order,
    }


def container_node_key(name: str) -> str:
    return f"container:{slugify(name or 'unassigned')}"


def form_node_key(slug: str) -> str:
    return f"form:{slug}"


def ensure_library_tree(session: Session) -> None:
    Base.metadata.create_all(bind=engine)
    definitions = session.scalars(
        select(FormDefinition)
        .options(selectinload(FormDefinition.versions), selectinload(FormDefinition.library_node))
        .order_by(FormDefinition.name, FormDefinition.id)
    ).all()

    nodes = session.scalars(select(LibraryNode)).all()
    nodes_by_key = {node.node_key: node for node in nodes}
    changed = False

    for definition in definitions:
        node_key = form_node_key(definition.slug)
        form_node = nodes_by_key.get(node_key)
        legacy_hint = legacy_definition_location_hint(definition)
        parent_id = None
        parent_node_key: str | None = None
        explicit_parent_key = compact_text(definition.library_parent_node_key)
        desired_form_order = (
            int(form_node.node_order or legacy_hint["legacy_form_order"])
            if form_node is not None
            else int(legacy_hint["legacy_form_order"])
        )

        if explicit_parent_key:
            explicit_parent = nodes_by_key.get(explicit_parent_key)
            if explicit_parent is not None and explicit_parent.kind == "container":
                if explicit_parent.archived:
                    explicit_parent.archived = False
                    changed = True
                parent_id = explicit_parent.id
                parent_node_key = explicit_parent.node_key
        elif form_node is not None:
            parent_id = form_node.parent_id
            if form_node.parent_id is not None:
                parent = session.scalar(select(LibraryNode).where(LibraryNode.id == form_node.parent_id))
                if parent is not None and parent.kind == "container":
                    parent_node_key = parent.node_key

        if parent_id is None and form_node is None and not legacy_hint["legacy_is_standalone"]:
            container = ensure_container_node(session, legacy_hint["legacy_parent_name"])
            if container.node_order != legacy_hint["legacy_parent_order"]:
                container.node_order = legacy_hint["legacy_parent_order"]
            nodes_by_key[container.node_key] = container
            changed = True
            parent_id = container.id
            parent_node_key = container.node_key

        if form_node is None:
            form_node = upsert_form_node_location(
                session,
                definition,
                parent_node_key=parent_node_key,
                node_order=desired_form_order,
            )
            nodes_by_key[node_key] = form_node
            changed = True
        else:
            original_state = (
                form_node.kind,
                form_node.name,
                form_node.parent_id,
                int(form_node.node_order or 1),
                bool(form_node.archived),
                form_node.form_definition_id,
            )
            upsert_form_node_location(
                session,
                definition,
                parent_node_key=parent_node_key,
                node_order=desired_form_order,
            )
            current_state = (
                form_node.kind,
                form_node.name,
                form_node.parent_id,
                int(form_node.node_order or 1),
                bool(form_node.archived),
                form_node.form_definition_id,
            )
            if current_state != original_state:
                changed = True

        if sync_definition_legacy_location_fields(session, definition, form_node=form_node):
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
            parent_container: LibraryNode | None = None
            parent_node_key: str | None = None

            if group_kind != "standalone_form":
                parent_container = ensure_container_node(session, group_name)
                if parent_container.node_order != group_order:
                    parent_container.node_order = group_order
                parent_node_key = parent_container.node_key

            for form in group.get("forms", []):
                slug = compact_text(form.get("key")) or slugify(form.get("name"))
                name = compact_text(form.get("name")) or "Untitled Form"
                form_order = int(form.get("order") or 1)
                normalized_schema = normalize_form_schema(
                    form,
                    slug=slug,
                    name=name,
                    form_order=form_order,
                )

                definition = new_definition_compat_shell(
                    slug=slug,
                    name=name,
                    parent_node_key=parent_node_key,
                )
                session.add(definition)
                session.flush()
                upsert_form_node_location(
                    session,
                    definition,
                    parent_node_key=parent_node_key,
                    node_order=form_order,
                )
                sync_definition_legacy_location_fields(session, definition)

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
    location_meta = resolve_form_location_metadata(
        session,
        form_name=name,
        location_name=compact_text(payload.location_name),
        library_parent_node_key=payload.library_parent_node_key,
        library_new_container_name=payload.library_new_container_name,
    )
    normalized_schema = normalize_form_schema(
        raw_schema,
        slug=slug,
        name=name,
        form_order=location_meta["resolved_form_order"],
    )
    stored_block_schema = normalize_block_schema_storage(payload.form_schema, normalized_schema=normalized_schema)

    definition = new_definition_compat_shell(
        slug=slug,
        name=name,
        parent_node_key=location_meta["resolved_parent_key"],
    )
    session.add(definition)
    session.flush()
    upsert_form_node_location(
        session,
        definition,
        parent_node_key=location_meta["resolved_parent_key"],
        node_order=location_meta["resolved_form_order"],
    )
    sync_definition_legacy_location_fields(session, definition)

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
    location_meta = resolve_form_location_metadata(
        session,
        form_name=name,
        location_name=compact_text(payload.location_name),
        library_parent_node_key=payload.library_parent_node_key,
        library_new_container_name=payload.library_new_container_name,
        existing_definition=definition,
    )
    normalized_schema = normalize_form_schema(
        raw_schema,
        slug=definition.slug,
        name=name,
        form_order=location_meta["resolved_form_order"],
    )
    stored_block_schema = normalize_block_schema_storage(payload.form_schema, normalized_schema=normalized_schema)

    next_version = (current_version(definition).version_number if current_version(definition) else 0) + 1
    for version in definition.versions:
        version.is_current = False

    definition.name = name
    upsert_form_node_location(
        session,
        definition,
        parent_node_key=location_meta["resolved_parent_key"],
        node_order=location_meta["resolved_form_order"],
    )
    sync_definition_legacy_location_fields(session, definition)
    definition.common_field_set_id = None

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
