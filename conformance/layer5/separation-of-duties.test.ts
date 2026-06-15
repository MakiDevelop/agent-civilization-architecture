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
 * Separation of Duties — ACA Layer 5 §2.4
 */
export function separationOfDutiesTests(adapter: Layer5Adapter) {
  describe("Separation of Duties (Layer 5 §2.4)", () => {
    after(() => adapter.cleanup());

    const unique = () => `${Date.now()}-${Math.random()}`;

    const makeEvidence = async () => {
      const written = await adapter.write({
        agent_id: "test-agent",
        namespace: "test:layer5:sod",
        memory_type: "fact",
        content: {
          format: "text/plain",
          value: `sod-evidence-${unique()}`,
        },
        source: {
          type: "human",
          ref: "layer5-sod-test",
          tier: "human_confirmed",
        },
        created_by: "human:evidence",
      });
      return written.memory_id;
    };

    const proposal = (evidenceIds: string[]): DecisionProposal => ({
      assumptions: [`assumption-${unique()}`],
      evidence_ids: evidenceIds,
      risks: ["test risk"],
      trade_offs: ["test trade-off"],
      rollback_plan: "revert the test decision",
      implementation_steps: ["execute the test decision"],
    });

    it("MUST reject self-ratification for medium+ decisions", async () => {
      const evidenceId = await makeEvidence();
      const proposer = `principal:medium-proposer-${unique()}`;
      const result = await adapter.proposeDecision(
        `Medium self-ratify rejection ${unique()}`,
        "medium",
        proposal([evidenceId]),
        proposer,
      );
      await adapter.reviewDecision(result.decision_id);

      await assert.rejects(() => adapter.ratifyDecision(
        result.decision_id,
        proposer,
        "Medium-risk self-ratification must fail.",
      ));
    });

    it("MUST reject reviewer-as-ratifier for high+ decisions", async () => {
      const evidenceId = await makeEvidence();
      const result = await adapter.proposeDecision(
        `High reviewer ratifier rejection ${unique()}`,
        "high",
        proposal([evidenceId]),
        `principal:proposer-${unique()}`,
      );
      await adapter.reviewDecision(result.decision_id);
      const review = await adapter.submitIndependentReview(
        result.decision_id,
        "approve",
        "The high-risk proposal has adequate evidence.",
        ["evidence_quality"],
        [evidenceId],
      );

      await assert.rejects(() => adapter.ratifyDecision(
        result.decision_id,
        review.reviewer_principal_id,
        "A reviewer must not be the ratifier for high-risk decisions.",
      ));
    });
  });
}
