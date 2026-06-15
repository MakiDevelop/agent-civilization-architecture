import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaTestAdapter } from "../adapter.ts";

/**
 * Supersede Operation — ACA Layer 1 §3.3
 */
export function supersedeTests(adapter: AcaTestAdapter) {
  describe("Supersede Operation (Layer 1 §3.3)", () => {
    after(() => adapter.cleanup());

    const makeCell = (value: string, tier = "human_confirmed") => ({
      agent_id: "test-agent",
      namespace: "test:supersede",
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

    it("MUST return new memory_id and superseded_id", async () => {
      const target = await adapter.write(makeCell("target"));
      const result = await adapter.supersede(makeCell("replacement"), target.memory_id);

      assert.ok(result.memory_id);
      assert.equal(result.superseded_id, target.memory_id);
      assert.ok(result.memory_id !== result.superseded_id);
    });

    it("target status MUST become superseded", async () => {
      const target = await adapter.write(makeCell("status-target"));
      await adapter.supersede(makeCell("status-replacement"), target.memory_id);

      const { records } = await adapter.read({
        memory_id: target.memory_id,
        filterInactive: false,
      });

      assert.equal(records.length, 1);
      assert.equal(records[0].status, "superseded");
    });

    it("superseded record MUST be excluded from default reads", async () => {
      const target = await adapter.write(makeCell("filtered-target"));
      await adapter.supersede(makeCell("filtered-replacement"), target.memory_id);

      const { records } = await adapter.read({ memory_id: target.memory_id });

      assert.equal(records.length, 0);
    });

    it("MUST reject supersede of non-active target", async () => {
      const target = await adapter.write(makeCell("non-active-target"));
      await adapter.supersede(makeCell("non-active-replacement"), target.memory_id);

      await assert.rejects(() =>
        adapter.supersede(makeCell("non-active-second-replacement"), target.memory_id),
      );
    });

    it("MUST produce audit event with operation:supersede", async () => {
      const target = await adapter.write(makeCell("audit-target"));
      const result = await adapter.supersede(makeCell("audit-replacement"), target.memory_id);

      const targetEvents = await adapter.audit(target.memory_id);
      const newEvents = await adapter.audit(result.memory_id);
      const events = [...targetEvents, ...newEvents];

      assert.ok(
        events.some((event) => event.operation === "supersede"),
        "must produce supersede audit event",
      );
    });
  });
}
