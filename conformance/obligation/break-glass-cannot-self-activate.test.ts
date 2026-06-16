import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaObligationAdapter, AcaTestAdapter, ObligationPacket, PolicyEvaluation } from "../adapter.ts";

type ObligationTestAdapter = AcaObligationAdapter & AcaTestAdapter;

/**
 * Break-Glass Cannot Self-Activate — RFC-001 §Break-Glass
 *
 * Break-glass MUST NOT be activated by the acting agent.
 * Only a designated break-glass authority (human or governance plane) may activate.
 */
export function breakGlassCannotSelfActivateTests(adapter: ObligationTestAdapter) {
  describe("Break-Glass Cannot Self-Activate (RFC-001 §Break-Glass)", () => {
    after(() => adapter.cleanup());

    const makePacket = (): ObligationPacket => ({
      obligation_id: `obl-break-glass-${Date.now()}`,
      promise: "emergency hotfix",
      owner: "agent:actor-1",
      fallback_owner: "agent:steward",
      status: "blocked",
      evidence: [],
      missing_evidence: ["evaluator-unavailable"],
      blocked_by: ["evaluator-offline"],
      stale_if: { type: "ttl", seconds: 3600 },
      allowed_next_actions: ["refresh_evidence", "query_owner", "escalate"],
      created_at: new Date().toISOString(),
      last_touched_at: new Date().toISOString(),
    });

    const makeStaleEvaluation = (): PolicyEvaluation => ({
      risk_tier: "high",
      operation_permissions: [],
      evaluator_id: "agent:evaluator-offline",
      evaluated_at: "2020-01-01T00:00:00Z",
      policy_version: "1.0.0",
      evaluator_scope: "test",
      evidence_refs: [],
    });

    it("MUST reject break-glass activated by the acting agent", async () => {
      const packet = makePacket();
      await adapter.createObligation(packet, makeStaleEvaluation());

      const writeResult = await adapter.writeToSurface(
        packet.obligation_id,
        "break_glass",
        "agent:actor-1",
      );
      assert.equal(writeResult.allowed, false, "Acting agent must not self-activate break-glass");
    });

    it("MUST allow break-glass activated by designated authority", async () => {
      const packet = makePacket();
      await adapter.createObligation(packet, makeStaleEvaluation());

      const writeResult = await adapter.writeToSurface(
        packet.obligation_id,
        "break_glass",
        "principal:human-authority",
      );
      assert.equal(writeResult.allowed, true, "Designated authority can activate break-glass");
    });
  });
}
