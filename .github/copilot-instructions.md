# Review focus for this repository

This project also has durable engineering rules in `AGENTS.md` at the repo
root — read that file for the full git workflow, scope, and validation
requirements. When reviewing a pull request, prioritize:

- **Bugs and regressions** in the changed logic, including edge cases the
  diff doesn't handle.
- **Authentication/authorization mistakes** — especially any check that can
  be bypassed client-side, or that trusts client-supplied identity instead
  of a verified server-side value.
- **Unsafe client/server boundaries** — server-only code, credentials, or
  environment variables (anything not prefixed `NEXT_PUBLIC_`) leaking into
  a client component or the client bundle.
- **Exposed secrets** — API keys, service-account credentials, tokens, or
  other production secrets committed to the repo.
- **Weak input validation** at trust boundaries (user input, external APIs,
  file uploads).
- **Dependency/security issues** introduced by new or updated packages.
- **Duplicated or unnecessary abstractions** — new code that reimplements an
  existing utility/component in `components/ui/` or elsewhere.
- **Missing tests** for non-trivial logic changes.
- **Scope creep** — changes unrelated to the PR's stated Linear issue, such
  as opportunistic refactors, redesigns, or new dependencies that aren't
  required by the task.
- **Over-engineering** — premature abstractions or generalization for
  requirements the task doesn't actually have.

This automated review is advisory. It does not replace CI (lint, typecheck,
test, build) or manual review by the project owner.
