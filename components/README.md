# Components

Shared UI primitives live in `components/ui/`. Before adding new UI, check
here and the existing Storybook stories -- reuse or extend an existing
component instead of introducing an equivalent one. See `AGENTS.md` for the
full engineering rules this repo follows.

## Folder structure

Each component gets its own folder under `components/ui/<component-name>/`:

```
components/ui/<component-name>/
  <component-name>.tsx          # component implementation
  <component-name>.stories.tsx  # Storybook story
  <component-name>.test.tsx     # Vitest + React Testing Library test, for non-trivial logic
```

Storybook discovers stories under `components/**` (see `.storybook/main.ts`).
Vitest discovers tests under `components/**` as part of the `unit` project
(see `vitest.config.mts`).

## Naming

- Folder and file names: kebab-case (e.g. `dashboard-shell`).
- Exported component names: PascalCase (e.g. `DashboardShell`).
- One component (plus any closely related helper types) per file.

## Composition

- Build on top of Mantine (`@mantine/core`, `@mantine/hooks`) rather than
  hand-rolling equivalents.
- Use `lucide-react` for icons in dashboard/navigation UI -- it's the single
  icon library for this purpose; don't mix in Mantine/Tabler icons.
- Keep components in `components/ui/` presentational: pass data and
  callbacks in via props rather than reaching into route-specific data
  fetching or server actions. Feature- or route-specific composition (e.g. a
  page's form) belongs alongside the route in `app/` instead of here.
