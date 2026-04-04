# NAIC Medtech AI Handoff

## Purpose
This document explains the core product concept for the NAIC Medtech app so another AI can continue implementation without re-discovering the domain context.

## Project Summary
The client is a clinic/laboratory that needs an internal app to make laboratory operations faster during daily use.

The app has two big functional directions:

1. Input
Staff fills up examination forms inside the app, saves records, and uses structured data instead of manually encoding results into scattered templates.

2. Output
The app should eventually generate patient-facing printable results. Legacy print templates exist and can be used as visual guidance, but they are not the strict source of truth.

## Most Important Product Decision
The app must not be built as a fixed set of hardcoded forms.

The highest-priority feature is an `Exam/Form Builder` so the client can:
- create new exams/forms
- edit existing exams/forms
- change fields, sections, and options
- avoid paying a programmer for every future form change

This means the product should be treated as a:

`schema-driven laboratory platform with an exam builder`

not as a:

`lab app with hardcoded forms`

## Phase 1 Priority
Phase 1 must focus on the `Exam/Form Builder`.

Phase 1 should enable:
- creating an exam/form definition
- editing an exam/form definition
- adding sections
- adding fields
- defining choices/options
- defining normal values and unit hints
- reordering fields
- previewing the resulting form structure
- saving the schema definition

Phase 1 is not primarily about:
- user accounts
- full admin portal
- advanced permissions
- broader reporting modules
- full clinic operations suite

Those can come later, but the architecture should still allow them.

## Builder Direction Note
The current builder prototype is not yet considered final for the real client.

Before continuing major builder work, read in this order:
- `docs/handoff/FLEXIBLE_BUILDER_FOUNDATION.md`
- `docs/handoff/BUILDER_DATA_MODEL_SPEC.md`
- `docs/handoff/BUILDER_UX_FLOW_SPEC.md`
- `docs/handoff/BUILDER_WIREFRAME_IMPLEMENTATION_PLAN.md`
- `docs/handoff/BUILDER_V2_PLAN.md`

Important:
- `FLEXIBLE_BUILDER_FOUNDATION.md` is the current long-term architecture recommendation
- `BUILDER_DATA_MODEL_SPEC.md` is the current concrete data-model recommendation
- `BUILDER_UX_FLOW_SPEC.md` is the current recommended user experience flow
- `BUILDER_WIREFRAME_IMPLEMENTATION_PLAN.md` is the current screen-by-screen build plan
- `BUILDER_V2_PLAN.md` remains the active short-term UX simplification plan for the current prototype

## Alignment Lock
This section is meant to keep the next AI aligned without re-opening solved debates.

Current locked direction:
- the engine should stay flexible and future-proof
- the visible UX should stay calm and simple for non-technical users
- keep the `container | form` tree direction
- keep the ordered-block direction under the hood
- do not reintroduce presets into the active user flow right now
- do not add new product surfaces unless they clearly reduce complexity or complete the current core goal

Current honest status:
- the main goal is **not finished yet**
- the app is much closer than before
- the right next work is still cleanup and completion of the core builder flow, not feature sprawl

What the next AI should optimize for:
- make the current builder feel more like arranging content and less like managing schema
- keep simplifying wording, actions, and deeper editor surfaces
- avoid undoing the calmness passes just to expose more power
- preserve the current block-backed migration path instead of restarting from a new architecture idea

## Current Implementation Checkpoint
The first real screen from the newer builder direction now exists.

