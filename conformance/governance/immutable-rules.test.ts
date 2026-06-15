import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaGovernanceAdapter } from "../adapter.ts";

/**
 * Immutable Rules — ACA Governance Plane §2.3
 */
export function immutableRulesTests(adapter: AcaGovernanceAdapter) {
  describe("Immutable Rules (Governance Plane §2.3)", () => {
    after(() => adapter.cleanup());

    const unique = () => `${Date.now()}-${Math.random()}`;

    const defineImmutableRule = async () => {
      const ruleId = `rule:immutable-${unique()}`;
      await adapter.defineRule({
        rule_id: ruleId,
        category: "immutable",
        title: "Immutable Conformance Rule",
        specification: `This immutable test rule cannot be modified or suspended. ${unique()}`,
        enforced_at_layers: [1, 2, 3, 4, 5],
        created_by_decision: null,
      });
      return ruleId;
    };

    it("MUST reject suspension of immutable rules", async () => {
      const ruleId = await defineImmutableRule();

      await assert.rejects(() => adapter.suspendRule(
        ruleId,
        "Immutable rules cannot be suspended.",
      ));
    });

    it("MUST reject amendment of immutable rules", async () => {
      const ruleId = await defineImmutableRule();

      await assert.rejects(() => adapter.proposeAmendment(
        ruleId,
        "Modified immutable rule text.",
        "Immutable rules must reject amendment proposals.",
        `principal:governance-proposer-${unique()}`,
      ));
    });

    it("MUST keep immutable rules active regardless of attempted operations", async () => {
      const ruleId = await defineImmutableRule();

      await assert.rejects(() => adapter.suspendRule(
        ruleId,
        "Attempted suspension must not change status.",
      ));
      await assert.rejects(() => adapter.proposeAmendment(
        ruleId,
        "Attempted amendment must not change status.",
        "Immutable rules remain active after rejected operations.",
        `principal:governance-proposer-${unique()}`,
      ));

      const rule = await adapter.getRule(ruleId);
      assert.ok(rule);
      assert.equal(rule.category, "immutable");
      assert.equal(rule.status, "active");
      assert.equal(rule.version, 1);
    });
  });
}
