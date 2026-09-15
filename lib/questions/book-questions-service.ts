import "server-only";

import { listModulesService } from "@/lib/modules/modules-service";
import { ok, type ServiceResult } from "@/lib/http/service-result";
import {
  getCachedBookQuestions,
  setCachedBookQuestions,
  type BookQuestionGroup,
} from "./book-questions-cache";
import { listQuestions } from "./questions-repository";

export type { BookQuestionGroup };

/**
 * Returns every Question under `bookId`, grouped by Module in
 * `Book.modules` order (see ANA-108). Served from the in-memory cache
 * unless `forceRefresh` is set, in which case every Module's Questions are
 * reloaded from Firestore and the cached value is replaced before
 * returning.
 */
export async function getBookQuestionsGroupedByModuleService(
  bookId: string,
  forceRefresh: boolean,
): Promise<ServiceResult<BookQuestionGroup[]>> {
  if (!forceRefresh) {
    const cached = getCachedBookQuestions(bookId);

    if (cached) {
      return ok(cached);
    }
  }

  const modules = await listModulesService(bookId);

  if (!modules.ok) {
    return modules;
  }

  const groups: BookQuestionGroup[] = await Promise.all(
    modules.value.map(async (module) => ({
      moduleId: module.id,
      questions: await listQuestions(bookId, module.id),
    })),
  );

  setCachedBookQuestions(bookId, groups);

  return ok(groups);
}