What is implemented:
- `/` now redirects to `/forms`
- the backend now includes a first future-proof library foundation: a persisted generic `container | form` tree
- the compatibility tree is exposed at `/api/library/tree`
- form reads now expose `block_schema` as the active form shape
- `/api/forms/{slug}` now carries the ordered-block view directly via `block_schema`
- live create and update flows now use the block-based `form_schema` contract only
- each form version now also stores a real `block_schema_json` payload alongside the legacy `schema_json`
- startup now backfills missing stored block schemas for older versions
- non-legacy block kinds like `note` and `divider` can now be preserved in stored block schema even when the legacy compatibility projection skips them
- the frontend builder draft is now block-first too: the live editor state no longer keeps a duplicated `draft.schema`, and setup details like `Key` and `Notes` now read and write directly through `block_schema.meta`
- builder saves now go out through `block_schema` instead of posting the legacy `fields + sections` shape directly
- the current focused editor and live preview now also read and write through block-backed paths for real edit flows, not just save-time bridging
- top-level content editing now operates through block-backed collection handling while the visible UI stays calm
- advanced mode now includes a true `Layout` pane for editing the real top-level ordered block list
- the live preview now follows the actual root block order, including multiple top-field clusters when top-level fields appear in different positions
- advanced `Layout` can now add real `note` and `divider` blocks as first visible proof of richer ordered-block editing
- advanced `Layout` can now also add a real `table` block, including inside nested child-layout workspaces for sections and groups
- the live preview can now render stored `note` and `divider` blocks while the calmer default panes still stay focused on ordinary fields and sections
- the live preview can now render real `table` blocks too, including nested tables inside sections
- selected sections can now add `note`, `divider`, and `table` blocks too, but only in advanced mode so the normal section flow stays calm by default
- selected groups can now add `note`, `divider`, and `table` blocks in advanced mode too, and the live preview now renders those nested utility blocks from the real block tree
- advanced mode can now open a real child-layout workspace for a selected section or group, with back navigation to the parent layout, so nested ordered blocks can be edited directly
- when a section contains advanced utility blocks, the default section editor now hides them and shows a small hint instead of exposing extra controls in the standard flow
- richer stored block schema now survives builder hydration correctly, so advanced-only blocks are preserved after normal save/reload flows instead of collapsing back to the legacy projection in the frontend
- `/forms` now renders a dedicated `Form Library` screen
- `/forms` now renders directly from the real persisted `container | form` tree instead of the older one-level grouped library view
- the library can now show both root-level forms and folders in one calm tree-first browse surface
- library search now works against the full folder path text instead of only one-level group labels
- folder cards in `/forms` can now launch folder-scoped creation directly via `New form here` and `New folder here`
- folder cards in `/forms` can now also launch `Edit folder`, so the visible tree flow is no longer create-only
- folder cards in `/forms` can now also launch `Move`, and form cards can now launch `Move` too, so the visible tree flow now supports real relocation as well as browse/create/edit
- the library top bar now also has a direct `New folder` path for root-level folder creation
- `/forms/new` now renders a dedicated guided `Start New Form` screen
- `New Form`, `Open Builder`, and `Duplicate` are all routed from the new library screen
- guided creation now asks for:
  - form name
  - destination folder
  - starting method (`Blank` or `Duplicate Existing Form`)
