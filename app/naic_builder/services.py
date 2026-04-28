from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import secrets
from pathlib import Path
from datetime import timezone
from typing import Any
from uuid import uuid4

from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from .config import CLINIC_UPLOADS_DIR, RECORD_UPLOADS_DIR, REFERENCE_SCHEMA_PATH, USER_UPLOADS_DIR
from .database import Base, engine
from .models import ClinicProfile, FormDefinition, FormVersion, LibraryNode, Record, RecordAsset, User, utc_now
from .schemas import (
    AccountRequestPayload,
    ClinicProfilePayload,
    FormSavePayload,
    LoginPayload,
    PasswordChangePayload,
    RecordCreatePayload,
    RecordUpdatePayload,
    SetupAdminPayload,
    UserCreatePayload,
)

ACTIVE_BLOCK_SCHEMA_SOURCE = "builder_blocks_v1"
LEGACY_BLOCK_SCHEMA_SOURCE = "compat_legacy_fields_sections"
ALLOWED_IMAGE_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_RECORD_IMAGE_BYTES = 10 * 1024 * 1024
MAX_CLINIC_LOGO_BYTES = 5 * 1024 * 1024
MAX_USER_AVATAR_BYTES = 2 * 1024 * 1024


def load_reference_schema() -> dict[str, Any]:
    return json.loads(REFERENCE_SCHEMA_PATH.read_text(encoding="utf-8"))




def slugify(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    return normalized or "item"


def compact_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalize_email(value: Any) -> str:
    return compact_text(value).lower()


def normalize_login_id(value: Any) -> str:
    return slugify(compact_text(value))


def validate_email_format(email: str) -> bool:
    return bool(re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email))


def validate_role(value: Any) -> str:
    role = compact_text(value).lower()
    return role if role in {"admin", "medtech"} else "medtech"


def validate_user_status(value: Any) -> str:
    status = compact_text(value).lower()
    return status if status in {"pending", "active", "disabled"} else "pending"


def password_hash_value(password: str) -> str:
    salt = secrets.token_bytes(16)
    iterations = 120_000
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return "pbkdf2_sha256${iterations}${salt}${digest}".format(
        iterations=iterations,
        salt=base64.b64encode(salt).decode("ascii"),
        digest=base64.b64encode(digest).decode("ascii"),
    )


def verify_password_hash(password_hash: str | None, password: str) -> bool:
    stored = compact_text(password_hash)
    if not stored:
        return False
    try:
        algorithm, iterations_text, salt_text, digest_text = stored.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        iterations = int(iterations_text)
        salt = base64.b64decode(salt_text.encode("ascii"))
        expected = base64.b64decode(digest_text.encode("ascii"))
    except (TypeError, ValueError, base64.binascii.Error):
        return False
    actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(actual, expected)


def validate_password_strength(password: str) -> None:
    if len(password or "") < 8:
        raise ValueError("Use at least 8 characters for the password.")


def derive_login_id(*, full_name: str, email: str, requested_login_id: str = "") -> str:
    requested = normalize_login_id(requested_login_id)
    if requested:
        return requested
    email_local = normalize_email(email).split("@", 1)[0]
    email_candidate = normalize_login_id(email_local)
    if email_candidate:
        return email_candidate
    return normalize_login_id(full_name) or "user"


def next_available_login_id(session: Session, base_login_id: str) -> str:
    base = normalize_login_id(base_login_id) or "user"
    candidate = base
    suffix = 2
    while session.scalar(select(User.id).where(User.login_id == candidate)) is not None:
        candidate = f"{base}{suffix}"
        suffix += 1
    return candidate


def has_any_users(session: Session) -> bool:
    return session.scalar(select(User.id).limit(1)) is not None


def has_any_admin_users(session: Session) -> bool:
    return session.scalar(
        select(User.id).where(User.role == "admin", User.status == "active").limit(1)
    ) is not None


def count_active_admin_users(session: Session) -> int:
    return int(
        session.scalar(
            select(func.count(User.id)).where(User.role == "admin", User.status == "active")
        )
        or 0
    )


def get_user_or_none(session: Session, user_id: int) -> User | None:
    return session.scalar(select(User).where(User.id == user_id))


def get_user_by_identifier(session: Session, identifier: str) -> User | None:
    normalized = compact_text(identifier).lower()
    if not normalized:
        return None
    return session.scalar(
        select(User).where(
            or_(
                func.lower(User.login_id) == normalized,
                func.lower(User.email) == normalized,
            )
        )
    )


def serialize_user(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "email": user.email,
        "login_id": user.login_id,
        "full_name": user.full_name,
        "role": user.role,
        "status": user.status,
        "must_change_password": bool(user.must_change_password),
        "avatar_path": user.avatar_path,
        "avatar_original_filename": compact_text(user.avatar_original_filename),
        "avatar_mime_type": compact_text(user.avatar_mime_type),
        "has_avatar": bool(compact_text(user.avatar_path)),
        "created_at": user.created_at.astimezone(timezone.utc).isoformat(),
        "updated_at": user.updated_at.astimezone(timezone.utc).isoformat(),
    }


def get_or_create_clinic_profile(session: Session) -> ClinicProfile:
    profile = session.scalar(select(ClinicProfile).limit(1))
    if profile is not None:
        return profile
    profile = ClinicProfile(clinic_name="")
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


def serialize_clinic_profile(profile: ClinicProfile) -> dict[str, Any]:
    return {
        "id": profile.id,
        "clinic_name": compact_text(profile.clinic_name),
        "address": compact_text(profile.address),
        "contact_number": compact_text(profile.contact_number),
        "contact_email": compact_text(profile.contact_email),
        "logo_path": profile.logo_path,
        "logo_original_filename": compact_text(profile.logo_original_filename),
        "logo_mime_type": compact_text(profile.logo_mime_type),
        "has_logo": bool(compact_text(profile.logo_path)),
        "created_at": profile.created_at.astimezone(timezone.utc).isoformat(),
        "updated_at": profile.updated_at.astimezone(timezone.utc).isoformat(),
    }


def get_clinic_profile(session: Session) -> dict[str, Any]:
    return serialize_clinic_profile(get_or_create_clinic_profile(session))


def list_users(session: Session, *, status: str | None = None) -> list[dict[str, Any]]:
    query = select(User).order_by(User.created_at.desc(), User.id.desc())
    normalized_status = validate_user_status(status) if compact_text(status) else ""
    if normalized_status:
        query = query.where(User.status == normalized_status)
    users = session.scalars(query).all()
    return [serialize_user(user) for user in users]


def count_users(session: Session, *, status: str | None = None) -> int:
    query = select(func.count(User.id))
    normalized_status = validate_user_status(status) if compact_text(status) else ""
    if normalized_status:
        query = query.where(User.status == normalized_status)
    return int(session.scalar(query) or 0)


def save_user(session: Session, user: User) -> User:
    session.add(user)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise ValueError("This email or login ID is already in use.") from exc
    session.refresh(user)
    return user


def request_account(session: Session, payload: AccountRequestPayload) -> dict[str, Any]:
    full_name = compact_text(payload.full_name)
    email = normalize_email(payload.email)
    validate_password_strength(payload.password)
    if not full_name:
        raise ValueError("Enter the staff member's full name.")
    if not validate_email_format(email):
        raise ValueError("Enter a valid email address.")
    login_id = next_available_login_id(
        session,
        derive_login_id(full_name=full_name, email=email, requested_login_id=payload.login_id or ""),
    )
    user = User(
        email=email,
        login_id=login_id,
        full_name=full_name,
        role="medtech",
        status="pending",
        password_hash=password_hash_value(payload.password),
        must_change_password=False,
    )
    return serialize_user(save_user(session, user))


