# Shared components

Reusable UI primitives that aren't specific to one route live under
`components/ui/`. Before adding new UI elsewhere in the app, check here first
and reuse or extend an existing component instead of introducing an
equivalent one.

## FormField

`components/ui/form-field.tsx` is the reusable field for the repeated
Title / Arabic-English / Translate with AI / AI Assistance pattern (ANA-96) --
reach for it instead of wiring that pattern up again in a new screen. It
renders a `text`, `textarea`, or `markdown` body, optionally per-language
(`translatable`), with Translate with AI and AI Assistance as independent,
optional actions. Neither AI action calls an `/api/v1/ai/*` boundary itself:
each is wired through a caller-provided `onAiTranslate`/`onAiAssist` function
plus a matching `getAITranslationContext`/`getAIAssistanceContext` builder
that supplies whatever domain context that call needs (e.g. a Book id) --
`FormField` never hard-codes Book- or Module-specific context. Both actions
share the same Additional Instructions step (`ai-instructions-modal.tsx`) and
the same busy/disabled/error handling; `onBusyChange` lets a caller managing
several `FormField`s together freeze the rest of its form while any one
field's AI request is in flight (see edit-module-modal.tsx's existing
`aiBusy` pattern, which this replaces once a screen migrates to it).
`translatable-field-header.tsx` is the label + actions + language-switcher
row `FormField`, `TranslatableTextInput`, and `TranslatableTextArea` all
share.

## Conventions

- **Location**: `components/ui/<kebab-case-name>.tsx`.
- **Colocated stories and tests**: `<name>.stories.tsx` and `<name>.test.tsx`
  sit next to the component they cover, not in `stories/` or `__tests__/`.
  Both `.storybook/main.ts` and `vitest.config.mts` are configured to pick up
  `components/**`.
- **Every component needs a story.** This includes supporting components
  extracted for composition (e.g. a switcher or toolbar used by a larger
  field), not only the top-level component a caller imports. This also
  applies to feature-level components under `app/` (e.g.
  `app/admin/books/`) -- `.storybook/main.ts` also picks up
  `app/**/*.stories.tsx` for these, colocated the same way.
- **Mantine first**: build the field shell, labels, buttons, and layout with
  Mantine components (`@mantine/core`) rather than raw HTML/Tailwind, so the
  design system stays consistent. Tailwind utility classes are fine for small
  layout tweaks Mantine doesn't cover, matching the pattern already used in
  `app/admin/_components/dashboard-shell.tsx`.
- **No business logic**: shared components take `value`/`onChange` (or a
  small imperative ref API) and stay free of translation/Firestore/API
  concerns -- callers own that.
- **Client-only dependencies**: a component that touches browser-only APIs
  and has no SSR support (e.g. MDXEditor, see `markdown-editor.tsx`) is
  loaded via `next/dynamic({ ssr: false })` behind a small public wrapper, so
  callers can use it like any other component. If that wrapper needs to
  expose a ref, pass it as a plain prop (not `ref`) to the dynamically loaded
  component -- `next/dynamic`'s loading wrapper doesn't forward `ref`.
