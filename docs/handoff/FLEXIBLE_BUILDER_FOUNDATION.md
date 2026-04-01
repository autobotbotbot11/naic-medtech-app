# Flexible Builder Foundation

## Purpose
This document defines the recommended long-term builder architecture for NAIC Medtech.

The goal is not only to support today's laboratory forms. The goal is to let the client create future forms without needing a developer for ordinary structural changes.

The builder must be:
- future-proof
- flexible
- simple enough for non-technical users
- structured enough to remain maintainable

## Core Product Rule
The system should hardcode **primitives**, not **medical assumptions**.

Hardcode:
- container
- form
- block
- field type
- preset
- version

Do not hardcode:
- `top_of_form`
- `shared_patient_info`
- `medtech`
- `pathologist`
- `requesting_physician`
- fixed category depth
- fixed form layout rhythm

## Best Flexibility Sweet Spot
The best direction is:

**free structurally, not free pixel-by-pixel**

That means:
- the client can organize forms in many ways
- the client can build forms from reusable lego-like blocks
- the system still saves structured data safely

Do not try to become:
- Canva
- Figma
- desktop publishing software

That would make the product much harder to use, validate, preview, print, and maintain.

## Layer Separation
There should be five separate layers.

### 1. Organization layer
Used only for organizing and finding forms.

### 2. Form definition layer
Used for designing the structure of a form.

### 3. Preset layer
Used for inserting reusable bundles of blocks.

### 4. Record layer
Used for storing actual patient/result data entered from a form version.

### 5. Output layer
Used later for printable patient-facing results.

Important:
- organization is not the form layout
- form layout is not the print layout
- presets are not hardcoded system requirements

## Organization Tree Model
The organization tree should use only two node kinds:

- `container`
- `form`

### Container
A generic grouping node.

It can contain:
- other containers
- forms

It can represent:
- category
- subcategory
- department
- folder
- special bucket

### Form
A leaf node in the organization tree.

It contains:
- metadata
- a form schema
- versions

### Why this is better than category-specific modeling
This supports all of these without schema redesign:

- `form`
- `container -> form`
- `container -> container -> form`
- `container -> container -> container -> form`

### Recommended organization node shape
```json
{
  "id": "node_001",
  "kind": "container",
  "name": "Serology",
  "parent_id": null,
  "order": 1
}
```

```json
{
  "id": "form_001",
  "kind": "form",
  "name": "COVID 19 Antigen (Rapid Test)",
  "parent_id": "node_001",
  "order": 4
}
```

### Optional extras
The tree should stay simple, but forms may also support:
- `tags`
- `archived`
- `draft`
- `published`

Tags are useful because hierarchy alone is not enough for long-term discoverability.

## Form Definition Model
A form should be composed from **ordered blocks**.

Do not separate the model into special zones like:
- `top_of_form`
- `main_sections`

That is too strict.

Instead:
- the form has one ordered block list
- blocks may contain child blocks or child fields depending on type

### Recommended top-level form shape
```json
{
  "id": "form_001",
  "name": "Urinalysis",
  "status": "published",
  "blocks": []
}
```

### Recommended block kinds
- `section`
- `field`
- `field_group`
- `note`
- `divider`
- `table`
- `repeater`
- `columns`

These are the real lego pieces.

### Section
Used for logical grouping with a visible title.

### Field
A single input/control.

### Field Group
A cluster of related fields.

Example:
- vital signs
- signatories
- patient demographics

### Note
Static instructional or descriptive content.

### Divider
Visual separator.

### Table
Structured row/column input when a plain field list is not enough.

### Repeater
A repeatable block or row group.

Useful later for:
- multiple signatories
- multiple samples
- multiple observations

### Columns
Optional layout block for limited structured side-by-side presentation.

Important:
- this is still structured layout
- not arbitrary free positioning

## Field Model
Fields should be generic.

The system should not assume special meaning just because a label is currently common in the clinic.

