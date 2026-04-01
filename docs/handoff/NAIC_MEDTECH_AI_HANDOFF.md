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
- `/forms` now renders a dedicated `Form Library` screen
- the main library shows only the official reference groups in the primary browse area
- extra working or scratch groups are still accessible, but tucked into a secondary collapsed area so the main screen stays calmer
- library search works across both the primary groups and the tucked-away extra groups
- `/forms/new` now renders a dedicated guided `Start New Form` screen
- `New Form`, `Open Builder`, and `Duplicate` are all routed from the new library screen
- guided creation now asks for:
  - form name
  - destination folder
  - starting method (`Blank`, `Duplicate Existing Form`, or `Start from Preset`)
- guided creation now hands the user off into the current builder with cleaner defaults instead of dropping them straight into `Untitled Form`
- the current builder workspace now has a real left outline plus one focused editing context at a time
- the old `Top of form` language is now reframed as `Free fields`
- `Shared patient info` is no longer a primary always-visible setting in the default form-details surface; it now sits in advanced mode as a default record-details preset

Important reading for the next implementation step:
- treat `/forms` as the new entry surface
- treat `/forms/new` as the new creation surface
- the current builder page is still using the older underlying schema shape, but the workspace shell is now significantly calmer
- the next large build step should continue from the newer flexible builder docs, not from a full V3 reset

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
- form setup collapses by default on existing forms
- top-of-form fields are collapsible
- sections are collapsible
- only one section stays open at a time for calmer editing
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
- optional reusable presets instead of mandatory shared blocks
- versioned records separate from form design

This is documented in:
- `docs/handoff/FLEXIBLE_BUILDER_FOUNDATION.md`
- `docs/handoff/BUILDER_DATA_MODEL_SPEC.md`
- `docs/handoff/BUILDER_UX_FLOW_SPEC.md`
- `docs/handoff/BUILDER_WIREFRAME_IMPLEMENTATION_PLAN.md`

Important:
- the engine should be highly flexible
- the UI should still stay very simple for non-technical users

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