- preset support has now been deliberately removed from the active product path so the builder can stay focused on the core flow
- builder bootstrap no longer exposes preset data
- advanced `Layout` no longer exposes insert/save preset actions
- guided creation now hands the user off into the current builder with cleaner defaults instead of dropping them straight into `Untitled Form`
- `/forms/new` now uses real container choices from the persisted library tree instead of the older one-level grouped-folder list
- `/forms/new` can now also intentionally place a form at the top level instead of forcing every new form into a folder
- `/forms/new` duplicate choices now use the real tree too, showing full folder paths instead of the older grouped optgroup list
- `/forms/new` can now also create a brand-new folder inside an existing folder, and the first save path resolves that pending nested folder into the real library tree
- `/folders/new` now exists as a small standalone folder-creation screen, so empty folders can be created directly before any forms exist inside them
- `/folders/edit` now gives folders a real management path too: they can be renamed, and they can be deleted once empty
- `/folders/move` and `/forms/move` now exist as calm single-purpose move screens, so folders and forms can change parent location inside the real tree without dropping back to the old one-level group model
- the first save path can now carry a real `library_parent_node_key`, so new drafts can keep their intended container parent without collapsing back to a one-level folder assumption
- the current builder workspace now has a real left outline plus one focused editing context at a time
- the default workspace now lands on a single `Content` pane driven by real root block order, instead of splitting the main flow into separate `Ungrouped fields` and `Sections` panes
- the root `Content` pane now inserts new top-level blocks relative to the current selected block when possible, so the main workspace follows real root order instead of old bucket placement rules
- the left outline now follows that same root content model too, showing real top-level content items instead of a section-only shortcut list
- in advanced mode, the root `Content` pane can now add `note`, `divider`, and `table` blocks directly without forcing users into `Layout` just to place them
- the old `Top of form` language is now reframed as `Free fields`
- `Shared patient info` is no longer a primary always-visible setting in the default form-details surface; it now sits in advanced mode as a default record-details option
- the content pane now uses a compact root organizer plus one focused editor instead of forcing users to switch between separate root buckets
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
- the builder no longer tracks `common_field_set_id` in the active frontend draft path, so the visible editing flow is less tied to the old shared-metadata model
- serialized form responses no longer expose `common_field_set_id` either, so the active API shape is less tied to the old shared-metadata model
- serialized form responses no longer expose `group_name`, `group_kind`, `group_order`, or `form_order`; the live API now exposes only tree-first `location_*` metadata, and the builder reads that location state directly
- the visible builder location helpers now read from `location_*` directly too; the sync helper now just keeps location labels and node keys consistent instead of maintaining old grouped-era shadow metadata
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
- the active create/update path is thinner too: block-based save payloads now normalize directly through a block-first storage helper instead of passing through older schema-bridge wrappers
- the active create/update entry path is thinner too: it no longer materializes a full legacy schema just to derive slug/name before saving; live saves now read those directly from `payload` and block metadata
- active block metadata is cleaner too: new writes now use `form_id`, `form_key`, and `form_order` in `block_schema.meta`, while old `legacy_form_*` keys are only read/backfilled for stored compatibility
- active block source metadata is more honest too: live builder-created block schemas now store `source_kind = builder_blocks_v1`, while true legacy conversions still keep the compatibility marker
- the live backend block-meta path is thinner too: active create/update conversion no longer reads `legacy_form_*` keys, and those old keys are now only part of startup cleanup/backfill logic
- version storage assembly is more honest too: create/update/seed now go through explicit storage builders and one `FormVersion` storage-record helper, so `schema_json` reads more clearly as compatibility storage instead of a parallel live model
- live read and startup cleanup are more explicit too: `serialize_form()` and startup backfill now go through dedicated storage-document loaders, and the startup pass is named around full form-version storage cleanup instead of only `block_schema` backfill
- old `legacy_form_*` block meta is thinner still: startup cleanup now drops those keys without reading them as fallback inputs, and the frontend draft meta sync strips `legacy_form_id` too
- live frontend node helpers are thinner too: core builder helpers now treat blocks as the only active node shape, instead of falling back to old `fields/sections`-style field objects in the live UI path
- live option data is more consistent too: the builder now uses option `name` as the active key end to end, and old `label` values are only normalized away during helper cleanup
- focused section and field cards are thinner too: they now render directly from the passed live block node instead of re-looking up the same path and carrying fallback source juggling
- mixed-content render helpers are more aligned too: the live builder now uses `item`-oriented helper naming for shared section/group/field render paths instead of pretending those helpers are field-only
- active builder selection state is more aligned too: the shared item selection path and item focus/toggle actions now use `item` naming instead of `field` naming in the live JS flow
- internal preview and traversal helpers are more aligned too: shared item-path, item-summary, preview-item, and item-count helpers now read like mixed-content block code instead of field-era helper code
- mixed-content organizer chrome is more aligned too: the live builder now uses `item-*` organizer/list/focus CSS and markup naming instead of `field-*` naming for shared section/group/utility content flows
- shared item-card chrome is more aligned too: the live builder now uses `item-*` card/head/meta/summary/title/focus/basics/input CSS and markup naming instead of `field-*` naming for shared mixed-content cards
- preview segment plumbing is more aligned too: the live preview now groups shared root content under `item` segment naming instead of carrying `fields` as the internal mixed-content segment shape
- live choice seeding is cleaner too: when an input switches to `Choices`, the first seeded option now uses the active `name` shape directly instead of minting the old `label` key
- blank item factories are more honest too: field and group creation now use separate helpers, and shared insertion helpers no longer pretend every mixed content add path is field-only
- input-type internals are more aligned too: the live builder now uses `input`-oriented helper naming for control/data/unit/normal/options/type logic instead of keeping those paths under broader `field` helper names
- active input props are leaner too: the live builder now relies on `control + data_type` instead of minting a duplicate `field_type` mirror in new drafts and edits
- stored block cleanup is leaner too: startup/save cleanup now strips stale `field_type` and old option `label` residue from active block-schema storage
- legacy-to-block option conversion is cleaner too: when older storage is bridged into block schema, options now come out with the active `name` shape directly instead of minting old `label` keys first
- form-version storage assembly is cleaner too: raw live block payloads are normalized before the legacy storage bridge runs, so the live save path no longer depends on fallback reads of stale option `label` keys
- old option `label` residue is thinner in the browser too: legacy `label -> name` cleanup now lives in draft-ingress normalization, while repeated live option helpers read the active `name` shape only
- seed and missing-block fallback storage are cleaner too: both now rebuild block storage through one explicit legacy-storage -> block-storage bridge helper instead of open-coding direct legacy block conversion paths
- form-choice payloads are more location-first too: builder quick-switch reads now prefer `location_path_label` and explicit `form_path_label`, instead of depending on older `path_label/location_label` aliases in the live browser path
- live form-choice payloads are thinner too: `list_form_choices()` no longer emits the old `path_label/location_label` aliases, and active builder/new/move flows now read the explicit location-first keys directly
- form create, update, and move flows now use a shared tree-first form-node sync helper, so the real `LibraryNode` state is updated directly before legacy mirrors are backfilled
- `resolve_form_location_metadata()` is more tree-first too: it now feeds create/update with `resolved_parent_*` and `resolved_form_order` values instead of returning `group_*` as the primary active shape
- legacy `group_*` mirror backfill is now centralized too: one helper derives those compatibility fields from the real node state instead of duplicating that logic across create/update/move/tree-sync paths
- top-level new and copied drafts are cleaner too: they no longer start from the old `Unassigned` sentinel or keep a stale previous form name as fake location state
- old `Unassigned` location residue is thinner too: stale inputs are now normalized once at ingress to `Top level`, instead of being special-cased across multiple live location helpers
- the builder frontend reads more tree-first too: active suggestion helpers and setup variables now use `location` language instead of old `group` wording where the UI already treats folders as locations
- the active create/update resolver is more tree-first too: it now derives parent/order state from real library nodes and the current location intent, instead of depending on old `group_kind/group_order/form_order` inputs
- the `/forms/new` flow reads more consistently now too: its template and browser-side logic use `location` wording for the visible create flow, and the handoff into `/builder` now uses `location_name` only
- serialized form payloads are more tree-first too: `serialize_form()` now returns `location_name`, `location_path_label`, `location_node_key`, and `location_kind`, and the builder display/helpers use those aliases directly
- the active save API is more tree-first too: the current builder now posts `location_name`, and the live save contract no longer treats `group_name` as an active alias
- active read compatibility is more tree-first too: legacy `group_*` metadata is now derived from the real library tree during serialization and grouped listings, instead of trusting the raw stored legacy columns
- the visible builder setup flow is more tree-first too: the `Location` input now binds to `location_name` instead of the old `group_name`, while the draft keeps its real location state synchronized directly
- the active builder draft is more tree-first too: `location_*` is now the only active location state in the editor
- the active builder setup internals are thinner too: `Key` and `Notes` now bind straight to `block_schema.meta`, and the live draft no longer keeps a duplicated `draft.schema` object just to drive those fields
- the active organizer/render path is thinner too: content organizers, focused cards, and preview section labels now read directly from block nodes instead of carrying a synthetic legacy `.view` projection through the live builder UI
- the live frontend draft contract is thinner too: the builder no longer accepts a `form_schema` fallback when hydrating local drafts, and now expects `block_schema` directly in the active UI path
- the live frontend block state is more honest too: new drafts and edited drafts now keep `source_kind = builder_blocks_v1` instead of reusing the old compatibility label
- the save payload schema is leaner too: `group_kind`, `group_order`, and `form_order` are no longer part of `FormSavePayload`, and old callers can still send them as ignored compatibility extras
- dead grouped-library backend helpers are gone too: the codebase no longer keeps `list_grouped_forms` / `split_library_groups` around even though the live app is already tree-first
- the visible advanced pane now reads `Arrange` instead of `Layout`, so the UI feels more like arranging content than editing a technical layer
- builder action wording is quieter too: `Duplicate` now reads `Copy`, `More` is shorter and calmer than the old `More options`, and destructive actions now prefer `Remove` language for a less tool-like feel
- toggle and preview wording are calmer too: setup/save/section cards now use `Show` and `Hide` instead of `Open` and `Done`, and preview helper copy now says `Choose` or `Show` instead of `Open`
- selected sections still use a compact section organizer plus one focused section editor
- inside selected sections and groups, the builder now uses compact item organizers plus one focused item editor instead of showing every field card at once
- dropdown fields now use a compact `Choices` organizer plus one focused choice editor instead of rendering every option input at once
- `Form details` and `Save` now use a calmer narrow centered treatment instead of wide full-width surfaces
- `Form details` now offers folder suggestions from the existing library to reduce typing friction
- `Save` now uses a clearer draft-state spotlight (`Ready to save` / `Already saved`) with a simpler optional note field
- the top shell is now more compact: lighter status bar, calmer workspace header, and a tighter preview/advanced control strip
- the live preview panel now reads more like a polished form surface: read-only controls, stronger section grouping, and a clearer preview paper layout
- the preview now includes sticky quick-jump section chips for long forms, with active state so the user can navigate the preview faster
- advanced mode now also exposes a `Layout` pane so the builder can work on the actual root ordered blocks without disturbing the calmer default flow
- the preview now respects root block order instead of always forcing one single ungrouped-fields area before every section
- the left outline and library wording are now less technical, using calmer labels like `Basics`, `Content`, `Location`, and `Edit`
- the builder basics flow is clearer too: it now says `Name` and `Location`, and top-level forms read as `Top level` instead of the old `Unassigned`
- item editors are calmer too: fields, options, and utility items now use `Name` instead of the more technical `Label`
- the builder `Location` field is now tree-aware too: it suggests real folder paths from the persisted container tree and resolves the correct parent container when one is selected
- the builder quick-switch drawer is tree-aware now too: it searches and lists forms by real folder path instead of the old one-level grouped drawer
- the builder bootstrap path is tree-first now too: quick-switch data comes from `form_choices`, not the old grouped builder payload
- the builder bootstrap payload no longer sends old shared-metadata options either, since that control is no longer part of the visible builder flow
- the current builder save path is less legacy too: it no longer posts old grouping/order fields, and the backend now derives folder/order metadata from the real tree when possible
- the committed sample runtime DB has been reset back to the clean schema-seeded state, and a maintenance script now exists at `tools/scripts/reset_builder_runtime_db.py`
- the focused field editor is now lighter: reorder stays in the organizer above, while the selected field uses a compact basics row and a calmer choice editor
- the focused section editor is now lighter too: reorder stays in the organizer above, while the selected section uses a compact summary strip and a simpler section basics row
- duplicate and delete for selected sections and fields now live in a quieter footer `More` area instead of staying in the header
- the `Sections` pane is now less mechanical: it shows a simple section count, removes organizer row numbers, and marks only the active row as `Editing`

