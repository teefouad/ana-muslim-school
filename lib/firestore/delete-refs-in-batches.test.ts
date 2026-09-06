import type { DocumentReference, Firestore } from "firebase-admin/firestore";
import { describe, expect, it, vi } from "vitest";

import { deleteRefsInBatches } from "./delete-refs-in-batches";

function fakeRef(id: string): DocumentReference {
  return { id } as DocumentReference;
}

function fakeFirestore() {
  const commits: unknown[][] = [];
  const batch = vi.fn(() => {
    const deletes: unknown[] = [];
    return {
      delete: (ref: unknown) => deletes.push(ref),
      commit: async () => {
        commits.push(deletes);
      },
    };
  });

  return { batch, commits };
}

describe("deleteRefsInBatches", () => {
  it("does nothing for an empty list of refs", async () => {
    const { batch, commits } = fakeFirestore();

    await deleteRefsInBatches({ batch } as never, []);

    expect(batch).not.toHaveBeenCalled();
    expect(commits).toEqual([]);
  });

  it("deletes every ref in a single batch when under the 500-write limit", async () => {
    const { batch, commits } = fakeFirestore();
    const refs = Array.from({ length: 3 }, (_, i) => fakeRef(`ref-${i}`));

    await deleteRefsInBatches({ batch } as unknown as Firestore, refs);

    expect(batch).toHaveBeenCalledTimes(1);
    expect(commits).toEqual([refs]);
  });

  it("splits more than 500 refs across multiple batches", async () => {
    const { batch, commits } = fakeFirestore();
    const refs = Array.from({ length: 501 }, (_, i) => fakeRef(`ref-${i}`));

    await deleteRefsInBatches({ batch } as unknown as Firestore, refs);

    expect(batch).toHaveBeenCalledTimes(2);
    expect(commits[0]).toHaveLength(500);
    expect(commits[1]).toHaveLength(1);
  });
});
