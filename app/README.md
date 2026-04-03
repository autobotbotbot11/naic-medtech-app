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
- the backend now exposes the compatibility `block_schema` bridge directly on form reads
- create/update flows can now accept either the current legacy `fields + sections` shape or a limited compatible `blocks` shape
- each form version now also stores a real `block_schema_json` payload alongside the legacy `schema_json`
- startup now backfills missing stored block schemas for older versions
- non-legacy block kinds like `note` and `divider` can now be preserved in stored block schema even when the legacy compatibility projection skips them
- the frontend builder draft is now block-first too: the live editor state no longer keeps a duplicated `draft.schema`, and setup details like `Key` and `Notes` now read and write directly through `block_schema.meta`
- save requests now go out through `block_schema`
- the current calmer editor now reads and writes through block-backed paths for focused editing, preview rendering, and top-level content/section organizer flows
- advanced mode now exposes a real `Layout` pane that works on the top-level ordered `block_schema.blocks` collection
- advanced `Layout` can now add real `note` and `divider` blocks without forcing them into the calmer default editing panes
- advanced `Layout` can now also add a real `table` block for richer structured result layouts without exposing that complexity in the default panes
- the live preview now follows the real top-level block order, including separated top-field clusters when root fields appear in multiple places
- the live preview can now render `note` and `divider` blocks from stored `block_schema`, while the calm default pane stays focused on ordinary field and section editing
- the live preview can now render real `table` blocks too, including nested tables inside sections
- selected sections can now add real `note`, `divider`, and `table` blocks too, but only in `Advanced` mode so the normal section editor stays simple by default
- selected groups can now add real `note`, `divider`, and `table` blocks in `Advanced` mode too, and the live preview now renders those nested utility blocks from the real block tree
- advanced mode can now open a real child-layout workspace for a selected section or group, so nested block order can be edited directly without changing the calmer default panes
- when a section contains advanced utility blocks, the default section editor hides them and shows a quiet hint instead of exposing extra controls in the normal flow
- richer stored block schema is now preserved correctly across save/reload hydration, so advanced-only blocks are no longer dropped when a saved response is reloaded into the calmer builder UI
- presets have been deliberately removed from the active product path for now so the builder stays focused on the core flow
- `/forms/new` now starts only from `Blank` or `Duplicate existing form`
- `/forms/new` now uses real container choices from the persisted library tree instead of the older one-level grouped-folder list
- `/forms/new` can now also intentionally place a form at the top level instead of forcing every new form into a folder
- `/forms/new` duplicate choices now use the real tree too, showing full folder paths instead of the older grouped optgroup list
- `/forms/new` can now create a brand-new folder inside an existing folder, and the first save will resolve that pending nested folder into the real library tree
- `/folders/new` now exists as a small standalone folder-creation screen, so empty folders can be created directly before any forms exist inside them
- `/folders/edit` now gives folders a real management path too: they can be renamed, and they can be deleted once empty
- `/folders/move` and `/forms/move` now give the tree real move flows too, so folders and forms can change parent location without falling back to the old one-level grouped model
- the first save path can now carry a real `library_parent_node_key`, so new drafts can keep their intended container parent without collapsing back to a one-level folder assumption
- builder bootstrap and advanced `Layout` no longer expose preset actions while the core flexible engine is being finished
- the visible surface still keeps a compatibility projection so the UI can stay calm while the engine migrates underneath it
- the new entry screen is `/forms`, a dedicated `Form Library`
- new form creation now starts from `/forms/new`, a guided `Start New Form` screen
- the builder workspace now uses a calmer `outline + focused editor + live preview` layout
- the default workspace now lands on a single `Content` pane driven by real top-level block order instead of splitting the root flow into separate `Ungrouped fields` and `Sections` panes
- the root `Content` pane now inserts new top-level blocks relative to the current selected block when possible, so the main workspace follows real root order instead of old bucket placement rules
- the left outline now follows that same root content model too, showing real top-level content items instead of a section-only shortcut list
- in `Advanced` mode, the root `Content` pane can now add `note`, `divider`, and `table` blocks directly without forcing users into `Layout` just to place them
- the focused content pane uses one organizer plus one focused editor, while selected sections and groups still use compact field organizers plus one focused field editor
- nested section and group content now also inserts relative to the currently selected child block when possible, so deeper editing follows real ordered block behavior instead of always appending at the end
- selected groups can now add nested groups in the normal flow too, so grouped content is less locked to a field-only structure
- selected groups now use the same compact child organizer plus one focused child editor pattern as selected sections, instead of spilling every child card open at once
- the old separate root `Ungrouped fields` and `Sections` panes are no longer active workspace paths; the builder now uses one real root `Content` path instead of keeping both models alive
- the old root section-only focus path has now been removed from the active builder flow, so the workspace no longer keeps that extra root shortcut model alive behind the scenes
- advanced `Layout` add actions now insert relative to the current selected block when possible, so the true ordered-block surface no longer blindly appends new blocks
- advanced and fallback wording is calmer now too: the builder now prefers `content` and `item` language over more technical `block` wording in the visible UI
- the live preview now also uses calmer root labels like `Top content` instead of the older `Top fields` or `Layout` wording for mixed root content
- repeated add-button clusters are now collapsed into a quieter `Add` menu in `Content`, `Layout`, sections, and groups, so deeper editing feels less like managing buckets and more like inserting content pieces
- focused group cards are lighter too: the dead disabled `Type = Group` row is gone, and the focused spotlight now uses quieter summary copy like `Nested content` instead of repeating mechanical metadata
- focused field cards are lighter too: their focused state no longer repeats the field-type label above the title, their spotlight only shows truly useful metadata, advanced labels like `Normal` and `Unit` are shorter, and multi-cluster preview labels now read `More content` instead of awkward numbering like `Top content 2`
- focused section cards are lighter too: the duplicate `Section` spotlight strip is gone, and deeper advanced actions now use the shorter `Layout` label instead of `Open layout`
- focused field and option editors are flatter too: the extra focused spotlight panels are gone, so those editors now read more like direct content editing and less like schema inspector cards
- preview root clusters now use calmer labels like `Details` and `More details` instead of `Top content`
- focused section, group, and utility cards are flatter too: redundant kind chips and utility spotlights are gone, so those editors now spend less space repeating what the item already is
- organizer rows and the left outline are quieter too: named sections and groups no longer repeat redundant `Section` or `Group` subtitles, while field and utility cues still appear when they actually help with scanning
- field organizers are quieter too: plain text and number fields no longer repeat type subtitles, while higher-signal cues like `Dropdown`, `Date`, `Time`, and utility kinds stay visible for faster scanning
- field input wording is calmer too: the picker now says `Input`, with simpler choices like `Text`, `Choices`, and `Date & time`
- active organizer rows are quieter too: the old `Editing` pills are gone from the outline and nested organizers, so focus now reads through the active highlight instead of extra status chips
- advanced labels and helper copy are calmer too: shorter labels like `Key` and `Notes`, and simpler content/help text now keep the builder and library screens less technical without changing behavior
- the old shared `Record defaults` selector is now hidden from the visible builder flow, so setup stays closer to the flexible lego model while backend compatibility remains intact
- the guided `/forms/new` flow is less legacy too: it no longer carries old grouping/order hidden fields into the builder, only the tree/location data the current flow actually needs
- the frontend draft logic is less legacy too: new and duplicated drafts no longer depend on old grouping/order fields just to keep the current builder working
- library-tree sync is stronger too: `FormDefinition` location metadata is now backfilled from real library nodes, so page flows rely less on old `group_name/group_kind` fallbacks
- top-level drafts are more stable too: renaming a top-level form now keeps the fallback location state in sync, so the builder no longer shows a stale old location name
- the builder no longer tracks `common_field_set_id` in the active frontend draft path, so the current UI no longer carries that hidden shared-metadata concept around while editing
- serialized form responses no longer expose `common_field_set_id` either, so the active API shape is less tied to the old shared-metadata model
- serialized form responses no longer expose `group_name`, `group_kind`, `group_order`, or `form_order`; the live API now exposes only tree-first `location_*` metadata, while the builder recreates any needed compatibility shadow state locally
- the visible builder location helpers now read from `location_*` directly too; `group_name` remains only as internal shadow metadata inside the sync helper instead of a primary display source
- the active save contract is leaner too: `FormSavePayload` no longer declares `group_name`, and legacy callers are mapped into `location_name` during validation instead of staying as a first-class field
- `FormDefinition.common_field_set_id` is no longer actively mirrored during seed/create flows, and update flows now clear that old mirror field instead of keeping it in sync with the schema
- the active schema/block normalizers are less special too: new create/update/seed flows no longer inject a synthetic `common_field_set_id` into saved `schema_json` or `block_schema_json`, so the hidden shared-record concept is no longer minted into fresh versions by default
- generated legacy schema ids are less location-bound too: new create/update/seed flows now use stable form-based ids like `form.urine` instead of encoding the old folder/group name into the schema id
- the schema seed/reset path is more tree-first too: `ensure_reference_seed()` now creates real container and form nodes first, then backfills legacy location mirrors from those nodes instead of seeding forms through the old grouped-first path
- `ensure_library_tree()` is more tree-first too: it no longer orchestrates sync work in old `group_order/form_order` order, it prefers real node parent/order first, and it now uses the shared form-node/container helpers for rebuilds instead of manually recreating grouped-first state
- direct model-layer placeholder writes are more isolated too: create and seed flows now build `FormDefinition` rows through one small compatibility-shell helper instead of open-coding `group_*` values in multiple places
- stale `FormDefinition.common_field_set_id` values no longer survive active tree sync either: the same compatibility-sync path now clears that old mirror field back to `None`
- the `FormDefinition` model contract is less legacy too: old `group_name`, `group_kind`, `group_order`, and `form_order` columns are now nullable compatibility shadows instead of required first-class fields
- runtime schema migration now upgrades older SQLite DBs to that nullable shape too, so existing local DBs no longer force placeholder writes just to satisfy the old grouped model
- the reset script now follows that same runtime migration path too, so a fresh sample DB no longer regresses back to the old NOT NULL grouped-column shape
- the last-resort tree rebuild fallback is safer too: if a definition loses its node, parent key, and all usable legacy location hints, it now rebuilds as a top-level form instead of inventing a self-named folder from missing legacy data
- stored version metadata is cleaner too: startup/reset backfill now strips stale `common_field_set_id` from old `schema_json` and `block_schema_json`, and it normalizes old `legacy_form_*` block meta into cleaner `form_*` keys with stable `form.<slug>` ids
- the save payload alias path is thinner too: `group_name` is now just a tolerated legacy input alias that gets normalized into `location_name` and removed before validation, instead of lingering as part of the active request shape
- top-level compatibility shadows are more honest too: when a form lives at the root, legacy `group_name`, `group_kind`, and `group_order` are now kept `NULL` instead of being filled with a fake self-named group
- grouped compatibility shadows are thinner too: live tree sync no longer actively maintains legacy `group_kind`; grouped fallback now relies on `group_name` and ordering hints only
- stale self-named top-level shadows are safer too: if an old form still carries a fake self-named `group_name`, rebuild fallback now treats that as top-level instead of recreating a bogus folder
- the stored model shape is thinner too: `FormDefinition.group_kind` is gone from the live SQLAlchemy/runtime DB shape, and older local DBs are rebuilt forward automatically on startup
- the stored model shape is thinner again too: `FormDefinition.common_field_set_id` is gone from the live SQLAlchemy/runtime DB shape now too, and older local DBs are rebuilt forward automatically on startup
- the stored model shape is thinner again too: `FormDefinition.group_order` is gone from the live SQLAlchemy/runtime DB shape, and grouped fallback now preserves existing container order instead of mirroring that old field
- the stored model shape is thinner again too: `FormDefinition.group_name` is gone from the live SQLAlchemy/runtime DB shape, and if a form loses both its real node and parent key, fallback now treats it as top-level instead of trusting old grouped-name shadows
- the stored model shape is thinner again too: `FormDefinition.form_order` is gone from the live SQLAlchemy/runtime DB shape, and rebuild fallback now uses the current version schema order instead of a separate legacy mirror column
- the backend resolver path is thinner too: `ensure_library_tree()` now reads schema order directly instead of going through a leftover legacy location-hint wrapper, and `resolve_form_location_metadata()` no longer returns unused `resolved_parent_name` / `resolved_parent_order` scaffolding
- the live contract is thinner too: save validation no longer maps `group_name` into `location_name`, and `/builder` new-draft startup now reads only `location_name` instead of tolerating old grouped-era query params
- the live save contract is thinner too: the builder now posts `form_schema` directly, and backend validation no longer remaps old `schema` into `form_schema`
- the live save contract is stricter too: `FormSavePayload` now expects the block-based `form_schema` shape in active API usage, so old `fields/sections` save payloads are no longer part of the live builder contract
- the live form-read contract is thinner too: `/api/forms/{slug}` now returns only `block_schema` for the active form shape, and the builder derives any temporary legacy projection locally
- backend naming is more honest too: the no-op save alias validator is gone, and the remaining form-definition helpers in `services.py` now read like tree-first helpers instead of grouped-era compatibility names
- the active create/update path is thinner too: block-based save payloads now normalize directly through a block-first helper instead of routing the live request path through `coerce_legacy_schema()`
- active block metadata is cleaner too: new writes now use `form_id`, `form_key`, and `form_order` in `block_schema.meta`, while old `legacy_form_*` keys are only read/backfilled for stored compatibility
- form create, update, and move flows now use a shared tree-first form-node sync helper, so the real `LibraryNode` state is updated directly before legacy mirrors are backfilled
- `resolve_form_location_metadata()` is more tree-first too: it now feeds create/update with `resolved_parent_*` and `resolved_form_order` values instead of returning `group_*` as the primary active shape
- legacy `group_*` mirror backfill is now centralized too: one helper derives those compatibility fields from the real node state instead of duplicating that logic across create/update/move/tree-sync paths
- top-level new and copied drafts are cleaner too: they no longer start from the old `Unassigned` sentinel or keep a stale previous form name as fake location state
- the builder frontend reads more tree-first too: active suggestion helpers and setup variables now use `location` language instead of old `group` wording where the UI already treats folders as locations
- the active create/update resolver is more tree-first too: it now derives parent/order state from real library nodes and the current location intent, instead of depending on old `group_kind/group_order/form_order` inputs
- the `/forms/new` flow reads more consistently now too: its template and browser-side logic use `location` wording for the visible create flow, and the handoff into `/builder` now uses `location_name` only
- serialized form payloads are more tree-first too: `serialize_form()` now returns `location_name`, `location_path_label`, `location_node_key`, and `location_kind`, and the builder display/helpers prefer those aliases while keeping legacy `group_name` compatibility for save/update
- the active save API is more tree-first too: the current builder now posts `location_name`, while the backend still accepts legacy `group_name` callers through compatibility mapping
- active read compatibility is more tree-first too: legacy `group_*` metadata is now derived from the real library tree during serialization and grouped listings, instead of trusting the raw stored legacy columns
- the visible builder setup flow is more tree-first too: the `Location` input now binds to `location_name` instead of the old `group_name`, while the draft still keeps compatibility metadata synchronized behind the scenes
- the active builder draft is more tree-first too: `location_*` is now the only active location state in the editor
- the active builder setup internals are thinner too: `Key` and `Notes` now bind straight to `block_schema.meta`, and the live draft no longer keeps a duplicated `draft.schema` object just to drive those fields
- the active organizer/render path is thinner too: content organizers, focused cards, and preview section labels now read directly from block nodes instead of carrying a synthetic legacy `.view` projection through the live builder UI
- the save payload schema is leaner too: `group_kind`, `group_order`, and `form_order` are no longer part of `FormSavePayload`, and old callers can still send them as ignored compatibility extras
- dead grouped-library backend helpers are gone too: the codebase no longer keeps `list_grouped_forms` / `split_library_groups` around even though the live app is already tree-first
- the visible advanced pane now reads `Arrange` instead of `Layout`, so the UI feels more like arranging content than editing a technical layer
- builder action wording is quieter too: `Duplicate` now reads `Copy`, `More` is shorter and calmer than the old `More options`, and destructive actions now prefer `Remove` language for a less tool-like feel
- toggle and preview wording are calmer too: setup/save/section cards now use `Show` and `Hide` instead of `Open` and `Done`, and preview helper copy now says `Choose` or `Show` instead of `Open`
- dropdown `Choices` editors now use compact choice organizers plus one focused choice editor
- `Form details` and `Save` now use narrower calmer guided surfaces
- the folder field suggests existing library folders while editing form details
- the top shell now uses a lighter status bar and a more compact workspace header
- the live preview is now read-only and includes sticky quick-jump section navigation
- the left outline and library wording now use calmer non-technical labels like `Basics`, `Content`, `Location`, and `Edit`
- the builder basics flow is clearer too: it now says `Name` and `Location`, and top-level forms read as `Top level` instead of the old `Unassigned`
- item editors are calmer too: fields, options, and utility items now use `Name` instead of the more technical `Label`
- the builder `Location` field is now tree-aware too: it suggests real folder paths from the persisted container tree and resolves the correct parent container when one is selected
- the builder quick-switch drawer is tree-aware now too: it searches and lists forms by real folder path instead of the old one-level grouped drawer
- the builder bootstrap path is tree-first now too: quick-switch data comes from `form_choices`, not the old grouped builder payload
- the builder bootstrap payload no longer sends old shared-metadata options either, since that control is no longer part of the visible builder flow
- the current builder save path is less legacy too: it no longer posts old grouping/order fields, and the backend now derives folder/order metadata from the real tree when possible
- the selected field editor is now lighter: the organizer owns drag/reorder, while the focused editor uses a compact basics row and a smaller choice editor
- the selected section editor is now lighter too: the organizer owns reorder, while the focused section uses a smaller summary strip and simpler section basics
- duplicate and delete for selected sections and fields now live in a quieter footer `More` area instead of staying in the header
- the `Sections` pane is now less mechanical: it shows a simple section count, removes organizer row numbers, and marks only the active row as `Editing`
- the nested `Choices` organizer is now less mechanical too: it removes choice row numbers, marks only the active choice as `Editing`, and uses a calmer selected-choice spotlight
- selected choice actions now use a quieter footer `More` area too, with `Copy` and a calmer confirmed `Delete` flow
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
- the library cards are lighter too: version labels are subtler (`v1`), card spacing is tighter, and the library reads less like an admin list
- the top of the library page is calmer too: shorter header copy, quieter `Find` search affordance, and a lighter `New` action for a cleaner first glance
- the library header itself is tighter too: spacing is calmer, the top band sits lower visually, and the first impression is less crowded
- `/forms` now renders directly from the real persisted `container | form` tree instead of the older one-level grouped library view
- the library can now show both root-level forms and folders in one calm tree-first browse surface
- library search now works against the full folder path text instead of only one-level group labels
- folder cards in `/forms` can now launch folder-scoped creation directly via `New form here` and `New folder here`
- folder cards in `/forms` can now also launch `Edit folder`, so the visible tree flow is no longer create-only
- folder cards in `/forms` can now also launch `Move`, and form cards can now launch `Move` too, so the visible library flow is no longer limited to browse/create/edit
- the library top bar now also has a direct `New folder` path for root-level folder creation
- the current long-term builder direction is documented in:
  - `../docs/handoff/FLEXIBLE_BUILDER_FOUNDATION.md`
  - `../docs/handoff/BUILDER_DATA_MODEL_SPEC.md`
  - `../docs/handoff/BUILDER_UX_FLOW_SPEC.md`
  - `../docs/handoff/BUILDER_WIREFRAME_IMPLEMENTATION_PLAN.md`
- important limitation: the visible builder is now partially block-backed, but deeper editing still uses some compatibility behavior while the root flow moves toward true ordered blocks
- richer block kinds like `note`, `divider`, and `table` are now available only through advanced `Layout`, while the legacy compatibility projection is still intentionally limited to `field`, `field_group`, and `section`
- reusable preset concepts are deferred, not active, until the core builder flow is finished and simpler

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

If Windows blocks the default port with `WinError 10013`, use an explicit safe local port instead:

```powershell
uvicorn naic_builder.main:app --reload --app-dir app --host 127.0.0.1 --port 8114
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
