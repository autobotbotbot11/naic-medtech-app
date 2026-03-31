# App Source

The app now starts from a builder-first FastAPI scaffold.

## Stack
- Backend: `FastAPI`
- Database: `SQLite`
- Frontend: vanilla `HTML`, `CSS`, and `JS`

## Current focus
- phase 1 is the `exam/form builder`
- the app seeds itself from `../artifacts/schema/naic_medtech_app_schema.json`
- runtime data lives in `../data/runtime/naic_medtech.db`

## Run locally
1. Create and activate a virtual environment.
2. Install dependencies:

```powershell
pip install -r app/requirements.txt
```

3. Start the server:

```powershell
uvicorn app.naic_builder.main:app --reload
```

4. Open:

```text
http://127.0.0.1:8000
```

## Important note
This scaffold is intentionally builder-first. Accounts, deeper admin controls, and broader operations modules should come after the form builder foundation is stable.
