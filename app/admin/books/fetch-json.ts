/**
 * Thrown by `fetchJson` for a non-OK response, carrying the HTTP status so
 * callers can distinguish a `404` (real not-found) from any other failure
 * without re-parsing the response.
 */
export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * The shared GET fetcher for `useSWR` reads of `/api/v1/books` (ANA-65).
 * Client-side data fetching in this Next.js version flags a plain
 * `useEffect` + `fetch` + `setState` as a synchronous-setState-in-effect
 * lint violation (`react-hooks/set-state-in-effect`) -- see
 * node_modules/next/dist/docs/01-app/02-guides/client-side-data-fetching,
 * which recommends a data-fetching library such as SWR for a Client
 * Component that needs an inline loading/error state.
 */
export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new HttpError(
      response.status,
      data?.error ?? "Something went wrong. Please try again.",
    );
  }

  return response.json();
}
