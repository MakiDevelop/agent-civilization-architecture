import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaAuthorityAdapter, AcaIdentityAdapter, Capability, Constraint } from "../adapter.ts";

type Layer4Adapter = AcaAuthorityAdapter & AcaIdentityAdapter;

/**
 * Check Authority — ACA Layer 4 §3.4
 */
export function checkAuthorityTests(adapter: Layer4Adapter) {
  describe("Check Authority (Layer 4 §3.4)", () => {
    after(() => adapter.cleanup());

    const unique = () => `${Date.now()}-${Math.random()}`;

    const defineAndAssign = async (
      principalId: string,
      capabilities: Capability[],
      constraints: Constraint[] = [],
      scopeNamespace?: string,
    ) => {
      const roleId = `role:authority-${unique()}`;
      const assignedBy = `human:authority-assigner-${unique()}`;
      await adapter.registerPrincipal(assignedBy, "human");
      await adapter.defineRole({
        role_id: roleId,
        display_name: "Authority Role",
        scope: "all",
        capabilities,
        constraints,
      });
      await adapter.assignRole(principalId, roleId, assignedBy, { scopeNamespace });
      return roleId;
    };

    it("MUST allow when capability matches", async () => {
      const principalId = `agent:allowed-${unique()}`;
      await adapter.registerPrincipal(principalId, "agent");
      const roleId = await defineAndAssign(principalId, ["write_memory"]);

      const result = await adapter.checkAuthority(principalId, "write_memory");

      assert.equal(result.allowed, true);
      assert.ok(result.roles.includes(roleId));
    });

    it("MUST deny when no matching capability is present (fail-closed)", async () => {
      const principalId = `agent:no-capability-${unique()}`;
      await adapter.registerPrincipal(principalId, "agent");
      await defineAndAssign(principalId, ["read_memory"]);

      const result = await adapter.checkAuthority(principalId, "write_memory");

      assert.equal(result.allowed, false);
    });

    it("MUST deny when a constraint blocks the capability", async () => {
      const principalId = `agent:constraint-block-${unique()}`;
      await adapter.registerPrincipal(principalId, "agent");
      await defineAndAssign(
        principalId,
        ["modify_governance"],
        ["cannot_modify_governance"],
      );

      const result = await adapter.checkAuthority(principalId, "modify_governance");

      assert.equal(result.allowed, false);
      assert.ok(result.constraints_applied.includes("cannot_modify_governance"));
    });

    it("MUST let constraints override capabilities", async () => {
      const principalId = `agent:constraint-override-${unique()}`;
      await adapter.registerPrincipal(principalId, "agent");
      await defineAndAssign(principalId, ["modify_governance"]);
      await defineAndAssign(principalId, [], ["cannot_modify_governance"]);

      const result = await adapter.checkAuthority(principalId, "modify_governance");

      assert.equal(result.allowed, false);
      assert.ok(result.constraints_applied.includes("cannot_modify_governance"));
    });

    it("MUST allow scoped assignment only in matching namespace", async () => {
      const principalId = `agent:scope-check-${unique()}`;
      const namespace = `project:scope-check-${unique()}`;
      const otherNamespace = `project:scope-check-other-${unique()}`;
      await adapter.registerPrincipal(principalId, "agent");
      await defineAndAssign(principalId, ["read_memory"], [], namespace);

      const matching = await adapter.checkAuthority(principalId, "read_memory", namespace);
      const elsewhere = await adapter.checkAuthority(principalId, "read_memory", otherNamespace);

      assert.equal(matching.allowed, true);
      assert.equal(elsewhere.allowed, false);
    });

    it("MUST deny suspended principals", async () => {
      const principalId = `agent:suspended-authority-${unique()}`;
      await adapter.registerPrincipal(principalId, "agent");
      await defineAndAssign(principalId, ["read_memory"]);
      await adapter.suspendPrincipal(principalId);

      const result = await adapter.checkAuthority(principalId, "read_memory");

      assert.equal(result.allowed, false);
    });

    it("MUST union capabilities and constraints across multiple roles", async () => {
      const principalId = `agent:multi-role-${unique()}`;
      await adapter.registerPrincipal(principalId, "agent");
      const writerRole = await defineAndAssign(
        principalId,
        ["write_memory"],
        ["cannot_modify_governance"],
      );
      const readerRole = await defineAndAssign(
        principalId,
        ["read_memory", "modify_governance"],
      );

      const write = await adapter.checkAuthority(principalId, "write_memory");
      const read = await adapter.checkAuthority(principalId, "read_memory");
      const governance = await adapter.checkAuthority(principalId, "modify_governance");

      assert.equal(write.allowed, true);
      assert.equal(read.allowed, true);
      assert.equal(governance.allowed, false);
      assert.ok(write.roles.includes(writerRole));
      assert.ok(read.roles.includes(readerRole));
      assert.ok(governance.constraints_applied.includes("cannot_modify_governance"));
    });
  });
}