### Recommended field types
- `text`
- `textarea`
- `number`
- `select`
- `multi_select`
- `date`
- `time`
- `datetime`
- `checkbox`
- `radio`

Optional later:
- `computed`
- `lookup`
- `signature`
- `image`

### Recommended field shape
```json
{
  "id": "field_001",
  "kind": "field",
  "name": "Pathologist",
  "field_type": "text",
  "required": false,
  "options": [],
  "meta": {}
}
```

### Important rule
`Patient Name`, `Medtech`, `Pathologist`, and similar items are fields, not special hardcoded engine concepts.

If they need to exist often, they should come from presets, not from hardcoded builder rules.

## Preset Model
Presets are the key feature that makes the system feel powerful without becoming difficult.

### What presets are
Reusable bundles of blocks.

Examples:
- `Patient Info`
- `Signatories`
- `Vital Signs`
- `Urinalysis Macroscopic Section`
- `Standard Chemistry Result Table`

### What presets are not
- required parts of every form
- uneditable locked templates
- hardcoded system zones

### Preset rules
- a user can insert a preset into a form
- after insertion, the blocks become part of that form
- the user can still edit them
- the user can duplicate and reorder them

This is what gives the client speed without sacrificing flexibility.

## Record Model
The system must keep patient/result data separate from the form design.

### Why
If a form changes later:
- old records must still remain valid
- old outputs must still make sense

### Record should point to a specific form version
Recommended concept:
- `form`
- `form_version`
- `record`
- `record_values`

The record stores data against the exact version used at entry time.

## Output Model
Printable output should not be the same thing as form structure.

The builder defines:
- what data exists
- how staff enters it

The output layer defines:
- how the patient-facing document is rendered

Legacy `.dotx` files remain layout inspiration only.

## Simple UX Rule
The engine should be highly flexible.
The UI should be highly simple.

This is non-negotiable.

### Default builder experience
Show only the common actions:
- add section
- add field
- add group
- add preset
- duplicate
- reorder
- preview
- save

### Advanced behavior
Hide by default:
- repeaters
- tables
- columns
- advanced field rules
- technical metadata

### Why
The client is investing in flexibility, but the people using the builder are still likely to be non-technical.

So:
- power belongs in the engine
- calmness belongs in the UI

## Recommended Builder Flow
### Step 1. Choose location
- pick parent container
- or create a new container
- or place at root

### Step 2. Choose how to start
- blank form
- duplicate existing form
- start from preset

### Step 3. Build with blocks
Use a limited visible action set.

### Step 4. Arrange
Use drag-and-drop.
Do not use manual order number inputs.

### Step 5. Preview
Use live preview or quick preview access.

### Step 6. Save
Save draft, later publish.

## What Should Be Avoided
Avoid these design mistakes:

### 1. Special-casing current lab assumptions
Examples:
- `top_of_form`
- fixed signatory model
- fixed patient info zone

### 2. Overexposing engine power
Do not show the full data model to the user all at once.

### 3. Tying form organization to form layout
Containers organize forms. They do not define how a form must be built.

### 4. Using hierarchy alone for discoverability
Support tags and search later.

### 5. Building a full visual page designer
That is too much complexity for Phase 1.

## Recommended Baseline Decision
If forced to choose the cleanest future-proof baseline, choose this:

### Engine
- organization tree of `container | form`
- block-based form schema
- generic field model
- optional presets
- versioned records

### UX
- duplicate-first workflow
- simple visible actions
- drag-and-drop ordering
- live preview
- advanced features hidden by default

## Implication For Current Codebase
The current builder is still based on a more rigid structure:
- special `top_of_form`
- separate sections flow
- assumptions inherited from the existing workbook

That means the current code is a useful prototype, but not the final foundation.

Before major new UI work, the product direction should be considered:

**organization tree + block-based builder + presets**

That is the cleanest long-term foundation currently recommended.
