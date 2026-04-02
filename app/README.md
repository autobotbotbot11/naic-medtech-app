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
- the backend now includes a first safe future-proofing step: a generic persisted `container | form` library tree foundation
- the compatibility library tree is exposed at `/api/library/tree`
- the backend now also exposes a compatibility `block_schema` bridge on form reads, plus `/api/forms/{slug}/block-schema`
- create/update flows can now accept either the current legacy `fields + sections` shape or a limited compatible `blocks` shape
- each form version now also stores a real `block_schema_json` payload alongside the legacy `schema_json`
- startup now backfills missing stored block schemas for older versions
- non-legacy block kinds like `note` and `divider` can now be preserved in stored block schema even when the legacy compatibility projection skips them
- the frontend builder draft now keeps a compatibility `block_schema` in sync while the calmer legacy editor stays intact
- save requests now go out through `block_schema`
- the current calmer editor now reads and writes through block-backed paths for focused editing, preview rendering, and top-level ungrouped/section organizer flows
- advanced mode now exposes a real `Layout` pane that works on the top-level ordered `block_schema.blocks` collection
- advanced `Layout` can now add real `note` and `divider` blocks without forcing them into the calmer default editing panes
- the live preview now follows the real top-level block order, including separated ungrouped-field clusters when root fields appear in multiple places
- the live preview can now render `note` and `divider` blocks from stored `block_schema`, while default `Ungrouped fields` and `Sections` panes stay focused on ordinary field editing
- the visible surface still keeps a compatibility `fields + sections` projection so the UI can stay calm while the engine migrates underneath it
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
- the focused section/field/choice strips are quieter too: they now use small label-style cues like `Section`, `Field`, `Group`, and `Choice` instead of sentence-style `Editing this ...` copy
- the top-level left outline is quieter too: `Ungrouped fields` and `Sections` no longer show count chips, so the rail reads more like simple navigation
- the center and preview chrome are quieter too: the builder header, `Sections` header, and preview surfaces no longer repeat summary count badges
- the center organizer metadata is quieter too: section rows no longer repeat item counts, field rows use simpler type cues like `Dropdown`, and the choices editor no longer repeats choice counts in its header and spotlight
- the preview wording is calmer too: shorter `Show` and `Hide` actions, `Live preview` callout language, and preview copy that reads more like a live companion than a technical sample panel
- the empty-state and no-data copy are warmer too: builder and library messages now guide the user more gently instead of sounding like raw system states
- the save surface is calmer too: `Save draft` is now just `Save`, the finish-step wording is softer, the floating save dock is quieter, and the save card now stays in sync with dirty state while editing the note
- the library page is calmer too: folder jump counts and repeated folder metadata are gone, and form card actions now use shorter labels like `Copy` and `Edit`
- the library cards are lighter too: version labels are subtler (`v1`), card spacing is tighter, and the secondary library area now reads as `Older forms` with calmer copy
- the top of the library page is calmer too: shorter header copy, quieter `Find` search affordance, and a lighter `New` action for a cleaner first glance
- the library header itself is tighter too: spacing is calmer, the top band sits lower visually, and the first impression is less crowded
- official reference groups are shown in the main library area
- extra working or scratch groups are tucked into a secondary collapsed area
- the current long-term builder direction is documented in:
  - `../docs/handoff/FLEXIBLE_BUILDER_FOUNDATION.md`
  - `../docs/handoff/BUILDER_DATA_MODEL_SPEC.md`
  - `../docs/handoff/BUILDER_UX_FLOW_SPEC.md`
  - `../docs/handoff/BUILDER_WIREFRAME_IMPLEMENTATION_PLAN.md`
- important limitation: the visible builder is now partially block-backed, but the default calm surface still mirrors the older `fields + sections` mental model
- richer block kinds like `note` and `divider` are now available only through advanced `Layout`, while the legacy compatibility projection is still intentionally limited to `field`, `field_group`, and `section`

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
