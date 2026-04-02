# App Source

The app now starts from a builder-first FastAPI scaffold.

## Stack
- Backend: `FastAPI`
- Database: `SQLite`
- Frontend base: server-rendered `HTML`, `CSS`, and `JS`
- Builder V2 recommendation: minimal helper libraries such as `Alpine.js` and `SortableJS`

## Current focus
- phase 1 is the `exam/form builder`
- the app seeds itself from `../artifacts/schema/naic_medtech_app_schema.json`
- runtime data lives in `../data/runtime/naic_medtech.db`
- the new entry screen is `/forms`, a dedicated `Form Library`
- new form creation now starts from `/forms/new`, a guided `Start New Form` screen
- the builder workspace now uses a calmer `outline + focused editor + live preview` layout
- the `Sections` view now uses a compact organizer plus one focused section editor
- `Free fields` and selected sections now use compact field organizers plus one focused field editor
- dropdown `Choices` editors now use compact choice organizers plus one focused choice editor
- `Form details` and `Save` now use narrower calmer guided surfaces
- the folder field suggests existing library folders while editing form details
- the top shell now uses a lighter status bar and a more compact workspace header
- the live preview is now read-only and includes sticky quick-jump section navigation
- the left outline and library wording now use calmer non-technical labels like `Basics`, `Ungrouped fields`, `Folder`, and `Edit Form`
- the selected field editor is now lighter: the organizer owns drag/reorder, while the focused editor uses a compact basics row and a smaller choice editor
- the selected section editor is now lighter too: the organizer owns reorder, while the focused section uses a smaller summary strip and simpler section basics
- duplicate and delete for selected sections and fields now live in a quieter footer `More options` area instead of staying in the header
- the `Sections` pane is now less mechanical: it shows a simple section count, removes organizer row numbers, and marks only the active row as `Editing`
- the nested `Choices` organizer is now less mechanical too: it removes choice row numbers, marks only the active choice as `Editing`, and uses a calmer selected-choice spotlight
- selected choice actions now use a quieter footer `More options` area too, with `Duplicate` and a calmer confirmed `Delete` flow
- the left outline is less manager-like now: section subitems no longer show per-row counts, and only the active section shows `Editing`
- the top shell is calmer too: the status strip is more subtle, status messages are shorter, and the live-preview callout uses steadier less repetitive copy
- the top-right app-bar actions are quieter now: `New` and `Save` stay visible, while `Duplicate` moved into a small overflow menu
- the preview panel header is quieter too: shorter heading/copy, shorter hide action, and less repeated live/read-only wording inside the preview card
- the left rail header is quieter too: `This form` became `Outline`, the extra summary line was removed, and the navigation block reads less like a mini dashboard
- the center workspace header is quieter too: `Editing` became `Builder`, the title now uses the form name directly, and the supporting copy is shorter and less repetitive
- official reference groups are shown in the main library area
- extra working or scratch groups are tucked into a secondary collapsed area
- the current long-term builder direction is documented in:
  - `../docs/handoff/FLEXIBLE_BUILDER_FOUNDATION.md`
  - `../docs/handoff/BUILDER_DATA_MODEL_SPEC.md`
  - `../docs/handoff/BUILDER_UX_FLOW_SPEC.md`
  - `../docs/handoff/BUILDER_WIREFRAME_IMPLEMENTATION_PLAN.md`

## Run locally
1. Create and activate a virtual environment.
2. Install dependencies:

```powershell
pip install -r app/requirements.txt
```

3. Start the server:

```powershell
uvicorn naic_builder.main:app --reload --app-dir app
```

4. Open:

```text
http://127.0.0.1:8000
```

## Reset sample builder data
If the tracked sample runtime DB gets cluttered during builder testing, reset it back to the clean schema-seeded state:

```powershell
python tools/scripts/reset_builder_runtime_db.py
```

## Important note
This scaffold is intentionally builder-first. Accounts, deeper admin controls, and broader operations modules should come after the form builder foundation is stable.
