from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.sessions import SessionMiddleware

from .config import APP_TITLE, SESSION_SECRET, STATIC_DIR, TEMPLATES_DIR
from .database import SessionLocal, ensure_runtime_schema, get_session
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
from .services import (
    authenticate_user,
    build_record_print_document,
    change_user_password,
    count_records,
    count_users,
    complete_record,
    create_initial_admin,
    create_container,
    delete_container,
    get_clinic_profile,
    delete_record_asset,
    create_form,
    create_record,
    create_user_account,
    ensure_form_version_storage_documents,
    ensure_library_tree,
    ensure_reference_seed,
    get_user_or_none,
    get_form_or_none,
    get_container_or_none,
    get_record_or_none,
    has_any_users,
    list_container_choices,
    list_form_choices,
    list_library_tree,
    list_records,
    list_users,
    list_move_target_choices,
    move_container,
    move_form,
    request_account,
    RecordCompletionValidationError,
    remove_clinic_logo,
    rename_container,
    serialize_user,
    serialize_record,
    serialize_form,
    serialize_form_location,
    save_clinic_profile,
    store_record_image_asset,
    update_user_status,
    approve_user_account,
    update_record,
    update_form,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_runtime_schema()
    with SessionLocal() as session:
        ensure_reference_seed(session)
        ensure_form_version_storage_documents(session)
        ensure_library_tree(session)
    yield


app = FastAPI(title=APP_TITLE, lifespan=lifespan)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


PUBLIC_PATHS = {
    "/api/health",
    "/login",
    "/logout",
    "/request-account",
    "/setup",
    "/change-password",
}
PUBLIC_PREFIXES = ("/static",)
ADMIN_PREFIXES = ("/forms", "/folders", "/builder", "/settings", "/api/forms", "/api/builder", "/api/library")


def redirect_for_html(path: str) -> RedirectResponse:
    return RedirectResponse(url=path, status_code=303)


def auth_error_response(path: str, status_code: int, detail: str, redirect_path: str) -> JSONResponse | RedirectResponse:
    if path.startswith("/api/"):
        return JSONResponse(status_code=status_code, content={"detail": detail})
    return redirect_for_html(redirect_path)


class AuthFlowMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if any(path.startswith(prefix) for prefix in PUBLIC_PREFIXES):
            return await call_next(request)

        with SessionLocal() as session:
            user_present = has_any_users(session)
            session_user = None
            raw_user_id = request.session.get("user_id")
            if raw_user_id not in (None, ""):
                try:
                    session_user = get_user_or_none(session, int(raw_user_id))
                except (TypeError, ValueError):
                    session_user = None
            if session_user is not None and session_user.status != "active":
                request.session.pop("user_id", None)
                session_user = None

            request.state.current_user = serialize_user(session_user) if session_user is not None else None
            request.state.has_users = user_present
            request.state.is_admin = bool(session_user is not None and session_user.role == "admin")

            if not user_present:
                if path == "/setup":
                    return await call_next(request)
                return auth_error_response(path, 503, "Initial setup is required.", "/setup")

            if session_user is None:
                if path in PUBLIC_PATHS:
                    return await call_next(request)
                return auth_error_response(path, 401, "Login required.", "/login")

            if session_user.must_change_password and path not in {"/change-password", "/logout", "/api/health"}:
                return auth_error_response(
                    path,
                    403,
                    "Password change required.",
                    "/change-password",
                )

            if path in {"/login", "/request-account", "/setup"}:
                return redirect_for_html("/records")

            if any(path.startswith(prefix) for prefix in ADMIN_PREFIXES) and session_user.role != "admin":
                return auth_error_response(path, 403, "Admin access required.", "/records")

        return await call_next(request)


app.add_middleware(AuthFlowMiddleware)
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET, same_site="lax")


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


def current_user_id(request: Request) -> int | None:
    current_user = getattr(request.state, "current_user", None) or {}
    raw_user_id = current_user.get("id")
    return int(raw_user_id) if raw_user_id not in (None, "") else None


def render_login_page(
    request: Request,
    *,
    identifier: str = "",
    error_message: str = "",
    status_code: int = 200,
) -> HTMLResponse:
    return templates.TemplateResponse(
        request=request,
        name="auth/login.html",
        context={
            "app_title": APP_TITLE,
            "identifier": identifier,
            "error_message": error_message,
            "needs_setup": not getattr(request.state, "has_users", True),
        },
        status_code=status_code,
    )


