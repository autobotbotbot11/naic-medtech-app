# Builder Wireframe Implementation Plan

## Purpose
This document converts the builder direction into a wireframe-level implementation plan.

It sits after:
- `docs/handoff/FLEXIBLE_BUILDER_FOUNDATION.md`
- `docs/handoff/BUILDER_DATA_MODEL_SPEC.md`
- `docs/handoff/BUILDER_UX_FLOW_SPEC.md`

This is the bridge between:
- product design
- data model
- coding work

## Core Rule
Build the simplest possible visible experience on top of a flexible engine.

That means:
- fewer visible controls
- fewer simultaneous panels
- one main task at a time
- strong defaults
- advanced power hidden by default

## Recommended Build Order
Build in this order:

1. `Form Library`
2. `Start New Form`
3. `Builder Workspace`
4. `Review or Publish`
5. `Advanced Mode`

This order keeps the product coherent and prevents the builder from turning into a technical editor too early.

## Screen 1: Form Library

### Purpose
Give the user one calm place to:
- browse forms
- browse folders
- search
- start a new form
- open an existing form
- duplicate a form

### Wireframe zones

#### A. Top Bar
Visible elements:
- app title
- search input
- `New Form` button

Optional secondary:
- `New Folder`

Do not show:
- advanced filters
- version internals
- schema language

#### B. Left Tree Panel
Content:
- folders/containers
- forms inside folders
- root-level forms

Visible item details:
- name
- simple status badge

Item actions:
- open
- duplicate
- move later
- archive later

#### C. Main Content Panel
This panel shows the selected node summary.

If a container is selected:
- show child forms/folders

If a form is selected:
- show simple info:
  - name
  - status
  - last updated
- show actions:
  - `Open Builder`
  - `Duplicate`

### Default user path
1. Open library
2. Search or browse
3. Click form
4. Open builder

### Acceptance criteria
- user can find forms without seeing technical details
- user can start a new form in one click
- user can duplicate a form without opening the builder first

## Screen 2: Start New Form

### Purpose
Prevent junk forms and confusing blank states.

### Wireframe zones

#### A. Header
Visible:
- `Back to Library`
- title: `Create a New Form`

#### B. Main Card
Fields:
- `Form Name`
- `Where should it live?`
- `How do you want to start?`

Start options:
- `Blank Form`
- `Duplicate Existing Form`
- `Start from Preset`

If `Duplicate Existing Form`:
- show form picker

If `Start from Preset`:
- show preset picker

#### C. Footer Actions
- `Continue`
- `Cancel`

### Important rule
Do not let the user create:
- unnamed forms
- junk containers by accident
- hidden technical drafts with no place in the tree

### Acceptance criteria
- user cannot proceed without a name
- user must choose a location
- user can create from blank, duplicate, or preset

## Screen 3: Builder Workspace

### Purpose
Build one form calmly.

### Core layout
- left: outline
- center: focused editor
- right: live preview

This is the most important screen.

### Wireframe zones

#### A. Top Bar
Visible:
- `Back to Library`
- current form name
- draft or published badge
- `Save Draft`
- `Publish`

Optional:
- `Preview`
- `Advanced`

Do not show:
- technical ids
- raw version objects
- complex workflow controls

#### B. Left Outline
Purpose:
- navigate the form structure
- show only the important structure

Visible nodes:
- blocks
- block nesting
- selected item

Visible actions:
- `Add Section`
- `Add Field`
- `Add Group`
- `Add Preset`

Optional per-node action:
- `...`

Do not show:
- raw props
- internal keys
- validation details

#### C. Center Focused Editor
Purpose:
- edit only one selected thing at a time

Possible editing contexts:
- form setup
- section
- field
- group
- preset instance

When no selection:
- show simple empty state

#### D. Right Live Preview
Purpose:
- reassure the user that the form is taking shape

Rules:
- independent scroll
- can be hidden
- updates on edit
- should not dominate the screen

### Default visible action set
Keep this very small:
- `Add Section`
- `Add Field`
- `Add Group`
- `Add Preset`
- `Duplicate`
- `Delete`
- `Save Draft`

### Advanced actions
Hide behind:
- `Advanced`
- or `More`

Advanced insert actions:
- note
- divider
- table
- repeater
- columns

Advanced field actions:
- semantic hints
- validation
- advanced props

### Acceptance criteria
- the user sees only one main editing context at a time
- the preview updates while editing
- the user can add and reorder content without typing order values
- the UI does not expose schema terms in the default path

## Screen 4: Review or Publish

### Purpose
Create a calm final checkpoint before the form becomes official.

### Wireframe zones

#### A. Header
- form name
- version state

#### B. Summary
Show:
- where the form lives
- block count
- last changes summary

#### C. Preview
Larger preview than the workspace side panel.

#### D. Publish Actions
- `Back to Edit`
- `Save Draft`
- `Publish`

Optional:
- version note input

### Acceptance criteria
- publishing does not feel like a technical operation
- user can review before finalizing
- user can return to editing safely

## Advanced Mode

### Purpose
Expose extra flexibility without overwhelming normal users.

### Recommended access
- one `Advanced` toggle in the builder workspace

### What becomes visible
- note blocks
- divider blocks
- repeater blocks
- table blocks
- columns blocks
- semantic hints
- validation rules
- advanced metadata

### Important rule
Advanced mode must not alter the default mental model.

It adds power.
It should not replace simplicity.

## Detailed Builder Workspace States

### State 1: Empty new form
Show:
- very small setup
- empty outline
- primary call to action: `Add Section` or `Add Preset`

### State 2: Existing simple form
Show:
- compact outline
- selected section or field in center
- preview visible

### State 3: Complex form
Show:
- same layout
- do not open everything
- rely on outline navigation

## Recommended Component Inventory

### Shared components
- top bar
- search input
- status badge
- primary action button
- ghost action button
- inline `...` menu
- modal confirm
- toast or status line

### Library components
- tree node
- selected form card
- empty search state

### Builder components
- outline node
- focused editor card
- block insert menu
- live preview panel
- dirty-state bar

### Review components
- publish summary card
- larger preview panel

## Recommended Interaction Rules

### Selection
Selecting an item should:
- highlight it in the outline
- open its editor in the center
- not open every other card

### Add flow
Adding content should always happen relative to the current context:
- add inside selected section
- add at top level
- add after selected block

### Reordering
Use drag-and-drop only.
No typed order numbers.

### Duplicate
Support duplication for:
- form
- section
- field
- group

### Delete
Always confirm.
Use calm language.

## Recommended Coding Sequence

### Phase 1: Library route
Deliver:
- tree-like library screen
- search
- new form button
- duplicate button

### Phase 2: New form route
Deliver:
- guided create flow
- name + location + starting method

### Phase 3: Workspace shell
Deliver:
- left outline
- center focused editor
- right preview

### Phase 4: Core block editing
Deliver:
- add section
- add field
- add group
- presets
- reorder

### Phase 5: Review/publish
Deliver:
- dedicated review screen
- publish flow

### Phase 6: Advanced mode
Deliver:
- advanced blocks
- advanced field options

## Recommended Definition Of Done For The First Usable Builder
The first truly usable builder is done when:
- a non-technical user can create a named form
- place it in the tree
- build it from sections, fields, groups, and presets
- preview it live
- save draft
- publish it

without needing to understand schema or internal system structure

## Final Recommendation
The builder should be implemented like this:

- screen-based flow
- simple default actions
- focused editing
- live preview
- hidden advanced power

That is the cleanest wireframe-level implementation plan for the current product direction.
