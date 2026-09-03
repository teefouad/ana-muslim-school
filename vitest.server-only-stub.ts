// Test-only stand-in for the `server-only` package.
//
// `server-only` unconditionally throws; in a real build, Next.js's webpack
// config swaps it for a no-op on the server compilation and leaves it
// throwing for the client bundle. Vitest doesn't apply that swap, so this
// alias (see vitest.config.mts) mirrors the server-side behavior for tests
// that import server-only modules.
export {};