Important reading for the next implementation step:
- treat `/forms` as the new entry surface
- treat `/forms/new` as the new creation surface
- the current builder page is still using the older underlying schema shape, but the workspace shell is now significantly calmer
- the next large build step should continue from the newer flexible builder docs, not from a full V3 reset
- important limitation: the current builder is now partially block-backed, but deeper editing still contains compatibility behavior while the root flow moves toward true ordered blocks
- richer block kinds like `note` and `divider` are currently exposed only through advanced `Layout`, while the legacy compatibility projection remains limited on purpose
- reusable presets are deferred for now because they added cognitive load before the core builder flow was finished

## Current Builder Progress
Current implementation status:
- `Phase 1` shell rebuild is done
- `Phase 2` core editing simplification is in place for the current builder direction
- `Phase 3` drag-and-drop ordering is now implemented
- `Phase 4` safety/usability polish is meaningfully underway

What is already true in the current builder:
- form library is now a collapsible left drawer
- live preview is now a docked side-by-side panel in the workspace on desktop
- live preview is now treated as a first-class builder feature, not just a utility button
- the main canvas focuses on one form at a time
- the left outline can switch between `Form details`, `Free fields`, `Sections`, and `Save`
- form setup collapses by default on existing forms
- top-of-form fields are collapsible
- sections are collapsible
- only one section stays open at a time for calmer editing
- the sections view now keeps a compact organizer list at the top and a single focused section editor below it
- the `Free fields` and selected-section editors now keep a compact item organizer list and one focused item editor at a time
- dropdown `Choices` editors now keep a compact choice organizer list and one focused choice editor at a time
- `Form details` and `Save` now render as narrower, calmer guided sheets inside the focused editor
- the top shell now uses a lighter first-glance hierarchy, with less stacked copy before the main workspace
- the preview panel now behaves as a true read-only preview instead of looking like another editable form
- the preview now has quick-jump section navigation for long forms
- fields now use a calmer `Edit` / `Done` flow instead of exposing every field editor at once
- sections and fields now use a calmer `More` action menu instead of always showing all actions
- the save note is now separated into its own save step card
- sections can be reordered by drag-and-drop
- fields can be reordered by drag-and-drop
- `SortableJS` is now used locally for reliable drag-and-drop ordering
- a floating save/reset dock appears while the draft is dirty
- the builder warns before discarding unsaved changes on form switch or page unload
- clean state now shows a disabled `Saved` button instead of an active save action
- the save step stays collapsed by default until needed
- closed sections and closed fields now render as compact outline rows instead of repeating helper text
- the shell summary updates live while the user edits the form title
- preview control was moved out of the crowded top bar into a dedicated main-flow `Live Preview` callout
- the live preview now stays visible while editing instead of blocking the builder in an overlay
- the preview panel updates live while the user edits builder fields and form titles
- on desktop, the preview panel uses its own internal scroll area so long forms remain fully inspectable without losing the builder view
- the preview hide/show path is now hardened so hiding the panel fully removes it from layout instead of leaving a bottom leak in stacked layouts
- helper text is now reduced and moved into small `?` popovers in the main editing cards
- open help popovers and `More` menus now close when the user clicks elsewhere
- in-app destructive/dirty decisions now use a calmer custom modal instead of browser `confirm()` dialogs
- the floating dirty-state bar is now smaller and less visually aggressive while still keeping save/reset obvious
- the top bar now uses shorter, smaller actions to reduce first-glance weight
- row actions now use quieter icon-like drag and `...` controls instead of heavier text buttons
- drag and `...` controls stay visually subdued until a card is active or hovered
- open section cards now use a compact header row where section title and quick add-actions live together
- the save step now uses a single compact inline row (note input + one save action) to reduce vertical weight
- open field cards now use lighter metadata chrome by default (less repetitive labeling noise)
- `Advanced mode` toggle is now available in the stage header and defaults to `Off`
- when `Advanced mode` is `Off`, technical panels are hidden (`Advanced` blocks + `Technical JSON`) to keep first-time editing focused on core actions

