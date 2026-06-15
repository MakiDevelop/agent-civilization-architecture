import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaTestAdapter } from "../adapter.ts";

/**
 * Consumer Responsibilities — ACA Layer 2 §4.3
 */
export function consumerTests(adapter: AcaTestAdapter) {
  describe("Consumer Responsibilities (Layer 2 §4.3)", () => {
    after(() => adapter.cleanup());

    const makeCell = (value: string, tier: unknown) => ({
      agent_id: "test-agent",
      namespace: "test:consumer",
      memory_type: "fact" as const,
      content: {
        format: "text/plain",
        value: `${value}-${Date.now()}-${Math.random()}`,
      },
      source: {
        type: "agent" as const,
        ref: "test-session",
        tier,
      },
      created_by: "test-principal",
    });

    it("missing tier MUST fail closed instead of being silently promoted", async () => {
      const cell = makeCell("missing-tier", undefined);

      await assert.rejects(() => adapter.write(cell));
    });

    it("malformed tier MUST fail closed instead of being silently promoted", async () => {
      const cell = makeCell("malformed-tier", "trusted_by_default");

      await assert.rejects(() => adapter.write(cell));
    });

    it("missing tier MUST NOT be silently promoted to llm_derived", async () => {
      const cell = makeCell("missing-not-llm", undefined);

      try {
        const result = await adapter.write(cell);
        const { records } = await adapter.read({ memory_id: result.memory_id });
        assert.notEqual(records[0].source.tier, "llm_derived");
      } catch (err) {
        assert.ok(err, "rejecting malformed input is a valid fail-closed behavior");
      }
    });

    it("malformed tier MUST NOT be silently promoted to human_confirmed", async () => {
      const cell = makeCell("malformed-not-human", "humanish");

      try {
        const result = await adapter.write(cell);
        const { records } = await adapter.read({ memory_id: result.memory_id });
        assert.notEqual(records[0].source.tier, "human_confirmed");
      } catch (err) {
        assert.ok(err, "rejecting malformed input is a valid fail-closed behavior");
      }
    });

    it("raw_source MUST remain raw_source unless an explicit tier upgrade occurs", async () => {
      const result = await adapter.write(makeCell("raw-remains-raw", "raw_source"));
      const { records } = await adapter.read({ memory_id: result.memory_id });

      assert.equal(records.length, 1);
      assert.equal(records[0].source.tier, "raw_source");
    });
  });
}
