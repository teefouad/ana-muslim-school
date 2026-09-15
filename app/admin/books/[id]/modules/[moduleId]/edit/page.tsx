"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import {
  Alert,
  Box,
  Divider,
  Flex,
  Group,
  Skeleton,
  Stack,
  Text,
  Title,
} from "@mantine/core";

import { fetchJson, HttpError } from "../../../../fetch-json";
import { createLesson, reorderLessons } from "../../../../lessons-client";
import { LessonsPanel } from "../../../../lessons-panel";
import styles from "./edit-module-page.module.css";
import { isValidReorder } from "@/lib/learning-content/validate-reorder";
import type { Lesson } from "@/lib/lessons/types";
import type { Module } from "@/lib/modules/types";

const LESSONS_SKELETON_ROW_COUNT = 4;

// Approximates LessonsPanel/ItemList's own card chrome -- header, a few
// rows, an Add footer (see lessons-panel.tsx/item-list.tsx) -- closely
// enough that swapping in the real panel doesn't shift the page's layout,
// matching ModulesPanelSkeleton's approach on Edit Book (ANA-104).
function LessonsPanelSkeleton() {
  return (
    <Box
      role="status"
      aria-label="Loading lessons"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        border: "1px solid var(--mantine-color-default-border)",
        borderRadius: 12,
      }}
    >
      <Box
        p="md"
        style={{
          borderBottom: "1px solid var(--mantine-color-default-border)",
        }}
        aria-hidden="true"
      >
        <Skeleton height={14} width={70} />
        <Skeleton height={11} width={90} mt={6} />
      </Box>
      <Stack gap="xs" p="md" style={{ flex: 1 }} aria-hidden="true">
        {Array.from({ length: LESSONS_SKELETON_ROW_COUNT }).map((_, index) => (
          <Skeleton key={index} height={40} radius={12} />
        ))}
      </Stack>
      <Box
        p="md"
        style={{
          borderTop: "1px solid var(--mantine-color-default-border)",
        }}
        aria-hidden="true"
      >
        <Skeleton height={36} radius={8} />
      </Box>
    </Box>
  );
}

// Edit Module (ANA-111): the first UI slice of Lesson management. Loads the
// Module through `GET /api/v1/books/{bookId}/modules/{moduleId}` (so a
// missing/foreign Module renders a real not-found state) and its Lessons
// through `GET .../lessons`, in `Module.lessons` order. Lesson selection/
// editing, deletion, and Question actions are all out of scope here -- the
// right-hand column is a fixed placeholder until ANA-110 adds the Lesson
// editor. Reorder and Add each persist immediately through the existing
// Lesson/Module APIs (unlike Edit Book's Modules panel, which defers reorder
// to its own Save changes) since this page has no larger form/save action
// yet to bundle either into.
export default function EditModulePage() {
  const { id: bookId, moduleId } = useParams<{
    id: string;
    moduleId: string;
  }>();

  const {
    data: moduleData,
    error: moduleError,
    isLoading: moduleLoading,
  } = useSWR(
    `/api/v1/books/${bookId}/modules/${moduleId}`,
    (url) => fetchJson<{ data: Module }>(url).then((response) => response.data),
    { shouldRetryOnError: false },
  );
  // Conditional on `moduleData` (a moduleId-less key tells SWR to skip the
  // fetch), matching Edit Book's own Modules fetch -- there's no point
  // requesting a Module's Lessons before its owning Module is confirmed to
  // exist.
  const {
    data: lessonsData,
    isLoading: lessonsLoading,
    mutate: mutateLessons,
  } = useSWR(
    moduleData ? `/api/v1/books/${bookId}/modules/${moduleId}/lessons` : null,
    (url) =>
      fetchJson<{ data: Lesson[] }>(url).then((response) => response.data),
  );
  const lessons = lessonsData ?? [];

  const [actionError, setActionError] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const notFound =
    moduleError instanceof HttpError && moduleError.status === 404;

  // Persists a drag reorder immediately (ANA-111) -- optimistically applies
  // it to the Lessons SWR cache (without revalidating) so the row settles
  // into place instantly instead of snapping back until the request
  // resolves, then reconciles with the server response. A failure rolls the
  // cache back to the pre-drag order and surfaces the error rather than
  // leaving a reorder displayed that was never actually persisted.
  async function handleReorderLessons(reordered: Lesson[]) {
    if (
      !isValidReorder(
        reordered.map((lesson) => lesson.id),
        lessons.map((lesson) => lesson.id),
      )
    ) {
      return;
    }

    const previousLessons = lessonsData;
    setActionError(null);
    setIsReordering(true);
    await mutateLessons(reordered, { revalidate: false });

    try {
      await reorderLessons(
        bookId,
        moduleId,
        reordered.map((lesson) => lesson.id),
      );
      await mutateLessons();
    } catch (err) {
      await mutateLessons(previousLessons, { revalidate: false });
      setActionError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setIsReordering(false);
    }
  }

  // Creates a new Lesson through the backend using the existing/default
  // Lesson fields (ANA-111) -- there's no form to collect fields from yet
  // (ANA-110), so Add Lesson never inserts a client-generated row itself; it
  // only appears once `createLesson` actually succeeds and the Lessons SWR
  // data is revalidated.
  async function handleAddLesson() {
    setActionError(null);
    setIsAdding(true);

    try {
      await createLesson(bookId, moduleId);
      await mutateLessons();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <Stack gap="xl" p="xl">
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Title order={2}>Edit Module</Title>
      </Group>
      <Divider opacity={0.25} mx={-27} />

      {moduleLoading && (
        <Flex
          gap="xl"
          direction={{ base: "column", md: "row" }}
          align="stretch"
        >
          <Box w={{ base: "100%", md: 320 }} style={{ flexShrink: 0 }}>
            <LessonsPanelSkeleton />
          </Box>
          <Box style={{ flex: 1, minWidth: 0 }} />
        </Flex>
      )}

      {moduleError && !notFound && (
        <Alert color="red">{moduleError.message}</Alert>
      )}

      {notFound && (
        <Text c="dimmed" size="sm">
          This module could not be found.
        </Text>
      )}

      {moduleData && (
        <Flex
          gap="xl"
          direction={{ base: "column", md: "row" }}
          align="stretch"
        >
          <Box w={{ base: "100%", md: 320 }} style={{ flexShrink: 0 }}>
            {lessonsLoading ? (
              <LessonsPanelSkeleton />
            ) : (
              <LessonsPanel
                lessons={lessons}
                onReorderLessons={handleReorderLessons}
                reorderDisabled={isReordering}
                onAddLesson={handleAddLesson}
                addDisabled={isAdding}
                error={actionError}
              />
            )}
          </Box>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Box className={styles.placeholder}>
              <Text c="dimmed">Select a lesson to edit.</Text>
            </Box>
          </Box>
        </Flex>
      )}
    </Stack>
  );
}