def create_initial_admin(session: Session, payload: SetupAdminPayload) -> dict[str, Any]:
    if has_any_users(session):
        raise ValueError("Initial setup is already complete.")
    full_name = compact_text(payload.full_name)
    email = normalize_email(payload.email)
    validate_password_strength(payload.password)
    if not full_name:
        raise ValueError("Enter the admin's full name.")
    if not validate_email_format(email):
        raise ValueError("Enter a valid email address.")
    login_id = next_available_login_id(
        session,
        derive_login_id(full_name=full_name, email=email, requested_login_id=payload.login_id or ""),
    )
    user = User(
        email=email,
        login_id=login_id,
        full_name=full_name,
        role="admin",
        status="active",
        password_hash=password_hash_value(payload.password),
        must_change_password=False,
    )
    return serialize_user(save_user(session, user))


def create_user_account(session: Session, payload: UserCreatePayload) -> dict[str, Any]:
    full_name = compact_text(payload.full_name)
    email = normalize_email(payload.email)
    validate_password_strength(payload.password)
    if not full_name:
        raise ValueError("Enter the staff member's full name.")
    if not validate_email_format(email):
        raise ValueError("Enter a valid email address.")
    login_id = next_available_login_id(
        session,
        derive_login_id(full_name=full_name, email=email, requested_login_id=payload.login_id or ""),
    )
    user = User(
        email=email,
        login_id=login_id,
        full_name=full_name,
        role=validate_role(payload.role),
        status="active",
        password_hash=password_hash_value(payload.password),
        must_change_password=True,
    )
    return serialize_user(save_user(session, user))


def approve_user_account(session: Session, user_id: int, *, role: str) -> dict[str, Any]:
    user = get_user_or_none(session, user_id)
    if user is None:
        raise KeyError(user_id)
    user.role = validate_role(role)
    user.status = "active"
    return serialize_user(save_user(session, user))


def update_user_status(session: Session, user_id: int, *, status: str) -> dict[str, Any]:
    user = get_user_or_none(session, user_id)
    if user is None:
        raise KeyError(user_id)
    next_status = validate_user_status(status)
    if next_status == "disabled" and user.role == "admin" and user.status == "active" and count_active_admin_users(session) <= 1:
        raise ValueError("Keep at least one active admin account.")
    user.status = next_status
    return serialize_user(save_user(session, user))


def authenticate_user(session: Session, payload: LoginPayload) -> dict[str, Any]:
    user = get_user_by_identifier(session, payload.identifier)
    if user is None:
        raise ValueError("The email or login ID and password do not match.")
    if not verify_password_hash(user.password_hash, payload.password):
        raise ValueError("The email or login ID and password do not match.")
    if user.status == "pending":
        raise ValueError("This account is still waiting for admin approval.")
    if user.status == "disabled":
        raise ValueError("This account is currently disabled. Ask an admin for access.")
    if user.status != "active":
        raise ValueError("This account is not active yet.")
    return serialize_user(user)


