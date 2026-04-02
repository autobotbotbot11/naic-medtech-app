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

## Current Implementation Checkpoint
The first real screen from the newer builder direction now exists.

What is implemented:
- `/` now redirects to `/forms`
- the backend now includes a first future-proof library foundation: a persisted generic `container | form` tree
- the compatibility tree is exposed at `/api/library/tree`
- form reads now also expose a derived compatibility `block_schema`
- `/api/forms/{slug}/block-schema` now exposes the ordered-block view directly
- create and update flows now accept either the current legacy `fields + sections` schema or a limited compatible ordered-block schema
- each form version now also stores a real `block_schema_json` payload alongside the legacy `schema_json`
- startup now backfills missing stored block schemas for older versions
- non-legacy block kinds like `note` and `divider` can now be preserved in stored block schema even when the legacy compatibility projection skips them
- the frontend builder draft now keeps a compatibility `block_schema` in sync while the current calmer editor still renders the legacy projection
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
- the first save path can now carry a real `library_parent_node_key`, so new drafts can keep their intended container parent without collapsing back to a one-level folder assumption
- the current builder workspace now has a real left outline plus one focused editing context at a time
- the default workspace now lands on a single `Content` pane driven by real root block order, instead of splitting the main flow into separate `Ungrouped fields` and `Sections` panes
- the root `Content` pane now inserts new top-level blocks relative to the current selected block when possible, so the main workspace follows real root order instead of old bucket placement rules
- in advanced mode, the root `Content` pane can now add `note`, `divider`, and `table` blocks directly without forcing users into `Layout` just to place them
- the old `Top of form` language is now reframed as `Free fields`
- `Shared patient info` is no longer a primary always-visible setting in the default form-details surface; it now sits in advanced mode as a default record-details option
- the content pane now uses a compact root organizer plus one focused editor instead of forcing users to switch between separate root buckets
- nested section and group content now also inserts relative to the currently selected child block when possible, so deeper editing follows real ordered block behavior instead of always appending at the end
- selected groups can now add nested groups in the normal flow too, so grouped content is less locked to a field-only structure
- the old separate root `Ungrouped fields` and `Sections` panes are no longer active workspace paths; the builder now uses one real root `Content` path instead of keeping both models alive
- advanced `Layout` add actions now insert relative to the current selected block when possible, so the true ordered-block surface no longer blindly appends new blocks
- selected sections still use a compact section organizer plus one focused section editor
- inside selected sections and groups, the builder now uses compact field organizers plus one focused field editor instead of showing every field card at once
- dropdown fields now use a compact `Choices` organizer plus one focused choice editor instead of rendering every option input at once
- `Form details` and `Save` now use a calmer narrow centered treatment instead of wide full-width surfaces
- `Form details` now offers folder suggestions from the existing library to reduce typing friction
- `Save` now uses a clearer draft-state spotlight (`Ready to save` / `Already saved`) with a simpler optional note field
- the top shell is now more compact: lighter status bar, calmer workspace header, and a tighter preview/advanced control strip
- the live preview panel now reads more like a polished form surface: read-only controls, stronger section grouping, and a clearer preview paper layout
- the preview now includes sticky quick-jump section chips for long forms, with active state so the user can navigate the preview faster
- advanced mode now also exposes a `Layout` pane so the builder can work on the actual root ordered blocks without disturbing the calmer default flow
- the preview now respects root block order instead of always forcing one single ungrouped-fields area before every section
- the left outline and library wording are now less technical, using calmer labels like `Basics`, `Content`, `Folder`, and `Edit`
- the committed sample runtime DB has been reset back to the clean schema-seeded state, and a maintenance script now exists at `tools/scripts/reset_builder_runtime_db.py`
- the focused field editor is now lighter: reorder stays in the organizer above, while the selected field uses a compact basics row and a calmer choice editor
- the focused section editor is now lighter too: reorder stays in the organizer above, while the selected section uses a compact summary strip and a simpler section basics row
- duplicate and delete for selected sections and fields now live in a quieter footer `More options` area instead of staying in the header
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
- the `Free fields` and selected-section editors now keep a compact field organizer list and one focused field editor at a time
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
- the builder now uses calmer non-technical wording such as `Basics`, `Ungrouped fields`, `Folder`, and `Edit Form`
- the workspace uses `outline + focused editor + live preview`
- the live preview is read-only and uses sticky quick-jump section navigation
- selected sections and fields keep destructive actions in a quieter footer `More options` area
- the `Sections` pane is less mechanical: simple count, no organizer row numbers, only the active section shows `Editing`
- the nested `Choices` organizer now follows the same calmer pattern: no choice row numbers, only the active choice shows `Editing`, and the selected choice uses a smaller spotlight card
- selected choice actions now follow the same quiet pattern too: footer `More options`, `Duplicate`, and a calmer confirmed `Delete` dialog
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

1. Shared patient/request fields were moved into a reusable common field set.
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
