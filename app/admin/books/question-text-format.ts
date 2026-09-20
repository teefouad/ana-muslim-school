// The structured plain-text format one language's Question textarea edits
// (ANA-119, matching the old admin's authoring format exactly) -- e.g.:
//
//   What is ...?
//
//   Explanation of the answer.
//
//   [ ] First choice
//   [x] Correct choice
//   [ ] Third choice
//
// One editable representation per language, parsed live into the
// structured shape the current Question model (lib/questions/types.ts)
// persists -- text/explanation/choices -- without ever introducing a
// `rawText` field into that persisted document; raw text stays editor-only
// state (see question-fields.ts).
interface ParsedQuestionChoice {
  text: string;
  isCorrect: boolean;
}

export interface ParsedQuestionText {
  text: string;
  explanation: string;
  choices: ParsedQuestionChoice[];
}

export type QuestionTextParseResult =
  { ok: true; value: ParsedQuestionText } | { ok: false; error: string };

// A choice line's exact marker: "[ ] " (incorrect) or "[x] " (correct,
// lowercase x only), followed by exactly one space before the choice text
// -- the choice text itself (`\S.*` / empty) may never start with a space,
// or a second space would have silently slipped past the "exactly one
// space" rule.
const CHOICE_LINE = /^\[( |x)\] (\S.*|)$/;

// Any line that *looks like* an attempt at a choice marker -- "[ ]", "[x]",
// or "[X]" as the line's first three characters -- whether or not the rest
// of the line actually satisfies CHOICE_LINE. Used to reject malformed
// choices (missing space, uppercase X, extra space) as parse errors even
// before the first well-formed choice has been seen, rather than letting
// them silently fall through into the Explanation just because the choices
// region hasn't "started" yet.
const CHOICE_MARKER_ATTEMPT = /^\[[ xX]\]/;

// Parses one language's raw textarea value into the structured Question
// shape it represents, or reports why it can't -- called on every change
// (see question-text-editor.tsx) so the admin gets immediate feedback
// without ever having their raw input silently discarded or normalized.
//
// An empty/whitespace-only input parses as a valid, entirely blank
// question rather than an error; only *malformed* non-empty input is ever
// rejected.
export function parseQuestionText(raw: string): QuestionTextParseResult {
  // Normalizes CRLF line endings without otherwise touching whitespace --
  // every other trim happens per-segment below, never on the raw string as
  // a whole, so the admin's exact input is never silently rewritten.
  const lines = raw.split("\n").map((line) => line.replace(/\r$/, ""));

  const questionIndex = lines.findIndex((line) => line.trim() !== "");
  if (questionIndex === -1) {
    return { ok: true, value: { text: "", explanation: "", choices: [] } };
  }

  const text = lines[questionIndex].trim();

  // The Explanation is everything between the Question and the first
  // choice-marker line, regardless of how many blank (or non-marker-like)
  // lines that spans -- blank lines here are purely cosmetic spacing,
  // never significant to parsing. A line that merely *attempts* a marker
  // but doesn't match it exactly (missing space, uppercase X, extra space)
  // is a parse error here too, not silently absorbed as more explanation
  // text -- only lines with no marker-like prefix at all continue to read
  // as explanation.
  let firstChoiceIndex = -1;
  for (let i = questionIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (CHOICE_LINE.test(line)) {
      firstChoiceIndex = i;
      break;
    }
    if (CHOICE_MARKER_ATTEMPT.test(line)) {
      return {
        ok: false,
        error: `Line ${i + 1}: choices must start with "[ ] " or "[x] ".`,
      };
    }
  }

  const explanationLines =
    firstChoiceIndex === -1
      ? lines.slice(questionIndex + 1)
      : lines.slice(questionIndex + 1, firstChoiceIndex);
  const explanation = explanationLines.join("\n").trim();

  if (firstChoiceIndex === -1) {
    return { ok: true, value: { text, explanation, choices: [] } };
  }

  // Once the first choice marker is seen, every remaining non-blank line
  // must itself be a choice -- anything else (a missing marker, a typo, an
  // uppercase "[X]") is a parse error rather than silently absorbed as
  // more explanation text, since there's no longer an unambiguous "still
  // explanation" interpretation once choices have started.
  const choices: ParsedQuestionChoice[] = [];
  for (let i = firstChoiceIndex; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;

    const match = CHOICE_LINE.exec(line);
    if (!match) {
      return {
        ok: false,
        error: `Line ${i + 1}: choices must start with "[ ] " or "[x] ".`,
      };
    }

    choices.push({ text: match[2].trim(), isCorrect: match[1] === "x" });
  }

  return { ok: true, value: { text, explanation, choices } };
}

// The inverse of parseQuestionText -- builds the canonical textarea
// representation of a structured Question for one language. Omits the
// Explanation/Choices blocks entirely when empty, rather than emitting
// blank placeholder lines, so a round-trip through parse -> serialize ->
// parse is stable.
export function serializeQuestionText({
  text,
  explanation,
  choices,
}: ParsedQuestionText): string {
  const blocks = [text.trim()];

  if (explanation.trim()) {
    blocks.push(explanation.trim());
  }

  if (choices.length > 0) {
    blocks.push(
      choices
        .map((choice) => `${choice.isCorrect ? "[x]" : "[ ]"} ${choice.text}`)
        .join("\n"),
    );
  }

  return blocks.join("\n\n");
}
