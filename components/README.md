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

Module Builder's Font Size (zoom) and Text Direction (align) controls
(`font-size-control.tsx`, `text-direction-control.tsx`) also build on this
component -- they pass a smaller `size={28}`/icon `size={14}` (a compact
bordered `control-group.module.css` group, not an inline action row) and
Text Direction additionally toggles `variant="light"`/`"subtle"` with
`aria-pressed` for its active/inactive state, both of which pass straight
through as ordinary `ActionIconProps`.

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
specific context; see module-editor-body.tsx's Title/Description/Content
wiring (ANA-98) for the pattern. AI Assistance runs through the shared
Additional Instructions step (`ai-instructions-modal.tsx`); Translate with
AI opens the same modal with `showInstructions={false}` (ANA-98: it only
ever transforms the whole Arabic value into English, never something an
editor needs to redirect with free-form guidance, so it has no free-form
field -- but it still shows its base prompt, see below).
A caller that needs extra controls in that dialog passes them as
`aiAssistanceOptions` (rendered above the instructions field via
`AiInstructionsModal`'s `children`) and keeps their state itself -- the Book
form's module picker for Description/Long description (ANA-133) works this
way. AI Assistance stays enabled on an empty field -- caller context alone may
be enough to generate a value -- and for `type="markdown"` operates on the
editor's current selection when there is one, replacing only that range,
falling back to the whole value otherwise. `FormField` stays domain-agnostic
about that selection: it only reports whether `text` is a selection via
`isSelection` on the action args (`FormFieldAiActionArgs`, ANA-99) -- a
caller whose AI task needs the rest of the field's current value as
surrounding context (e.g. the full Learning Material around a selected
paragraph) reads `isSelection` and supplies that extra context itself; see
module-editor-body.tsx's Content field wiring (`fullMaterial`, ANA-99).
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
since only `onAiAssist`'s own args carry `language`).

A third shape exists for a translatable field whose AI Assistance always
generates one fixed language regardless of which tab is active -- e.g. a
Lesson Title/Description Suggest, which always returns Arabic even though
the field itself stays translatable so English can still be filled in
separately via Translate with AI (ANA-116 PR review). Unlike the two
contracts above, this one _is_ enforced by `FormField` itself, via the
`aiAssistanceLanguage` prop: when set, AI Assistance's whole-field (non-
selection) source text and apply target are pinned to that language,
overriding the default tab-following `activeSlug`, so running it from the
English tab can never write the fixed language's output into `en` (see
lesson-form.tsx's Title/Description wiring). Omit
`aiAssistanceLanguage` for either of the two contracts above -- `FormField`
otherwise stays language-agnostic, so which one applies is each caller's
responsibility.
Both actions share the same busy/disabled/error handling, scoped to that one
field: `FormField` combines its own `disabled` prop with its own
translate/assist loading state into a local `fieldBusy` that only ever
freezes itself. A caller with several `FormField`s in one form must not
aggregate their busy states into one flag and feed it back into every
field's `disabled` (or into unrelated, non-AI controls) -- that was the
book-form.tsx/module-editor-body.tsx `aiBusy` bug fixed by ANA-109: an
in-flight Translate/AI Assistance request on one field must never disable
any other field or control. `onBusyChange` still reports one field's own
busy window to its caller for whatever else it might need beyond disabling
that field itself -- module-editor-body.tsx aggregates its three fields'
`onBusyChange` calls into one `aiBusy` flag again, but only to gate its own
Save Module/Save changes action (never Cancel, and never fed back into any
field's `disabled`): saving while a translation is still in flight would
persist the pre-translation value and silently lose the AI result once it
resolves after the container has already closed (ANA-109 PR review). book-form.tsx
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

## DrawerShell

`components/ui/drawer-shell.tsx` is the reusable right-side drawer layout
(ANA-122) for admin editor panels: a header that always stays visible (a
left-pointing back arrow plus the supplied `title`, rendered with the same
`Title order={2}` typography/theme behavior as the Edit Book page's own
title -- never Mantine's own close/X button), a `flex: 1` scrollable
content region, and an optional footer pinned to the bottom for the
consumer's own actions (e.g. Cancel/Save). It's built from Mantine's
compound `Drawer.Root`/`Content`/`Header`/`Body` API rather than the
`<Drawer>` shorthand specifically so the header/footer can be real
flex-column siblings of the scrollable body (see `drawer-shell.module.css`)
instead of fixed pixel positioning. `DrawerShell` is presentation-only: it
owns no editor state or save/dirty logic of its own, and every dismissal
path it doesn't render its own control for (Escape, outside/backdrop click)
funnels through the caller-supplied `onClose` -- the same guarded handler
the caller already wires its own Cancel action to, so an existing
unsaved-changes confirmation stays authoritative regardless of how the
drawer was dismissed. The back arrow calls `onBack` when supplied, falling
back to `onClose` otherwise (every current consumer is a single top-level
drawer, where those are the same thing).

A component nested arbitrarily deep in `DrawerShell`'s `children` that owns
its own busy/dirty state (and so can't have that state lifted up into the
container that renders `DrawerShell`) renders its actions into the fixed
footer via the paired `DrawerFooter` component, which portals into the
nearest ancestor `DrawerShell`'s footer region instead -- see
`module-editor-body.tsx`'s `isNarrow` footer wiring for the real usage this
supports. `DrawerShell` keeps no state of its own beyond one instance's own
footer-portal target, so nothing prevents two instances being mounted and
`opened` at once with no extra wiring.

Real nested-drawer stacking (PR review, ANA-122) -- a parent staying open/
mounted underneath a child, with only the topmost one responding to
Escape/outside-click and showing its own overlay -- is opt-in via the
`stackId` prop: wrap the parent and child `DrawerShell`s in a shared
Mantine `Drawer.Stack` (re-exported from `@mantine/core`), give each its
own `stackId`, and `DrawerShell` reads that `Drawer.Stack`'s context itself
to scope `closeOnEscape`/`trapFocus`/the overlay's own visibility to
whichever `stackId` is currently topmost -- the same rule Mantine's own
stacked modals/drawers use, since the compound `Drawer.Root` API this
component is built on (unlike the `<Drawer>` shorthand) doesn't do this
automatically. See this file's own `Stacked` story and
`drawer-shell.test.tsx`'s stacking `describe` block for the exact
behavior. A standalone `DrawerShell` that omits `stackId` is completely
unaffected -- every prop this adds is left at `Drawer.Root`'s own regular
default in that case. `edit-module-drawer.tsx` (ANA-123) is the first
production consumer: a Lessons header action opens a second, nested
`DrawerShell` stacked above the Module editor's own via this same
mechanism. `edit-module-drawer.tsx` itself only owns that nested drawer's
open/closed flag (a plain navigation boolean); its real content -- a
purpose-built, minimal sortable Lesson-card list -- is rendered by
`module-editor-body.tsx` instead, since every Lesson data/handler that
content needs (the Lessons SWR read, the pending reorder draft, create/
update/delete) already lives there. Reordering there has no dirty-tracking
or Save/Cancel of its own (ANA-124, simplified in ANA-126): it belongs to
the Module object itself, so it folds straight into `ModuleEditorBody`'s
own Module-level `isDirty`/Save changes, the same as every other Module
field -- this nested drawer is purely a display/navigation surface for it.
That
second `DrawerShell` instance ends up mounted several React components
deeper than the first, inside `ModuleEditorBody`'s own children rather than
as its JSX sibling -- `Drawer.Stack`'s stacking still works correctly
across that gap, since it's wired through Mantine's own `DrawerStackContext`
(plain React context), not DOM/JSX adjacency. Don't assume a stacked child
`DrawerShell` has to be declared next to its parent's -- render it from
wherever its own content/state naturally lives instead of lifting that
state up just to keep the JSX visually nested.

`headerActions` (ANA-123) renders additional content in the header,
right-aligned opposite the back button/title -- e.g. that same Lessons
button. It needs no layout wrapper of its own: Mantine's own
`ModalBaseHeader` is already `justify-content: space-between`, so a second
header child lands on the opposite side for free. Omit for a header with
no actions beyond the back button (every consumer before ANA-123).

One implementation note for a future change here: `Drawer.Stack`'s own
context value is a new object every time its internal `stack`/`maxZIndex`
state changes -- including as a _result_ of a `DrawerShell`'s own
`addModal`/`removeModal` registration call. The registration effect's
dependency array deliberately omits that context value (matching Mantine's
own identical effect in its `<Drawer>` shorthand) -- including it re-runs
the effect on every one of those re-renders too, calling `addModal`/
`removeModal` again, producing another new context value, and so on: an
infinite render loop (hit once during development, not merely a
theoretical concern).

## SaveButton

`components/ui/save-button.tsx` (ANA-129) wraps the plain Mantine `Button`
used for every editor's primary save action -- Module/Lesson Save
changes/Save Module (module-editor-body.tsx/lesson-editor.tsx), the Book
edit page's Save changes, and the Manage Users permission form's Save
changes/Save access. It takes the same props as `Button` plus a required
`dirty: boolean`: this theme's usual primary green (the default, no
`color` override) while `dirty` is `false`, an amber `#fd9c20` (PR review
-- a literal hex, not one of this theme's own named colors) once it's
`true`. `color` is omitted from this component's own props -- it fully
owns the color, so a caller can't fight `dirty` with its own override.
Before this existed, every one of those buttons rendered in the same
green regardless of whether there was anything to save -- reach for this
instead of a bare `Button` for any new Save action so it stays
consistent. The caller still owns computing `dirty` (comparing current
field values against whatever the editor was seeded with, e.g.
`ModuleEditorBody`'s/`LessonEditor`'s own `isDirty`) --
this component only renders the result.

## ListHeaderAction

`components/ui/list-header-action.tsx` (extracted in ANA-129 from
`questions-editor.tsx`'s original New/Insert/Generate) is the compact text
action a bare (non-`ItemList`) list's header uses instead of a full Mantine
`Button` -- a plain `<button>` styled through `list-header-action.module.css`
(white at 70% opacity, this theme's primary green at full opacity on hover,
35% opacity plus `not-allowed` when `disabled`), which reads as lighter-weight
than a pill-shaped filled/light `Button` would for a header action. Takes an
`icon` (`ReactNode`) plus the label as `children`; every other prop passes
straight through to the underlying `<button>`. Used by the Questions editor's
New/Insert/Generate and the Break entries list's Add entry
(lesson-break-config.tsx) -- reach for this before adding a new list's own
header action rather than reinventing the style.

## DashedEmptyState

`components/ui/dashed-empty-state.tsx` (extracted in ANA-129 from
`questions-editor.tsx`'s original "No questions yet." state) is the centered
message inside a dashed, rounded box a bare (non-`ItemList`) list shows when
it has nothing to display. `ItemList`'s own `emptyState` prop needs no
separate border (it already renders inside `ItemList`'s own bordered card,
see `item-list.module.css`'s `.emptyState`) -- this is for a list with no
such outer card of its own, e.g. the Questions and Break entries editors.
Takes the message as `children`.

## Edit Module: thin container + shared body

`app/admin/books/edit-module-drawer.tsx` (the Edit Module drawer, right-side,
fixed 560px on desktop -- 500px at ANA-121, widened at ANA-123, migrated onto
the shared `DrawerShell` above in ANA-122) is a thin container around the
actual editing experience -- `app/admin/books/module-editor-body.tsx`'s
`ModuleEditorBody`, which owns every field, AI action, the Lessons
list/editor, loading state, and save/discard behavior. The drawer mounts
`ModuleEditorBody` inside the shared `DrawerShell`, bridges every way the
drawer can be dismissed (back arrow, Escape, backdrop/outside click) through
the body's own unsaved-changes guard via a `requestCloseRef` pattern, and
otherwise gets out of the way.

`ModuleEditorBody` renders no Lessons list/editor inline (ANA-123): that's a
Lessons header action that opens a second, nested `DrawerShell` stacked
above the Module drawer via a shared Mantine `Drawer.Stack`, per `stackId`
(ANA-122's own stacking support -- see `drawer-shell.tsx`'s `Stacked`
story/tests for the exact mechanics this reuses), with its own purpose-built,
minimal sortable card list (`lessons-drawer-list.tsx`) and no dirty-state or
Save/Cancel of its own (ANA-126: a pending reorder counts toward
`ModuleEditorBody`'s own Module-level dirty state instead). Lesson mode's
`LessonEditor` content renders in its own third nested `DrawerShell`
(`stackId="lesson-editor"`, ANA-125) stacked above the Lessons drawer, opened
by New Lesson/Edit inside that Lessons drawer, which stays mounted/open
underneath rather than being hidden (see `DrawerShell`'s `stackId` doc above
for the same "child stays a JSX sibling, not a DOM descendant, and only the
topmost drawer responds to Escape/outside click" mechanics one level
deeper). This third `DrawerShell`'s own `onClose` is wired through a second,
deeper `requestCloseRef` bridge (ANA-126), the same "container calls
`requestCloseRef.current()` instead of `onClose` directly" pattern
`EditModuleDrawer` uses one level up, so `LessonEditor`'s own unsaved-changes
confirmation stays authoritative regardless of whether it was dismissed via
its Back button, Escape, or an outside click. Reach for this same split -- a
shared `*-body.tsx` plus a thin container wrapper -- before duplicating an
existing editor's logic into a second container.

(An earlier `EditModuleModal` container/`ModuleEditorBody` `layout` prop
existed alongside this drawer through ANA-127; both were removed in ANA-128
once the drawer became the only consumer.)

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

## Base prompt is always visible and editable (ANA-134)

Every AI action shows the base prompt it will send -- in an editable
textarea -- before the request is made, and the value in that textarea is
what reaches the model (the untouched default if the admin changes nothing).
No AI request may be sent with a prompt the admin can't inspect first.

- `use-base-prompt.ts` (`useBasePrompt(task, language?)`) loads the default
  from `GET /api/v1/ai/base-prompt` via SWR and holds the admin's edit;
  `base-prompt-field.tsx` (`BasePromptField`) renders it, with a "Reset to
  default". Both are used by `AiInstructionsModal` and
  `GenerateQuestionsModal`.
- `AiInstructionsModal` requires a `promptTask` (a key from
  `lib/ai/base-prompt-tasks.ts`) and calls `onGenerate(instructions,
basePrompt)`. Generate stays disabled until the prompt has loaded.
  `FormField` takes `aiAssistanceTask`/`aiTranslationTask` and keeps the
  action disabled without one; `basePrompt` arrives on
  `FormFieldAiActionArgs` and must be forwarded on the request.
- Server side, every `/api/v1/ai/*` request accepts an optional `basePrompt`
  (validated by `lib/ai/read-base-prompt.ts`); omitted means the helper's own
  default. The defaults are exported from each `lib/ai` helper and collected
  in `lib/ai/base-prompts.ts` -- **a new AI action must add a task key
  there, export its prompt, accept `basePromptOverride`, and open its dialog
  with `promptTask`** so this stays consistent.
- Unit tests get a global synchronous stub of `useBasePrompt` (see
  `vitest.setup.ts`; default prompt is `Default base prompt for <task>`).
  Stories that open an AI dialog use `withBasePromptStub`.
