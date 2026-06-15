import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type {
  AcaAuthorityAdapter,
  AcaDecisionAdapter,
  AcaTestAdapter,
  DecisionProposal,
} from "../adapter.ts";

type Layer5Adapter = AcaDecisionAdapter & AcaTestAdapter & AcaAuthorityAdapter;

/**
 * Risk Classification — ACA Layer 5 §2.2
 */
export function riskClassificationTests(adapter: Layer5Adapter) {
  describe("Risk Classification (Layer 5 §2.2)", () => {
    after(() => adapter.cleanup());

    const unique = () => `${Date.now()}-${Math.random()}`;

    const makeEvidence = async (
      tier: "raw_source" | "llm_derived" | "human_confirmed" = "human_confirmed",
    ) => {
      const written = await adapter.write({
        agent_id: "test-agent",
        namespace: "test:layer5:risk",
        memory_type: "fact",
        content: {
          format: "text/plain",
          value: `risk-evidence-${tier}-${unique()}`,
        },
        source: {
          type: tier === "human_confirmed" ? "human" : "agent",
          ref: "layer5-risk-test",
          tier,
        },
        created_by: tier === "human_confirmed" ? "human:evidence" : "agent:evidence",
      });
      return written.memory_id;
    };

    const proposal = (evidenceIds: string[], risks = ["test risk"]): DecisionProposal => ({
      assumptions: [`assumption-${unique()}`],
      evidence_ids: evidenceIds,
      risks,
      trade_offs: ["test trade-off"],
      rollback_plan: "revert the decision",
      implementation_steps: ["execute the decision"],
    });

    it("MUST auto-upgrade risk but never downgrade proposer's classification", async () => {
      const evidenceId = await makeEvidence("human_confirmed");
      const high = await adapter.proposeDecision(
        `Never downgrade high ${unique()}`,
        "high",
        proposal([evidenceId], ["single-scope reversible test change"]),
        `principal:proposer-${unique()}`,
      );
      assert.equal(high.risk_level, "high");

      const critical = await adapter.proposeDecision(
        `Governance modification ${unique()}`,
        "low",
        proposal([evidenceId], ["governance_modification"]),
        `principal:proposer-${unique()}`,
      );
      assert.equal(critical.risk_level, "critical");
    });

    it("MUST require Independent Review before critical ratification", async () => {
      const evidenceId = await makeEvidence("human_confirmed");
      const result = await adapter.proposeDecision(
        `Critical review required ${unique()}`,
        "critical",
        proposal([evidenceId], ["production or governance-impacting change"]),
        `principal:proposer-${unique()}`,
      );

      await adapter.reviewDecision(result.decision_id);
      await assert.rejects(() => adapter.ratifyDecision(
        result.decision_id,
        `principal:ratifier-${unique()}`,
        "Critical ratification without Independent Review must fail.",
        "No independent review exists.",
      ));

      const review = await adapter.submitIndependentReview(
        result.decision_id,
        "approve",
        "The critical decision has human-confirmed evidence and a rollback plan.",
        ["evidence_quality", "rollback"],
        [evidenceId],
      );

      const ratified = await adapter.ratifyDecision(
        result.decision_id,
        `principal:ratifier-${unique()}`,
        "Critical decision ratified after Independent Review.",
        `Addressed review ${review.review_id}: evidence and rollback risk accepted.`,
      );
      assert.equal(ratified.status, "ratified");
    });

    it("MUST require at least one review before high ratification", async () => {
      const evidenceId = await makeEvidence("human_confirmed");
      const result = await adapter.proposeDecision(
        `High review required ${unique()}`,
        "high",
        proposal([evidenceId], ["difficult to reverse"]),
        `principal:proposer-${unique()}`,
      );

      await adapter.reviewDecision(result.decision_id);
      await assert.rejects(() => adapter.ratifyDecision(
        result.decision_id,
        `principal:ratifier-${unique()}`,
        "High ratification without review must fail.",
      ));

      await adapter.submitIndependentReview(
        result.decision_id,
        "approve",
        "The high-risk decision has adequate evidence for this test.",
        ["evidence_quality"],
        [evidenceId],
      );

      const ratified = await adapter.ratifyDecision(
        result.decision_id,
        `principal:ratifier-${unique()}`,
        "High decision ratified after review.",
      );
      assert.equal(ratified.status, "ratified");
    });
  });
}
