import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaObligationAdapter, AcaTestAdapter, ObligationPacket, PolicyEvaluation } from "../adapter.ts";

type ObligationTestAdapter = AcaObligationAdapter & AcaTestAdapter;

/**
 * Missing Evidence Cannot Close — RFC-001 Test 1 variant
 *
 * An obligation with non-empty missing_evidence MUST NOT be closed.
 * Missing evidence is a safety-critical signal that cannot be erased.
 */
export function missingEvidenceCannotCloseTests(adapter: ObligationTestAdapter) {
  describe("Missing Evidence Cannot Close (RFC-001 §Constraint)", () => {
    after(() => adapter.cleanup());

    const makePacket = (overrides?: Partial<ObligationPacket>): ObligationPacket => ({
      obligation_id: `obl-missing-ev-${Date.now()}`,
      promise: "migrate database schema",
      owner: "agent:worker-1",
      fallback_owner: "agent:steward",
      status: "in_progress",
      evidence: [{ ref: "unit-tests", result: "pass" }],
      missing_evidence: ["integration-test-not-run", "rollback-not-verified"],
      blocked_by: [],
      stale_if: { type: "ttl", seconds: 3600 },
      allowed_next_actions: ["refresh_evidence", "query_owner", "escalate"],
      created_at: new Date().toISOString(),
      last_touched_at: new Date().toISOString(),
      ...overrides,
    });

    const makeEvaluation = (): PolicyEvaluation => ({
      risk_tier: "high",
      operation_permissions: ["read"],
      evaluator_id: "agent:evaluator-1",
      evaluated_at: new Date().toISOString(),
      policy_version: "1.0.0",
      evaluator_scope: "test",
      evidence_refs: ["evidence-1"],
    });

    it("MUST reject close when missing_evidence is non-empty", async () => {
      const packet = makePacket();
      await adapter.createObligation(packet, makeEvaluation());

      await assert.rejects(
        () => adapter.closeObligation(
          packet.obligation_id,
          "principal:human-1",
          "human_confirmed",
          ["unit-tests"],
        ),
        "Cannot close obligation with missing evidence",
      );

      const read = await adapter.readObligation(packet.obligation_id);
      assert.ok(read, "Obligation must still exist");
      assert.notEqual(read.status, "closed", "Status must not be closed");
      assert.ok(read.missing_evidence.length > 0, "missing_evidence must be preserved");
    });

    it("MUST NOT allow llm_derived actor to erase missing_evidence", async () => {
      const packet = makePacket();
      await adapter.createObligation(packet, makeEvaluation());

      const writeResult = await adapter.writeToSurface(
        packet.obligation_id,
        "missing_evidence",
        "agent:worker-1",
      );
      assert.equal(writeResult.allowed, false, "llm_derived actor must not erase missing evidence");
    });

    it("CAN close when missing_evidence is resolved to empty", async () => {
      const packet = makePacket({ missing_evidence: [] });
      await adapter.createObligation(packet, makeEvaluation());

      const result = await adapter.closeObligation(
        packet.obligation_id,
        "principal:human-1",
        "human_confirmed",
        ["unit-tests", "integration-tests"],
      );
      assert.equal(result.status, "closed", "Obligation with no missing evidence can be closed");
    });
  });
}
