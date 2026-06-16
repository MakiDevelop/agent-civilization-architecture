import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaObligationAdapter, AcaTestAdapter, ObligationPacket, PolicyEvaluation } from "../adapter.ts";

type ObligationTestAdapter = AcaObligationAdapter & AcaTestAdapter;

/**
 * Stale-Permission Invalidation — RFC-001 Test 3
 *
 * A stale packet MUST NOT authorize permission-bearing actions.
 * It CAN be read as history.
 */
export function stalePermissionTests(adapter: ObligationTestAdapter) {
  describe("Stale-Permission Invalidation (RFC-001 §Test 3)", () => {
    after(() => adapter.cleanup());

    const makePacket = (overrides?: Partial<ObligationPacket>): ObligationPacket => ({
      obligation_id: `obl-stale-perm-${Date.now()}`,
      promise: "deliver feature X",
      owner: "agent:worker-1",
      fallback_owner: "agent:steward",
      status: "in_progress",
      evidence: [{ ref: "test-run-1", result: "pass" }],
      missing_evidence: [],
      blocked_by: [],
      stale_if: { type: "ttl", seconds: 0 },
      allowed_next_actions: ["read", "summarize", "propose_low_risk", "route_attention"],
      created_at: "2026-06-15T00:00:00Z",
      last_touched_at: "2026-06-15T00:00:00Z",
      ...overrides,
    });

    const makeEvaluation = (): PolicyEvaluation => ({
      risk_tier: "low",
      operation_permissions: ["read", "summarize", "propose_low_risk"],
      evaluator_id: "agent:evaluator-1",
      evaluated_at: new Date().toISOString(),
      policy_version: "1.0.0",
      evaluator_scope: "test",
      evidence_refs: ["evidence-1"],
    });

    it("MUST block permission-bearing actions on stale packet", async () => {
      const packet = makePacket({ stale_if: { type: "ttl", seconds: 0 } });
      await adapter.createObligation(packet, makeEvaluation());

      const writeResult = await adapter.writeToSurface(
        packet.obligation_id,
        "file:feature-x.ts",
        "agent:worker-1",
      );
      assert.equal(writeResult.allowed, false, "Stale packet must not authorize writes");
    });

    it("MUST restrict allowed_next_actions to refresh/query/escalate when stale", async () => {
      const packet = makePacket({ stale_if: { type: "ttl", seconds: 0 } });
      await adapter.createObligation(packet, makeEvaluation());

      await adapter.evaluateStale(packet.obligation_id, "agent:evaluator-1");
      const updated = await adapter.readObligation(packet.obligation_id);
      assert.ok(updated, "Obligation must be readable");
      assert.equal(updated.status, "stale", "Status must be stale");

      const validStaleActions = ["refresh_evidence", "query_owner", "escalate"];
      for (const action of updated.allowed_next_actions) {
        assert.ok(
          validStaleActions.includes(action),
          `Stale packet allowed_next_actions must only contain refresh/query/escalate, found: ${action}`,
        );
      }
    });

    it("CAN be read as history when stale", async () => {
      const packet = makePacket({ stale_if: { type: "ttl", seconds: 0 } });
      await adapter.createObligation(packet, makeEvaluation());
      await adapter.evaluateStale(packet.obligation_id, "agent:evaluator-1");

      const read = await adapter.readObligation(packet.obligation_id);
      assert.ok(read, "Stale obligation must still be readable as history");
      assert.equal(read.promise, "deliver feature X", "Content must be preserved");
    });

    it("MUST block close on stale packet with missing evidence", async () => {
      const packet = makePacket({
        stale_if: { type: "ttl", seconds: 0 },
        missing_evidence: ["integration-test-not-run"],
      });
      await adapter.createObligation(packet, makeEvaluation());

      await assert.rejects(
        () => adapter.closeObligation(
          packet.obligation_id,
          "principal:human-1",
          "human_confirmed",
          [],
        ),
        "Cannot close stale obligation with missing evidence",
      );
    });
  });
}
