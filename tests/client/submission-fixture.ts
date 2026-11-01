import type { Context } from "@deepseek-ai/cordis";
import type { SessionId } from "@deepseek-ai/dsh-session/types";
import type {
  ComposerSubmissionOverrides,
  InputSubmitMode,
} from "@deepseek-ai/dsh-client-ui-conversation/client";
import { vi } from "vitest";

/** Owned implementation of the public last-live-registration contract. */
export function submissionFixture(root: Context) {
  const leases: { id: SessionId; behavior: InputSubmitMode }[] = [];
  const submission: ComposerSubmissionOverrides = {
    register: vi.fn((id, behavior) => {
      const lease = { id, behavior };
      leases.push(lease);
      return () => {
        const index = leases.indexOf(lease);
        if (index >= 0) leases.splice(index, 1);
      };
    }),
  };
  root.provide("conversation", { submission } as any);
  return {
    submission,
    active: () => leases.length,
    behavior: (id: SessionId) =>
      leases.findLast((lease) => lease.id === id)?.behavior,
  };
}
