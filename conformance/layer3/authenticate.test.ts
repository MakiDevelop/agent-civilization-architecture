import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaIdentityAdapter } from "../adapter.ts";

/**
 * Authentication — ACA Layer 3 §3.2
 */
export function authenticateTests(adapter: AcaIdentityAdapter) {
  describe("Authentication (Layer 3 §3.2)", () => {
    after(() => adapter.cleanup());

    it("MUST return Principal for valid credential", async () => {
      const id = `agent:auth-valid-${Date.now()}`;
      const registered = await adapter.registerPrincipal(id, "agent");
      const authed = await adapter.authenticate({ principal_id: id, token: "test-token" });
      assert.equal(authed.principal_id, registered.principal_id);
      assert.equal(authed.status, "active");
    });

    it("MUST reject invalid credential", async () => {
      await assert.rejects(
        () => adapter.authenticate({ principal_id: "nonexistent", token: "bad" }),
        (err: Error) => {
          assert.ok(
            err.message.includes("Invalid") || err.message.includes("not found"),
            `Expected authentication error, got: ${err.message}`,
          );
          return true;
        },
      );
    });

    it("MUST reject suspended principal", async () => {
      const id = `agent:auth-suspended-${Date.now()}`;
      await adapter.registerPrincipal(id, "agent");
      await adapter.suspendPrincipal(id);
      await assert.rejects(
        () => adapter.authenticate({ principal_id: id, token: "test-token" }),
        (err: Error) => {
          assert.ok(
            err.message.includes("suspended") || err.message.includes("Suspended"),
            `Expected suspended error, got: ${err.message}`,
          );
          return true;
        },
      );
    });
  });
}
