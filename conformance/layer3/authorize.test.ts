import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaIdentityAdapter } from "../adapter.ts";

/**
 * Authorization — ACA Layer 3 §3.3
 */
export function authorizeTests(adapter: AcaIdentityAdapter) {
  describe("Authorization (Layer 3 §3.3)", () => {
    after(() => adapter.cleanup());

    it("MUST deny by default (fail-closed)", async () => {
      const id = `agent:authz-deny-${Date.now()}`;
      await adapter.registerPrincipal(id, "agent");
      const result = await adapter.authorize(id, "project:private", "write");
      assert.equal(result.allowed, false);
    });

    it("MUST allow after grant", async () => {
      const owner = `human:authz-owner-${Date.now()}`;
      const grantee = `agent:authz-grantee-${Date.now()}`;
      const ns = `project:authz-${Date.now()}`;
      await adapter.registerPrincipal(owner, "human");
      await adapter.registerPrincipal(grantee, "agent");

      await adapter.grantPermission(owner, grantee, ns, ["read", "write"]);

      const readResult = await adapter.authorize(grantee, ns, "read");
      assert.equal(readResult.allowed, true);

      const writeResult = await adapter.authorize(grantee, ns, "write");
      assert.equal(writeResult.allowed, true);
    });

    it("MUST deny permissions not granted", async () => {
      const owner = `human:authz-partial-${Date.now()}`;
      const grantee = `agent:authz-partial-${Date.now()}`;
      const ns = `project:authz-partial-${Date.now()}`;
      await adapter.registerPrincipal(owner, "human");
      await adapter.registerPrincipal(grantee, "agent");

      await adapter.grantPermission(owner, grantee, ns, ["read"]);

      const writeResult = await adapter.authorize(grantee, ns, "write");
      assert.equal(writeResult.allowed, false);
    });

    it("MUST deny after grant revocation", async () => {
      const owner = `human:authz-revoke-${Date.now()}`;
      const grantee = `agent:authz-revoke-${Date.now()}`;
      const ns = `project:authz-revoke-${Date.now()}`;
      await adapter.registerPrincipal(owner, "human");
      await adapter.registerPrincipal(grantee, "agent");

      const grant = await adapter.grantPermission(owner, grantee, ns, ["read", "write"]);
      await adapter.revokeGrant(grant.grant_id, owner);

      const result = await adapter.authorize(grantee, ns, "read");
      assert.equal(result.allowed, false);
    });

    it("MUST deny for unknown principal", async () => {
      const result = await adapter.authorize("nonexistent:principal", "project:any", "read");
      assert.equal(result.allowed, false);
    });

    it("MUST deny for suspended principal", async () => {
      const owner = `human:authz-susp-${Date.now()}`;
      const grantee = `agent:authz-susp-${Date.now()}`;
      const ns = `project:authz-susp-${Date.now()}`;
      await adapter.registerPrincipal(owner, "human");
      await adapter.registerPrincipal(grantee, "agent");

      await adapter.grantPermission(owner, grantee, ns, ["read"]);
      await adapter.suspendPrincipal(grantee);

      const result = await adapter.authorize(grantee, ns, "read");
      assert.equal(result.allowed, false);
    });
  });
}
