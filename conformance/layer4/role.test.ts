import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaAuthorityAdapter } from "../adapter.ts";

/**
 * Role Definition — ACA Layer 4 §3.1
 */
export function roleTests(adapter: AcaAuthorityAdapter) {
  describe("Role Definition (Layer 4 §3.1)", () => {
    after(() => adapter.cleanup());

    const unique = () => `${Date.now()}-${Math.random()}`;

    it("MUST define a role with capabilities and constraints", async () => {
      const roleId = `role:writer-${unique()}`;

      const result = await adapter.defineRole({
        role_id: roleId,
        display_name: "Writer",
        scope: "memory",
        capabilities: ["write_memory", "read_memory"],
        constraints: ["cannot_delete_memory"],
      });

      assert.equal(result.role_id, roleId);
      assert.equal(result.status, "active");
    });

    it("MUST retrieve a defined role", async () => {
      const roleId = `role:retrieve-${unique()}`;

      await adapter.defineRole({
        role_id: roleId,
        display_name: "Retrieve Role",
        scope: "memory",
        capabilities: ["read_memory"],
        constraints: [],
      });

      const role = await adapter.getRole(roleId);
      assert.ok(role);
      assert.equal(role.role_id, roleId);
      assert.equal(role.display_name, "Retrieve Role");
      assert.deepEqual(role.capabilities, ["read_memory"]);
      assert.deepEqual(role.constraints, []);
      assert.equal(role.status, "active");
    });

    it("MUST support risk_threshold on roles", async () => {
      const roleId = `role:risk-${unique()}`;

      await adapter.defineRole({
        role_id: roleId,
        display_name: "Risk Limited Role",
        scope: "decisions",
        capabilities: ["propose_decision"],
        constraints: ["requires_independent_review"],
        risk_threshold: 40,
        escalation_target: "role:resolver",
      });

      const role = await adapter.getRole(roleId);
      assert.ok(role);
      assert.equal(role.risk_threshold, 40);
      assert.equal(role.escalation_target, "role:resolver");
    });

    it("MUST reject duplicate role_id on create", async () => {
      const roleId = `role:dup-${unique()}`;

      await adapter.defineRole({
        role_id: roleId,
        display_name: "Duplicate Role",
        scope: "memory",
        capabilities: ["read_memory"],
        constraints: [],
      });

      await assert.rejects(
        () => adapter.defineRole({
          role_id: roleId,
          display_name: "Duplicate Role Again",
          scope: "memory",
          capabilities: ["read_memory"],
          constraints: [],
        }),
        (err: Error) => {
          assert.ok(
            err.message.includes("exists") || err.message.includes("duplicate"),
            `Expected duplicate role error, got: ${err.message}`,
          );
          return true;
        },
      );
    });
  });
}
