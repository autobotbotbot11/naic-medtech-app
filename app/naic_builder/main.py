from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from .config import APP_TITLE, STATIC_DIR, TEMPLATES_DIR
from .database import SessionLocal, ensure_runtime_schema, get_session
from .schemas import FormSavePayload
from .services import (
    create_form,
    ensure_block_schema_storage,
    ensure_library_tree,
    ensure_reference_seed,
    get_form_or_none,
    list_library_tree,
    list_grouped_forms,
    load_reference_schema,
    serialize_form,
    split_library_groups,
    update_form,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_runtime_schema()
    with SessionLocal() as session:
        ensure_reference_seed(session)
        ensure_block_schema_storage(session)
        ensure_library_tree(session)
    yield


app = FastAPI(title=APP_TITLE, lifespan=lifespan)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


def render_builder_page(
    request: Request,
    *,
    initial_form_slug: str = "",
    initial_builder_mode: str = "",
) -> HTMLResponse:
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={
            "app_title": APP_TITLE,
            "initial_form_slug": initial_form_slug,
            "initial_builder_mode": initial_builder_mode,
        },
    )


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse(url="/forms", status_code=303)


@app.get("/forms", response_class=HTMLResponse)
def forms_library(request: Request, session: Session = Depends(get_session)) -> HTMLResponse:
    official_groups, extra_groups = split_library_groups(session)
    return templates.TemplateResponse(
        request=request,
        name="forms/library.html",
        context={
            "app_title": APP_TITLE,
            "official_groups": official_groups,
            "extra_groups": extra_groups,
        },
    )


@app.get("/forms/new", response_class=HTMLResponse)
def start_new_form_page(
    request: Request,
    source: str = "",
    session: Session = Depends(get_session),
) -> HTMLResponse:
    official_groups, extra_groups = split_library_groups(session)

    def enrich_group(group: dict[str, Any]) -> dict[str, Any]:
        forms = group.get("forms", [])
        next_form_order = max((int(form.get("form_order") or 0) for form in forms), default=0) + 1
        return {
            **group,
            "next_form_order": next_form_order,
        }

    official_group_options = [enrich_group(group) for group in official_groups]
    extra_group_options = [enrich_group(group) for group in extra_groups]
    all_group_options = [*official_group_options, *extra_group_options]

    source_form = None
    source_slug = source.strip()
    if source_slug:
        source_form = get_form_or_none(session, source_slug)
        if source_form is None:
            raise HTTPException(status_code=404, detail="Source form not found.")

    default_group_name = source_form.group_name if source_form else (all_group_options[0]["name"] if all_group_options else "")
    default_group_order = next(
        (group["order"] for group in all_group_options if group["name"] == default_group_name),
        999,
    )
    default_form_order = next(
        (group["next_form_order"] for group in all_group_options if group["name"] == default_group_name),
        1,
    )

    preset_options = [
        {
            "id": "quick_results",
            "name": "Quick Results",
            "description": "Start with one ready section for common result fields.",
        },
        {
            "id": "structured_report",
            "name": "Structured Report",
            "description": "Start with simple sections for details, results, and remarks.",
        },
    ]

    return templates.TemplateResponse(
        request=request,
        name="forms/new.html",
        context={
            "app_title": APP_TITLE,
            "official_group_options": official_group_options,
            "extra_group_options": extra_group_options,
            "default_group_name": default_group_name,
            "default_group_order": default_group_order,
            "default_form_order": default_form_order,
            "source_form": source_form,
            "preset_options": preset_options,
        },
    )


@app.get("/builder", response_class=HTMLResponse)
def builder_page(
    request: Request,
    slug: str = "",
    mode: str = "",
    session: Session = Depends(get_session),
) -> HTMLResponse:
    initial_slug = slug.strip()
    if initial_slug and get_form_or_none(session, initial_slug) is None:
        raise HTTPException(status_code=404, detail="Form not found.")
    initial_mode = mode.strip().lower()
    if initial_mode not in {"", "new", "duplicate"}:
        initial_mode = ""
    return render_builder_page(
        request,
        initial_form_slug=initial_slug,
        initial_builder_mode=initial_mode,
    )


@app.get("/forms/{slug}/builder", response_class=HTMLResponse)
def form_builder_page(
    slug: str,
    request: Request,
    session: Session = Depends(get_session),
) -> HTMLResponse:
    definition = get_form_or_none(session, slug)
    if definition is None:
        raise HTTPException(status_code=404, detail="Form not found.")
    return render_builder_page(request, initial_form_slug=definition.slug)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/builder/bootstrap")
def builder_bootstrap(session: Session = Depends(get_session)) -> dict[str, Any]:
    reference = load_reference_schema()
    groups = list_grouped_forms(session)
    selected_slug = groups[0]["forms"][0]["slug"] if groups and groups[0]["forms"] else None
    return {
        "app_title": APP_TITLE,
        "common_field_sets": reference.get("common_field_sets", []),
        "groups": groups,
        "selected_form_slug": selected_slug,
    }


@app.get("/api/library/tree")
def library_tree(session: Session = Depends(get_session)) -> dict[str, Any]:
    return {"nodes": list_library_tree(session)}


@app.get("/api/forms/{slug}")
def get_form(slug: str, session: Session = Depends(get_session)) -> dict[str, Any]:
    definition = get_form_or_none(session, slug)
    if definition is None:
        raise HTTPException(status_code=404, detail="Form not found.")
    return serialize_form(definition)


@app.get("/api/forms/{slug}/block-schema")
def get_form_block_schema(slug: str, session: Session = Depends(get_session)) -> dict[str, Any]:
    definition = get_form_or_none(session, slug)
    if definition is None:
        raise HTTPException(status_code=404, detail="Form not found.")
    payload = serialize_form(definition)
    return {
        "slug": payload["slug"],
        "name": payload["name"],
        "current_version_number": payload["current_version_number"],
        "block_schema": payload["block_schema"],
    }


@app.post("/api/forms", status_code=201)
def create_form_endpoint(payload: FormSavePayload, session: Session = Depends(get_session)) -> dict[str, Any]:
    try:
        return create_form(session, payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.put("/api/forms/{slug}")
def update_form_endpoint(
    slug: str,
    payload: FormSavePayload,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    try:
        return update_form(session, slug, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Form not found.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
