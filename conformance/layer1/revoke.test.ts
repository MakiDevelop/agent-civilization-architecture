import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaTestAdapter } from "../adapter.ts";

/**
 * Revoke Operation — ACA Layer 1 §3.4
 */
export function revokeTests(adapter: AcaTestAdapter) {
  describe("Revoke Operation (Layer 1 §3.4)", () => {
    after(() => adapter.cleanup());

    const makeCell = (value: string) => ({
      agent_id: "test-agent",
      namespace: "test:revoke",
      memory_type: "fact" as const,
      content: {
        format: "text/plain",
        value: `${value}-${Date.now()}-${Math.random()}`,
      },
      source: {
        type: "agent" as const,
        ref: "test-session",
        tier: "llm_derived" as const,
      },
      created_by: "test-principal",
    });

    it("MUST mark memory as revoked", async () => {
      const written = await adapter.write(makeCell("mark-revoked"));
      const result = await adapter.revoke(written.memory_id);
      const { records } = await adapter.read({
        memory_id: written.memory_id,
        filterInactive: false,
      });

      assert.equal(result.memory_id, written.memory_id);
      assert.equal(result.status, "revoked");
      assert.equal(records.length, 1);
      assert.equal(records[0].status, "revoked");
    });

    it("revoked record MUST be excluded from default reads", async () => {
      const written = await adapter.write(makeCell("filtered-revoked"));
      await adapter.revoke(written.memory_id);

      const { records } = await adapter.read({ memory_id: written.memory_id });

      assert.equal(records.length, 0);
    });

    it("MUST be idempotent on already-revoked records", async () => {
      const written = await adapter.write(makeCell("idempotent-revoked"));
      const first = await adapter.revoke(written.memory_id);
      const second = await adapter.revoke(written.memory_id);

      assert.equal(first.status, "revoked");
      assert.equal(second.status, "revoked");
      assert.equal(second.already_revoked, true);
    });

    it("MUST reject revoke of non-existent record", async () => {
      await assert.rejects(() =>
        adapter.revoke(`missing-${Date.now()}-${Math.random()}`),
      );
    });
  });
}
