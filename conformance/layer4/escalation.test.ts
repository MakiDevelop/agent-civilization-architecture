import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaAuthorityAdapter, AcaIdentityAdapter, AcaTestAdapter } from "../adapter.ts";

type Layer4Adapter = AcaAuthorityAdapter & AcaIdentityAdapter & Partial<Pick<AcaTestAdapter, "audit">>;

/**
 * Escalation — ACA Layer 4 §3.5
 */
export function escalationTests(adapter: Layer4Adapter) {
  describe("Escalation (Layer 4 §3.5)", () => {
    after(() => adapter.cleanup());

    const unique = () => `${Date.now()}-${Math.random()}`;

    it("MUST return target role and pending status", async () => {
      const resolverRoleId = `role:resolver-${unique()}`;
      const escalatorRoleId = `role:escalator-${unique()}`;
      const principalId = `agent:escalator-${unique()}`;
      const assignedBy = `human:escalation-assigner-${unique()}`;
      await adapter.registerPrincipal(principalId, "agent");
      await adapter.registerPrincipal(assignedBy, "human");

      await adapter.defineRole({
        role_id: resolverRoleId,
        display_name: "Resolver",
        scope: "all",
        capabilities: ["ratify_decision", "veto_decision", "escalate", "break_glass"],
        constraints: ["cannot_self_approve"],
      });
      await adapter.defineRole({
        role_id: escalatorRoleId,
        display_name: "Escalator",
        scope: "decisions",
        capabilities: ["propose_decision", "escalate"],
        constraints: [],
        risk_threshold: 20,
        escalation_target: resolverRoleId,
      });
      await adapter.assignRole(principalId, escalatorRoleId, assignedBy);

      const result = await adapter.escalate(
        `decision:escalate-${unique()}`,
        "risk_exceeds_threshold",
        principalId,
      );

      assert.ok(result.escalation_id);
      assert.equal(result.target_role, resolverRoleId);
      assert.equal(result.status, "pending");
    });

    it("MUST produce an audit trail for escalation", async () => {
      assert.equal(typeof adapter.audit, "function", "adapter must expose audit to verify escalation audit trail");

      const resolverRoleId = `role:audit-resolver-${unique()}`;
      const escalatorRoleId = `role:audit-escalator-${unique()}`;
      const principalId = `agent:audit-escalator-${unique()}`;
      const assignedBy = `human:audit-escalation-assigner-${unique()}`;
      const decisionId = `decision:escalation-audit-${unique()}`;
      await adapter.registerPrincipal(principalId, "agent");
      await adapter.registerPrincipal(assignedBy, "human");

      await adapter.defineRole({
        role_id: resolverRoleId,
        display_name: "Audit Resolver",
        scope: "all",
        capabilities: ["ratify_decision", "veto_decision", "escalate", "break_glass"],
        constraints: ["cannot_self_approve"],
      });
      await adapter.defineRole({
        role_id: escalatorRoleId,
        display_name: "Audit Escalator",
        scope: "decisions",
        capabilities: ["escalate"],
        constraints: [],
        escalation_target: resolverRoleId,
      });
      await adapter.assignRole(principalId, escalatorRoleId, assignedBy);

      await adapter.escalate(decisionId, "irreversible_action", principalId);
      const events = await adapter.audit(decisionId);

      assert.ok(events.length > 0, "escalation must have at least one audit event");
      assert.ok(
        events.some((event) => event.operation === "escalate"),
        "escalation audit trail must include operation:escalate",
      );
    });
  });
}