def render_request_account_page(
    request: Request,
    *,
    full_name: str = "",
    email: str = "",
    login_id: str = "",
    error_message: str = "",
    success_message: str = "",
    status_code: int = 200,
) -> HTMLResponse:
    return templates.TemplateResponse(
        request=request,
        name="auth/request_account.html",
        context={
            "app_title": APP_TITLE,
            "full_name": full_name,
            "email": email,
            "login_id": login_id,
            "error_message": error_message,
            "success_message": success_message,
        },
        status_code=status_code,
    )


def render_setup_page(
    request: Request,
    *,
    full_name: str = "",
    email: str = "",
    login_id: str = "",
    error_message: str = "",
    status_code: int = 200,
) -> HTMLResponse:
    return templates.TemplateResponse(
        request=request,
        name="auth/setup.html",
        context={
            "app_title": APP_TITLE,
            "full_name": full_name,
            "email": email,
            "login_id": login_id,
            "error_message": error_message,
        },
        status_code=status_code,
    )


def render_change_password_page(
    request: Request,
    *,
    error_message: str = "",
    success_message: str = "",
    status_code: int = 200,
) -> HTMLResponse:
    return templates.TemplateResponse(
        request=request,
        name="auth/change_password.html",
        context={
            "app_title": APP_TITLE,
            "error_message": error_message,
            "success_message": success_message,
        },
        status_code=status_code,
    )


def render_settings_clinic_page(
    request: Request,
    session: Session,
    *,
    profile_override: dict[str, Any] | None = None,
    error_message: str = "",
    success_message: str = "",
    status_code: int = 200,
) -> HTMLResponse:
    clinic_profile = profile_override or get_clinic_profile(session)
    return templates.TemplateResponse(
        request=request,
        name="settings/clinic.html",
        context={
            "app_title": APP_TITLE,
            "clinic_profile": clinic_profile,
            "clinic_logo_url": "/settings/clinic/logo" if clinic_profile.get("has_logo") else "",
            "error_message": error_message,
            "success_message": success_message,
        },
        status_code=status_code,
    )


def render_settings_users_page(
    request: Request,
    session: Session,
    *,
    error_message: str = "",
    success_message: str = "",
    status_code: int = 200,
) -> HTMLResponse:
    return templates.TemplateResponse(
        request=request,
        name="settings/users.html",
        context={
            "app_title": APP_TITLE,
            "pending_users": list_users(session, status="pending"),
            "active_users": list_users(session, status="active"),
            "disabled_users": list_users(session, status="disabled"),
            "pending_count": count_users(session, status="pending"),
            "active_count": count_users(session, status="active"),
            "disabled_count": count_users(session, status="disabled"),
            "error_message": error_message,
            "success_message": success_message,
        },
        status_code=status_code,
    )


def render_new_user_page(
    request: Request,
    *,
    full_name: str = "",
    email: str = "",
    login_id: str = "",
    role: str = "medtech",
    error_message: str = "",
    status_code: int = 200,
) -> HTMLResponse:
    return templates.TemplateResponse(
        request=request,
        name="settings/new_user.html",
        context={
            "app_title": APP_TITLE,
            "full_name": full_name,
            "email": email,
            "login_id": login_id,
            "selected_role": role,
            "error_message": error_message,
        },
        status_code=status_code,
    )


def render_records_home_page(
    request: Request,
    session: Session,
    *,
    search_query: str = "",
    status_filter: str = "",
) -> HTMLResponse:
    active_status = (status_filter or "").strip().lower()
    if active_status not in {"", "draft", "completed"}:
        active_status = ""
    query_text = (search_query or "").strip()
    has_filters = bool(query_text or active_status)
    matching_records = (
        list_records(
            session,
            status=active_status or None,
            search=query_text or None,
            limit=40,
        )
        if has_filters
        else []
    )
    matching_total_count = (
        count_records(
            session,
            status=active_status or None,
            search=query_text or None,
        )
        if has_filters
        else 0
    )
    return templates.TemplateResponse(
        request=request,
        name="records/home.html",
        context={
            "app_title": APP_TITLE,
            "form_choices": list_form_choices(session),
            "search_query": query_text,
            "status_filter": active_status,
            "has_filters": has_filters,
            "matching_records": matching_records,
            "matching_count": matching_total_count,
            "matching_shown_count": len(matching_records),
            "matching_truncated": matching_total_count > len(matching_records),
            "draft_count": count_records(session, status="draft"),
            "completed_count": count_records(session, status="completed"),
            "recent_drafts": list_records(session, status="draft", limit=8),
            "recent_completed": list_records(session, status="completed", limit=8),
        },
    )


