import "server-only";

import type { Question } from "./types";

export type BookQuestionGroup = {
  moduleId: string;
  questions: Question[];
};

/**
 * In-memory cache of a Book's Questions grouped by Module (see ANA-108).
 * Deliberately process-local and unbounded -- no persistent/distributed
 * cache is in scope for this task. Every mutation helper below is a no-op
 * when `bookId` isn't cached, so question create/edit/delete flows never
 * need to initialize a cache entry just to stay correct.
 */
const cache = new Map<string, BookQuestionGroup[]>();

export function getCachedBookQuestions(
  bookId: string,
): BookQuestionGroup[] | undefined {
  return cache.get(bookId);
}

export function setCachedBookQuestions(
  bookId: string,
  groups: BookQuestionGroup[],
): void {
  cache.set(bookId, groups);
}

/** Adds `question` to `moduleId`'s cached group. No-op if `bookId` isn't cached. */
export function addQuestionToBookCache(
  bookId: string,
  moduleId: string,
  question: Question,
): void {
  const groups = cache.get(bookId);

  if (!groups) {
    return;
  }

  const group = groups.find((g) => g.moduleId === moduleId);

  if (group) {
    group.questions.push(question);
  } else {
    groups.push({ moduleId, questions: [question] });
  }
}

/**
 * Updates a cached Question in place. If it's currently cached under a
 * different Module than `moduleId`, it's moved into `moduleId`'s group
 * instead -- this is what keeps the cache correct if a Question is ever
 * edited into a different Module. No-op if `bookId` isn't cached.
 */
export function updateQuestionInBookCache(
  bookId: string,
  moduleId: string,
  question: Question,
): void {
  const groups = cache.get(bookId);

  if (!groups) {
    return;
  }

  let previousGroup: BookQuestionGroup | undefined;
  let previousIndex = -1;

  for (const group of groups) {
    const index = group.questions.findIndex((q) => q.id === question.id);

    if (index !== -1) {
      group.questions.splice(index, 1);
      previousGroup = group;
      previousIndex = index;
      break;
    }
  }

  const target = groups.find((g) => g.moduleId === moduleId);

  if (!target) {
    groups.push({ moduleId, questions: [question] });
  } else if (target === previousGroup) {
    // Same group: reinsert at its old position instead of appending, so an
    // in-place edit doesn't reorder the group's other Questions.
    target.questions.splice(previousIndex, 0, question);
  } else {
    target.questions.push(question);
  }
}

/** Removes `questionId` from `moduleId`'s cached group. No-op if `bookId` isn't cached. */
export function removeQuestionFromBookCache(
  bookId: string,
  moduleId: string,
  questionId: string,
): void {
  const group = cache.get(bookId)?.find((g) => g.moduleId === moduleId);

  if (!group) {
    return;
  }

  const index = group.questions.findIndex((q) => q.id === questionId);

  if (index !== -1) {
    group.questions.splice(index, 1);
  }
}
