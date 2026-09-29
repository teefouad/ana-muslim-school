// The full set of named color tokens the Book "Color" field may suggest
// (ANA-63). Deliberately local and explicit -- this is not a generalized
// color-system abstraction, just the exact palette this one field is
// restricted to. Keys are the token strings a Book's `color` value may hold
// (e.g. "blue.6"); values are that token's canonical hex meaning, used only
// where the UI needs a concrete swatch -- the stored/submitted form value
// stays whatever token string the admin picked or typed, never the hex.
export const APPLICATION_COLORS = {
  black: "#000000",
  gray: "#868e96",
  dark: "#2e2e2e",
  night: "#334155",
  cream: "#e8d5b5",
  red: "#fa5252",
  green: "#40c057",
  blue: "#228be6",
  gold: "#fab005",
  yellow: "#fbc949",
  orange: "#fd9c20",
  pink: "#e64980",
  grape: "#be4bdb",
  violet: "#7950f2",
  indigo: "#4c6ef5",
  cyan: "#15aabf",
  teal: "#12b886",
  lime: "#82c91e",
} as const;

export type ApplicationColorToken = keyof typeof APPLICATION_COLORS;

/** The default `color` value for a new Book or Module (ANA-63/ANA-91) --
 * shared here so every field/form that needs an initial color agrees on the
 * same one instead of each defining its own. */
export const DEFAULT_APPLICATION_COLOR = "#1c7ed6";

// Autocomplete suggestions, in the exact order the mapping above declares
// them -- one entry per supported named token, nothing invented on top.
export const APPLICATION_COLOR_TOKENS = Object.keys(
  APPLICATION_COLORS,
) as ApplicationColorToken[];

// A Book's `color` is stored as whatever string the admin picked or typed
// (ANA-63) -- a named token from the mapping above, or a free-form value
// such as a raw hex string. Resolves a token to its concrete hex meaning
// wherever the UI needs an actual paintable color (e.g. a swatch preview);
// a free-form value that isn't a known token is returned unchanged, since
// it's presumably already a valid CSS color.
export function resolveApplicationColor(value: string): string {
  return value in APPLICATION_COLORS
    ? APPLICATION_COLORS[value as ApplicationColorToken]
    : value;
}
