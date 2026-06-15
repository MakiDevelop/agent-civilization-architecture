import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type {
  AcaDecisionAdapter,
  AcaGovernanceAdapter,
  RuleCategory,
  RiskLevel,
} from "../adapter.ts";

type GovernanceAdapter = AcaGovernanceAdapter & AcaDecisionAdapter;

/**
 * Amendment Process — ACA Governance Plane §3.1 / §3.2
 */
export function amendmentTests(adapter: GovernanceAdapter) {
  describe("Amendment Process (Governance Plane §3.1 / §3.2)", () => {
    after(() => adapter.cleanup());

    const unique = () => `${Date.now()}-${Math.random()}`;

    const defineRule = async (category: RuleCategory) => {
      const ruleId = `rule:${category}-${unique()}`;
      await adapter.defineRule({
        rule_id: ruleId,
        category,
        title: `${category} Amendment Test Rule`,
        specification: `Original ${category} rule specification ${unique()}`,
        enforced_at_layers: [1, 2, 3, 4, 5],
        created_by_decision: null,
      });
      return ruleId;
    };

    const propose = async (ruleId: string) => {
      return adapter.proposeAmendment(
        ruleId,
        `Updated rule specification ${unique()}`,
        "Conformance test amendment proposal.",
        `principal:governance-proposer-${unique()}`,
      );
    };

    const assertAmendmentRisk = async (category: RuleCategory, expectedRisk: RiskLevel) => {
      const ruleId = await defineRule(category);
      const amendment = await propose(ruleId);

      assert.ok(amendment.amendment_id);
      assert.ok(amendment.decision_id);
      assert.equal(amendment.risk_level, expectedRisk);

      const decision = await adapter.getDecision(amendment.decision_id);
      assert.ok(decision);
      assert.equal(decision.risk_level, expectedRisk);
      assert.equal(decision.status, "proposed");
    };

    it("MUST create a decision with appropriate risk level", async () => {
      await assertAmendmentRisk("operational", "high");
    });

    it("MUST classify structural rule amendments as critical risk", async () => {
      await assertAmendmentRisk("structural", "critical");
    });

    it("MUST classify operational rule amendments as high risk", async () => {
      await assertAmendmentRisk("operational", "high");
    });

    it("MUST reject amendment of immutable rules", async () => {
      const ruleId = await defineRule("immutable");

      await assert.rejects(() => propose(ruleId));
    });
  });
}
