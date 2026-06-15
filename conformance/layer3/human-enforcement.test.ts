import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaTestAdapter, AcaIdentityAdapter, TrustProof } from "../adapter.ts";

/**
 * Human Principal Enforcement — ACA Layer 3 §4.2
 *
 * When Layer 3 is enabled, tier upgrade to human_confirmed
 * MUST verify confirmed_by is a human principal.
 */
export function humanEnforcementTests(
  memoryAdapter: AcaTestAdapter,
  identityAdapter: AcaIdentityAdapter,
) {
  describe("Human Principal Enforcement (Layer 3 §4.2)", () => {
    after(async () => {
      await memoryAdapter.cleanup();
      await identityAdapter.cleanup();
    });

    const makeCell = (value: string) => ({
      agent_id: "test-agent",
      namespace: "test:human-enforcement",
      memory_type: "fact" as const,
      content: {
        format: "text/plain",
        value: `${value}-${Date.now()}-${Math.random()}`,
      },
      source: {
        type: "agent" as const,
        ref: "test",
        tier: "raw_source" as const,
      },
      created_by: "test-principal",
    });

    it("MUST allow human principal to confirm human_confirmed tier", async () => {
      await identityAdapter.registerPrincipal("human:reviewer", "human");
      const w = await memoryAdapter.write(makeCell("human-ok"));

      const proof: TrustProof = {
        tier: "human_confirmed",
        confirmed_by: "human:reviewer",
        confirmed_at: new Date().toISOString(),
        evidence_ids: [],
        method: "human_review",
      };

      const result = await memoryAdapter.tierUpgrade(w.memory_id, "human_confirmed", proof);
      assert.equal(result.new_tier, "human_confirmed");
    });

    it("MUST reject agent principal confirming human_confirmed tier", async () => {
      await identityAdapter.registerPrincipal("agent:impersonator", "agent");
      const w = await memoryAdapter.write(makeCell("agent-reject"));

      const proof: TrustProof = {
        tier: "human_confirmed",
        confirmed_by: "agent:impersonator",
        confirmed_at: new Date().toISOString(),
        evidence_ids: [],
        method: "human_review",
      };

      await assert.rejects(
        () => memoryAdapter.tierUpgrade(w.memory_id, "human_confirmed", proof),
        (err: Error) => {
          assert.ok(
            err.message.includes("human") || err.message.includes("Human") || err.message.includes("principal"),
            `Expected human principal enforcement error, got: ${err.message}`,
          );
          return true;
        },
      );
    });

    it("MUST reject system principal confirming human_confirmed tier", async () => {
      await identityAdapter.registerPrincipal("system:cron", "system");
      const w = await memoryAdapter.write(makeCell("system-reject"));

      const proof: TrustProof = {
        tier: "human_confirmed",
        confirmed_by: "system:cron",
        confirmed_at: new Date().toISOString(),
        evidence_ids: [],
        method: "automated_check",
      };

      await assert.rejects(
        () => memoryAdapter.tierUpgrade(w.memory_id, "human_confirmed", proof),
      );
    });
  });
}
