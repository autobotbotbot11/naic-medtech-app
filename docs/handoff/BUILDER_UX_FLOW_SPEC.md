# Builder UX Flow Spec

## Purpose
This document defines the recommended user experience for the form builder based on:
- `docs/handoff/FLEXIBLE_BUILDER_FOUNDATION.md`
- `docs/handoff/BUILDER_DATA_MODEL_SPEC.md`

This is the screen and interaction layer.

The goal is:
- keep the builder powerful
- keep the experience simple for non-technical users

## Primary UX Rule
The builder should feel like:
- organizing folders
- choosing a starting pattern
- assembling lego blocks

It should not feel like:
- editing raw schema
- configuring a CMS
- filling an admin console

## Primary User
The main builder user is likely:
- clinic owner
- admin staff
- trusted back-office person

This user may:
- understand the lab workflow
- not understand schema design
- feel stressed by too much visible configuration

So the UX must be:
- simple first
- advanced second

## Product Modes
The builder should have two experience levels:

### 1. Simple Builder
Default mode.

What it exposes:
- add section
- add field
- add group
- add preset
- duplicate
- reorder
- preview
- save

### 2. Advanced Builder
Optional mode.

What it exposes:
- note blocks
- divider blocks
- repeater blocks
- table blocks
- columns blocks
- semantic hints
- validation rules
- advanced metadata

Important:
- advanced mode should be hidden by default
- advanced mode should not be required for common lab forms

## Recommended Screen Set

### Screen 1. Form Library
This is the landing screen for builder work.

Purpose:
- browse existing forms
- search forms
- organize forms in containers
- start a new form
- duplicate an existing form

Primary actions:
- `New Form`
- `Duplicate`
- `Open Builder`
- `New Folder`

Visible content:
- organization tree
- search box
- simple status labels like `Draft` and `Published`

Do not show:
- schema terms
- technical ids
- version internals unless needed

### Screen 2. Start New Form
This should be a guided step, not a blank technical editor.

Purpose:
- keep form creation calm
- avoid junk forms like `Untitled Form`

Fields:
- form name
- where it belongs in the tree
- how to start

Starting options:
- `Blank Form`
- `Duplicate Existing Form`
- `Start from Preset`

Optional:
- short explanation text under each option

### Screen 3. Builder Workspace
This is the main building screen.

Purpose:
- edit one form at a time
- keep focus narrow

Recommended layout:
- left: simple outline
- center: focused editor
- right: live preview

Important:
- do not show all settings at once
- do not render the whole schema in an intimidating way

### Screen 4. Review or Publish
This should be separate from the builder workspace.

Purpose:
- review the final form calmly
- save draft or publish
- add version note

Primary actions:
- `Save Draft`
- `Publish`
- `Back to Edit`

## Form Library UX

### Recommended behavior
- show folders and forms in a tree
- allow root forms
- allow nested folders
- allow simple drag-and-drop reorganization later

### Recommended visible actions per item
For containers:
- open
- rename
- move
- archive

For forms:
- open
- duplicate
- move
- archive

### Important simplicity rule
The library should not show:
- full schema previews
- raw block counts everywhere
- technical metadata overload

Default visible info:
- name
- status
- last updated

## Start New Form UX

### Why this screen matters
This is where users decide:
- where the form lives
- how to start

This step prevents:
- accidental junk forms
- confusing default names
- wrong placement in the tree

### Recommended flow
1. Enter form name
2. Choose container
3. Choose starting method
4. Continue to builder

### Recommended copy
Keep it simple:
- `Name this form`
- `Where should it live?`
- `How do you want to start?`

Do not use:
- schema
- node
- metadata
- internal key

## Builder Workspace UX

### Recommended top bar
Keep only:
- back to library
- form name
- draft or published badge
- save draft
- publish

Optional:
- preview toggle
- advanced mode toggle

### Left panel: Outline
Purpose:
- navigate the structure
- reorder blocks later

Show:
- section names
- group names
- top-level fields

Do not show:
- every advanced property
- internal ids
- raw JSON

### Center panel: Focused editor
Show only the currently selected block or form setup.

This is critical.

The center panel should never feel like:
- one giant endless form
- one giant stack of open cards

Instead:
- click one item from the outline
- edit only that item

### Right panel: Live preview
This remains a priority because it creates confidence and wow-factor.

Rules:
- visible on desktop by default is okay if balanced
- must be easy to hide
- must scroll independently
- must update as the user edits

### Important preview rule
Preview should feel like reassurance, not competition.

That means:
- it supports the edit flow
- it does not dominate the workspace

## Recommended Builder Flow Inside the Workspace

### Step A. Setup
Very small setup surface.

Show only:
- form name
- optional short description
- current location in the tree

Do not show:
- special `top_of_form`
- shared patient info system rules
- technical internals

### Step B. Add content
Primary visible actions:
- `Add Section`
- `Add Field`
- `Add Group`
- `Add Preset`

Advanced insert actions live behind:
- `More`
- or `Advanced`

### Step C. Edit one block at a time
When a block is selected:
- edit title
- edit main settings
- reorder children if needed
- duplicate
- delete

### Step D. Preview
Always available but not always intrusive.

### Step E. Save or publish
Should feel separate and safe.

## Recommended Add Menu
The add menu is one of the most important simplicity tools.

### Default add menu
- Section
- Field
- Group
- Preset

### Advanced add menu
- Note
- Divider
- Repeater
- Table
- Columns

This keeps everyday creation calm while preserving future flexibility.

## Recommended Field Editing UX

### Default field editor
Show only:
- label
- field type
- required toggle
- options if select
- unit hint
- normal value

### Hidden by default
- semantic hints
- validation rules
- advanced behaviors

### Why
Even if the engine supports more, the common editing path must stay small.

## Recommended Preset UX

Presets should feel like:
- useful shortcuts
- not locked templates

### Insert preset flow
1. Click `Add Preset`
2. See preset gallery
3. Pick preset
4. Insert into current location
5. Continue editing normally

### Preset gallery should show
- name
- short description
- tiny structural preview

Not:
- raw schema dump

## Recommended Reordering UX

Use:
- drag-and-drop

Do not use:
- typed order numbers

### Reordering should exist in two places
- library tree
- builder outline

## Recommended Safety UX

### Draft model
Users should feel safe editing without fear.

Required:
- clear draft state
- clear save state
- custom unsaved-changes modal
- easy reset to last saved version

### Destructive actions
Use calm confirmations:
- `Delete block?`
- `Archive form?`

Avoid harsh technical prompts.

## Recommended Language Rules

### Prefer
- form
- folder
- section
- field
- group
- preset
- save draft
- publish

### Avoid in primary UI
- schema
- node
- metadata
- internal key
- version object
- configuration payload

## Recommended Simplicity Constraints

To protect non-technical users, these rules should stay true:

1. Only one main editing context visible at a time.
2. Only one or two primary actions per area.
3. Advanced settings stay hidden until requested.
4. The user should rarely need to think about structure depth.
5. The builder should strongly encourage duplication and presets.

## Recommended First Build Order

If implementation resumes from this direction, the UX build order should be:

1. `Form Library`
2. `Start New Form`
3. `Builder Workspace`
4. `Review or Publish`
5. `Advanced Mode`

This order protects simplicity.

## Final Recommendation
The best user experience for this project is:

- simple tree-based organization
- guided form creation
- focused block editing
- live preview
- presets for speed
- advanced capabilities hidden by default

That is the strongest match for:
- long-term flexibility
- client wow-factor
- non-technical usability
