# UI Reskin Plan

## Purpose
This document locks the next live UI direction for the app so future implementation stays aligned with the chosen standalone explorations.

The app already works functionally. The goal now is not to redesign the workflow from zero. The goal is to reskin the live app into a more premium, modern, calm product without making it heavier or less usable.

## Locked Visual Direction
Chosen visual family:
- `Clinical Depth Luxe`

Chosen mode pair:
- light mode: `artifacts/ui-explorations/records-home-modern-clinical-depth-luxe.html`
- dark mode: `artifacts/ui-explorations/records-home-modern-clinical-depth-luxe-dark-deeper.html`

These two files are the visual north star.

Important:
- do not reopen style-family exploration before trying to translate this pair into the live app
- do not add random extra themes
- keep only:
  - `Light`
  - `Dark`
  - optional `System` behavior for default mode detection

## Design Intent
The chosen direction is not flashy luxury and not generic dashboard minimalism.

The intended feel is:
- premium
- modern
- authored
- calm
- clinical
- high-end but restrained

The app should feel expensive because it is deliberate, not because it is overloaded.

## Non-Negotiable UI Rules
1. The app must stay simple to use for a small clinic.
2. The daily medtech path must stay obvious.
3. Dark mode should be atmospheric, not neon and not pure black.
4. Light and dark mode must feel like the same product.
5. Do not add many theme choices or arbitrary palette switching.
6. The reskin must be token-first and scalable, not page-hack-first.

## Current Live CSS Reality
The current live app is split across these surface styles:
- `app/naic_builder/static/library.css`
- `app/naic_builder/static/records.css`
- `app/naic_builder/static/auth.css`
- `app/naic_builder/static/app.css`
- `app/naic_builder/static/new-form.css`
- `app/naic_builder/static/print.css`

Current reality:
- these files still carry the older warm builder-era palette directly inside each stylesheet
- repeated color and surface values exist across files
- this is workable for a functional prototype, but it is not the right base for a scalable reskin

## Recommended Technical Direction
The reskin should start by introducing a shared theme layer instead of repainting every stylesheet independently.

Recommended new shared assets:
- `app/naic_builder/static/theme.css`
- `app/naic_builder/static/theme.js`

### `theme.css`
Should define the global design tokens for both light and dark mode:
- page background
- shell background
- panel backgrounds
- elevated surfaces
- borders
- shadows
- text colors
- muted text
- accent colors
- success / warning / danger colors
- radii
- focus rings
- shared button/input treatments

Recommended pattern:
- `:root` = light tokens
- `[data-theme="dark"]` = dark tokens

### `theme.js`
Should handle:
- reading saved theme from local storage
- defaulting to system preference if no manual setting exists
- setting `data-theme` on `document.documentElement` or `body`
- simple mode switching:
  - `light`
  - `dark`
  - optional `system`

Important:
- the visible toggle should stay small and calm
- do not turn settings into a theme playground

## Rollout Order
Do not reskin every screen at once.

### Phase 1
Shared theme foundation
- add `theme.css`
- add `theme.js`
- define the token system
- add the light/dark toggle
- apply the shell-level background, text, panels, buttons, and inputs first

Definition of done:
- the app can switch between the chosen light and dark modes
- the shell and generic controls already feel like the new design family

Current status:
- landed
- `theme.css` and `theme.js` already exist
- the shared token layer and light/dark plumbing are already live

### Phase 1.5
Authenticated product shell
- add one shared authenticated shell
- add sidebar navigation
- add top contextual bar
- keep the builder in the same product family through a workspace variant

Definition of done:
- authenticated records, forms, settings, and builder screens all use one product shell
- page-level actions move into the contextual top bar instead of every page inventing its own nav chrome

Current status:
- landed
- shared shell assets now exist at:
  - `app/naic_builder/static/shell.css`
  - `app/naic_builder/static/shell.js`
  - `app/naic_builder/templates/_authenticated_shell.html`
- the builder now uses the same family through a workspace shell variant

### Phase 2
Records-first reskin
- `/records`
- `/records/new`
- `/records/{id}/edit`
- `/records/{id}`

Reason:
- records is the real center of the app
- if the records flow looks premium, the product story becomes much stronger immediately

Definition of done:
- records home and record entry feel like the chosen `Clinical Depth Luxe` direction in both light and dark mode

### Phase 3
Auth and settings
- `/login`
- `/setup`
- `/request-account`
- `/change-password`
- `/settings/clinic`
- `/settings/users`

Reason:
- these screens should match the product shell, but they are secondary to the daily medtech runtime

### Phase 4
Forms library and guided creation
- `/forms`
- `/forms/new`
- folder move/create/edit screens

Reason:
- these are admin/setup surfaces
- they should inherit the same system cleanly after records and auth are stable

### Phase 5
Builder
- `/builder`

Important:
- builder is more complex and should be reskinned after the calmer shared system already exists
- do not let builder styling drive the entire product direction again

### Phase 6
Print
- only after the real branded print/template direction is resumed
- print should borrow the brand identity from the new UI system, but follow its own template-first rules

## What To Change First
The first implementation pass should focus on:
- page background treatment
- app shell chrome
- panel materials
- heading/body typography pairing
- primary / ghost button hierarchy
- input styling
- status chips
- banners
- search fields

This gives the largest visual gain with the least workflow risk.

## What Not To Change Early
Avoid starting with:
- page-by-page custom art direction
- complex motion systems
- print styling
- builder-specific deep component surgery
- lots of one-off decorative effects

Those should come after the shared system is stable.

## Theme Behavior Recommendation
Preferred behavior:
- default to `System`
- allow user override via a small toggle or menu
- remember the explicit choice in local storage

Visible choices should stay limited to:
- `Light`
- `Dark`
- optionally `System`

Do not expose broader theme customization right now.

## Typography Recommendation
The chosen exploration direction needs:
- stronger, more premium heading personality
- still highly readable body text
- better hierarchy than the current warm prototype

Implementation note:
- the live reskin should choose one intentional heading family and one intentional body family
- avoid falling back to generic default-feeling combinations if possible

## Product Guardrails
When implementing the reskin:
- preserve existing information hierarchy
- preserve existing route structure
- preserve current calm copy and workflow decisions
- do not trade clarity for decoration
- do not make dark mode so dark that data entry becomes tiring

## Success Criteria
The live reskin is successful if:
- the app still feels simple and fast
- the product feels more premium and modern immediately
- records feel like the center of a real clinic product
- auth/settings/forms no longer feel like prototype utility screens
- light and dark both feel curated and consistent
- the reskin makes later branded print work easier, not harder
