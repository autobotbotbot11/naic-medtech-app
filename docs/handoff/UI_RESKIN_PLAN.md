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
7. Do not let the UI collapse into panel-inside-panel composition.
8. Cards should mostly represent actual objects like records, forms, and users, not every section wrapper.
9. Do not over-explain obvious screens. Helper text should exist only when it prevents mistakes or clarifies a genuinely non-obvious step.

## Current Composition Rule
The shell architecture is no longer the main problem.

The current live direction is:
- keep the thin global header
- keep the hidden drawer
- keep page-local headers
- keep list-heavy pages bounded, but do not force nested scroll containers onto detail/edit pages
- shift page composition toward:
  - lighter page headers
  - compact toolbars
  - open sections
  - object cards only where they carry real content
- make module-local navigation clearer when it carries real workflow weight:
  - `Records > Work / History` should read like real local navigation, not like weak filter pills
- keep primary drawer navigation intentionally short:
  - `Records` for daily work
  - `Forms` for admin form setup
  - `Settings` for both personal and admin settings
- do not place account maintenance actions like password change in the drawer footer; they belong inside `Settings > My account`
- keep personal profile controls inside `Settings > My account`; the drawer should only summarize identity and expose log out
- keep email/login ID read-only in personal account settings unless a future admin-reviewed identity-change flow is explicitly designed
- reduce copy density:
  - hub pages should scan fast
  - simple actions should not need paragraph-length explanation
  - helper text belongs near constraints, file limits, validation, or ambiguous setup choices

Builder is the controlled exception:
- it can stay denser
- it is a focused tool workspace, not the calmest everyday surface

## Current Live CSS Reality
The current live app is split across these surface styles:
- `app/naic_builder/static/library.css`
- `app/naic_builder/static/records.css`
- `app/naic_builder/static/auth.css`
- `app/naic_builder/static/app.css`
- `app/naic_builder/static/new-form.css`
- `app/naic_builder/static/print.css`

Current reality:
- shared theme and shell assets are already landed now:
  - `app/naic_builder/static/theme.css`
  - `app/naic_builder/static/theme.js`
  - `app/naic_builder/static/shell.css`
  - `app/naic_builder/static/shell.js`
- the app is no longer purely in the old warm builder-era palette, but some older surface assumptions still exist inside the feature stylesheets
- repeated surface and spacing assumptions still exist across files even though the token layer is now shared
- the reskin is materially live already; current work is refinement and composition cleanup, not the initial light/dark plumbing anymore

## Recommended Technical Direction
The reskin should start by introducing a shared theme layer instead of repainting every stylesheet independently.

Shared assets that now exist:
- `app/naic_builder/static/theme.css`
- `app/naic_builder/static/theme.js`
- `app/naic_builder/static/shell.css`
- `app/naic_builder/static/shell.js`

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
- make the blurred top bar the primary anchor
- keep global navigation hidden inside a left drawer opened from the top bar
- keep only the real top-level destinations in global navigation
- keep the builder in the same product family through a workspace variant instead of a global nav destination

Definition of done:
- authenticated records, forms, settings, and builder screens all use one product shell
- the main canvas stays wide because global navigation is hidden until needed
- the global header stays thin, while page identity, contextual back links, and page actions live in page-local headers
- builder stays reachable from the forms workflow without competing as a first-class product area in global navigation

Current status:
- landed
- shared shell assets now exist at:
  - `app/naic_builder/static/shell.css`
  - `app/naic_builder/static/shell.js`
  - `app/naic_builder/templates/_authenticated_shell.html`
- the builder now uses the same family through a workspace shell variant
- the live shell now uses a thin global header plus page-local headers, with a hidden top-bar-triggered drawer instead of a persistent rail or permanently wide sidebar
- `Settings` is now visible for all signed-in users, while `Forms`, `Clinic profile`, and `Users & access` remain admin-only
- password management now lives in `Settings > My account`; the drawer footer is account identity plus `Log out` only
- drawer icons now use one consistent premium-style 24px stroke icon system
- `Settings > My account` now also carries profile photo upload/remove and read-only account identity, and the shell uses the uploaded profile photo with initials fallback
- `Settings > Users & access` now treats account rows like staff identity cards with avatar/initial display instead of text-only admin rows
- user maintenance now opens a dedicated `Manage user` page instead of stuffing role correction and password reset into the directory row

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

Current status:
- materially landed for the current non-print pass
- `/records` is now a queue-first Work surface with compact record cards, bounded list scrolling, and `New record` handled through a searchable picker instead of a ceremony page; `/records/new` keeps the same picker pattern as the fallback route
- `/records/history` owns completed lookup/search, while `Work` stays focused on active drafts
- `Work` now exposes `View all drafts` when recent drafts are truncated, and `/records/history?status=draft` gives draft lookup its own real filter instead of burying older drafts under `All`

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

Current status:
- materially landed for the current non-print pass
- `/login`, `/request-account`, and `/setup` now use the same compact utility-card treatment as the Settings account surfaces, replacing the older heavy auth panel plus long helper-list composition with one direct form card and one compact facts card
- `/settings/clinic` and `/settings/users` now use lighter local sectioning and tighter object cards instead of wrapping every block in large settings panels
- `/settings/clinic` now uses the same compact utility-card treatment for clinic identity, contact details, logo upload, and brand preview, keeping clinic branding ready for the later print-template pass without making this screen feel heavy
- `/settings/account` now carries the personal profile foundation: avatar upload/remove, password management, and read-only email/login identity, now using the same compact utility-card system as the newer account admin screens
- `/settings/users` now displays uploaded staff avatars when available, with initials fallback
- `/settings/users/{id}/edit` now exists for admin full-name/role correction and password reset
- `/settings/users` is now one searchable/filterable directory with status filters, instead of separate pending/active/disabled buckets
- `/settings/users/new` and `/settings/users/{id}/edit` now use the same compact utility-card treatment as the Forms utility screens, so manual account creation and user maintenance no longer fall back to the older heavy auth-panel composition

### Phase 4
Forms library and guided creation
- `/forms`
- `/forms/new`
- folder move/create/edit screens

Reason:
- these are admin/setup surfaces
- they should inherit the same system cleanly after records and auth are stable

Current status:
- materially landed for the current non-print pass
- `/forms` now uses a lighter search/browse toolbar and open section flow instead of the earlier browse-sidebar composition
- folder and form rows are tighter, with repeated metadata reduced and secondary actions kept behind calm `More` menus
- `/forms` now has a compact file-browser pass too: object icons, icon-only overflow actions, live result counts, and clearable search make the library feel more direct without changing the tree model
- `/forms/new` now uses one guided setup card plus a compact summary instead of three separate step panels, keeping the same builder handoff while reducing ceremony
- folder create/edit/move and form move screens now share the same compact utility-card treatment instead of falling back to older heavy form cards

### Phase 5
Builder
- `/builder`

Important:
- builder is more complex and should be reskinned after the calmer shared system already exists
- do not let builder styling drive the entire product direction again

Current status:
- active refinement landed for the current non-print pass
- the separate stage-head band is gone; preview, advanced mode, status, new, more, and save now live in the builder command bar
- builder can still stay denser than daily records/forms/settings because it is a focused setup workspace

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