def change_user_password(
    session: Session,
    user_id: int,
    payload: PasswordChangePayload,
    *,
    require_current_password: bool = True,
) -> dict[str, Any]:
    user = get_user_or_none(session, user_id)
    if user is None:
        raise KeyError(user_id)
    if require_current_password and not verify_password_hash(user.password_hash, payload.current_password):
        raise ValueError("The current password is incorrect.")
    validate_password_strength(payload.new_password)
    user.password_hash = password_hash_value(payload.new_password)
    user.must_change_password = False
    return serialize_user(save_user(session, user))


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
                "is_normal": bool(option.get("is_normal")) if isinstance(option, dict) else False,
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

    reference_text = compact_text(field.get("reference_text") or field.get("normal_value"))
    if reference_text:
        normalized["reference_text"] = reference_text
        normalized["normal_value"] = reference_text

    normal_min = compact_text(field.get("normal_min"))
    if normal_min:
        normalized["normal_min"] = normal_min

    normal_max = compact_text(field.get("normal_max"))
    if normal_max:
        normalized["normal_max"] = normal_max

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

    props["control"] = compact_text(field.get("control")) or "input"
    props["data_type"] = compact_text(field.get("data_type")) or "text"
    props["required"] = bool(field.get("required") or False)

    unit_hint = compact_text(field.get("unit_hint"))
    if unit_hint:
        props["unit_hint"] = unit_hint

    reference_text = compact_text(field.get("reference_text") or field.get("normal_value"))
    if reference_text:
        props["reference_text"] = reference_text

    normal_min = compact_text(field.get("normal_min"))
    if normal_min:
        props["normal_min"] = normal_min

    normal_max = compact_text(field.get("normal_max"))
    if normal_max:
        props["normal_max"] = normal_max

    options = []
    for option in normalize_items(field.get("options")):
        if not isinstance(option, dict):
            continue
        name = compact_text(option.get("name"))
        if not name:
            continue
        options.append(
            {
                "id": compact_text(option.get("id")) or f"{field_id}.{slugify(name)}",
                "key": compact_text(option.get("key")) or slugify(name),
                "name": name,
                "order": int(option.get("order") or len(options) + 1),
                "is_normal": bool(option.get("is_normal")),
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


def build_block_schema_from_legacy_storage(raw_schema: dict[str, Any]) -> dict[str, Any]:
    meta: dict[str, Any] = {
        "form_id": compact_text(raw_schema.get("id")),
        "form_key": compact_text(raw_schema.get("key")),
        "form_order": int(raw_schema.get("order") or 1),
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
        "source_kind": LEGACY_BLOCK_SCHEMA_SOURCE,
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

    control = compact_text(props.get("control")) or "input"
    data_type = compact_text(props.get("data_type")) or "text"
    if control == "select" or data_type == "enum":
        control = "select"
        data_type = "enum"
    else:
        control = "input"
        data_type = data_type or "text"

    raw_field["control"] = control
    raw_field["data_type"] = data_type

    unit_hint = compact_text(props.get("unit_hint"))
    if unit_hint:
        raw_field["unit_hint"] = unit_hint

    reference_text = compact_text(props.get("reference_text") or props.get("normal_value"))
    if reference_text:
        raw_field["reference_text"] = reference_text
        raw_field["normal_value"] = reference_text

    normal_min = compact_text(props.get("normal_min"))
    if normal_min:
        raw_field["normal_min"] = normal_min

    normal_max = compact_text(props.get("normal_max"))
    if normal_max:
        raw_field["normal_max"] = normal_max

    options = []
    for option in normalize_items(props.get("options")):
        if not isinstance(option, dict):
            continue
        name = compact_text(option.get("name"))
        if not name:
            continue
        options.append(
            {
                "id": compact_text(option.get("id")) or "",
                "key": compact_text(option.get("key")) or slugify(name),
                "name": name,
                "order": int(option.get("order") or len(options) + 1),
                "is_normal": bool(option.get("is_normal")),
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


def build_legacy_storage_schema_from_blocks(raw_schema: dict[str, Any]) -> dict[str, Any]:
    blocks = normalize_items(raw_schema.get("blocks"))
    meta = raw_schema.get("meta") if isinstance(raw_schema.get("meta"), dict) else {}
    form_id = compact_text(meta.get("form_id")) or "form.compat"
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


def normalize_block_option_props(raw_options: Any) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []

    for index, option in enumerate(normalize_items(raw_options), start=1):
        if isinstance(option, dict):
            normalized_option = dict(option)
            name = compact_text(normalized_option.get("name") or normalized_option.get("label"))
            if not name:
                continue
            normalized_option["name"] = name
            normalized_option.pop("label", None)
            normalized_option["key"] = compact_text(normalized_option.get("key")) or slugify(name) or f"option_{index}"
            normalized_option["order"] = int(normalized_option.get("order") or index)
            normalized_option["is_normal"] = bool(normalized_option.get("is_normal"))
            normalized.append(normalized_option)
            continue

        name = compact_text(option)
        if not name:
            continue
        normalized.append(
            {
                "name": name,
                "key": slugify(name) or f"option_{index}",
                "order": index,
                "is_normal": False,
            }
        )

    return normalized


def normalize_active_block_storage_node(node: dict[str, Any]) -> bool:
    if not isinstance(node, dict):
        return False

    changed = False
    props = node.get("props") if isinstance(node.get("props"), dict) else None
    if isinstance(props, dict):
        if "field_type" in props:
            props.pop("field_type", None)
            changed = True

        reference_text = compact_text(props.get("reference_text") or props.get("normal_value"))
        if reference_text:
            if props.get("reference_text") != reference_text:
                props["reference_text"] = reference_text
                changed = True
        elif "reference_text" in props:
            props.pop("reference_text", None)
            changed = True

        if "normal_value" in props:
            props.pop("normal_value", None)
            changed = True

        normal_min = compact_text(props.get("normal_min"))
        if normal_min:
            if props.get("normal_min") != normal_min:
                props["normal_min"] = normal_min
                changed = True
        elif "normal_min" in props:
            props.pop("normal_min", None)
            changed = True

        normal_max = compact_text(props.get("normal_max"))
        if normal_max:
            if props.get("normal_max") != normal_max:
                props["normal_max"] = normal_max
                changed = True
        elif "normal_max" in props:
            props.pop("normal_max", None)
            changed = True

        if "options" in props:
            normalized_options = normalize_block_option_props(props.get("options"))
            if normalized_options:
                if normalized_options != props.get("options"):
                    props["options"] = normalized_options
                    changed = True
            else:
                props.pop("options", None)
                changed = True

    for child in normalize_items(node.get("children")):
        if normalize_active_block_storage_node(child):
            changed = True

    return changed


def normalize_active_block_storage_schema(block_schema: dict[str, Any]) -> bool:
    if not isinstance(block_schema, dict):
        return False

    changed = False
    blocks = normalize_items(block_schema.get("blocks"))
    if block_schema.get("blocks") != blocks:
        block_schema["blocks"] = blocks
        changed = True

    for block in blocks:
        if normalize_active_block_storage_node(block):
            changed = True

    return changed


def build_block_storage_payload(
    raw_schema: dict[str, Any],
    *,
    legacy_storage_schema: dict[str, Any],
) -> dict[str, Any]:
    if isinstance(raw_schema, dict) and "blocks" in raw_schema and "fields" not in raw_schema and "sections" not in raw_schema:
        block_schema = json.loads(json.dumps(raw_schema))
        source_kind = ACTIVE_BLOCK_SCHEMA_SOURCE
    else:
        block_schema = build_block_schema_from_legacy_storage(legacy_storage_schema)
        source_kind = LEGACY_BLOCK_SCHEMA_SOURCE

    block_schema["schema_version"] = int(block_schema.get("schema_version") or 1)
    block_schema["source_kind"] = source_kind
    block_schema["blocks"] = normalize_items(block_schema.get("blocks"))
    normalize_active_block_storage_schema(block_schema)

    meta = block_schema.get("meta") if isinstance(block_schema.get("meta"), dict) else {}
    meta.pop("common_field_set_id", None)
    meta["form_id"] = compact_text(legacy_storage_schema.get("id"))
    meta["form_key"] = compact_text(legacy_storage_schema.get("key"))
    meta["form_order"] = int(legacy_storage_schema.get("order") or 1)
    meta.pop("legacy_form_id", None)
    meta.pop("legacy_form_key", None)
    meta.pop("legacy_order", None)

    notes = normalize_notes(legacy_storage_schema.get("notes"))
    if notes:
        meta["notes"] = notes
    else:
        meta.pop("notes", None)

    source = legacy_storage_schema.get("source")
    if isinstance(source, dict) and source:
        meta["source"] = source
    else:
        meta.pop("source", None)

    block_schema["meta"] = meta
    return block_schema


def build_block_storage_document_from_legacy_storage(
    legacy_storage_schema: dict[str, Any],
) -> dict[str, Any]:
    return build_block_storage_payload(
        legacy_storage_schema,
        legacy_storage_schema=legacy_storage_schema,
    )


def build_form_version_storage_documents(
    raw_block_schema: dict[str, Any],
    *,
    slug: str,
    name: str,
    form_order: int,
) -> tuple[dict[str, Any], dict[str, Any]]:
    normalized_block_schema = json.loads(json.dumps(raw_block_schema))
    normalize_active_block_storage_schema(normalized_block_schema)
    legacy_storage_source = build_legacy_storage_schema_from_blocks(normalized_block_schema)
    legacy_storage_schema = build_legacy_storage_payload(
        legacy_storage_source,
        slug=slug,
        name=name,
        form_order=form_order,
    )
    stored_block_schema = build_block_storage_payload(
        normalized_block_schema,
        legacy_storage_schema=legacy_storage_schema,
    )
    return legacy_storage_schema, stored_block_schema


def block_payload_form_key(raw_block_schema: dict[str, Any]) -> str:
    if not isinstance(raw_block_schema, dict):
        return ""
    meta = raw_block_schema.get("meta") if isinstance(raw_block_schema.get("meta"), dict) else {}
    return compact_text(meta.get("form_key"))


def stable_form_schema_id(slug: str) -> str:
    return f"form.{slugify(slug or 'compat')}"


def build_legacy_storage_payload(
    raw_schema: dict[str, Any],
    *,
    slug: str,
    name: str,
    form_order: int,
) -> dict[str, Any]:
    raw_schema = raw_schema if isinstance(raw_schema, dict) else {}
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


def build_form_version_record(
    *,
    form_id: int,
    version_number: int,
    summary: str,
    legacy_storage_schema: dict[str, Any],
    block_storage_schema: dict[str, Any],
    source: str,
    is_current: bool,
) -> FormVersion:
    return FormVersion(
        form_id=form_id,
        version_number=version_number,
        summary=summary,
        schema_json=json.dumps(legacy_storage_schema, ensure_ascii=False),
        block_schema_json=json.dumps(block_storage_schema, ensure_ascii=False),
        source=source,
        is_current=is_current,
    )


def current_version(definition: FormDefinition) -> FormVersion | None:
    for version in definition.versions:
        if version.is_current:
            return version
    return definition.versions[-1] if definition.versions else None


def load_legacy_storage_document(version: FormVersion) -> dict[str, Any]:
    raw_schema = compact_text(version.schema_json)
    if not raw_schema:
        return {}
    try:
        parsed = json.loads(raw_schema)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def load_block_storage_document(
    version: FormVersion,
    *,
    legacy_storage_schema: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], bool]:
    raw_block_storage = compact_text(version.block_schema_json)
    if raw_block_storage:
        try:
            parsed = json.loads(raw_block_storage)
            if isinstance(parsed, dict):
                return parsed, False
        except json.JSONDecodeError:
            pass
    fallback_legacy_storage = legacy_storage_schema if isinstance(legacy_storage_schema, dict) else load_legacy_storage_document(version)
    return build_block_storage_document_from_legacy_storage(fallback_legacy_storage), True


def load_json_object(raw_value: str | None) -> dict[str, Any]:
    payload = compact_text(raw_value)
    if not payload:
        return {}
    try:
        parsed = json.loads(payload)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def normalize_record_values(raw_values: Any) -> dict[str, Any]:
    if not isinstance(raw_values, dict):
        return {}

    normalized: dict[str, Any] = {}
    for raw_key, raw_value in raw_values.items():
        field_id = compact_text(raw_key)
        if not field_id:
            continue

        if isinstance(raw_value, dict):
            asset_payload: dict[str, Any] = {}
            asset_id = raw_value.get("asset_id")
            if asset_id not in (None, ""):
                try:
                    asset_payload["asset_id"] = int(asset_id)
                except (TypeError, ValueError):
                    pass
            kind = compact_text(raw_value.get("kind"))
            if kind:
                asset_payload["kind"] = kind
            if asset_payload:
                normalized[field_id] = asset_payload
            continue

        if isinstance(raw_value, bool):
            normalized[field_id] = raw_value
            continue

        if isinstance(raw_value, (int, float)):
            normalized[field_id] = raw_value
            continue

        text_value = compact_text(raw_value)
        if text_value:
            normalized[field_id] = text_value

    return normalized


def normalize_record_indexed_meta(
    raw_meta: Any,
    *,
    patient_name: str,
    patient_age: str,
    patient_sex: str,
    case_number: str,
) -> dict[str, Any]:
    normalized = dict(raw_meta) if isinstance(raw_meta, dict) else {}

    if patient_name:
        normalized["patient_name"] = patient_name
    else:
        normalized.pop("patient_name", None)

    if patient_age:
        normalized["patient_age"] = patient_age
    else:
        normalized.pop("patient_age", None)

    if patient_sex:
        normalized["patient_sex"] = patient_sex
    else:
        normalized.pop("patient_sex", None)

    if case_number:
        normalized["case_number"] = case_number
    else:
        normalized.pop("case_number", None)

    return normalized


def remove_file_if_present(path_value: str | None) -> None:
    file_path = Path(path_value or "")
    if not file_path.exists() or not file_path.is_file():
        return
    try:
        file_path.unlink()
    except OSError:
        return

    parent = file_path.parent
    stop_dir = RECORD_UPLOADS_DIR.resolve()
    while parent.exists():
        try:
            if parent.resolve() == stop_dir:
                break
        except OSError:
            break
        try:
            parent.rmdir()
        except OSError:
            break
        parent = parent.parent


def remove_file_if_present_under(path_value: str | None, *, stop_dir: Path) -> None:
    file_path = Path(path_value or "")
    if not file_path.exists() or not file_path.is_file():
        return
    try:
        file_path.unlink()
    except OSError:
        return

    parent = file_path.parent
    safe_stop_dir = stop_dir.resolve()
    while parent.exists():
        try:
            if parent.resolve() == safe_stop_dir:
                break
        except OSError:
            break
        try:
            parent.rmdir()
        except OSError:
            break
        parent = parent.parent


def remove_record_asset(
    session: Session,
    asset: RecordAsset,
) -> None:
    remove_file_if_present(asset.storage_path)
    session.delete(asset)


def save_user_avatar(
    session: Session,
    user_id: int,
    *,
    avatar_filename: str = "",
    avatar_content_type: str | None = None,
    avatar_bytes: bytes | None = None,
) -> dict[str, Any]:
    user = get_user_or_none(session, user_id)
    if user is None:
        raise KeyError(user_id)

    mime_type = compact_text(avatar_content_type)
    extension = ALLOWED_IMAGE_CONTENT_TYPES.get(mime_type)
    if extension is None:
        raise ValueError("Only JPG, PNG, and WebP avatars are allowed.")
    if not avatar_bytes:
        raise ValueError("Choose an image before uploading.")
    if len(avatar_bytes) > MAX_USER_AVATAR_BYTES:
        raise ValueError("Avatar image must be 2 MB or smaller.")

    old_avatar_path = user.avatar_path
    old_avatar_name = user.avatar_original_filename
    old_avatar_type = user.avatar_mime_type
    USER_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    new_avatar_path = USER_UPLOADS_DIR / f"user_{user.id}_avatar_{uuid4().hex}{extension}"
    new_avatar_path.write_bytes(avatar_bytes)

    user.avatar_path = str(new_avatar_path)
    user.avatar_original_filename = compact_text(avatar_filename) or new_avatar_path.name
    user.avatar_mime_type = mime_type or None

    try:
        session.add(user)
        session.commit()
    except Exception:
        session.rollback()
        remove_file_if_present_under(str(new_avatar_path), stop_dir=USER_UPLOADS_DIR)
        user.avatar_path = old_avatar_path
        user.avatar_original_filename = old_avatar_name
        user.avatar_mime_type = old_avatar_type
        raise

    if old_avatar_path and old_avatar_path != str(new_avatar_path):
        remove_file_if_present_under(old_avatar_path, stop_dir=USER_UPLOADS_DIR)

    session.refresh(user)
    return serialize_user(user)


def remove_user_avatar(session: Session, user_id: int) -> dict[str, Any]:
    user = get_user_or_none(session, user_id)
    if user is None:
        raise KeyError(user_id)

    old_avatar_path = user.avatar_path
    user.avatar_path = None
    user.avatar_original_filename = None
    user.avatar_mime_type = None
    session.add(user)
    session.commit()
    if old_avatar_path:
        remove_file_if_present_under(old_avatar_path, stop_dir=USER_UPLOADS_DIR)
    session.refresh(user)
    return serialize_user(user)


def save_clinic_profile(
    session: Session,
    payload: ClinicProfilePayload,
    *,
    logo_filename: str = "",
    logo_content_type: str | None = None,
    logo_bytes: bytes | None = None,
) -> dict[str, Any]:
    profile = get_or_create_clinic_profile(session)

    clinic_name = compact_text(payload.clinic_name)
    address = compact_text(payload.address)
    contact_number = compact_text(payload.contact_number)
    contact_email = normalize_email(payload.contact_email) if compact_text(payload.contact_email) else ""

    if not clinic_name:
        raise ValueError("Enter the clinic name.")
    if contact_email and not validate_email_format(contact_email):
        raise ValueError("Enter a valid contact email address.")

    old_logo_path = profile.logo_path
    old_logo_name = profile.logo_original_filename
    old_logo_type = profile.logo_mime_type
    new_logo_path: Path | None = None

    if logo_bytes is not None:
        mime_type = compact_text(logo_content_type)
        extension = ALLOWED_IMAGE_CONTENT_TYPES.get(mime_type)
        if extension is None:
            raise ValueError("Only JPG, PNG, and WebP logos are allowed.")
        if not logo_bytes:
            raise ValueError("Choose an image before uploading.")
        if len(logo_bytes) > MAX_CLINIC_LOGO_BYTES:
            raise ValueError("Logo image must be 5 MB or smaller.")
        CLINIC_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        new_logo_path = CLINIC_UPLOADS_DIR / f"logo_{uuid4().hex}{extension}"
        new_logo_path.write_bytes(logo_bytes)
        profile.logo_path = str(new_logo_path)
        profile.logo_original_filename = compact_text(logo_filename) or new_logo_path.name
        profile.logo_mime_type = mime_type or None

    profile.clinic_name = clinic_name
    profile.address = address or None
    profile.contact_number = contact_number or None
    profile.contact_email = contact_email or None

    try:
        session.add(profile)
        session.commit()
    except Exception:
        session.rollback()
        if new_logo_path is not None:
            remove_file_if_present_under(str(new_logo_path), stop_dir=CLINIC_UPLOADS_DIR)
        profile.logo_path = old_logo_path
        profile.logo_original_filename = old_logo_name
        profile.logo_mime_type = old_logo_type
        raise

    if new_logo_path is not None and old_logo_path and old_logo_path != str(new_logo_path):
        remove_file_if_present_under(old_logo_path, stop_dir=CLINIC_UPLOADS_DIR)

    session.refresh(profile)
    return serialize_clinic_profile(profile)


def remove_clinic_logo(session: Session) -> dict[str, Any]:
    profile = get_or_create_clinic_profile(session)
    old_logo_path = profile.logo_path
    profile.logo_path = None
    profile.logo_original_filename = None
    profile.logo_mime_type = None
    session.add(profile)
    session.commit()
    if old_logo_path:
        remove_file_if_present_under(old_logo_path, stop_dir=CLINIC_UPLOADS_DIR)
    session.refresh(profile)
    return serialize_clinic_profile(profile)


def preserve_existing_asset_values(
    existing_values: dict[str, Any],
    incoming_values: dict[str, Any],
) -> dict[str, Any]:
    merged = dict(incoming_values)
    for field_id, value in existing_values.items():
        if field_id in merged:
            continue
        if isinstance(value, dict) and value.get("kind") == "image" and value.get("asset_id"):
            merged[field_id] = value
    return merged


def find_block_by_id(blocks: list[dict[str, Any]], block_id: str) -> dict[str, Any] | None:
    target_id = compact_text(block_id)
    for block in blocks:
        if not isinstance(block, dict):
            continue
        if compact_text(block.get("id")) == target_id:
            return block
        children = normalize_items(block.get("children"))
        if children:
            found = find_block_by_id(children, target_id)
            if found is not None:
                return found
    return None


def resolve_record_image_field(record: Record, field_block_id: str) -> dict[str, Any]:
    block_schema, _ = load_block_storage_document(record.form_version)
    field_block = find_block_by_id(normalize_items(block_schema.get("blocks")), field_block_id)
    if field_block is None or compact_text(field_block.get("kind")) != "field":
        raise ValueError("Image field not found.")
    props = field_block.get("props") if isinstance(field_block.get("props"), dict) else {}
    if compact_text(props.get("data_type")) != "image":
        raise ValueError("This field does not accept image uploads.")
    return field_block


def current_record_values(record: Record) -> dict[str, Any]:
    return normalize_record_values(load_json_object(record.values_json))


def next_record_key(session: Session, form_slug: str) -> str:
    base = f"rec_{slugify(form_slug or 'record')}"
    while True:
        candidate = f"{base}_{uuid4().hex[:8]}"
        exists = session.scalar(select(Record.id).where(Record.record_key == candidate))
        if exists is None:
            return candidate


def form_path_label_for_record(record: Record) -> str:
    location = serialize_form_location(record.form)
    if location["location_kind"] == "top_level":
        return compact_text(record.form.name) or "Untitled Form"
    return f"{location['location_path_label']} / {compact_text(record.form.name) or 'Untitled Form'}"


def serialize_record_asset(asset: RecordAsset) -> dict[str, Any]:
    return {
        "id": asset.id,
        "field_block_id": asset.field_block_id,
        "field_key": asset.field_key,
        "kind": asset.kind,
        "storage_path": asset.storage_path,
        "original_filename": asset.original_filename,
        "mime_type": asset.mime_type,
        "size_bytes": asset.size_bytes,
        "image_width": asset.image_width,
        "image_height": asset.image_height,
        "created_at": asset.created_at.astimezone(timezone.utc).isoformat(),
    }


def format_timestamp_label(value: Any) -> str:
    if value is None:
        return ""
    try:
        local_value = value.astimezone()
    except Exception:
        return ""
    tz_name = compact_text(local_value.tzname()) or "local"
    return f"{local_value.strftime('%b %d, %Y %I:%M %p')} {tz_name}"


def serialize_record_actor(user: User | None) -> dict[str, Any] | None:
    if user is None:
        return None
    return {
        "id": user.id,
        "full_name": compact_text(user.full_name),
        "email": compact_text(user.email),
        "login_id": compact_text(user.login_id),
        "role": compact_text(user.role),
    }


class RecordCompletionValidationError(ValueError):
    def __init__(self, issues: list[str]):
        self.issues = issues
        super().__init__("Complete this record after filling the missing required details.")


def has_meaningful_record_value(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, dict):
        if value.get("kind") == "image" and value.get("asset_id"):
            return True
        return any(has_meaningful_record_value(item) for item in value.values())
    if isinstance(value, list):
        return any(has_meaningful_record_value(item) for item in value)
    return bool(compact_text(value))


def collect_required_record_field_issues(
    blocks: list[dict[str, Any]],
    values: dict[str, Any],
) -> list[str]:
    issues: list[str] = []
    for block in blocks:
        if not isinstance(block, dict):
            continue
        kind = compact_text(block.get("kind"))
        if kind in {"section", "field_group"}:
            issues.extend(
                collect_required_record_field_issues(
                    normalize_items(block.get("children")),
                    values,
                )
            )
            continue
        if kind != "field":
            continue
        props = block.get("props") if isinstance(block.get("props"), dict) else {}
        if not bool(props.get("required")):
            continue
        block_id = compact_text(block.get("id"))
        field_name = compact_text(block.get("name")) or "Untitled field"
        if not has_meaningful_record_value(values.get(block_id)):
            issues.append(f"Fill in required field: {field_name}.")
    return issues


def list_record_completion_issues(
    record: Record,
    *,
    patient_name: str,
    case_number: str,
    values: dict[str, Any],
) -> list[str]:
    issues: list[str] = []
    if not patient_name:
        issues.append("Add the patient name.")
    if not case_number:
        issues.append("Add the case number.")

    block_schema, _ = load_block_storage_document(record.form_version)
    issues.extend(
        collect_required_record_field_issues(
            normalize_items(block_schema.get("blocks")),
            values,
        )
    )
    return issues


def validate_record_completion(
    record: Record,
    *,
    patient_name: str,
    case_number: str,
    values: dict[str, Any],
) -> None:
    issues = list_record_completion_issues(
        record,
        patient_name=patient_name,
        case_number=case_number,
        values=values,
    )
    if issues:
        raise RecordCompletionValidationError(issues)


def parse_numeric_answer(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = compact_text(value)
    if not text:
        return None
    text = text.replace(",", "")
    try:
        return float(text)
    except ValueError:
        return None


def build_print_reference(props: dict[str, Any]) -> str:
    reference_text = compact_text(props.get("reference_text"))
    if reference_text:
        return reference_text

    normal_min = compact_text(props.get("normal_min"))
    normal_max = compact_text(props.get("normal_max"))
    if normal_min and normal_max:
        return f"{normal_min} to {normal_max}"
    if normal_min:
        return f">= {normal_min}"
    if normal_max:
        return f"<= {normal_max}"
    return ""


def evaluate_numeric_abnormal(props: dict[str, Any], value: Any) -> tuple[bool, str | None]:
    numeric_value = parse_numeric_answer(value)
    if numeric_value is None:
        return False, None

    normal_min = parse_numeric_answer(props.get("normal_min"))
    normal_max = parse_numeric_answer(props.get("normal_max"))
    if normal_min is not None and numeric_value < normal_min:
        return True, "low"
    if normal_max is not None and numeric_value > normal_max:
        return True, "high"
    return False, None


def evaluate_choice_abnormal(props: dict[str, Any], value: Any) -> tuple[bool, str | None]:
    selected = compact_text(value)
    if not selected:
        return False, None

    options = normalize_items(props.get("options"))
    normal_names = {
        compact_text(option.get("name"))
        for option in options
        if isinstance(option, dict) and bool(option.get("is_normal")) and compact_text(option.get("name"))
    }
    if not normal_names:
        return False, None
    if selected in normal_names:
        return False, None
    return True, "abnormal"


def evaluate_print_abnormal(props: dict[str, Any], value: Any) -> tuple[bool, str | None]:
    data_type = compact_text(props.get("data_type"))
    control = compact_text(props.get("control"))

    if data_type == "image":
        return False, None
    if control == "select":
        return evaluate_choice_abnormal(props, value)
    return evaluate_numeric_abnormal(props, value)


def build_print_display_value(
    props: dict[str, Any],
    value: Any,
    image_asset: dict[str, Any] | None,
    *,
    record_id: int,
) -> dict[str, Any]:
    data_type = compact_text(props.get("data_type"))
    if data_type == "image":
        if image_asset is None:
            return {
                "kind": "image",
                "text": "",
                "image_url": None,
                "filename": "",
                "is_empty": True,
            }
        return {
            "kind": "image",
            "text": "",
            "image_url": f"/records/{record_id}/assets/{image_asset['id']}/file",
            "filename": compact_text(image_asset.get("original_filename")),
            "is_empty": False,
        }

    text_value = compact_text(value)
    return {
        "kind": "text",
        "text": text_value,
        "image_url": None,
        "filename": "",
        "is_empty": not text_value,
    }


def build_print_utility_content(props: dict[str, Any]) -> str:
    return compact_text(props.get("content")) or ""


def build_print_table_columns(props: dict[str, Any]) -> list[str]:
    columns = [
        compact_text(column)
        for column in normalize_items(props.get("columns"))
        if compact_text(column)
    ]
    return columns or ["Column 1", "Column 2"]


def build_print_table_sample_rows(props: dict[str, Any]) -> int:
    try:
        sample_rows = int(props.get("sample_rows") or 0)
    except (TypeError, ValueError):
        sample_rows = 0
    return max(1, min(sample_rows or 3, 6))


def build_print_field_item(
    block: dict[str, Any],
    values: dict[str, Any],
    asset_by_field: dict[str, dict[str, Any]],
    *,
    record_id: int,
) -> dict[str, Any]:
    props = block.get("props") if isinstance(block.get("props"), dict) else {}
    block_id = compact_text(block.get("id"))
    raw_value = values.get(block_id)
    image_asset = asset_by_field.get(block_id)
    display = build_print_display_value(props, raw_value, image_asset, record_id=record_id)
    is_abnormal, abnormal_reason = evaluate_print_abnormal(props, raw_value)

    return {
        "kind": "field",
        "id": block_id,
        "name": compact_text(block.get("name")) or "Untitled Field",
        "unit_hint": compact_text(props.get("unit_hint")),
        "reference_text": build_print_reference(props),
        "display": display,
        "is_abnormal": is_abnormal,
        "abnormal_reason": abnormal_reason,
    }


def build_print_items(
    blocks: list[dict[str, Any]],
    values: dict[str, Any],
    asset_by_field: dict[str, dict[str, Any]],
    *,
    record_id: int,
) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []

    for block in blocks:
        if not isinstance(block, dict):
            continue
        kind = compact_text(block.get("kind"))
        props = block.get("props") if isinstance(block.get("props"), dict) else {}

        if kind == "section":
            items.append(
                {
                    "kind": "section",
                    "name": compact_text(block.get("name")) or "Untitled Section",
                    "items": build_print_items(
                        normalize_items(block.get("children")),
                        values,
                        asset_by_field,
                        record_id=record_id,
                    ),
                }
            )
            continue

        if kind == "field_group":
            items.append(
                {
                    "kind": "group",
                    "name": compact_text(block.get("name")) or "Untitled Group",
                    "items": build_print_items(
                        normalize_items(block.get("children")),
                        values,
                        asset_by_field,
                        record_id=record_id,
                    ),
                }
            )
            continue

        if kind == "field":
            items.append(build_print_field_item(block, values, asset_by_field, record_id=record_id))
            continue

        if kind == "note":
            items.append(
                {
                    "kind": "note",
                    "name": compact_text(block.get("name")) or "",
                    "content": build_print_utility_content(props),
                }
            )
            continue

        if kind == "divider":
            items.append(
                {
                    "kind": "divider",
                    "name": compact_text(block.get("name")) or "",
                    "content": build_print_utility_content(props),
                }
            )
            continue

        if kind == "table":
            items.append(
                {
                    "kind": "table",
                    "name": compact_text(block.get("name")) or "Table",
                    "columns": build_print_table_columns(props),
                    "sample_rows": build_print_table_sample_rows(props),
                }
            )
            continue

    return items


def build_record_print_document(record: Record) -> dict[str, Any]:
    serialized = serialize_record(record, include_entry_schema=True)
    entry_schema = serialized.get("entry_schema") or {}
    values = serialized.get("values") or {}
    asset_by_field = serialized.get("asset_by_field_id") or {}

    return {
        "record": serialized,
        "title": serialized["form_name"],
        "status": serialized["status"],
        "patient_name": serialized["patient_name"] or "",
        "patient_age": serialized["patient_age"] or "",
        "patient_sex": serialized["patient_sex"] or "",
        "case_number": serialized["case_number"] or "",
        "form_name": serialized["form_name"],
        "form_path_label": serialized["form_path_label"],
        "form_version_number": serialized["form_version_number"],
        "record_key": serialized["record_key"],
        "created_at": serialized["created_at"],
        "updated_at": serialized["updated_at"],
        "items": build_print_items(
            normalize_items(entry_schema.get("blocks")),
            values,
            asset_by_field,
            record_id=serialized["id"],
        ),
    }


def serialize_record(
    record: Record,
    *,
    include_values: bool = True,
    include_entry_schema: bool = False,
) -> dict[str, Any]:
    location = serialize_form_location(record.form)
    indexed_meta = load_json_object(record.indexed_meta_json)
    asset_by_field_id = {
        compact_text(asset.field_block_id): serialize_record_asset(asset)
        for asset in record.assets
        if compact_text(asset.field_block_id)
    }
    payload = {
        "id": record.id,
        "record_key": record.record_key,
        "status": record.status,
        "patient_name": record.patient_name,
        "patient_age": compact_text(indexed_meta.get("patient_age")) or None,
        "patient_sex": compact_text(indexed_meta.get("patient_sex")) or None,
        "case_number": record.case_number,
        "form_slug": record.form.slug,
        "form_name": record.form.name,
        "form_path_label": form_path_label_for_record(record),
        "location_name": location["location_name"],
        "location_path_label": location["location_path_label"],
        "location_node_key": location["location_node_key"],
        "form_version_id": record.form_version_id,
        "form_version_number": record.form_version.version_number,
        "assets": [serialize_record_asset(asset) for asset in record.assets],
        "asset_by_field_id": asset_by_field_id,
        "created_at": record.created_at.astimezone(timezone.utc).isoformat(),
        "updated_at": record.updated_at.astimezone(timezone.utc).isoformat(),
        "completed_at": record.completed_at.astimezone(timezone.utc).isoformat() if record.completed_at else None,
        "created_at_label": format_timestamp_label(record.created_at),
        "updated_at_label": format_timestamp_label(record.updated_at),
        "completed_at_label": format_timestamp_label(record.completed_at) if record.completed_at else "",
        "created_by": serialize_record_actor(record.created_by_user),
        "updated_by": serialize_record_actor(record.updated_by_user),
        "indexed_meta": indexed_meta,
    }
    if include_values:
        payload["values"] = normalize_record_values(load_json_object(record.values_json))
    if include_entry_schema:
        block_schema, _ = load_block_storage_document(record.form_version)
        payload["entry_schema"] = block_schema
    return payload


def get_record_or_none(session: Session, record_id: int) -> Record | None:
    return session.scalar(
        select(Record)
        .where(Record.id == record_id)
        .options(
            selectinload(Record.form).selectinload(FormDefinition.library_node).selectinload(LibraryNode.parent),
            selectinload(Record.form_version),
            selectinload(Record.assets),
            selectinload(Record.created_by_user),
            selectinload(Record.updated_by_user),
        )
    )


def record_query_with_relationships():
    return select(Record).options(
        selectinload(Record.form).selectinload(FormDefinition.library_node).selectinload(LibraryNode.parent),
        selectinload(Record.form_version),
        selectinload(Record.assets),
        selectinload(Record.created_by_user),
        selectinload(Record.updated_by_user),
    )


def apply_record_filters(
    query,
    *,
    status: str | None = None,
    search: str | None = None,
):
    normalized_status = compact_text(status)
    if normalized_status:
        query = query.where(Record.status == normalized_status)

    search_text = compact_text(search)
    if search_text:
        search_pattern = f"%{search_text}%"
        query = query.join(FormDefinition, Record.form_id == FormDefinition.id).where(
            or_(
                Record.patient_name.ilike(search_pattern),
                Record.case_number.ilike(search_pattern),
                Record.record_key.ilike(search_pattern),
                FormDefinition.name.ilike(search_pattern),
            )
        )

    return query


def count_records(
    session: Session,
    *,
    status: str | None = None,
    search: str | None = None,
) -> int:
    query = select(func.count(Record.id))
    query = apply_record_filters(query, status=status, search=search)
    return int(session.scalar(query) or 0)


def list_records(
    session: Session,
    *,
    status: str | None = None,
    search: str | None = None,
    limit: int = 24,
) -> list[dict[str, Any]]:
    query = record_query_with_relationships()
    query = apply_record_filters(query, status=status, search=search)
    query = query.order_by(Record.updated_at.desc(), Record.id.desc()).limit(limit)
    records = session.scalars(query).all()
    return [serialize_record(record, include_values=False) for record in records]

def create_record(
    session: Session,
    payload: RecordCreatePayload,
    *,
    actor_user_id: int | None = None,
) -> dict[str, Any]:
    form_slug = compact_text(payload.form_slug)
    if not form_slug:
        raise ValueError("Choose a form before you continue.")

    definition = get_form_or_none(session, form_slug)
    if definition is None:
        raise ValueError("Form not found.")

    version = current_version(definition)
    if version is None:
        raise ValueError("This form has no current version yet.")

    patient_name = compact_text(payload.patient_name)
    patient_age = compact_text(payload.patient_age)
    patient_sex = compact_text(payload.patient_sex)
    case_number = compact_text(payload.case_number)
    indexed_meta = normalize_record_indexed_meta(
        payload.indexed_meta,
        patient_name=patient_name,
        patient_age=patient_age,
        patient_sex=patient_sex,
        case_number=case_number,
    )

    record = Record(
        record_key=next_record_key(session, definition.slug),
        form_id=definition.id,
        form_version_id=version.id,
        status="draft",
        patient_name=patient_name or None,
        case_number=case_number or None,
        values_json=json.dumps(normalize_record_values(payload.values), ensure_ascii=False),
        indexed_meta_json=json.dumps(indexed_meta, ensure_ascii=False),
        created_by_user_id=actor_user_id,
        updated_by_user_id=actor_user_id,
    )
    session.add(record)
    session.commit()
    session.expire_all()

    created = get_record_or_none(session, record.id)
    if created is None:
        raise ValueError("Record could not be loaded.")
    return serialize_record(created, include_entry_schema=True)


def update_record(
    session: Session,
    record_id: int,
    payload: RecordUpdatePayload,
    *,
    preserve_asset_fields: bool = False,
    actor_user_id: int | None = None,
) -> dict[str, Any]:
    record = get_record_or_none(session, record_id)
    if record is None:
        raise KeyError(record_id)
    if record.status == "completed":
        raise ValueError("Completed records are read-only.")

    patient_name = compact_text(payload.patient_name)
    patient_age = compact_text(payload.patient_age)
    patient_sex = compact_text(payload.patient_sex)
    case_number = compact_text(payload.case_number)
    indexed_meta = normalize_record_indexed_meta(
        payload.indexed_meta,
        patient_name=patient_name,
        patient_age=patient_age,
        patient_sex=patient_sex,
        case_number=case_number,
    )

    normalized_values = normalize_record_values(payload.values)
    if preserve_asset_fields:
        normalized_values = preserve_existing_asset_values(current_record_values(record), normalized_values)

    validate_record_completion(
        record,
        patient_name=patient_name,
        case_number=case_number,
        values=normalized_values,
    )

    record.patient_name = patient_name or None
    record.case_number = case_number or None
    record.values_json = json.dumps(normalized_values, ensure_ascii=False)
    record.indexed_meta_json = json.dumps(indexed_meta, ensure_ascii=False)
    record.updated_by_user_id = actor_user_id
    session.commit()
    session.expire_all()

    updated = get_record_or_none(session, record_id)
    if updated is None:
        raise KeyError(record_id)
    return serialize_record(updated, include_entry_schema=True)


def complete_record(
    session: Session,
    record_id: int,
    payload: RecordUpdatePayload,
    *,
    preserve_asset_fields: bool = False,
    actor_user_id: int | None = None,
) -> dict[str, Any]:
    record = get_record_or_none(session, record_id)
    if record is None:
        raise KeyError(record_id)
    if record.status == "completed":
        raise ValueError("This record is already completed.")

    patient_name = compact_text(payload.patient_name)
    patient_age = compact_text(payload.patient_age)
    patient_sex = compact_text(payload.patient_sex)
    case_number = compact_text(payload.case_number)
    indexed_meta = normalize_record_indexed_meta(
        payload.indexed_meta,
        patient_name=patient_name,
        patient_age=patient_age,
        patient_sex=patient_sex,
        case_number=case_number,
    )

    normalized_values = normalize_record_values(payload.values)
    if preserve_asset_fields:
        normalized_values = preserve_existing_asset_values(current_record_values(record), normalized_values)

    validate_record_completion(
        record,
        patient_name=patient_name,
        case_number=case_number,
        values=normalized_values,
    )

    record.patient_name = patient_name or None
    record.case_number = case_number or None
    record.values_json = json.dumps(normalized_values, ensure_ascii=False)
    record.indexed_meta_json = json.dumps(indexed_meta, ensure_ascii=False)
    record.status = "completed"
    record.completed_at = utc_now()
    record.updated_by_user_id = actor_user_id
    session.commit()
    session.expire_all()

    completed = get_record_or_none(session, record_id)
    if completed is None:
        raise KeyError(record_id)
    return serialize_record(completed, include_entry_schema=True)


def store_record_image_asset(
    session: Session,
    *,
    record_id: int,
    field_block_id: str,
    original_filename: str,
    content_type: str | None,
    file_bytes: bytes,
) -> dict[str, Any]:
    record = get_record_or_none(session, record_id)
    if record is None:
        raise KeyError(record_id)
    if record.status == "completed":
        raise ValueError("Completed records are read-only.")

    field_block = resolve_record_image_field(record, field_block_id)
    mime_type = compact_text(content_type)
    extension = ALLOWED_IMAGE_CONTENT_TYPES.get(mime_type)
    if extension is None:
        raise ValueError("Only JPG, PNG, and WebP images are allowed.")
    if not file_bytes:
        raise ValueError("Choose an image before uploading.")
    if len(file_bytes) > MAX_RECORD_IMAGE_BYTES:
        raise ValueError("Image must be 10 MB or smaller.")

    props = field_block.get("props") if isinstance(field_block.get("props"), dict) else {}
    field_key = compact_text(props.get("key")) or None
    safe_field = slugify(field_key or field_block_id)
    destination_dir = RECORD_UPLOADS_DIR / record.record_key / safe_field
    destination_dir.mkdir(parents=True, exist_ok=True)
    destination_path = destination_dir / f"{uuid4().hex}{extension}"
    destination_path.write_bytes(file_bytes)

    current_values = current_record_values(record)
    existing_ref = current_values.get(field_block_id)
    if isinstance(existing_ref, dict) and existing_ref.get("asset_id"):
        existing_asset = session.scalar(
            select(RecordAsset).where(
                RecordAsset.id == int(existing_ref["asset_id"]),
                RecordAsset.record_id == record.id,
            )
        )
        if existing_asset is not None:
            remove_record_asset(session, existing_asset)

    asset = RecordAsset(
        record_id=record.id,
        field_block_id=compact_text(field_block_id),
        field_key=field_key,
        kind="image",
        storage_path=str(destination_path),
        original_filename=compact_text(original_filename) or destination_path.name,
        mime_type=mime_type or None,
        size_bytes=len(file_bytes),
        image_width=None,
        image_height=None,
    )
    session.add(asset)
    session.flush()

    current_values[compact_text(field_block_id)] = {
        "asset_id": asset.id,
        "kind": "image",
    }
    record.values_json = json.dumps(current_values, ensure_ascii=False)
    session.commit()
    session.expire_all()

    updated = get_record_or_none(session, record_id)
    if updated is None:
        raise KeyError(record_id)
    return serialize_record(updated, include_entry_schema=True)


def delete_record_asset(session: Session, record_id: int, asset_id: int) -> dict[str, Any]:
    record = get_record_or_none(session, record_id)
    if record is None:
        raise KeyError(record_id)
    if record.status == "completed":
        raise ValueError("Completed records are read-only.")

    asset = session.scalar(
        select(RecordAsset).where(
            RecordAsset.id == asset_id,
            RecordAsset.record_id == record.id,
        )
    )
    if asset is None:
        raise KeyError(asset_id)

    current_values = current_record_values(record)
    field_id = compact_text(asset.field_block_id)
    current_ref = current_values.get(field_id)
    if isinstance(current_ref, dict) and current_ref.get("asset_id") == asset.id:
        current_values.pop(field_id, None)
        record.values_json = json.dumps(current_values, ensure_ascii=False)

    remove_record_asset(session, asset)
    session.commit()
    session.expire_all()

    updated = get_record_or_none(session, record_id)
    if updated is None:
        raise KeyError(record_id)
    return serialize_record(updated, include_entry_schema=True)


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

    block_schema, _ = load_block_storage_document(version)

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
                    "folder_path_label": " / ".join(current_path),
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
                    "location_name": path[-1] if path else "Top level",
                    "location_path_label": " / ".join(path) or "Top level",
                    "form_path_label": " / ".join(current_path),
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


def create_form_definition_record(
    *,
    slug: str,
    name: str,
    parent_node_key: str | None = None,
) -> FormDefinition:
    return FormDefinition(
        slug=slug,
        name=name,
        library_parent_node_key=parent_node_key,
    )


def sync_definition_parent_node_key(
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
    changed = False
    if compact_text(definition.library_parent_node_key) != compact_text(derived_parent_key):
        definition.library_parent_node_key = derived_parent_key
        changed = True
    return changed


def definition_schema_order_hint(definition: FormDefinition) -> int:
    version = current_version(definition)
    if version is not None:
        schema = load_legacy_storage_document(version)
        return int(schema.get("order") or 1)
    return 1


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
    sync_definition_parent_node_key(session, definition, form_node=form_node)

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


def normalize_location_name_input(value: str | None) -> str:
    normalized = compact_text(value)
    return "Top level" if normalized == "Unassigned" else normalized


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
    explicit_location_name = normalize_location_name_input(location_name)

    if pending_container_name:
        resolved_parent_key = ensure_container_node(session, pending_container_name, resolved_parent_key).node_key
    elif (
        not resolved_parent_key
        and explicit_location_name
        and explicit_location_name != "Top level"
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
        fallback_form_order = definition_schema_order_hint(definition)
        parent_id = None
        parent_node_key: str | None = None
        explicit_parent_key = compact_text(definition.library_parent_node_key)
        desired_form_order = (
            int(form_node.node_order or fallback_form_order)
            if form_node is not None
            else int(fallback_form_order)
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

        if sync_definition_parent_node_key(session, definition, form_node=form_node):
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
                legacy_storage_schema = build_legacy_storage_payload(
                    form,
                    slug=slug,
                    name=name,
                    form_order=form_order,
                )
                block_storage_schema = build_block_storage_document_from_legacy_storage(
                    legacy_storage_schema,
                )

                definition = create_form_definition_record(
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
                sync_definition_parent_node_key(session, definition)

                version = build_form_version_record(
                    form_id=definition.id,
                    version_number=1,
                    summary="Seeded from current reference schema.",
                    legacy_storage_schema=legacy_storage_schema,
                    block_storage_schema=block_storage_schema,
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


def ensure_form_version_storage_documents(session: Session) -> None:
    versions = session.scalars(select(FormVersion).options(selectinload(FormVersion.form))).all()
    changed = False

    for version in versions:
        legacy_storage_schema = load_legacy_storage_document(version)
        schema_changed = False

        if "common_field_set_id" in legacy_storage_schema:
            legacy_storage_schema.pop("common_field_set_id", None)
            schema_changed = True

        definition_slug = version.form.slug if version.form is not None else compact_text(legacy_storage_schema.get("key"))
        stable_schema_id = stable_form_schema_id(definition_slug)
        if compact_text(legacy_storage_schema.get("id")) != stable_schema_id:
            legacy_storage_schema["id"] = stable_schema_id
            schema_changed = True

        block_schema, block_changed = load_block_storage_document(
            version,
            legacy_storage_schema=legacy_storage_schema,
        )

        meta = block_schema.get("meta") if isinstance(block_schema.get("meta"), dict) else {}
        if "common_field_set_id" in meta:
            meta.pop("common_field_set_id", None)
            block_changed = True
        if compact_text(meta.get("form_id")) != stable_schema_id:
            meta["form_id"] = stable_schema_id
            block_changed = True
        if compact_text(meta.get("legacy_form_id")):
            meta.pop("legacy_form_id", None)
            block_changed = True
        stable_form_key = compact_text(legacy_storage_schema.get("key"))
        if compact_text(meta.get("form_key")) != stable_form_key:
            meta["form_key"] = stable_form_key
            block_changed = True
        if compact_text(meta.get("legacy_form_key")):
            meta.pop("legacy_form_key", None)
            block_changed = True
        stable_form_order = int(legacy_storage_schema.get("order") or 1)
        if int(meta.get("form_order") or 1) != stable_form_order:
            meta["form_order"] = stable_form_order
            block_changed = True
        if compact_text(meta.get("legacy_order")):
            meta.pop("legacy_order", None)
            block_changed = True

        if normalize_active_block_storage_schema(block_schema):
            block_changed = True
        block_schema["meta"] = meta

        if schema_changed:
            version.schema_json = json.dumps(legacy_storage_schema, ensure_ascii=False)
            changed = True
        if block_changed:
            version.block_schema_json = json.dumps(block_schema, ensure_ascii=False)
            changed = True

    if changed:
        session.commit()


def create_form(session: Session, payload: FormSavePayload) -> dict[str, Any]:
    raw_block_schema = payload.form_schema if isinstance(payload.form_schema, dict) else {}
    slug = next_available_slug(
        session,
        payload.slug or block_payload_form_key(raw_block_schema) or payload.name or "untitled_form",
    )
    name = compact_text(payload.name) or "Untitled Form"
    location_meta = resolve_form_location_metadata(
        session,
        form_name=name,
        location_name=compact_text(payload.location_name),
        library_parent_node_key=payload.library_parent_node_key,
        library_new_container_name=payload.library_new_container_name,
    )
    legacy_storage_schema, stored_block_schema = build_form_version_storage_documents(
        raw_block_schema,
        slug=slug,
        name=name,
        form_order=location_meta["resolved_form_order"],
    )

    definition = create_form_definition_record(
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
    sync_definition_parent_node_key(session, definition)

    version = build_form_version_record(
        form_id=definition.id,
        version_number=1,
        summary=compact_text(payload.summary) or "Initial builder version.",
        legacy_storage_schema=legacy_storage_schema,
        block_storage_schema=stored_block_schema,
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

    raw_block_schema = payload.form_schema if isinstance(payload.form_schema, dict) else {}
    name = compact_text(payload.name) or definition.name
    location_meta = resolve_form_location_metadata(
        session,
        form_name=name,
        location_name=compact_text(payload.location_name),
        library_parent_node_key=payload.library_parent_node_key,
        library_new_container_name=payload.library_new_container_name,
        existing_definition=definition,
    )
    legacy_storage_schema, stored_block_schema = build_form_version_storage_documents(
        raw_block_schema,
        slug=definition.slug,
        name=name,
        form_order=location_meta["resolved_form_order"],
    )

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
    sync_definition_parent_node_key(session, definition)

    version = build_form_version_record(
        form_id=definition.id,
        version_number=next_version,
        summary=compact_text(payload.summary) or f"Builder update v{next_version}.",
        legacy_storage_schema=legacy_storage_schema,
        block_storage_schema=stored_block_schema,
        source="builder",
        is_current=True,
    )
    session.add(version)
    session.commit()
    ensure_library_tree(session)
    session.expire_all()
    return serialize_form(get_form_or_none(session, slug))
