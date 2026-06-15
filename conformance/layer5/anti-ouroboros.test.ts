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
 * Anti-Ouroboros Gate — ACA Layer 5 §4.3
 */
export function antiOuroborosTests(adapter: Layer5Adapter) {
  describe("Anti-Ouroboros Gate (Layer 5 §4.3)", () => {
    after(() => adapter.cleanup());

    const unique = () => `${Date.now()}-${Math.random()}`;

    const makeEvidence = async (
      tier: "raw_source" | "llm_derived" | "human_confirmed",
      createdBy: string,
    ) => {
      const written = await adapter.write({
        agent_id: createdBy,
        namespace: "test:layer5:ouroboros",
        memory_type: "fact",
        content: {
          format: "text/plain",
          value: `ouroboros-evidence-${tier}-${createdBy}-${unique()}`,
        },
        source: {
          type: tier === "human_confirmed" ? "human" : "agent",
          ref: "layer5-ouroboros-test",
          tier,
        },
        created_by: createdBy,
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

    it("MUST block critical ratification when all evidence is llm_derived", async () => {
      const evidenceId = await makeEvidence("llm_derived", `agent:evidence-${unique()}`);
      const result = await adapter.proposeDecision(
        `Critical llm-only anti-ouroboros ${unique()}`,
        "critical",
        proposal([evidenceId]),
        `principal:proposer-${unique()}`,
      );

      await adapter.reviewDecision(result.decision_id);
      await adapter.submitIndependentReview(
        result.decision_id,
        "approve",
        "The review acknowledges the llm-derived evidence source.",
        ["evidence_quality"],
        [evidenceId],
      );

      await assert.rejects(() => adapter.ratifyDecision(
        result.decision_id,
        `principal:ratifier-${unique()}`,
        "Critical llm-only decision must be blocked.",
        "All evidence is llm_derived.",
      ));
    });

    it("MUST require external evidence when proposer authored all evidence", async () => {
      const proposer = `agent:proposer-${unique()}`;
      const selfEvidenceId = await makeEvidence("raw_source", proposer);

      await assert.rejects(() => adapter.proposeDecision(
        `Self-evidence rejection ${unique()}`,
        "medium",
        proposal([selfEvidenceId]),
        proposer,
      ));

      const externalEvidenceId = await makeEvidence(
        "raw_source",
        `agent:external-evidence-${unique()}`,
      );
      const accepted = await adapter.proposeDecision(
        `External evidence accepted ${unique()}`,
        "medium",
        proposal([selfEvidenceId, externalEvidenceId]),
        proposer,
      );

      assert.equal(accepted.status, "proposed");
    });
  });
}
