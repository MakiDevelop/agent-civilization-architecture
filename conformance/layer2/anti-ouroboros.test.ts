import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaTestAdapter } from "../adapter.ts";

/**
 * Anti-Ouroboros Rule — ACA Layer 2 §3.1
 *
 * "An llm_derived MemoryCell MUST NOT supersede another llm_derived
 *  MemoryCell without human intervention."
 *
 * This is ACA's signature innovation: the first protocol-level defense
 * against runtime belief amplification in multi-agent systems.
 */
export function antiOuroborosTests(adapter: AcaTestAdapter) {
  describe("Anti-Ouroboros Rule (Layer 2 §3.1)", () => {
    after(() => adapter.cleanup());

    const makeCell = (tier: string, ns = "test:ouroboros") => ({
      agent_id: "test-agent",
      namespace: ns,
      memory_type: "fact" as const,
      content: {
        format: "text/plain",
        value: `test-${tier}-${Date.now()}-${Math.random()}`,
      },
      source: {
        type: "agent" as const,
        ref: "test",
        tier: tier as "raw_source" | "llm_derived" | "human_confirmed",
      },
      created_by: "test-principal",
    });

    it("MUST reject llm_derived superseding llm_derived", async () => {
      const target = await adapter.write(makeCell("llm_derived"));
      await assert.rejects(
        () => adapter.supersede(makeCell("llm_derived"), target.memory_id),
        (err: Error) => {
          assert.ok(
            err.message.includes("AntiOuroboros") ||
              err.message.includes("anti_ouroboros") ||
              err.message.includes("ouroboros"),
            `Expected AntiOuroborosError, got: ${err.message}`,
          );
          return true;
        },
      );
    });

    it("MUST allow human_confirmed superseding llm_derived", async () => {
      const target = await adapter.write(makeCell("llm_derived"));
      const result = await adapter.supersede(
        makeCell("human_confirmed"),
        target.memory_id,
      );
      assert.ok(result.memory_id);
      assert.equal(result.superseded_id, target.memory_id);
    });

    it("MUST allow raw_source superseding llm_derived", async () => {
      const target = await adapter.write(makeCell("llm_derived"));
      const result = await adapter.supersede(
        makeCell("raw_source"),
        target.memory_id,
      );
      assert.ok(result.memory_id);
    });

    it("MUST allow llm_derived superseding raw_source", async () => {
      const target = await adapter.write(makeCell("raw_source"));
      const result = await adapter.supersede(
        makeCell("llm_derived"),
        target.memory_id,
      );
      assert.ok(result.memory_id);
    });

    it("MUST allow human_confirmed superseding human_confirmed", async () => {
      const target = await adapter.write(makeCell("human_confirmed"));
      const result = await adapter.supersede(
        makeCell("human_confirmed"),
        target.memory_id,
      );
      assert.ok(result.memory_id);
    });

    it("MUST allow llm_derived superseding human_confirmed", async () => {
      const target = await adapter.write(makeCell("human_confirmed"));
      const result = await adapter.supersede(
        makeCell("llm_derived"),
        target.memory_id,
      );
      assert.ok(result.memory_id);
    });

    it("MUST allow raw_source superseding raw_source", async () => {
      const target = await adapter.write(makeCell("raw_source"));
      const result = await adapter.supersede(
        makeCell("raw_source"),
        target.memory_id,
      );
      assert.ok(result.memory_id);
    });

    it("MUST allow raw_source superseding human_confirmed", async () => {
      const target = await adapter.write(makeCell("human_confirmed"));
      const result = await adapter.supersede(
        makeCell("raw_source"),
        target.memory_id,
      );
      assert.ok(result.memory_id);
    });

    it("MUST allow human_confirmed superseding raw_source", async () => {
      const target = await adapter.write(makeCell("raw_source"));
      const result = await adapter.supersede(
        makeCell("human_confirmed"),
        target.memory_id,
      );
      assert.ok(result.memory_id);
    });

    it("rejected supersede MUST produce audit event with operation:rejected", async () => {
      const target = await adapter.write(makeCell("llm_derived"));
      try {
        await adapter.supersede(makeCell("llm_derived"), target.memory_id);
      } catch {
        // expected
      }
      const events = await adapter.audit(target.memory_id);
      const rejections = events.filter((e) => e.operation === "rejected");
      assert.ok(
        rejections.length > 0,
        "Rejected supersede must produce an audit event with operation:rejected",
      );
    });
  });
}
