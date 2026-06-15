import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaTestAdapter } from "../adapter.ts";

/**
 * Read Operation — ACA Layer 1 §3.2
 */
export function readTests(adapter: AcaTestAdapter) {
  describe("Read Operation (Layer 1 §3.2)", () => {
    after(() => adapter.cleanup());

    const makeCell = (value: string, opts?: Record<string, unknown>) => ({
      agent_id: "test-agent",
      namespace: "test:read",
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
      ...opts,
    });

    it("default reads MUST exclude superseded, revoked, and expired records", async () => {
      const active = await adapter.write(makeCell("active"));
      const superseded = await adapter.write(makeCell("superseded-target"));
      await adapter.supersede(
        makeCell("superseded-replacement", {
          source: {
            type: "agent" as const,
            ref: "test-session",
            tier: "human_confirmed" as const,
          },
        }),
        superseded.memory_id,
      );
      const revoked = await adapter.write(makeCell("revoked"));
      await adapter.revoke(revoked.memory_id);
      const expired = await adapter.write(makeCell("expired"));
      await adapter.expire(expired.memory_id);

      const { records } = await adapter.read({ namespace: "test:read" });
      const ids = records.map((record) => record.memory_id);

      assert.ok(ids.includes(active.memory_id), "active record must be readable");
      assert.ok(!ids.includes(superseded.memory_id), "superseded record must be filtered");
      assert.ok(!ids.includes(revoked.memory_id), "revoked record must be filtered");
      assert.ok(!ids.includes(expired.memory_id), "expired record must be filtered");
    });

    it("filterInactive:false MUST return all records", async () => {
      const active = await adapter.write(makeCell("all-active"));
      const revoked = await adapter.write(makeCell("all-revoked"));
      await adapter.revoke(revoked.memory_id);
      const expired = await adapter.write(makeCell("all-expired"));
      await adapter.expire(expired.memory_id);

      const { records } = await adapter.read({
        namespace: "test:read",
        filterInactive: false,
      });
      const ids = records.map((record) => record.memory_id);

      assert.ok(ids.includes(active.memory_id));
      assert.ok(ids.includes(revoked.memory_id));
      assert.ok(ids.includes(expired.memory_id));
    });

    it("MUST query by namespace, memory_type, and agent_id", async () => {
      const expected = await adapter.write(
        makeCell("query-match", {
          agent_id: "test-agent-query",
          namespace: "test:read-query",
          memory_type: "lesson" as const,
        }),
      );
      await adapter.write(
        makeCell("query-wrong-agent", {
          agent_id: "test-agent-other",
          namespace: "test:read-query",
          memory_type: "lesson" as const,
        }),
      );
      await adapter.write(
        makeCell("query-wrong-type", {
          agent_id: "test-agent-query",
          namespace: "test:read-query",
          memory_type: "fact" as const,
        }),
      );

      const { records } = await adapter.read({
        namespace: "test:read-query",
        memory_type: "lesson",
        agent_id: "test-agent-query",
      });

      assert.ok(records.length >= 1);
      assert.ok(records.every((record) => record.namespace === "test:read-query"));
      assert.ok(records.every((record) => record.memory_type === "lesson"));
      assert.ok(records.every((record) => record.agent_id === "test-agent-query"));
      assert.ok(records.some((record) => record.memory_id === expected.memory_id));
    });

    it("records MUST be ordered by created_at DESC", async () => {
      await adapter.write(makeCell("ordered-1", { namespace: "test:read-order" }));
      await adapter.write(makeCell("ordered-2", { namespace: "test:read-order" }));
      await adapter.write(makeCell("ordered-3", { namespace: "test:read-order" }));

      const { records } = await adapter.read({ namespace: "test:read-order" });

      assert.ok(records.length >= 3);
      for (let i = 1; i < records.length; i += 1) {
        assert.ok(
          Date.parse(records[i - 1].created_at) >= Date.parse(records[i].created_at),
          "records must be sorted newest first",
        );
      }
    });
  });
}