What is still not done:
- final reduction of header and action noise
- deeper visual polish for truly client-ready comfort
- full stabilization and real-use QA

## Current Strategic Recommendation
The strongest future-proof direction currently recommended is:
- organization tree using generic `container | form` nodes
- block-based form schema instead of special zones like `top_of_form`
- generic fields instead of hardcoded domain-specific field concepts
- optional reusable blocks later if they can be reintroduced without hurting simplicity
- versioned records separate from form design

This is documented in:
- `docs/handoff/FLEXIBLE_BUILDER_FOUNDATION.md`
- `docs/handoff/BUILDER_DATA_MODEL_SPEC.md`
- `docs/handoff/BUILDER_UX_FLOW_SPEC.md`
- `docs/handoff/BUILDER_WIREFRAME_IMPLEMENTATION_PLAN.md`

Important:
- the engine should be highly flexible
- the UI should still stay very simple for non-technical users

Current migration status:
- the generic library tree foundation has started in the real backend via a new persisted `library_nodes` table
- current forms are automatically backfilled into that tree for compatibility
- the visible library now runs on the real persisted tree, while the builder still contains compatibility behavior during the ordered-block migration
- the backend now includes a compatibility bridge between the current legacy schema and an ordered-block schema
- current safe bridge coverage is limited to `field`, `field_group`, and `section`
- stored block schemas can now preserve extra block kinds even when the legacy compatibility projection cannot render them directly
- advanced `Layout` now provides the first UI foothold for extra block kinds like `note`, `divider`, and `table`
- the next engine milestone should be expanding true ordered-block editing beyond the new advanced `Layout` pane and reducing the remaining compatibility-only `fields + sections` thinking without breaking the calm UI in one jump

