import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaAuthorityAdapter, AcaGovernanceAdapter } from "../adapter.ts";

type GovernanceHealthAdapter = AcaGovernanceAdapter & AcaAuthorityAdapter;

/**
 * Governance Health Check — ACA Governance Plane §3.4
 */
export function healthCheckTests(adapter: GovernanceHealthAdapter) {
  describe("Governance Health Check (Governance Plane §3.4)", () => {
    after(() => adapter.cleanup());

    const unique = () => `${Date.now()}-${Math.random()}`;

    it("MUST return dormant rules with no related events", async () => {
      const dormantRuleId = `rule:dormant-${unique()}`;
      await adapter.defineRule({
        rule_id: dormantRuleId,
        category: "operational",
        title: "Dormant Health Check Rule",
        specification: `Dormant rule specification ${unique()}`,
        enforced_at_layers: [1, 4],
        created_by_decision: null,
      });

      const health = await adapter.healthCheck(30);

      assert.ok(Array.isArray(health.dormant_rules));
      assert.ok(
        health.dormant_rules.includes(dormantRuleId),
        "Health check must include rules with no related governance events.",
      );
    });

    it("MUST return unexercised roles", async () => {
      const roleId = `role:unexercised-${unique()}`;
      await adapter.defineRole({
        role_id: roleId,
        display_name: "Unexercised Health Check Role",
        scope: "governance",
        capabilities: ["modify_governance"],
        constraints: [],
      });

      const health = await adapter.healthCheck(30);

      assert.ok(Array.isArray(health.unexercised_roles));
      assert.ok(
        health.unexercised_roles.includes(roleId),
        "Health check must include roles with no active assignments or authority checks.",
      );
    });
  });
}
