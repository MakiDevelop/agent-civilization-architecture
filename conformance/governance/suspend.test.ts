import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaGovernanceAdapter, RuleCategory } from "../adapter.ts";

/**
 * Suspend Rule — ACA Governance Plane §3.3
 */
export function suspendTests(adapter: AcaGovernanceAdapter) {
  describe("Suspend Rule (Governance Plane §3.3)", () => {
    after(() => adapter.cleanup());

    const unique = () => `${Date.now()}-${Math.random()}`;

    const defineRule = async (category: RuleCategory) => {
      const ruleId = `rule:suspend-${category}-${unique()}`;
      await adapter.defineRule({
        rule_id: ruleId,
        category,
        title: `${category} Suspend Test Rule`,
        specification: `Suspend test rule specification ${unique()}`,
        enforced_at_layers: [4, 5],
        created_by_decision: null,
      });
      return ruleId;
    };

    it("MUST suspend operational rules", async () => {
      const ruleId = await defineRule("operational");

      const suspended = await adapter.suspendRule(
        ruleId,
        "Operational rule suspension is allowed by governance process.",
      );

      assert.equal(suspended.rule_id, ruleId);
      assert.equal(suspended.status, "suspended");
    });

    it("MUST retrieve suspended rules with status:suspended", async () => {
      const ruleId = await defineRule("operational");
      await adapter.suspendRule(
        ruleId,
        "Suspended status must be persisted and retrievable.",
      );

      const rule = await adapter.getRule(ruleId);
      assert.ok(rule);
      assert.equal(rule.rule_id, ruleId);
      assert.equal(rule.status, "suspended");
    });

    it("MUST reject suspension of immutable rules", async () => {
      const ruleId = await defineRule("immutable");

      await assert.rejects(() => adapter.suspendRule(
        ruleId,
        "Immutable rules cannot be suspended.",
      ));

      const rule = await adapter.getRule(ruleId);
      assert.ok(rule);
      assert.equal(rule.status, "active");
    });
  });
}