## Source Of Truth
Primary source of truth:
- `artifacts/schema/naic_medtech_app_schema.json`

Derived from:
- `data/source/NAIC MEDTECH SYSTEM DATA.xlsx`

Supporting references:
- `artifacts/schema/naic_medtech_structure.json`
- `artifacts/schema/naic_medtech_tree_diagram.html`

Legacy print/layout guidance only:
- `references/print-templates/*.dotx`

If there is a conflict:
- schema wins for structure and fields
- legacy print templates only guide presentation and print style

## Product Philosophy
The system should be built on strong reusable primitives instead of unlimited freeform layout editing.

Target:
- flexible enough that the client can build most future exams without a programmer
- structured enough that saving, validating, previewing, and printing remain consistent

Avoid trying to support totally arbitrary desktop-publishing behavior in Phase 1.

## Builder Requirements
The builder should support these structural primitives:
- group/category
- form/exam
- section
- field
- field group
- option list
- display order
- normal value
- unit hint
- notes/instructions

Recommended field controls and data types:
- `input/text`
- `input/textarea`
- `input/number`
- `input/date`
- `input/time`
- `input/datetime`
- `select`
- `multi_select`
- `field_group`
- repeatable rows/table, if needed later

The builder should also support:
- duplicating an existing exam/form
- versioning forms so old patient records remain valid
- previewing the data-entry form
- later mapping the same schema to printable output

