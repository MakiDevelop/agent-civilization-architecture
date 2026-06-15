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
 * Evidence Requirements — ACA Layer 5 §4.1
 */
export function evidenceTests(adapter: Layer5Adapter) {
  describe("Evidence Requirements (Layer 5 §4.1)", () => {
    after(() => adapter.cleanup());

    const unique = () => `${Date.now()}-${Math.random()}`;

    const makeEvidence = async (
      tier: "raw_source" | "llm_derived" | "human_confirmed",
    ) => {
      const written = await adapter.write({
        agent_id: "test-agent",
        namespace: "test:layer5:evidence",
        memory_type: "fact",
        content: {
          format: "text/plain",
          value: `evidence-${tier}-${unique()}`,
        },
        source: {
          type: tier === "human_confirmed" ? "human" : "agent",
          ref: "layer5-evidence-test",
          tier,
        },
        created_by: tier === "human_confirmed" ? "human:evidence" : "agent:evidence",
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

    it("MUST reject critical proposals without human_confirmed evidence", async () => {
      const evidenceId = await makeEvidence("raw_source");
      await assert.rejects(() => adapter.proposeDecision(
        `Critical raw-source-only evidence rejection ${unique()}`,
        "critical",
        proposal([evidenceId]),
        `principal:proposer-${unique()}`,
      ));
    });

    it("MUST reject expired or revoked evidence", async () => {
      const expiredId = await makeEvidence("raw_source");
      await adapter.expire(expiredId);

      await assert.rejects(() => adapter.proposeDecision(
        `Expired evidence rejection ${unique()}`,
        "medium",
        proposal([expiredId]),
        `principal:proposer-${unique()}`,
      ));

      const revokedId = await makeEvidence("raw_source");
      await adapter.revoke(revokedId);

      await assert.rejects(() => adapter.proposeDecision(
        `Revoked evidence rejection ${unique()}`,
        "medium",
        proposal([revokedId]),
        `principal:proposer-${unique()}`,
      ));
    });
  });
}
