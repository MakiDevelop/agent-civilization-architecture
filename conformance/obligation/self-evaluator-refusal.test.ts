import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaObligationAdapter, AcaTestAdapter, ObligationPacket, PolicyEvaluation } from "../adapter.ts";

type ObligationTestAdapter = AcaObligationAdapter & AcaTestAdapter;

/**
 * Self-Evaluator Refusal — RFC-001 Test 5
 *
 * If evaluator_id == acting agent, or evaluator is missing/stale,
 * no permission-bearing action is valid.
 */
export function selfEvaluatorRefusalTests(adapter: ObligationTestAdapter) {
  describe("Self-Evaluator Refusal (RFC-001 §Test 5)", () => {
    after(() => adapter.cleanup());

    const makePacket = (): ObligationPacket => ({
      obligation_id: `obl-self-eval-${Date.now()}`,
      promise: "deploy service Y",
      owner: "agent:actor-1",
      fallback_owner: "agent:steward",
      status: "in_progress",
      evidence: [{ ref: "build-pass", result: "ok" }],
      missing_evidence: [],
      blocked_by: [],
      stale_if: { type: "ttl", seconds: 3600 },
      allowed_next_actions: ["read", "summarize", "propose_low_risk"],
      created_at: new Date().toISOString(),
      last_touched_at: new Date().toISOString(),
    });

    it("MUST reject when evaluator_id == acting agent", async () => {
      const packet = makePacket();
      const selfEvaluation: PolicyEvaluation = {
        risk_tier: "low",
        operation_permissions: ["read", "summarize", "propose_low_risk"],
        evaluator_id: "agent:actor-1",
        evaluated_at: new Date().toISOString(),
        policy_version: "1.0.0",
        evaluator_scope: "test",
        evidence_refs: ["evidence-1"],
      };

      await adapter.createObligation(packet, selfEvaluation);

      const writeResult = await adapter.writeToSurface(
        packet.obligation_id,
        "file:service-y.ts",
        "agent:actor-1",
      );
      assert.equal(writeResult.allowed, false, "Self-evaluated agent must not perform permission-bearing actions");
    });

    it("MUST reject when evaluator_id is missing", async () => {
      const packet = makePacket();
      const noEvaluator: PolicyEvaluation = {
        risk_tier: "low",
        operation_permissions: ["read", "summarize"],
        evaluator_id: "",
        evaluated_at: new Date().toISOString(),
        policy_version: "1.0.0",
        evaluator_scope: "test",
        evidence_refs: [],
      };

      await adapter.createObligation(packet, noEvaluator);

      const writeResult = await adapter.writeToSurface(
        packet.obligation_id,
        "file:service-y.ts",
        "agent:actor-1",
      );
      assert.equal(writeResult.allowed, false, "Missing evaluator must block permission-bearing actions");
    });

    it("MUST reject when evaluation is stale (TTL expired)", async () => {
      const packet = makePacket();
      const staleEvaluation: PolicyEvaluation = {
        risk_tier: "low",
        operation_permissions: ["read", "summarize", "propose_low_risk"],
        evaluator_id: "agent:evaluator-1",
        evaluated_at: "2020-01-01T00:00:00Z",
        policy_version: "1.0.0",
        evaluator_scope: "test",
        evidence_refs: ["evidence-1"],
      };

      await adapter.createObligation(packet, staleEvaluation);

      const writeResult = await adapter.writeToSurface(
        packet.obligation_id,
        "file:service-y.ts",
        "agent:actor-1",
      );
      assert.equal(writeResult.allowed, false, "Stale evaluation must block permission-bearing actions");
    });

    it("MUST NOT allow close even with human_confirmed tier if self-evaluated", async () => {
      const packet = makePacket();
      const selfEvaluation: PolicyEvaluation = {
        risk_tier: "low",
        operation_permissions: ["read"],
        evaluator_id: "agent:actor-1",
        evaluated_at: new Date().toISOString(),
        policy_version: "1.0.0",
        evaluator_scope: "test",
        evidence_refs: [],
      };

      await adapter.createObligation(packet, selfEvaluation);

      await assert.rejects(
        () => adapter.closeObligation(packet.obligation_id, "agent:actor-1", "human_confirmed", ["evidence-1"]),
        "Self-evaluated obligation cannot be closed even with human_confirmed tier",
      );
    });
  });
}