## Core Technical Direction
The app should have three clearly separated layers:

1. Exam definition
- schema metadata describing the form

2. Data entry rendering
- UI generated from schema

3. Output rendering
- printable result document generated from schema and record data

Do not tightly couple output layout to a single fixed hardcoded screen.

## Current Frontend Note
Current builder implementation is still:
- server-rendered HTML
- vanilla JS
- local `SortableJS`

## Current Builder UX Checkpoint
- the builder now uses calmer non-technical wording such as `Basics`, `Content`, `Location`, and `Edit`
- the workspace uses `outline + focused editor + live preview`
- the live preview is read-only and uses sticky quick-jump section navigation
- selected sections and fields keep destructive actions in a quieter footer `More options` area
- the `Sections` pane is less mechanical: simple count, no organizer row numbers, only the active section shows `Editing`
- the nested `Choices` organizer now follows the same calmer pattern: no choice row numbers, only the active choice shows `Editing`, and the selected choice uses a smaller spotlight card
- selected choice actions now follow the same quiet pattern too: footer `More`, `Copy`, and a calmer confirmed `Delete` dialog
- the left outline is lighter too: section subitems no longer show per-row counts, and only the active section shows `Editing`
- the top shell is calmer now as well: the status strip is subtler, status messages are shorter, and the live-preview callout uses steadier less repetitive copy
- the top-right app-bar actions are quieter now too: `New` and `Save` stay visible, while `Duplicate` lives inside a small overflow menu
- the preview panel header is quieter now too: shorter heading/copy, shorter hide action, and less repeated live/read-only wording inside the preview card
- the left rail header is quieter too: `This form` became `Outline`, the extra summary line was removed, and the navigation block reads less like a mini dashboard
- the center workspace header is quieter too: `Editing` became `Builder`, the title now uses the form name directly, and the supporting copy is shorter and less repetitive
- the focused section/field/choice strips are quieter too: they now use small label-style cues like `Section`, `Field`, `Group`, and `Choice` instead of sentence-style `Editing this ...` copy
- the top-level outline is quieter too: `Ungrouped fields` and `Sections` no longer show count chips, so the left rail reads more like navigation than a mini manager
- the center and preview chrome are quieter too: the builder header, `Sections` header, and preview surfaces no longer repeat summary count badges
- the center organizer metadata is quieter too: section rows no longer repeat item counts, field rows use simpler type cues like `Dropdown`, and the choices editor no longer repeats choice counts in its header and spotlight
- the preview wording is calmer too: shorter `Show` and `Hide` actions, `Live preview` callout language, and preview copy that reads more like a live companion than a technical sample panel
- the empty-state and no-data copy are warmer too: builder and library messages now guide the user more gently instead of sounding like raw system states
- the save surface is calmer too: `Save draft` is now just `Save`, the finish-step wording is softer, the floating save dock is quieter, and the save card now stays in sync with dirty state while editing the note
- the library page is calmer too: folder jump counts and repeated folder metadata are gone, and form card actions now use shorter labels like `Copy` and `Edit`
- the library cards are lighter too: version labels are subtler (`v1`), card spacing is tighter, and the library now reads more like a calm folder browser than an admin list
- the top of the library page is calmer too: shorter header copy, quieter `Find` search affordance, and a lighter `New` action for a cleaner first glance
- the library header itself is tighter too: spacing is calmer, the top band sits lower visually, and the first impression is less crowded

