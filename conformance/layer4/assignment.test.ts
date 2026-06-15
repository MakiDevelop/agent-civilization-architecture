import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaAuthorityAdapter, AcaIdentityAdapter } from "../adapter.ts";

type Layer4Adapter = AcaAuthorityAdapter & AcaIdentityAdapter;

/**
 * Role Assignment — ACA Layer 4 §3.2 / §3.3
 */
export function assignmentTests(adapter: Layer4Adapter) {
  describe("Role Assignment (Layer 4 §3.2 / §3.3)", () => {
    after(() => adapter.cleanup());

    const unique = () => `${Date.now()}-${Math.random()}`;

    const defineRole = async (capabilities = ["read_memory"]) => {
      const roleId = `role:assignment-${unique()}`;
      await adapter.defineRole({
        role_id: roleId,
        display_name: "Assignment Role",
        scope: "memory",
        capabilities,
        constraints: [],
      });
      return roleId;
    };

    it("MUST assign a role to a principal", async () => {
      const principalId = `agent:assign-${unique()}`;
      const assignedBy = `human:assigner-${unique()}`;
      const roleId = await defineRole(["write_memory"]);
      await adapter.registerPrincipal(principalId, "agent");
      await adapter.registerPrincipal(assignedBy, "human");

      const assignment = await adapter.assignRole(principalId, roleId, assignedBy);

      assert.ok(assignment.assignment_id);
      assert.equal(assignment.principal_id, principalId);
      assert.equal(assignment.role_id, roleId);
      assert.equal(assignment.assigned_by, assignedBy);
      assert.equal(assignment.status, "active");
      assert.equal(assignment.delegation_allowed, false);
    });

    it("MUST revoke a role assignment", async () => {
      const principalId = `agent:revoke-assignment-${unique()}`;
      const assignedBy = `human:revoke-assigner-${unique()}`;
      const roleId = await defineRole(["read_memory"]);
      await adapter.registerPrincipal(principalId, "agent");
      await adapter.registerPrincipal(assignedBy, "human");

      const assignment = await adapter.assignRole(principalId, roleId, assignedBy);
      const result = await adapter.revokeRoleAssignment(assignment.assignment_id, assignedBy);

      assert.equal(result.assignment_id, assignment.assignment_id);
      assert.equal(result.status, "revoked");

      const authz = await adapter.checkAuthority(principalId, "read_memory");
      assert.equal(authz.allowed, false);
    });

    it("MUST support scoped assignment with scope_namespace", async () => {
      const principalId = `agent:scoped-${unique()}`;
      const assignedBy = `human:scoped-assigner-${unique()}`;
      const namespace = `project:scoped-${unique()}`;
      const otherNamespace = `project:scoped-other-${unique()}`;
      const roleId = await defineRole(["write_memory"]);
      await adapter.registerPrincipal(principalId, "agent");
      await adapter.registerPrincipal(assignedBy, "human");

      const assignment = await adapter.assignRole(principalId, roleId, assignedBy, {
        scopeNamespace: namespace,
      });

      assert.equal(assignment.scope_namespace, namespace);
      const matching = await adapter.checkAuthority(principalId, "write_memory", namespace);
      const elsewhere = await adapter.checkAuthority(principalId, "write_memory", otherNamespace);

      assert.equal(matching.allowed, true);
      assert.equal(elsewhere.allowed, false);
    });

    it("MUST preserve delegation_allowed flag", async () => {
      const principalId = `agent:delegate-${unique()}`;
      const assignedBy = `human:delegate-assigner-${unique()}`;
      const roleId = await defineRole(["grant_authority"]);
      await adapter.registerPrincipal(principalId, "agent");
      await adapter.registerPrincipal(assignedBy, "human");

      const assignment = await adapter.assignRole(principalId, roleId, assignedBy, {
        delegationAllowed: true,
      });

      assert.equal(assignment.delegation_allowed, true);
    });
  });
}
