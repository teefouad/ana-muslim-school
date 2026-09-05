<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project engineering rules (Ana Muslim Admin)

These rules are durable — they apply to every task in this repository, for every coding agent and every human contributor, regardless of chat history. Read this section before starting any work. If a task establishes or changes a durable convention, update this file (and `components/README.md` where relevant) in the same PR.

## Git workflow — required for every feature/task

1. Read this file (and `components/README.md`) before starting.
2. Start from an up-to-date `main`.
3. Create a dedicated feature/fix branch from `main` before changing any application code. **Never** implement feature work directly on `main`, and never work on whatever branch happens to already be checked out without first branching off `main` for the task at hand.
4. Work only within the scope of the assigned Linear issue. Do not perform unrelated refactors, cleanup, dependency changes, architecture changes, or feature additions unless strictly necessary for the assigned task, and say so explicitly if you do.
5. Before adding new UI, check `components/ui/` and existing Storybook stories first (see `components/README.md`). Reuse or extend an existing component instead of introducing an equivalent one.
6. Run the required validation: `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run test`, `npm run build`, `npm run build-storybook`.
7. Critically self-review the full diff before opening a PR — look for regressions, unnecessary complexity, duplicated code/components, scope creep, missing validation, weak error handling, and security-sensitive mistakes. Fix what you find, then re-run validation.
8. Commit the scoped changes, push the branch, and open a PR against `main` using the PR template: summary, validation performed, security/review notes, known limitations.
9. Let CI, the dependency audit, Semgrep, and Copilot code review run. Address relevant findings on the same branch and update the PR.
10. **Stop once the PR is ready for review.** Wait for manual review and merge by the project owner. Never merge your own PR, and never bypass required checks, unless explicitly instructed to.

## Scope discipline

Every task maps to a Linear issue. Do the work that issue describes — nothing broader. If you notice unrelated problems while working, mention them instead of fixing them inline, unless the fix is trivially required to complete the assigned task.

## One task, one PR

Never implement a task that has sub-issues as a single mega PR. If a Linear issue has sub-issues (children), each sub-issue is its own task: its own branch, its own PR, following the full git workflow above. Implement one sub-issue, open its PR, and stop there — wait for that PR's review/merge before branching for the next sub-issue. This holds even when the sub-issues are tightly related or part of the same epic/feature; do not combine them into one PR for convenience.

## CI/CD expectations

`main` is protected; changes land only through reviewed PRs. CI (`.github/workflows/ci.yml`) runs lint, typecheck, a formatting check, tests, a production build, and a Storybook build on every push/PR — required checks must pass before merge. Merging to `main` deploys production automatically on Vercel; PRs get preview deployments.

## Security & secrets

- Never commit real secrets, API keys, or service-account credentials. `.env*` files (other than `.env.example`) are gitignored — keep it that way.
- `.env.example` documents every required variable with placeholder values only.
- Client-exposed config must be prefixed `NEXT_PUBLIC_`; anything else (Firebase Admin credentials, etc.) is server-only and must never be imported into a client component.
- Dependabot, an `npm audit` dependency check, and Semgrep run on every PR (see `.github/workflows/`). Treat findings as blockers until resolved or explicitly accepted by the project owner.
- Significant or security-sensitive changes (auth, authorization, Firebase rules, uploads, permissions, secrets) may warrant an extra review pass beyond standard CI.

## Testing expectations

Non-trivial logic changes need a corresponding test (Vitest + React Testing Library, see `vitest.config.mts`). Tests run in CI via `npm run test` and are a required check.

## Component reuse & design system

Shared UI primitives live in `components/ui/`. Before introducing a new component, check whether an existing one already covers the need — reuse or extend it rather than duplicating. See `components/README.md` for naming, folder structure, and composition conventions.

## Inspect before introducing

Before adding a new dependency, abstraction, or architectural pattern, check whether the codebase already has something that solves the problem. Prefer extending existing structure over introducing a new one.
