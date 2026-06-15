import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaIdentityAdapter } from "../adapter.ts";

/**
 * Principal Registration — ACA Layer 3 §3.1
 */
export function principalTests(adapter: AcaIdentityAdapter) {
  describe("Principal Registration (Layer 3 §3.1)", () => {
    after(() => adapter.cleanup());

    it("MUST register a human principal", async () => {
      const p = await adapter.registerPrincipal("human:test-user", "human", "Test User");
      assert.equal(p.principal_id, "human:test-user");
      assert.equal(p.principal_type, "human");
      assert.equal(p.status, "active");
    });

    it("MUST register an agent principal", async () => {
      const p = await adapter.registerPrincipal("agent:planner", "agent");
      assert.equal(p.principal_id, "agent:planner");
      assert.equal(p.principal_type, "agent");
      assert.equal(p.status, "active");
    });

    it("MUST register a system principal", async () => {
      const p = await adapter.registerPrincipal("system:cron", "system");
      assert.equal(p.principal_type, "system");
    });

    it("MUST reject duplicate principal_id", async () => {
      const id = `human:dup-${Date.now()}`;
      await adapter.registerPrincipal(id, "human");
      await assert.rejects(
        () => adapter.registerPrincipal(id, "human"),
        (err: Error) => {
          assert.ok(err.message.includes("exists") || err.message.includes("duplicate"),
            `Expected duplicate error, got: ${err.message}`);
          return true;
        },
      );
    });

    it("MUST retrieve registered principal", async () => {
      const id = `agent:retrieve-${Date.now()}`;
      await adapter.registerPrincipal(id, "agent", "Retrieve Test");
      const p = await adapter.getPrincipal(id);
      assert.ok(p);
      assert.equal(p.principal_id, id);
      assert.equal(p.display_name, "Retrieve Test");
    });

    it("MUST return null for non-existent principal", async () => {
      const p = await adapter.getPrincipal("nonexistent:principal");
      assert.equal(p, null);
    });

    it("MUST suspend a principal", async () => {
      const id = `agent:suspend-${Date.now()}`;
      await adapter.registerPrincipal(id, "agent");
      const suspended = await adapter.suspendPrincipal(id);
      assert.equal(suspended.status, "suspended");
    });
  });
}