def render_new_record_page(
    request: Request,
    session: Session,
    *,
    selected_form_slug: str = "",
    patient_name: str = "",
    patient_age: str = "",
    patient_sex: str = "",
    case_number: str = "",
    error_message: str = "",
    status_code: int = 200,
) -> HTMLResponse:
    return templates.TemplateResponse(
        request=request,
        name="records/new.html",
        context={
            "app_title": APP_TITLE,
            "form_choices": list_form_choices(session),
            "selected_form_slug": selected_form_slug,
            "patient_name": patient_name,
            "patient_age": patient_age,
            "patient_sex": patient_sex,
            "case_number": case_number,
            "error_message": error_message,
        },
        status_code=status_code,
    )


def render_record_edit_page(
    request: Request,
    session: Session,
    *,
    record_id: int,
    error_message: str = "",
    validation_issues: list[str] | None = None,
    status_code: int = 200,
) -> HTMLResponse:
    record = get_record_or_none(session, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found.")

    return templates.TemplateResponse(
        request=request,
        name="records/edit.html",
        context={
            "app_title": APP_TITLE,
            "record": serialize_record(record, include_entry_schema=True),
            "error_message": error_message,
            "validation_issues": validation_issues or [],
        },
        status_code=status_code,
    )


def render_record_view_page(
    request: Request,
    session: Session,
    *,
    record_id: int,
) -> HTMLResponse:
    record = get_record_or_none(session, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found.")

    return templates.TemplateResponse(
        request=request,
        name="records/view.html",
        context={
            "app_title": APP_TITLE,
            "record": serialize_record(record, include_entry_schema=True),
        },
    )


def render_record_print_page(
    request: Request,
    session: Session,
    *,
    record_id: int,
) -> HTMLResponse:
    record = get_record_or_none(session, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found.")

    return templates.TemplateResponse(
        request=request,
        name="records/print.html",
        context={
            "app_title": APP_TITLE,
            "document": build_record_print_document(record),
        },
    )


def record_update_payload_from_form_data(form_data: dict[str, list[str]]) -> RecordUpdatePayload:
    values: dict[str, Any] = {}
    for key, raw_values in form_data.items():
        if not key.startswith("value__"):
            continue
        block_id = key.removeprefix("value__").strip()
        if not block_id:
            continue
        value = (raw_values or [""])[0]
        values[block_id] = value

    return RecordUpdatePayload(
        patient_name=(form_data.get("patient_name") or [""])[0],
        patient_age=(form_data.get("patient_age") or [""])[0],
        patient_sex=(form_data.get("patient_sex") or [""])[0],
        case_number=(form_data.get("case_number") or [""])[0],
        values=values,
    )


@app.get("/", include_in_schema=False)
def root(request: Request) -> RedirectResponse:
    if not getattr(request.state, "has_users", True):
        return redirect_for_html("/setup")
    if getattr(request.state, "current_user", None):
        if request.state.current_user.get("must_change_password"):
            return redirect_for_html("/change-password")
        return redirect_for_html("/records")
    return redirect_for_html("/login")


@app.get("/setup", response_class=HTMLResponse)
def setup_page(request: Request) -> HTMLResponse:
    if getattr(request.state, "has_users", True):
        return redirect_for_html("/login")
    return render_setup_page(request)


@app.post("/setup")
async def create_initial_admin_page(request: Request, session: Session = Depends(get_session)):
    if getattr(request.state, "has_users", True):
        return redirect_for_html("/login")
    body = (await request.body()).decode("utf-8")
    form_data = parse_qs(body, keep_blank_values=True)
    payload = SetupAdminPayload(
        full_name=(form_data.get("full_name") or [""])[0],
        email=(form_data.get("email") or [""])[0],
        login_id=(form_data.get("login_id") or [""])[0],
        password=(form_data.get("password") or [""])[0],
    )
    try:
        user = create_initial_admin(session, payload)
    except ValueError as exc:
        return render_setup_page(
            request,
            full_name=payload.full_name,
            email=payload.email,
            login_id=payload.login_id or "",
            error_message=str(exc),
            status_code=422,
        )
    request.session["user_id"] = user["id"]
    return redirect_for_html("/records")


@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request) -> HTMLResponse:
    if not getattr(request.state, "has_users", True):
        return redirect_for_html("/setup")
    return render_login_page(request)


@app.post("/login")
async def login_action(request: Request, session: Session = Depends(get_session)):
    body = (await request.body()).decode("utf-8")
    form_data = parse_qs(body, keep_blank_values=True)
    payload = LoginPayload(
        identifier=(form_data.get("identifier") or [""])[0],
        password=(form_data.get("password") or [""])[0],
    )
    try:
        user = authenticate_user(session, payload)
    except ValueError as exc:
        return render_login_page(
            request,
            identifier=payload.identifier,
            error_message=str(exc),
            status_code=422,
        )
    request.session["user_id"] = user["id"]
    if user.get("must_change_password"):
        return redirect_for_html("/change-password")
    return redirect_for_html("/records")


@app.get("/request-account", response_class=HTMLResponse)
def request_account_page(request: Request) -> HTMLResponse:
    return render_request_account_page(request)


@app.post("/request-account")
async def request_account_action(request: Request, session: Session = Depends(get_session)):
    body = (await request.body()).decode("utf-8")
    form_data = parse_qs(body, keep_blank_values=True)
    payload = AccountRequestPayload(
        full_name=(form_data.get("full_name") or [""])[0],
        email=(form_data.get("email") or [""])[0],
        login_id=(form_data.get("login_id") or [""])[0],
        password=(form_data.get("password") or [""])[0],
    )
    try:
        user = request_account(session, payload)
    except ValueError as exc:
        return render_request_account_page(
            request,
            full_name=payload.full_name,
            email=payload.email,
            login_id=payload.login_id or "",
            error_message=str(exc),
            status_code=422,
        )
    return render_request_account_page(
        request,
        success_message=f"Account request saved for {user['full_name']}. Wait for admin approval before logging in.",
    )


@app.get("/change-password", response_class=HTMLResponse)
def change_password_page(request: Request) -> HTMLResponse:
    if not getattr(request.state, "current_user", None):
        return redirect_for_html("/login")
    return render_change_password_page(request)


@app.post("/change-password")
async def change_password_action(request: Request, session: Session = Depends(get_session)):
    user_id = current_user_id(request)
    if user_id is None:
        return redirect_for_html("/login")
    body = (await request.body()).decode("utf-8")
    form_data = parse_qs(body, keep_blank_values=True)
    payload = PasswordChangePayload(
        current_password=(form_data.get("current_password") or [""])[0],
        new_password=(form_data.get("new_password") or [""])[0],
    )
    try:
        change_user_password(
            session,
            user_id,
            payload,
            require_current_password=not bool((request.state.current_user or {}).get("must_change_password")),
        )
    except KeyError:
        request.session.pop("user_id", None)
        return redirect_for_html("/login")
    except ValueError as exc:
        return render_change_password_page(
            request,
            error_message=str(exc),
            status_code=422,
        )
    return render_change_password_page(
        request,
        success_message="Password updated. You can continue using the app now.",
    )


@app.post("/logout")
def logout_action(request: Request) -> RedirectResponse:
    request.session.clear()
    return redirect_for_html("/login")


@app.get("/records", response_class=HTMLResponse)
def records_home(
    request: Request,
    q: str = "",
    status: str = "",
    session: Session = Depends(get_session),
) -> HTMLResponse:
    return render_records_home_page(request, session, search_query=q, status_filter=status)


@app.get("/records/new", response_class=HTMLResponse)
def start_new_record_page(request: Request, session: Session = Depends(get_session)) -> HTMLResponse:
    return render_new_record_page(request, session)


@app.post("/records/new")
async def create_record_page(
    request: Request,
    session: Session = Depends(get_session),
):
    body = (await request.body()).decode("utf-8")
    form_data = parse_qs(body, keep_blank_values=True)
    payload = RecordCreatePayload(
        form_slug=(form_data.get("form_slug") or [""])[0],
        patient_name=(form_data.get("patient_name") or [""])[0],
        patient_age=(form_data.get("patient_age") or [""])[0],
        patient_sex=(form_data.get("patient_sex") or [""])[0],
        case_number=(form_data.get("case_number") or [""])[0],
    )
    try:
        created = create_record(session, payload, actor_user_id=current_user_id(request))
    except ValueError as exc:
        return render_new_record_page(
            request,
            session,
            selected_form_slug=payload.form_slug,
            patient_name=payload.patient_name or "",
            patient_age=payload.patient_age or "",
            patient_sex=payload.patient_sex or "",
            case_number=payload.case_number or "",
            error_message=str(exc),
            status_code=422,
        )
    return RedirectResponse(url=f"/records/{created['id']}/edit", status_code=303)


@app.get("/records/{record_id}/edit", response_class=HTMLResponse)
def edit_record_page(
    record_id: int,
    request: Request,
    session: Session = Depends(get_session),
) -> HTMLResponse:
    return render_record_edit_page(request, session, record_id=record_id)


@app.post("/records/{record_id}/edit")
async def update_record_page(
    record_id: int,
    request: Request,
    session: Session = Depends(get_session),
):
    body = (await request.body()).decode("utf-8")
    form_data = parse_qs(body, keep_blank_values=True)
    action = ((form_data.get("action") or ["draft"])[0] or "draft").strip().lower()
    payload = record_update_payload_from_form_data(form_data)

    try:
        if action == "complete":
            completed = complete_record(
                session,
                record_id,
                payload,
                preserve_asset_fields=True,
                actor_user_id=current_user_id(request),
            )
            return RedirectResponse(url=f"/records/{completed['id']}", status_code=303)

        update_record(
            session,
            record_id,
            payload,
            preserve_asset_fields=True,
            actor_user_id=current_user_id(request),
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Record not found.") from exc
    except RecordCompletionValidationError as exc:
        return render_record_edit_page(
            request,
            session,
            record_id=record_id,
            error_message=str(exc),
            validation_issues=exc.issues,
            status_code=422,
        )
    except ValueError as exc:
        return render_record_edit_page(
            request,
            session,
            record_id=record_id,
            error_message=str(exc),
            status_code=422,
        )

    return RedirectResponse(url=f"/records/{record_id}/edit", status_code=303)


@app.post("/records/{record_id}/assets")
async def upload_record_asset_page(
    record_id: int,
    request: Request,
    session: Session = Depends(get_session),
):
    form = await request.form()
    field_block_id = str(form.get("field_block_id") or "")
    image_file = form.get("image_file")

    try:
        if image_file is None or not hasattr(image_file, "read") or not getattr(image_file, "filename", ""):
            raise ValueError("Choose an image before uploading.")
        file_bytes = await image_file.read()
        store_record_image_asset(
            session,
            record_id=record_id,
            field_block_id=field_block_id,
            original_filename=image_file.filename,
            content_type=image_file.content_type,
            file_bytes=file_bytes,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Record not found.") from exc
    except ValueError as exc:
        return render_record_edit_page(
            request,
            session,
            record_id=record_id,
            error_message=str(exc),
            status_code=422,
        )

    return RedirectResponse(url=f"/records/{record_id}/edit", status_code=303)


@app.post("/records/{record_id}/assets/{asset_id}/remove")
def remove_record_asset_page(
    record_id: int,
    asset_id: int,
    request: Request,
    session: Session = Depends(get_session),
):
    try:
        delete_record_asset(session, record_id, asset_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Record asset not found.") from exc
    except ValueError as exc:
        return render_record_edit_page(
            request,
            session,
            record_id=record_id,
            error_message=str(exc),
            status_code=422,
        )
    return RedirectResponse(url=f"/records/{record_id}/edit", status_code=303)


@app.get("/records/{record_id}/assets/{asset_id}/file")
def record_asset_file(
    record_id: int,
    asset_id: int,
    session: Session = Depends(get_session),
) -> FileResponse:
    record = get_record_or_none(session, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found.")

    asset = next((item for item in record.assets if item.id == asset_id), None)
    if asset is None:
        raise HTTPException(status_code=404, detail="Record asset not found.")
    if not asset.storage_path:
        raise HTTPException(status_code=404, detail="Record asset file not found.")

    return FileResponse(
        asset.storage_path,
        media_type=asset.mime_type or None,
        filename=asset.original_filename,
    )


@app.get("/records/{record_id}", response_class=HTMLResponse)
def view_record_page(
    record_id: int,
    request: Request,
    session: Session = Depends(get_session),
) -> HTMLResponse:
    return render_record_view_page(request, session, record_id=record_id)


@app.get("/records/{record_id}/print", response_class=HTMLResponse)
def print_record_page(
    record_id: int,
    request: Request,
    session: Session = Depends(get_session),
) -> HTMLResponse:
    return render_record_print_page(request, session, record_id=record_id)


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
            "folder_path_label": current_choice["folder_path_label"] if current_choice else container.name,
            "parent_path_label": parent_choice["folder_path_label"] if parent_choice else "Top level",
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
            "folder_path_label": current_choice["folder_path_label"] if current_choice else container.name,
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
            "form_path_label": current_choice["form_path_label"] if current_choice else definition.name,
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


@app.get("/settings", response_class=HTMLResponse)
def settings_home() -> RedirectResponse:
    return redirect_for_html("/settings/clinic")


@app.get("/settings/clinic", response_class=HTMLResponse)
def settings_clinic_page(request: Request, session: Session = Depends(get_session)) -> HTMLResponse:
    success_message = ""
    if request.query_params.get("saved") == "1":
        success_message = "Saved the clinic profile."
    elif request.query_params.get("logo_removed") == "1":
        success_message = "Removed the clinic logo."
    return render_settings_clinic_page(request, session, success_message=success_message)


@app.post("/settings/clinic")
async def save_settings_clinic_page(request: Request, session: Session = Depends(get_session)):
    form = await request.form()
    payload = ClinicProfilePayload(
        clinic_name=str(form.get("clinic_name") or ""),
        address=str(form.get("address") or ""),
        contact_number=str(form.get("contact_number") or ""),
        contact_email=str(form.get("contact_email") or ""),
    )
    logo_file = form.get("logo_file")
    logo_bytes: bytes | None = None
    logo_filename = ""
    logo_content_type = ""
    if logo_file is not None and hasattr(logo_file, "read") and getattr(logo_file, "filename", ""):
        logo_bytes = await logo_file.read()
        logo_filename = str(getattr(logo_file, "filename", "") or "")
        logo_content_type = str(getattr(logo_file, "content_type", "") or "")

    try:
        save_clinic_profile(
            session,
            payload,
            logo_filename=logo_filename,
            logo_content_type=logo_content_type,
            logo_bytes=logo_bytes,
        )
    except ValueError as exc:
        return render_settings_clinic_page(
            request,
            session,
            profile_override={
                **get_clinic_profile(session),
                "clinic_name": payload.clinic_name,
                "address": payload.address or "",
                "contact_number": payload.contact_number or "",
                "contact_email": payload.contact_email or "",
            },
            error_message=str(exc),
            status_code=422,
        )
    return RedirectResponse(url="/settings/clinic?saved=1", status_code=303)


@app.post("/settings/clinic/logo/remove")
def remove_settings_clinic_logo_page(request: Request, session: Session = Depends(get_session)):
    remove_clinic_logo(session)
    return RedirectResponse(url="/settings/clinic?logo_removed=1", status_code=303)


@app.get("/settings/clinic/logo")
def settings_clinic_logo_file(session: Session = Depends(get_session)) -> FileResponse:
    clinic_profile = get_clinic_profile(session)
    logo_path = str(clinic_profile.get("logo_path") or "")
    if not logo_path or not Path(logo_path).is_file():
        raise HTTPException(status_code=404, detail="Clinic logo not found.")
    return FileResponse(
        logo_path,
        media_type=str(clinic_profile.get("logo_mime_type") or "") or None,
        filename=str(clinic_profile.get("logo_original_filename") or "") or None,
    )


@app.get("/settings/users", response_class=HTMLResponse)
def settings_users_page(request: Request, session: Session = Depends(get_session)) -> HTMLResponse:
    return render_settings_users_page(request, session)


@app.get("/settings/users/new", response_class=HTMLResponse)
def settings_new_user_page(request: Request) -> HTMLResponse:
    return render_new_user_page(request)


@app.post("/settings/users/new")
async def create_user_account_page(request: Request, session: Session = Depends(get_session)):
    body = (await request.body()).decode("utf-8")
    form_data = parse_qs(body, keep_blank_values=True)
    payload = UserCreatePayload(
        full_name=(form_data.get("full_name") or [""])[0],
        email=(form_data.get("email") or [""])[0],
        login_id=(form_data.get("login_id") or [""])[0],
        role=(form_data.get("role") or ["medtech"])[0],
        password=(form_data.get("password") or [""])[0],
    )
    try:
        created = create_user_account(session, payload)
    except ValueError as exc:
        return render_new_user_page(
            request,
            full_name=payload.full_name,
            email=payload.email,
            login_id=payload.login_id or "",
            role=payload.role,
            error_message=str(exc),
            status_code=422,
        )
    return render_settings_users_page(
        request,
        session,
        success_message=f"Created {created['full_name']} as an active {created['role']} account.",
    )


@app.post("/settings/users/{user_id}/approve")
async def approve_user_account_page(
    user_id: int,
    request: Request,
    session: Session = Depends(get_session),
):
    body = (await request.body()).decode("utf-8")
    form_data = parse_qs(body, keep_blank_values=True)
    role = (form_data.get("role") or ["medtech"])[0]
    try:
        updated = approve_user_account(session, user_id, role=role)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="User not found.") from exc
    except ValueError as exc:
        return render_settings_users_page(request, session, error_message=str(exc), status_code=422)
    return render_settings_users_page(
        request,
        session,
        success_message=f"Approved {updated['full_name']} as {updated['role']}.",
    )


@app.post("/settings/users/{user_id}/disable")
def disable_user_account_page(
    user_id: int,
    request: Request,
    session: Session = Depends(get_session),
):
    try:
        updated = update_user_status(session, user_id, status="disabled")
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="User not found.") from exc
    except ValueError as exc:
        return render_settings_users_page(request, session, error_message=str(exc), status_code=422)
    return render_settings_users_page(
        request,
        session,
        success_message=f"Disabled {updated['full_name']}.",
    )


@app.post("/settings/users/{user_id}/activate")
def activate_user_account_page(
    user_id: int,
    request: Request,
    session: Session = Depends(get_session),
):
    try:
        updated = update_user_status(session, user_id, status="active")
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="User not found.") from exc
    except ValueError as exc:
        return render_settings_users_page(request, session, error_message=str(exc), status_code=422)
    return render_settings_users_page(
        request,
        session,
        success_message=f"Reactivated {updated['full_name']}.",
    )


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/records/bootstrap")
def records_bootstrap(session: Session = Depends(get_session)) -> dict[str, Any]:
    return {
        "app_title": APP_TITLE,
        "form_choices": list_form_choices(session),
        "recent_drafts": list_records(session, status="draft", limit=8),
        "recent_completed": list_records(session, status="completed", limit=8),
    }


@app.get("/api/records")
def records_index(
    status: str = "",
    q: str = "",
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    return {"records": list_records(session, status=status or None, search=q or None)}


@app.post("/api/records", status_code=201)
def create_record_endpoint(
    payload: RecordCreatePayload,
    request: Request,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    try:
        return create_record(session, payload, actor_user_id=current_user_id(request))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/records/{record_id}")
def get_record(record_id: int, session: Session = Depends(get_session)) -> dict[str, Any]:
    record = get_record_or_none(session, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found.")
    return serialize_record(record, include_entry_schema=True)


@app.put("/api/records/{record_id}")
def update_record_endpoint(
    record_id: int,
    payload: RecordUpdatePayload,
    request: Request,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    try:
        return update_record(session, record_id, payload, actor_user_id=current_user_id(request))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Record not found.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/records/{record_id}/complete")
def complete_record_endpoint(
    record_id: int,
    payload: RecordUpdatePayload,
    request: Request,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    try:
        return complete_record(session, record_id, payload, actor_user_id=current_user_id(request))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Record not found.") from exc
    except RecordCompletionValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail={
                "message": str(exc),
                "issues": exc.issues,
            },
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/records/{record_id}/assets")
async def upload_record_asset_endpoint(
    record_id: int,
    field_block_id: str = Form(...),
    image_file: UploadFile = File(...),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    try:
        file_bytes = await image_file.read()
        return store_record_image_asset(
            session,
            record_id=record_id,
            field_block_id=field_block_id,
            original_filename=image_file.filename or "",
            content_type=image_file.content_type,
            file_bytes=file_bytes,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Record not found.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.delete("/api/records/{record_id}/assets/{asset_id}")
def delete_record_asset_endpoint(
    record_id: int,
    asset_id: int,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    try:
        return delete_record_asset(session, record_id, asset_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Record asset not found.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


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
