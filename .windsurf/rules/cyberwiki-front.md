---
trigger: always_on
---

# CyberWiki Frontend Rules

Based on [FrontX AI Guidelines](https://github.com/cyberfabric/frontx/tree/develop/.ai).

## AI WORKFLOW (REQUIRED)

- Route: identify target area (pages, api, events, styling, etc.).
- Read: MUST read target files before changing code.
- Summarize: list 3-7 rules from target area (internal, not written).
- Verify: pass Pre-diff Checklist before proposing code.
- STOP: if unsure which rules apply, ask instead of guessing.

## FILE PLACEMENT (CRITICAL)

### Application pages and features → `src/app/`

All pages, components, actions, effects, events, API services, and layouts MUST be created under `src/app/`.

```
src/app/
├── pages/           # Application pages (LoginPage, ProfilePage, etc.)
├── api/             # API services (AccountsApiService, etc.)
├── actions/         # Flux actions (emit events)
├── effects/         # Flux effects (listen to events, dispatch to slices)
├── events/          # Event type declarations (EventPayloadMap augmentation)
├── components/      # Shared UI components, grouped by domain (see below)
├── layout/          # App shell (Header, Sidebar, Layout)
├── themes/          # Theme definitions
├── icons/           # Icon components
└── lib/             # Utility functions
```

### Components → `src/app/components/` (domain-grouped)

Components are organized by **domain**, not by abstraction layer. Generic primitives live in `primitives/`; everything else groups by what it does (space, file, changes, etc.).

```
src/app/components/
├── primitives/      # shadcn/Radix-style primitives — Avatar, ConfirmDialog, ContextMenu, DropdownMenu, Sidebar, Skeleton, Sonner, CodeBlock
├── space/           # Space CRUD + tree — CreateSpaceModal, EditSpaceModal, SpaceTree
├── file/            # File viewer ecosystem — FileViewer, FileTree, FileRenderer, MdRenderer, PlainTextContentRenderer, FileViewerHeader, ViewModeSwitcher, CreateFileModal
├── file-mapping/    # File-mapping config — FileMappingConfiguration, FileMappingConfigPanel, FileMappingPreview
├── changes/         # Drafts + PR — DraftDiffView, PRBanner
├── enrichments/     # Enrichment UI — EnrichmentPanel, Comment, CommentsTab, ChangesTab, ConflictDetailsDialog, ConflictResolutionWidget, DiffViewer
├── loading/         # Loading states — SmartLoadingIndicator, TextLoader, ViewLoadingFallback
├── ApiTokensSection.tsx
└── ThemeProvider.tsx
```

- New components **must** be placed in the matching domain folder; only truly cross-cutting providers (theme, root-level sections) sit at the components root.
- When creating a new domain (≥3 related components), add a new subfolder rather than letting the root grow.
- Enrichment **types**, **API service** (`EnrichmentsApiService`), **events**, **actions**, and **effects** live in `src/app/` (under `api/`, `events/`, `actions/`, `effects/`).
- No MFE packages — `src/mfe_packages/` does not exist.

## UI KIT DISCOVERY (REQUIRED)

- Read `frontx.config.json` at project root to find `uikit` value.
- If `uikit` is `"shadcn"`: use local `components/primitives/` (shadcn components already scaffolded).
- If `uikit` is `"none"`: no UI library; create all components locally.
- Before creating ANY new UI component, verify the configured UI kit does not already provide it.

## ARCHITECTURE RULES

### Event-Driven Flux Pattern

All state flow follows: **Action → Event → Effect → Slice**

- **Actions** (`src/app/actions/`): pure functions that `eventBus.emit(...)` an event
  - Must return `void` — no `Promise<void>`, no async keyword
  - Fire-and-forget; cannot access store state (no `getState`)
  - Use imperative names: `loadSpaces`, `createSpace`
  - May compose other actions
- **Events** (`src/app/events/`): type-safe `EventPayloadMap` augmentation via `declare module '@cyberfabric/react'`
  - Use past-tense names: `wiki/spaces/loaded`, `wiki/space/created`
  - Every key must exist in `EventPayloadMap`; one payload type per key
- **Effects** (`src/app/effects/`): `eventBus.on(...)` handlers that call API services and `dispatch(...)` to Redux slices
  - Update only their own slice; no business logic
  - May NOT call actions (prevents loops)
  - May emit result/error events to notify UI
- **Slices**: Redux state managed by `@cyberfabric/react`

### API Services

- Extend `BaseApiService` from `@cyberfabric/react`
- One domain service per backend domain (no entity-based services)
- Use `RestEndpointProtocol` for declarative endpoints:
  - `query<TData>(path)` — GET requests
  - `mutation<TData, TVariables>(method, path)` — POST/PUT/PATCH/DELETE
- Base URL pattern: `/api/{domain}/v1`
- All requests go through Vite proxy to backend at `http://localhost:8888`
- `withCredentials: true` for session-cookie auth
- Access only via `apiRegistry.getService(ServiceClass)` — no direct axios/fetch
- **No mocks in production code** — all data from real backend

### Styling Rules

- Use Tailwind classes and theme tokens — no inline `style={{}}` outside `components/primitives/`
- No hardcoded hex colors — use CSS variables (`hsl(var(--primary))`) or Tailwind classes
- Units: rem-based tokens; `px` allowed only for border width
- Dark mode: CSS variables via `[data-theme]`
- Responsive behavior uses Tailwind prefixes (mobile-first)

### Import Rules

- Same package: relative paths
- Cross-branch in app: `@/` alias (maps to `src/`)
- Cross-package: `@cyberfabric/react`, `@cyberfabric/framework`
- UI components: local `components/primitives/`
- No barrel exports unless aggregating 3+ exports
- Redux slices: import directly (no barrels)

### Type Rules

- `type` for objects and unions; `interface` for React props
- Prefer `enum` over union of string literals for named type aliases (enforced by `local/prefer-enum-over-union`)
- No hardcoded string IDs — use constants or enums
- No `any`, no `unknown` in type definitions
- No `as unknown as` casts
- Resolve type errors at boundaries using proper generics
- Class member order: properties -> constructor -> methods
- Use lodash for non-trivial object and array operations

## STOP CONDITIONS

- Modifying registry root files
- Adding new top-level dependencies without approval
- Bypassing event-driven architecture
- Direct slice dispatch from components

## BLOCKLIST

- No telemetry or tracking code
- No `eslint-disable` comments (enforced by `noInlineConfig: true` + baseline check via `npm run lint:check-disables`)
- No string-literal union type aliases — use enums instead
- No `as unknown as` type casts
- No `unknown` in public type definitions
- No manual state sync or prop drilling (use events)
- No direct slice dispatch from components (use actions → events → effects)
- No native helpers where lodash equivalents exist
- No barrel exports that hide real imports
- No direct axios/fetch outside BaseApiService
- No hardcoded hex colors or inline styles outside `components/primitives/`

## PRE-DIFF CHECKLIST

- [ ] Import paths follow import rules
- [ ] Pages/features created under `src/app/`
- [ ] Event-driven architecture (actions emit → effects handle → slice update)
- [ ] Actions return void, no async keyword
- [ ] Effects do not call actions
- [ ] API types defined in `src/app/api/wikiTypes.ts`
- [ ] All sizes use rem tokens; inline styles only in `components/primitives/`
- [ ] UI uses configured UI kit (check `frontx.config.json`)
- [ ] No console errors
- [ ] TypeScript compiles without errors
- [ ] `npm run arch:check` passes
- [ ] `npm run lint:check-disables` passes (zero eslint-disable directives)

## CORRECTION POLICY

- Add or update a rule here (short and focused).
- Store memory of the correction.
- If new items require central edits, redesign to self-register.

## FEATURE CREATION POLICY

- Reuse existing patterns where possible.
- If adding a 3rd or later similar item, consider an index file.
- If new items require central edits, redesign to self-register.
