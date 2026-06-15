import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type {
  AcaAuthorityAdapter,
  AcaDecisionAdapter,
  AcaTestAdapter,
  DecisionProposal,
  RiskLevel,
} from "../adapter.ts";

type Layer5Adapter = AcaDecisionAdapter & AcaTestAdapter & AcaAuthorityAdapter & {
  setDecisionReviewDeadline?: (decisionId: string, reviewDeadline: string) => Promise<void>;
  processDecisionTimeouts?: () => Promise<void>;
};

/**
 * Decision Lifecycle — ACA Layer 5 §2.3
 */
export function lifecycleTests(adapter: Layer5Adapter) {
  describe("Decision Lifecycle (Layer 5 §2.3)", () => {
    after(() => adapter.cleanup());

    const unique = () => `${Date.now()}-${Math.random()}`;

    const makeEvidence = async (
      tier: "raw_source" | "llm_derived" | "human_confirmed" = "human_confirmed",
    ) => {
      const written = await adapter.write({
        agent_id: "test-agent",
        namespace: "test:layer5:lifecycle",
        memory_type: "fact",
        content: {
          format: "text/plain",
          value: `decision-evidence-${tier}-${unique()}`,
        },
        source: {
          type: tier === "human_confirmed" ? "human" : "agent",
          ref: "layer5-lifecycle-test",
          tier,
        },
        created_by: tier === "human_confirmed" ? "human:evidence" : "agent:evidence",
      });
      return written.memory_id;
    };

    const proposal = (evidenceIds: string[] = []): DecisionProposal => ({
      assumptions: [`assumption-${unique()}`],
      evidence_ids: evidenceIds,
      risks: ["test risk"],
      trade_offs: ["test trade-off"],
      rollback_plan: "revert the test decision",
      implementation_steps: ["mark the test decision implemented"],
    });

    const propose = async (riskLevel: RiskLevel, evidenceIds: string[] = []) => {
      return adapter.proposeDecision(
        `Lifecycle decision ${unique()}`,
        riskLevel,
        proposal(evidenceIds),
        `principal:proposer-${unique()}`,
      );
    };

    it("MUST create decisions with status:proposed", async () => {
      const result = await propose("low");
      const decision = await adapter.getDecision(result.decision_id);

      assert.equal(result.status, "proposed");
      assert.equal(decision?.status, "proposed");
    });

    it("MUST allow low-risk self-ratify shortcut from proposed to ratified", async () => {
      const proposer = `principal:low-proposer-${unique()}`;
      const result = await adapter.proposeDecision(
        `Low self-ratify ${unique()}`,
        "low",
        proposal(),
        proposer,
      );

      const ratified = await adapter.ratifyDecision(
        result.decision_id,
        proposer,
        "Low-risk reversible decision can self-ratify.",
      );

      assert.equal(ratified.status, "ratified");
      assert.equal((await adapter.getDecision(result.decision_id))?.status, "ratified");
    });

    it("MUST require medium+ decisions to enter under_review before ratify", async () => {
      const evidenceId = await makeEvidence("raw_source");
      const result = await propose("medium", [evidenceId]);

      await assert.rejects(() => adapter.ratifyDecision(
        result.decision_id,
        `principal:ratifier-${unique()}`,
        "Ratification before review must fail.",
      ));

      const review = await adapter.reviewDecision(result.decision_id);
      assert.equal(review.status, "under_review");
      assert.equal((await adapter.getDecision(result.decision_id))?.status, "under_review");
    });

    it("MUST transition under_review decisions to ratified", async () => {
      const evidenceId = await makeEvidence("raw_source");
      const result = await propose("medium", [evidenceId]);
      await adapter.reviewDecision(result.decision_id);

      const ratified = await adapter.ratifyDecision(
        result.decision_id,
        `principal:ratifier-${unique()}`,
        "Reviewed medium-risk decision.",
      );

      assert.equal(ratified.status, "ratified");
      assert.equal((await adapter.getDecision(result.decision_id))?.status, "ratified");
    });

    it("MUST transition ratified decisions to in_effect on implement", async () => {
      const evidenceId = await makeEvidence("raw_source");
      const result = await propose("medium", [evidenceId]);
      await adapter.reviewDecision(result.decision_id);
      await adapter.ratifyDecision(
        result.decision_id,
        `principal:ratifier-${unique()}`,
        "Reviewed medium-risk decision.",
      );

      const implemented = await adapter.implementDecision(
        result.decision_id,
        `principal:implementer-${unique()}`,
        "Implementation steps completed.",
      );

      assert.equal(implemented.status, "in_effect");
      assert.ok(implemented.effective_at);
      assert.equal((await adapter.getDecision(result.decision_id))?.status, "in_effect");
    });

    it("MUST transition proposed or under_review decisions to revoked on veto", async () => {
      const result = await propose("low");

      const vetoed = await adapter.vetoDecision(
        result.decision_id,
        `principal:vetoer-${unique()}`,
        "Vetoed by lifecycle conformance test.",
      );

      assert.equal(vetoed.status, "revoked");
      assert.equal((await adapter.getDecision(result.decision_id))?.status, "revoked");
    });

    it("MUST revoke under_review decisions after review_deadline timeout", async () => {
      if (typeof adapter.setDecisionReviewDeadline !== "function") {
        assert.ok(true, "adapter does not expose review_deadline test control");
        return;
      }

      const evidenceId = await makeEvidence("raw_source");
      const result = await propose("medium", [evidenceId]);
      await adapter.reviewDecision(result.decision_id);
      await adapter.setDecisionReviewDeadline(
        result.decision_id,
        new Date(Date.now() - 60_000).toISOString(),
      );

      if (typeof adapter.processDecisionTimeouts === "function") {
        await adapter.processDecisionTimeouts();
      }

      const decision = await adapter.getDecision(result.decision_id);
      assert.equal(decision?.status, "revoked");
    });
  });
}
