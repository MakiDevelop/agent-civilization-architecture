import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaAuthorityAdapter, AcaIdentityAdapter } from "../adapter.ts";

type Layer4Adapter = AcaAuthorityAdapter & AcaIdentityAdapter & {
  recordDecisionProposer?: (decisionId: string, proposerPrincipalId: string) => Promise<void>;
};

/**
 * Independent Review — ACA Layer 4 §3.6 / §2.7
 */
export function independentReviewTests(adapter: Layer4Adapter) {
  describe("Independent Review (Layer 4 §3.6 / §2.7)", () => {
    after(() => adapter.cleanup());

    const unique = () => `${Date.now()}-${Math.random()}`;

    it("MUST submit review for a decision", async () => {
      const decisionId = `decision:review-${unique()}`;

      const review = await adapter.submitIndependentReview(
        decisionId,
        "approve",
        "The proposal addresses correctness risk with adequate evidence.",
        ["correctness"],
        [`memory:evidence-${unique()}`],
      );

      assert.ok(review.review_id);
      assert.equal(review.decision_id, decisionId);
      assert.equal(review.position, "approve");
      assert.ok(review.reviewer_principal_id);
      assert.ok(review.reviewer_role_id);
      assert.deepEqual(review.risk_categories_addressed, ["correctness"]);
    });

    it("MUST require non-empty reasoning", async () => {
      await assert.rejects(() => adapter.submitIndependentReview(
        `decision:empty-reasoning-${unique()}`,
        "oppose",
        "",
        ["security"],
        [],
      ));
    });

    it("MUST reject reviewer matching proposer when proposer tracking is supported", async () => {
      if (typeof adapter.recordDecisionProposer !== "function") {
        assert.ok(true, "adapter does not expose proposer tracking");
        return;
      }

      const decisionId = `decision:self-review-${unique()}`;
      const proposerId = `agent:review-proposer-${unique()}`;
      await adapter.registerPrincipal(proposerId, "agent");
      await adapter.recordDecisionProposer(decisionId, proposerId);

      await assert.rejects(() => adapter.submitIndependentReview(
        decisionId,
        "approve",
        "Self-review is not independent and must be rejected.",
        ["evidence_quality"],
        [],
      ));
    });
  });
}
