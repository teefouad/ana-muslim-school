# Shared components

Reusable UI primitives that aren't specific to one route live under
`components/ui/`. Before adding new UI elsewhere in the app, check here first
and reuse or extend an existing component instead of introducing an
equivalent one.

## ActionIconButton

`components/ui/action-icon-button.tsx` is the shared icon-button used for
every action button across the admin (ANA-105): AI Assistance/Translate with
AI on `FormField` (the Edit Module modal's fields), Module Builder's AI
Assistant/Translate/Delete (`learning-material-module-card.tsx`), the
Modules panel's Edit/Delete (`item-list.tsx`), and the Books/Users listing
Edit/Delete (`data-table.tsx`). It's a thin wrapper around Mantine's
`ActionIcon` (`variant="subtle"` by default) that applies one shared CSS
Module class (`action-icon-button.module.css`, originated as ANA-100's
FormField-local `.actionButton`): a 150ms hover background transition
(`rgba(255, 255, 255, 0.1)`), and a disabled state with a fully transparent
background (not Mantine's default disabled fill) and a dimmed icon. Reach
for this instead of a bare `ActionIcon` for any new icon-only action button,
so it stays visually consistent with the rest of the admin without
restyling per screen. `color` is left to the caller -- every action button
uses the default (theme primary) color except a destructive one (Delete),
which passes `color="red"` everywhere it appears, a deliberate, consistent
exception rather than a per-screen choice. Icon size is `16` at every one of
these call sites; a caller-supplied `className` layers on top of the shared
class for layout only (e.g. `learning-material-module-card.module.css`'s
`.headerAction` for inter-button spacing) -- never to restyle the button's
own look.

## FormField

`components/ui/form-field.tsx` is the reusable field for the repeated
Title / Arabic-English / Translate with AI / AI Assistance pattern (ANA-96) --
reach for it instead of wiring that pattern up again in a new screen. It
renders a `text`, `textarea`, or `markdown` body, optionally per-language
(`translatable`), with Translate with AI and AI Assistance as independent,
optional actions. Neither AI action calls an `/api/v1/ai/*` boundary itself:
each is wired through a caller-provided `onAiTranslate`/`onAiAssist` function
plus a matching `getAITranslationContext`/`getAIAssistanceContext` builder
that supplies whatever domain context that call needs (e.g. a Book id, or a
Module's other fields) -- `FormField` never hard-codes Book- or Module-
specific context; see edit-module-modal.tsx's Title/Description/Content
wiring (ANA-98) for the pattern. AI Assistance runs through the shared
Additional Instructions step (`ai-instructions-modal.tsx`); Translate with
AI is a deliberate exception and runs directly (ANA-98: it only ever
transforms the whole Arabic value into English, never something an editor
needs to redirect with free-form guidance), preserving the existing
replace-confirmation dialog when the target language already has content.
AI Assistance stays enabled on an empty field -- caller context alone may
be enough to generate a value -- and for `type="markdown"` operates on the
editor's current selection when there is one, replacing only that range,
falling back to the whole value otherwise. `FormField` stays domain-agnostic
about that selection: it only reports whether `text` is a selection via
`isSelection` on the action args (`FormFieldAiActionArgs`, ANA-99) -- a
caller whose AI task needs the rest of the field's current value as
surrounding context (e.g. the full Learning Material around a selected
paragraph) reads `isSelection` and supplies that extra context itself; see
edit-module-modal.tsx's Content field wiring (`fullMaterial`, ANA-99).
Non-translation AI generation/assistance is Arabic-only end to end for
Module-level fields (ANA-99): every Module `onAiAssist`/
`getAIAssistanceContext` wired to a real `/api/v1/ai/assist` call sends and
expects only Arabic text/context, never a bilingual `{ ar, en }` shape.
Book-level AI Assistance (`bookDescription`/`bookLongDescription`, ANA-100)
is the one deliberate exception: since `FormField` lets an editor run AI
Assistance from either language tab, Book field AI Assistance follows
whichever language is active (`language` on `FormFieldAiActionArgs`) --
context is sent in that same language and the AI is required to write its
result in that same language, so switching to the English tab and running
AI Assistance there can never overwrite the Arabic value (PR review, ANA-100
-- see suggest-book-description.ts's/suggest-book-long-description.ts's
language-parameterized base prompt, and book-form.tsx's `onAiAssist`, which
builds this context inline rather than through `getAIAssistanceContext`
since only `onAiAssist`'s own args carry `language`). `FormField` itself
stays language-agnostic in both cases (it doesn't enforce either contract),
so which one applies is each caller's responsibility.
Both actions share the same busy/disabled/error handling, scoped to that one
field: `FormField` combines its own `disabled` prop with its own
translate/assist loading state into a local `fieldBusy` that only ever
freezes itself. A caller with several `FormField`s in one form must not
aggregate their busy states into one flag and feed it back into every
field's `disabled` (or into unrelated, non-AI controls) -- that was the
book-form.tsx/edit-module-modal.tsx `aiBusy` bug fixed by ANA-109: an
in-flight Translate/AI Assistance request on one field must never disable
any other field or control. `onBusyChange` still reports one field's own
busy window to its caller for whatever else it might need beyond disabling
that field itself -- edit-module-modal.tsx aggregates its three fields'
`onBusyChange` calls into one `aiBusy` flag again, but only to gate its own
Save Module/Save changes action (never Cancel, and never fed back into any
field's `disabled`): saving while a translation is still in flight would
persist the pre-translation value and silently lose the AI result once it
resolves after the modal has already closed (ANA-109 PR review). book-form.tsx
has no such save action of its own to gate and wires nothing.
`translatable-field-header.tsx` is the label + actions + language-switcher
row `FormField`, `TranslatableTextInput`, and `TranslatableTextArea` all
share.

Not every entity has an owning parent to reload context from server-side.
Module-level AI Assistance (`suggest-module-title.ts`, etc.) always reloads
its owning Book fresh from a client-supplied `bookId`, since a Module is
never the top-level entity. A Book's own fields have no such parent --
`suggest-book-description.ts`/`suggest-book-long-description.ts` (ANA-100)
never load anything server-side; the Book's own Title/Description/Long
Description are trusted directly from the request body, the same way a
Module's own current title/content are already trusted for Module-level AI
Assistance. This is what lets Book field AI Assistance work identically
before the Book has even been created (Add Book) and after (Edit Book) --
see book-form.tsx's `onAiAssist` wiring.

The AI Assistance/Translate with AI actions (and any future delete-style
action added to this component) render through the shared `ActionIconButton`
(see above), not a bare `ActionIcon` -- that's what keeps every `FormField`
consumer visually consistent with the rest of the admin's action buttons
(ANA-100, generalized into a shared component in ANA-105).

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
- **Typography**: Inter is the admin dashboard's primary font (ANA-105), set
  once via `lib/mantine/theme.ts`'s `fontFamily`/`headings.fontFamily`
  (loaded through `next/font/google` in `app/layout.tsx` as `--font-inter`)
  so every Mantine component inherits it automatically. Don't set a
  component-local `fontFamily` to Inter explicitly, and don't reach for
  Geist Sans/Mono in admin UI -- those stay loaded only for the unrelated
  default Next.js landing page (`app/page.tsx`).
- **No business logic**: shared components take `value`/`onChange` (or a
  small imperative ref API) and stay free of translation/Firestore/API
  concerns -- callers own that.
- **Client-only dependencies**: a component that touches browser-only APIs
  and has no SSR support (e.g. MDXEditor, see `markdown-editor.tsx`) is
  loaded via `next/dynamic({ ssr: false })` behind a small public wrapper, so
  callers can use it like any other component. If that wrapper needs to
  expose a ref, pass it as a plain prop (not `ref`) to the dynamically loaded
  component -- `next/dynamic`'s loading wrapper doesn't forward `ref`.
