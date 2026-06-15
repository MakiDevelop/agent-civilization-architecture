import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaAuthorityAdapter, AcaIdentityAdapter } from "../adapter.ts";

type Layer4Adapter = AcaAuthorityAdapter & AcaIdentityAdapter;

/**
 * Backward Compatibility — ACA Layer 4 §5.5
 */
export function backwardCompatTests(adapter: Layer4Adapter) {
  describe("Backward Compatibility (Layer 4 §5.5)", () => {
    after(() => adapter.cleanup());

    const unique = () => `${Date.now()}-${Math.random()}`;

    it("MUST keep Layer 3 authorization enforced when Layer 4 is disabled", async () => {
      const principalId = `agent:l4-disabled-${unique()}`;
      const namespace = `project:l4-disabled-${unique()}`;
      await adapter.registerPrincipal(principalId, "agent");

      const result = await adapter.authorize(principalId, namespace, "write");

      assert.equal(result.allowed, false);
    });

    it("MUST NOT treat skipped Layer 4 checks as universal authorization", async () => {
      const ownerId = `human:l4-owner-${unique()}`;
      const principalId = `agent:l4-partial-${unique()}`;
      const namespace = `project:l4-partial-${unique()}`;
      await adapter.registerPrincipal(ownerId, "human");
      await adapter.registerPrincipal(principalId, "agent");
      await adapter.grantPermission(ownerId, principalId, namespace, ["read"]);

      const read = await adapter.authorize(principalId, namespace, "read");
      const write = await adapter.authorize(principalId, namespace, "write");

      assert.equal(read.allowed, true);
      assert.equal(write.allowed, false);
    });
  });
}
