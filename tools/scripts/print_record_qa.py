from __future__ import annotations

import argparse
import base64
import html
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "app"))

from fastapi.testclient import TestClient
from itsdangerous import TimestampSigner
from sqlalchemy import select

from naic_builder.config import SESSION_SECRET
from naic_builder.database import SessionLocal
from naic_builder.main import app
from naic_builder.models import FormDefinition, Record, User
from naic_builder.schemas import RecordCreatePayload, RecordUpdatePayload
from naic_builder.services import (
    build_record_print_document,
    build_sample_print_values,
    complete_record,
    create_record,
    current_version,
    get_clinic_profile,
    get_record_or_none,
    load_block_storage_document,
    normalize_items,
)

DEFAULT_QA_SLUGS = [
    "ogtt",
    "semen",
    "serology",
    "hematology",
    "male",
    "female",
    "blood_bank",
]

STRESS_VALUES = {
    "name": "Maria Christina Dela Cruz-Santos Villanueva",
    "case": "NAIC-2026-0001-RECHECK-LONG",
    "physician": "Dr. Antonio Miguel Reyes III, Internal Medicine",
    "room": "Outpatient Department / Follow-up Bay 2",
    "medical technologist": "Maria Lourdes Santos, RMT",
    "medtech": "Maria Lourdes Santos, RMT",
    "pathologist": "Dr. Rafael Alfonso Cruz, FPSP",
    "remarks": "Slightly hemolyzed specimen; correlate clinically and repeat if clinically indicated.",
    "others": "Occasional epithelial cells; correlate clinically if symptoms persist.",
    "released by": "Maria Lourdes Santos, RMT",
    "released to": "Juan Miguel Dela Cruz, authorized representative",
}


def compact_text(value: Any) -> str:
    return " ".join(str(value or "").split())


def apply_stress_values(blocks: list[dict[str, Any]], values: dict[str, Any]) -> None:
    for block in normalize_items(blocks):
        if not isinstance(block, dict):
            continue
        kind = compact_text(block.get("kind"))
        block_id = compact_text(block.get("id"))
        props = block.get("props") if isinstance(block.get("props"), dict) else {}
        label = f"{props.get('key') or ''} {block.get('name') or ''}".lower()
        if kind == "field" and block_id:
            for key, value in STRESS_VALUES.items():
                if key in label:
                    values[block_id] = value
                    break
        apply_stress_values(normalize_items(block.get("children")), values)


def first_active_user_id() -> int | None:
    with SessionLocal() as session:
        user = session.scalars(
            select(User)
            .where(User.status == "active")
            .order_by(User.id)
        ).first()
        return user.id if user else None


def signed_client(user_id: int | None) -> TestClient:
    client = TestClient(app)
    if user_id is not None:
        raw = base64.b64encode(json.dumps({"user_id": user_id}).encode("utf-8"))
        cookie = TimestampSigner(str(SESSION_SECRET)).sign(raw).decode("utf-8")
        client.cookies.set("session", cookie)
    return client


def qa_record_print(slug: str, *, actor_user_id: int | None, keep_records: bool) -> dict[str, Any]:
    created_record_id: int | None = None
    with SessionLocal() as session:
        definition = session.scalars(select(FormDefinition).where(FormDefinition.slug == slug)).first()
        if definition is None:
            raise ValueError(f"Form not found: {slug}")
        version = current_version(definition)
        if version is None:
            raise ValueError(f"Form has no current version: {slug}")

        block_schema, _ = load_block_storage_document(version)
        values = build_sample_print_values(normalize_items(block_schema.get("blocks")))
        apply_stress_values(normalize_items(block_schema.get("blocks")), values)

        created = create_record(
            session,
            RecordCreatePayload(form_slug=slug, values=values),
            actor_user_id=actor_user_id,
        )
        created_record_id = int(created["id"])
        completed = complete_record(
            session,
            created_record_id,
            RecordUpdatePayload(values=values),
            actor_user_id=actor_user_id,
        )
        record = get_record_or_none(session, created_record_id)
        if record is None:
            raise ValueError(f"Created record could not be loaded: {slug}")

        clinic_profile = get_clinic_profile(session)
        document = build_record_print_document(
            record,
            clinic_profile=clinic_profile,
            clinic_logo_url="/settings/clinic/logo" if clinic_profile.get("has_logo") else "",
        )
        fit = document.get("fit_estimate") if isinstance(document.get("fit_estimate"), dict) else {}

    client = signed_client(actor_user_id)
    response = client.get(f"/records/{created_record_id}/print")
    if response.status_code != 200:
        raise ValueError(f"Print route failed for {slug}: HTTP {response.status_code}")
    html_text = html.unescape(response.text)
    missing = [
        token
        for token in [
            "print-page",
            "print-fit-badge",
            compact_text(document.get("record_key")),
            compact_text(document.get("form_name")),
            "Medical Technologist",
        ]
        if token and token not in html_text
    ]

    if not keep_records and created_record_id is not None:
        with SessionLocal() as cleanup_session:
            record = cleanup_session.get(Record, created_record_id)
            if record is not None:
                cleanup_session.delete(record)
                cleanup_session.commit()

    return {
        "slug": slug,
        "record_id": created_record_id,
        "record_key": document.get("record_key"),
        "status": completed.get("status"),
        "fit": fit.get("status") or "",
        "fit_label": fit.get("label") or "",
        "missing": missing,
        "kept": keep_records,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create temporary actual records and smoke-test /records/{id}/print.",
    )
    parser.add_argument("slugs", nargs="*", help="Form slugs to test.")
    parser.add_argument("--all", action="store_true", help="Test all current forms.")
    parser.add_argument("--keep-records", action="store_true", help="Do not delete QA records after the run.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    actor_user_id = first_active_user_id()
    with SessionLocal() as session:
        if args.all:
            slugs = [
                slug
                for slug in session.scalars(select(FormDefinition.slug).order_by(FormDefinition.name)).all()
            ]
        else:
            slugs = args.slugs or DEFAULT_QA_SLUGS

    failures: list[str] = []
    for slug in slugs:
        result = qa_record_print(slug, actor_user_id=actor_user_id, keep_records=args.keep_records)
        missing = ", ".join(result["missing"]) if result["missing"] else "none"
        print(
            "\t".join(
                [
                    result["slug"],
                    str(result["record_id"]),
                    str(result["record_key"]),
                    str(result["status"]),
                    str(result["fit"]),
                    str(result["fit_label"]),
                    f"missing={missing}",
                    f"kept={result['kept']}",
                ]
            )
        )
        if result["missing"] or result["fit"] == "long":
            failures.append(slug)

    if failures:
        print(f"FAILED: {', '.join(failures)}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