The repo has not been migrated to Alpine.js. Alpine.js was only a possible helper direction discussed for future UI simplification, not a current dependency.

## Current Domain Structure
Client-approved current groups:
- Clinical Microscopy
- Blood Chemistry
- Serology
- Blood Bank
- Blood Gas Analysis
- Hematology
- Microbiology

Current important rule:
- `COVID 19 Antigen (Rapid Test)` belongs under `Serology`

## Current Important Schema Decisions
These decisions already exist in the current schema and should not be casually undone:

1. Shared patient/request metadata still exists as a backend compatibility field set, but it is intentionally hidden from the visible builder flow.
Included examples:
- Name
- Age
- Sex
- Date / Date-Time
- Requesting Physician
- Room
- Case Number
- Medical Technologist
- Pathologist

2. `Blood Bank > Type of Crossmatching > VITAL SIGNS` is normalized as a `field_group`, not a select field.
Its child fields are:
- BLOOD PRESSURE
- PULSE RATE
- RESPIRATORY RATE
- TEMPERATURE

3. In `Blood Chemistry > Male` and `Blood Chemistry > Female`, `IONIZED CALCIUM` must come immediately after `CHLORIDE`.

4. Standalone departments in raw extraction are normalized consistently in the app schema.

## Print Output Guidance
The `references/print-templates` folder contains `.dotx` templates that show the clinic's current print style.

Observed recurring print pattern:
- hospital branding/header
- patient info block
- exam title / department title
- result table or structured result sections
- medtech/pathologist footer

These templates are useful for:
- understanding print tone
- understanding result-document hierarchy
- guiding future PDF/print output styling

They are not the strict implementation source.

## Known Conservative Areas
Some fields in the schema were intentionally left conservative because the workbook did not give enough reliable signal to force a stricter type.

Examples include:
- `TOTAL VOLUME`
- `LIQUEFACTION TIME`
- several `OTHERS` fields
- some Blood Bank phase result fields
- `NOTE` text areas

These should be treated as safe defaults, not as final product truth.

## What Another AI Should Do First
When continuing implementation, the next AI should:

1. Read `artifacts/schema/naic_medtech_app_schema.json`
2. Read `docs/handoff/BUILDER_V2_PLAN.md`
3. Treat the app as schema-driven
4. Build the exam/form builder first
5. Avoid hardcoding individual lab forms
6. Keep output/print generation as a separate later-capable layer

## What Another AI Should Avoid
- Do not build one screen per exam.
- Do not treat legacy `.dotx` templates as the source of truth.
- Do not make the first version depend on programmer-only form changes.
- Do not assume accounts/admin features are the current main milestone.

## Ideal Phase 1 Outcome
By the end of Phase 1, the client should be able to:
- define or edit an exam/form without developer help
- preview the resulting structure
- preserve logical sections and field order
- keep the system ready for future patient-result entry and printable outputs
