# Print System Handoff

## Purpose
This document captures the current product decisions, implementation state, and next work for patient-facing print output.

Printing is a high-importance feature because this is the result document the clinic gives to patients. Treat print quality, compactness, and configurability as part of the core product, not as a minor browser-print detail.

## Current Product Decisions
- Print output should be compact and patient-facing.
- The practical target is one page when the form content allows it.
- The active print direction is A4 portrait, not the old landscape template shape.
- Header/accent color should be configurable per examination/form so staff can visually recognize the test type.
- Legacy `.dotx` templates in `references/print-templates` are visual guidance only. Do not copy them exactly.
- The app must stay generic. It should not hardcode patient-info concepts such as patient name, age, case number, medtech, or pathologist as special workflow zones in the builder.
- Patient information is just normal form content. If the clinic wants a `Patient info` area, the user should create that section and choose which fields belong there.
- Required fields are field-level builder settings. The clinic decides which fields are required, including identity-style fields such as name or case number.
- Print configuration belongs to the form builder, preferably in a separate `Print` tab/panel, because print behavior is tied to each saved form version.
- Do not build a full Canva/Figma-style freeform editor right now. The safer direction is a constrained print configuration panel with clear template controls.

## Current Implementation Status
The first print configuration foundation and builder-side preview confidence pass are implemented.

Implemented:
- Builder fields now support `props.required`.
- Completing a record validates configured required fields.
- Form versions can store generic record identity config at `block_schema.meta.record_identity`.
- Form versions can store print config at `block_schema.meta.print_config`.
- Default lab-request fields from the original source are now materialized as a normal `Patient Information` builder group, not as a hardcoded record-entry panel.
- Existing current forms have new current versions with `Patient Information` first, while old records remain attached to their frozen older form versions.
- The builder now has a `Print` pane/tab.
- Print config is normalized on backend save/read.
- `/records/{id}/print` reads the saved form version's print config.
- The builder `Print` pane can generate a backend-built sample print preview from the current unsaved draft.
- Builder print preview and `/records/{id}/print` share the same print document macro and backend print config normalization path.
- The builder print preview shows an estimated one-page fit signal: likely, tight, or long.
- The existing Semen sample was verified to export as one A4 portrait page.

Code paths:
- `app/naic_builder/static/app.js`
  - new blank forms start with an editable/removable `Patient Information` group
  - builder `Print` pane
  - print config helpers
  - summary row editor
  - embedded builder print preview iframe and refresh flow
  - required-field toggle handling
- `app/naic_builder/static/app.css`
  - builder print-tab, summary editor, and embedded preview styling
- `app/naic_builder/services.py`
  - default patient-info materialization/backfill helpers
  - `normalize_record_identity_config`
  - `normalize_print_config`
  - `build_print_summary_items`
  - `build_record_print_document`
  - `build_form_print_preview_document`
  - sample-data generation and estimated page-fit scoring
  - required-field completion validation
- `app/naic_builder/templates/records/_print_document.html`
  - shared print-page macro used by real record print and builder preview
- `app/naic_builder/templates/records/print.html`
  - applies `document.print_config`
  - renders configurable summary items
  - supports show/hide clinic logo, clinic info, status, and signatures
- `app/naic_builder/templates/forms/print_preview.html`
  - builder iframe document using sample data and the shared print-page macro
- `app/naic_builder/static/print.css`
  - compact print layout
  - print density handling
  - no-logo clinic header handling
  - builder-preview fit badge styling

## Config Shapes
`record_identity` lives under `block_schema.meta.record_identity`.

Current shape:
```json
{
  "primary_field_id": "form.patient.name",
  "secondary_field_id": "form.patient.case_number",
  "searchable_field_ids": [
    "form.patient.name",
    "form.patient.case_number"
  ]
}
```

Important rule: these fields are generic identity hints only. They are not a hardcoded patient-info model.

`print_config` lives under `block_schema.meta.print_config`.

Current shape:
```json
{
  "accent_color": "#2563eb",
  "density": "compact",
  "show_logo": true,
  "show_clinic_info": true,
  "show_status": true,
  "show_signatures": true,
  "summary_items": [
    {
      "id": "summary_primary",
      "label": "Record",
      "source": "primary_identity",
      "field_id": ""
    },
    {
      "id": "summary_total_volume",
      "label": "TOTAL VOLUME",
      "source": "field",
      "field_id": "form.semen.total_volume"
    }
  ]
}
```

Supported summary item sources:
- `field`
- `primary_identity`
- `secondary_identity`
- `record_key`
- `issued_at`
- `form_version`

## Current Print Pane Controls
The builder Print pane currently supports:
- header/accent color
- density: compact or comfortable
- show/hide clinic logo
- show/hide clinic info
- show/hide record status
- show/hide signatures
- configurable summary rows
- summary rows sourced from ordinary fields or system values
- sample print preview generated from the current unsaved builder draft
- estimated one-page fit warning

This is intentionally a constrained editor. It should stay easier than a design canvas.

## Legacy Template Guidance
Legacy templates showed these recurring patterns:
- clinic branding/header
- patient info block
- exam title or department title
- compact result table or structured result sections
- medtech/pathologist footer
- colored visual identity per examination

Use those patterns as reference only. The new app should produce a better, cleaner, configurable patient-facing document and should not inherit the old landscape layout.

## Known Limits
- One-page output cannot be guaranteed for arbitrarily long forms.
- The builder page-fit signal is an estimate only. Browser print preview remains the final confirmation.
- The previous verified one-page case is the existing Semen sample; rerun real-device checks after body layout options land.
- Current summary configuration is row-based and simple. There are no conditional expressions yet.
- Existing records point to frozen form versions. New print config applies naturally to records created from newer saved form versions unless old versions are intentionally migrated.
- Clinic data and logo come from Settings > Clinic profile.
- This is not yet a full PDF generation engine. The current implementation is browser-print based.

## Recommended Next Work
Phase 2B is now landed:
- real print preview inside the builder using sample data
- estimated page-fit indicator or warning
- visible copy that preview changes are saved into the next form version
- shared print macro and backend config normalization between builder preview and `/records/{id}/print`

Phase 2C should add controlled result-body layout options next:
- hide empty fields
- choose whether section titles appear
- allow section/result body accent behavior if needed
- tune table density and image sizing rules
- keep the result body driven by form structure, not by a freeform canvas

Phase 2D should improve footer/signature configuration:
- configurable signatory labels
- optional names or field-sourced names
- clearer clinic/footer rules

Phase 2E should test real forms:
- Semen
- Urinalysis
- Hematology
- Blood Chemistry
- forms with image fields
- long forms that may exceed one page

Later, consider server-side PDF generation only if browser print is not reliable enough for the clinic's actual devices and workflow.

## Rule For Future AI
Do not restart the print architecture from scratch. Continue from the current generic builder-driven model:

`form_version.block_schema.meta.record_identity`

and

`form_version.block_schema.meta.print_config`

The user already clarified that flexibility is the priority. Patient info and required identity fields must remain user-configurable in the form builder.
