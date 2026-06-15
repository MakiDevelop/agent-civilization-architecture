import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaTestAdapter } from "../adapter.ts";

/**
 * Expire Operation — ACA Layer 1 §3.7
 */
export function expireTests(adapter: AcaTestAdapter) {
  describe("Expire Operation (Layer 1 §3.7)", () => {
    after(() => adapter.cleanup());

    const makeCell = (value: string, tier = "human_confirmed") => ({
      agent_id: "test-agent",
      namespace: "test:expire",
      memory_type: "fact" as const,
      content: {
        format: "text/plain",
        value: `${value}-${Date.now()}-${Math.random()}`,
      },
      source: {
        type: "agent" as const,
        ref: "test-session",
        tier: tier as "raw_source" | "llm_derived" | "human_confirmed",
      },
      created_by: "test-principal",
    });

    it("MUST mark memory as expired", async () => {
      const written = await adapter.write(makeCell("mark-expired"));
      const result = await adapter.expire(written.memory_id);
      const { records } = await adapter.read({
        memory_id: written.memory_id,
        filterInactive: false,
      });

      assert.equal(result.memory_id, written.memory_id);
      assert.equal(result.status, "expired");
      assert.equal(records.length, 1);
      assert.equal(records[0].status, "expired");
    });

    it("expired record MUST be excluded from default reads", async () => {
      const written = await adapter.write(makeCell("filtered-expired"));
      await adapter.expire(written.memory_id);

      const { records } = await adapter.read({ memory_id: written.memory_id });

      assert.equal(records.length, 0);
    });

    it("MUST be idempotent on already-expired records", async () => {
      const written = await adapter.write(makeCell("idempotent-expired"));
      const first = await adapter.expire(written.memory_id);
      const second = await adapter.expire(written.memory_id);

      assert.equal(first.status, "expired");
      assert.equal(second.status, "expired");
    });

    it("MUST reject expire of non-active records", async () => {
      const revoked = await adapter.write(makeCell("non-active-revoked"));
      await adapter.revoke(revoked.memory_id);
      await assert.rejects(() => adapter.expire(revoked.memory_id));

      const superseded = await adapter.write(makeCell("non-active-superseded"));
      await adapter.supersede(
        makeCell("non-active-superseded-replacement"),
        superseded.memory_id,
      );
      await assert.rejects(() => adapter.expire(superseded.memory_id));
    });

    it("MUST produce audit event with operation:expire", async () => {
      const written = await adapter.write(makeCell("audit-expire"));
      await adapter.expire(written.memory_id);

      const events = await adapter.audit(written.memory_id);

      assert.ok(
        events.some((event) => event.operation === "expire"),
        "must produce expire audit event",
      );
    });
  });
}
