import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaObligationAdapter, AcaTestAdapter, ObligationPacket, PolicyEvaluation } from "../adapter.ts";

type ObligationTestAdapter = AcaObligationAdapter & AcaTestAdapter;

/**
 * Stale Packet Read-Only — RFC-001 (from reviewer feedback)
 *
 * A stale obligation packet CAN be read as history
 * but CANNOT authorize any action.
 */
export function staleReadOnlyTests(adapter: ObligationTestAdapter) {
  describe("Stale Packet Read-Only (RFC-001 §Stale-Permission)", () => {
    after(() => adapter.cleanup());

    const makePacket = (): ObligationPacket => ({
      obligation_id: `obl-stale-ro-${Date.now()}`,
      promise: "quarterly review",
      owner: "agent:analyst-1",
      fallback_owner: "agent:steward",
      status: "in_progress",
      evidence: [{ ref: "q2-data", result: "collected" }, { ref: "q1-baseline", result: "verified" }],
      missing_evidence: [],
      blocked_by: [],
      stale_if: { type: "ttl", seconds: 0 },
      allowed_next_actions: ["read", "summarize", "propose_low_risk"],
      created_at: "2026-06-01T00:00:00Z",
      last_touched_at: "2026-06-01T00:00:00Z",
    });

    const makeEvaluation = (): PolicyEvaluation => ({
      risk_tier: "medium",
      operation_permissions: ["read", "summarize"],
      evaluator_id: "agent:evaluator-1",
      evaluated_at: new Date().toISOString(),
      policy_version: "1.0.0",
      evaluator_scope: "test",
      evidence_refs: ["evidence-1"],
    });

    it("CAN read stale packet content and evidence", async () => {
      const packet = makePacket();
      await adapter.createObligation(packet, makeEvaluation());
      await adapter.evaluateStale(packet.obligation_id, "agent:evaluator-1");

      const read = await adapter.readObligation(packet.obligation_id);
      assert.ok(read, "Stale packet must be readable");
      assert.equal(read.status, "stale");
      assert.equal(read.promise, "quarterly review", "Promise content preserved");
      assert.equal(read.evidence.length, 2, "Evidence preserved for historical reference");
    });

    it("MUST NOT authorize write actions on stale packet", async () => {
      const packet = makePacket();
      await adapter.createObligation(packet, makeEvaluation());
      await adapter.evaluateStale(packet.obligation_id, "agent:evaluator-1");

      const write1 = await adapter.writeToSurface(packet.obligation_id, "file:report.md", "agent:analyst-1");
      assert.equal(write1.allowed, false, "Stale packet cannot authorize file writes");

      const write2 = await adapter.writeToSurface(packet.obligation_id, "api:submit-report", "agent:analyst-1");
      assert.equal(write2.allowed, false, "Stale packet cannot authorize API calls");
    });

    it("MUST NOT allow close on stale packet", async () => {
      const packet = makePacket();
      await adapter.createObligation(packet, makeEvaluation());
      await adapter.evaluateStale(packet.obligation_id, "agent:evaluator-1");

      await assert.rejects(
        () => adapter.closeObligation(packet.obligation_id, "agent:analyst-1", "llm_derived", []),
        "Stale packet cannot be closed",
      );
    });

    it("CAN transition from stale back to in_progress after evidence refresh", async () => {
      const packet = makePacket();
      await adapter.createObligation(packet, makeEvaluation());
      await adapter.evaluateStale(packet.obligation_id, "agent:evaluator-1");

      const stale = await adapter.readObligation(packet.obligation_id);
      assert.equal(stale!.status, "stale");

      await adapter.updateStatus(packet.obligation_id, "in_progress", "agent:evaluator-1");
      const refreshed = await adapter.readObligation(packet.obligation_id);
      assert.equal(refreshed!.status, "in_progress", "Stale can be refreshed back to in_progress");
    });
  });
}
