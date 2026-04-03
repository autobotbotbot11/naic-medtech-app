from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any
from urllib.parse import parse_qs

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from .config import APP_TITLE, STATIC_DIR, TEMPLATES_DIR
from .database import SessionLocal, ensure_runtime_schema, get_session
from .schemas import FormSavePayload
from .services import (
    create_container,
    delete_container,
    create_form,
    ensure_block_schema_storage,
    ensure_library_tree,
    ensure_reference_seed,
    get_form_or_none,
    get_container_or_none,
    list_container_choices,
    list_form_choices,
    list_library_tree,
    list_move_target_choices,
    move_container,
    move_form,
    rename_container,
    serialize_form,
    serialize_form_location,
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
    library_tree = list_library_tree(session)
    return templates.TemplateResponse(
        request=request,
        name="forms/library.html",
        context={
            "app_title": APP_TITLE,
            "library_tree": library_tree,
        },
    )


def render_new_folder_page(
    request: Request,
    session: Session,
    *,
    folder_name: str = "",
    parent_node_key: str = "",
    error_message: str = "",
    status_code: int = 200,
) -> HTMLResponse:
    container_options = list_container_choices(session)
    return templates.TemplateResponse(
        request=request,
        name="forms/new_folder.html",
        context={
            "app_title": APP_TITLE,
            "container_options": container_options,
            "folder_name": folder_name,
            "selected_parent_key": parent_node_key.strip(),
            "error_message": error_message,
        },
        status_code=status_code,
    )


def render_edit_folder_page(
    request: Request,
    session: Session,
    *,
    node_key: str,
    folder_name: str = "",
    error_message: str = "",
    status_code: int = 200,
) -> HTMLResponse:
    container = get_container_or_none(session, node_key)
    if container is None:
        raise HTTPException(status_code=404, detail="Folder not found.")

    container_options = list_container_choices(session)
    current_choice = next((option for option in container_options if option["node_key"] == container.node_key), None)
    parent_choice = next((option for option in container_options if option["node_key"] == container.parent.node_key), None) if container.parent else None
    return templates.TemplateResponse(
        request=request,
        name="forms/edit_folder.html",
        context={
            "app_title": APP_TITLE,
            "folder_node_key": container.node_key,
            "folder_name": folder_name or container.name,
            "folder_path_label": current_choice["path_label"] if current_choice else container.name,
            "parent_path_label": parent_choice["path_label"] if parent_choice else "Top level",
            "error_message": error_message,
        },
        status_code=status_code,
    )


def render_move_folder_page(
    request: Request,
    session: Session,
    *,
    node_key: str,
    selected_parent_key: str = "",
    error_message: str = "",
    status_code: int = 200,
) -> HTMLResponse:
    container = get_container_or_none(session, node_key)
    if container is None:
        raise HTTPException(status_code=404, detail="Folder not found.")

    current_choices = list_container_choices(session)
    current_choice = next((option for option in current_choices if option["node_key"] == container.node_key), None)
    selected_key = selected_parent_key.strip()
    if not selected_key and container.parent is not None:
        selected_key = container.parent.node_key

    return templates.TemplateResponse(
        request=request,
        name="forms/move_folder.html",
        context={
            "app_title": APP_TITLE,
            "folder_node_key": container.node_key,
            "folder_name": container.name,
            "folder_path_label": current_choice["path_label"] if current_choice else container.name,
            "selected_parent_key": selected_key,
            "container_options": list_move_target_choices(session, exclude_node_key=container.node_key),
            "error_message": error_message,
        },
        status_code=status_code,
    )


def render_move_form_page(
    request: Request,
    session: Session,
    *,
    slug: str,
    selected_parent_key: str = "",
    error_message: str = "",
    status_code: int = 200,
) -> HTMLResponse:
    definition = get_form_or_none(session, slug)
    if definition is None:
        raise HTTPException(status_code=404, detail="Form not found.")

    form_choices = list_form_choices(session)
    current_choice = next((option for option in form_choices if option["slug"] == definition.slug), None)
    container_options = list_move_target_choices(session)
    resolved_parent_key = definition.library_parent_node_key or ""

    return templates.TemplateResponse(
        request=request,
        name="forms/move_form.html",
        context={
            "app_title": APP_TITLE,
            "form_slug": definition.slug,
            "form_name": definition.name,
            "form_path_label": current_choice["path_label"] if current_choice else definition.name,
            "selected_parent_key": selected_parent_key.strip() or resolved_parent_key,
            "container_options": container_options,
            "error_message": error_message,
        },
        status_code=status_code,
    )


@app.get("/folders/new", response_class=HTMLResponse)
def start_new_folder_page(
    request: Request,
    parent: str = "",
    session: Session = Depends(get_session),
) -> HTMLResponse:
    return render_new_folder_page(request, session, parent_node_key=parent)


@app.post("/folders/new")
async def create_folder_page(
    request: Request,
    session: Session = Depends(get_session),
):
    body = (await request.body()).decode("utf-8")
    form_data = parse_qs(body, keep_blank_values=True)
    name = (form_data.get("name") or [""])[0]
    parent_node_key = (form_data.get("parent_node_key") or [""])[0]
    try:
        created = create_container(session, name, parent_node_key or None)
    except ValueError as exc:
        return render_new_folder_page(
            request,
            session,
            folder_name=name,
            parent_node_key=parent_node_key,
            error_message=str(exc),
            status_code=422,
        )
    node_anchor = created.node_key.replace(":", "-")
    return RedirectResponse(url=f"/forms#node-{node_anchor}", status_code=303)


@app.get("/folders/edit", response_class=HTMLResponse)
def edit_folder_page(
    request: Request,
    node: str = "",
    session: Session = Depends(get_session),
) -> HTMLResponse:
    return render_edit_folder_page(request, session, node_key=node)


@app.post("/folders/edit")
async def update_folder_page(
    request: Request,
    session: Session = Depends(get_session),
):
    body = (await request.body()).decode("utf-8")
    form_data = parse_qs(body, keep_blank_values=True)
    node_key = (form_data.get("node_key") or [""])[0]
    name = (form_data.get("name") or [""])[0]
    action = (form_data.get("action") or ["save"])[0]

    try:
        if action == "delete":
            delete_container(session, node_key)
            return RedirectResponse(url="/forms", status_code=303)

        updated = rename_container(session, node_key, name)
    except ValueError as exc:
        return render_edit_folder_page(
            request,
            session,
            node_key=node_key,
            folder_name=name,
            error_message=str(exc),
            status_code=422,
        )

    node_anchor = updated.node_key.replace(":", "-")
    return RedirectResponse(url=f"/forms#node-{node_anchor}", status_code=303)


@app.get("/folders/move", response_class=HTMLResponse)
def move_folder_page(
    request: Request,
    node: str = "",
    session: Session = Depends(get_session),
) -> HTMLResponse:
    return render_move_folder_page(request, session, node_key=node)


@app.post("/folders/move")
async def update_folder_location_page(
    request: Request,
    session: Session = Depends(get_session),
):
    body = (await request.body()).decode("utf-8")
    form_data = parse_qs(body, keep_blank_values=True)
    node_key = (form_data.get("node_key") or [""])[0]
    parent_node_key = (form_data.get("parent_node_key") or [""])[0]

    try:
        moved = move_container(session, node_key, parent_node_key or None)
    except ValueError as exc:
        return render_move_folder_page(
            request,
            session,
            node_key=node_key,
            selected_parent_key=parent_node_key,
            error_message=str(exc),
            status_code=422,
        )

    node_anchor = moved.node_key.replace(":", "-")
    return RedirectResponse(url=f"/forms#node-{node_anchor}", status_code=303)


@app.get("/forms/new", response_class=HTMLResponse)
def start_new_form_page(
    request: Request,
    source: str = "",
    parent: str = "",
    create_folder: bool = False,
    session: Session = Depends(get_session),
) -> HTMLResponse:
    container_options = list_container_choices(session)
    duplicate_options = list_form_choices(session)

    source_form = None
    source_slug = source.strip()
    if source_slug:
        source_form = get_form_or_none(session, source_slug)
        if source_form is None:
            raise HTTPException(status_code=404, detail="Source form not found.")

    explicit_parent_node_key = parent.strip()
    default_parent_node_key = ""
    default_location_mode = "existing" if container_options else "root"
    if source_form and source_form.library_parent_node_key:
        default_parent_node_key = source_form.library_parent_node_key
        default_location_mode = "existing"
    elif source_form:
        default_location_mode = "root"
    elif container_options:
        default_parent_node_key = container_options[0]["node_key"]
        default_location_mode = "existing"

    if explicit_parent_node_key:
        matching_parent = next(
            (option for option in container_options if option["node_key"] == explicit_parent_node_key),
            None,
        )
        if matching_parent is not None:
            default_parent_node_key = matching_parent["node_key"]
            default_location_mode = "new" if create_folder else "existing"

    selected_container = next(
        (option for option in container_options if option["node_key"] == default_parent_node_key),
        None,
    )
    default_location_name = selected_container["name"] if selected_container else (serialize_form_location(source_form)["location_name"] if source_form else "")
    default_new_folder_parent_key = default_parent_node_key if default_location_mode in {"existing", "new"} else ""

    return templates.TemplateResponse(
        request=request,
        name="forms/new.html",
        context={
            "app_title": APP_TITLE,
            "container_options": container_options,
            "duplicate_options": duplicate_options,
            "default_parent_node_key": default_parent_node_key,
            "default_location_mode": default_location_mode,
            "default_location_name": default_location_name,
            "default_new_folder_parent_key": default_new_folder_parent_key,
            "source_form": source_form,
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


@app.get("/forms/move", response_class=HTMLResponse)
def move_form_page(
    request: Request,
    slug: str = "",
    session: Session = Depends(get_session),
) -> HTMLResponse:
    return render_move_form_page(request, session, slug=slug)


@app.post("/forms/move")
async def update_form_location_page(
    request: Request,
    session: Session = Depends(get_session),
):
    body = (await request.body()).decode("utf-8")
    form_data = parse_qs(body, keep_blank_values=True)
    slug = (form_data.get("slug") or [""])[0]
    parent_node_key = (form_data.get("parent_node_key") or [""])[0]

    try:
        moved = move_form(session, slug, parent_node_key or None)
    except ValueError as exc:
        return render_move_form_page(
            request,
            session,
            slug=slug,
            selected_parent_key=parent_node_key,
            error_message=str(exc),
            status_code=422,
        )

    node_anchor = f"node-form-{moved.slug}"
    return RedirectResponse(url=f"/forms#{node_anchor}", status_code=303)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/builder/bootstrap")
def builder_bootstrap(session: Session = Depends(get_session)) -> dict[str, Any]:
    form_choices = list_form_choices(session)
    container_options = list_container_choices(session)
    selected_slug = form_choices[0]["slug"] if form_choices else None
    return {
        "app_title": APP_TITLE,
        "container_options": container_options,
        "form_choices": form_choices,
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
