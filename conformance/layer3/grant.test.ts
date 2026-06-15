import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaIdentityAdapter } from "../adapter.ts";

/**
 * Grant & Revoke — ACA Layer 3 §3.4 / §3.5
 */
export function grantTests(adapter: AcaIdentityAdapter) {
  describe("Grant Permission (Layer 3 §3.4 / §3.5)", () => {
    after(() => adapter.cleanup());

    it("MUST create a grant with correct fields", async () => {
      const granter = `human:grant-owner-${Date.now()}`;
      const grantee = `agent:grant-target-${Date.now()}`;
      const ns = `project:grant-${Date.now()}`;
      await adapter.registerPrincipal(granter, "human");
      await adapter.registerPrincipal(grantee, "agent");

      const grant = await adapter.grantPermission(granter, grantee, ns, ["read", "write"]);

      assert.ok(grant.grant_id);
      assert.equal(grant.granter_principal_id, granter);
      assert.equal(grant.grantee_principal_id, grantee);
      assert.equal(grant.namespace_id, ns);
      assert.deepEqual(grant.permissions, ["read", "write"]);
      assert.equal(grant.status, "active");
    });

    it("MUST revoke a grant", async () => {
      const granter = `human:revoke-owner-${Date.now()}`;
      const grantee = `agent:revoke-target-${Date.now()}`;
      const ns = `project:revoke-${Date.now()}`;
      await adapter.registerPrincipal(granter, "human");
      await adapter.registerPrincipal(grantee, "agent");

      const grant = await adapter.grantPermission(granter, grantee, ns, ["read"]);
      const result = await adapter.revokeGrant(grant.grant_id, granter);

      assert.equal(result.grant_id, grant.grant_id);
      assert.equal(result.status, "revoked");
    });

    it("MUST support multiple grants to different namespaces", async () => {
      const granter = `human:multi-ns-${Date.now()}`;
      const grantee = `agent:multi-ns-${Date.now()}`;
      await adapter.registerPrincipal(granter, "human");
      await adapter.registerPrincipal(grantee, "agent");

      const ns1 = `project:multi-a-${Date.now()}`;
      const ns2 = `project:multi-b-${Date.now()}`;

      await adapter.grantPermission(granter, grantee, ns1, ["read"]);
      await adapter.grantPermission(granter, grantee, ns2, ["read", "write"]);

      const r1 = await adapter.authorize(grantee, ns1, "read");
      const r2 = await adapter.authorize(grantee, ns2, "write");
      const r3 = await adapter.authorize(grantee, ns1, "write");

      assert.equal(r1.allowed, true);
      assert.equal(r2.allowed, true);
      assert.equal(r3.allowed, false);
    });

    it("revoking one grant MUST NOT affect other grants", async () => {
      const granter = `human:iso-revoke-${Date.now()}`;
      const grantee = `agent:iso-revoke-${Date.now()}`;
      await adapter.registerPrincipal(granter, "human");
      await adapter.registerPrincipal(grantee, "agent");

      const nsA = `project:iso-a-${Date.now()}`;
      const nsB = `project:iso-b-${Date.now()}`;

      const grantA = await adapter.grantPermission(granter, grantee, nsA, ["read"]);
      await adapter.grantPermission(granter, grantee, nsB, ["read"]);

      await adapter.revokeGrant(grantA.grant_id, granter);

      const rA = await adapter.authorize(grantee, nsA, "read");
      const rB = await adapter.authorize(grantee, nsB, "read");

      assert.equal(rA.allowed, false);
      assert.equal(rB.allowed, true);
    });
  });
}
