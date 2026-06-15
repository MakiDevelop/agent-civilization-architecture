import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaTestAdapter, TrustProof } from "../adapter.ts";

/**
 * Tier Transition Rules — ACA Layer 2 §3.2
 */
export function tierTransitionsTests(adapter: AcaTestAdapter) {
  describe("Tier Transition Rules (Layer 2 §3.2)", () => {
    after(() => adapter.cleanup());

    const makeCell = (tier: string) => ({
      agent_id: "test-agent",
      namespace: "test:tier-transitions",
      memory_type: "fact" as const,
      content: {
        format: "text/plain",
        value: `tier-transition-${tier}-${Date.now()}-${Math.random()}`,
      },
      source: {
        type: "agent" as const,
        ref: "test-session",
        tier: tier as "raw_source" | "llm_derived" | "human_confirmed",
      },
      created_by: "test-principal",
    });

    const proof = (
      tier: "raw_source" | "llm_derived" | "human_confirmed",
    ): TrustProof => ({
      tier,
      confirmed_by: "test-confirmer",
      confirmed_at: new Date().toISOString(),
      evidence_ids: [`evidence-${Date.now()}-${Math.random()}`],
      method: tier === "human_confirmed" ? "human_review" : "automated_check",
    });

    it("MUST allow raw_source → llm_derived", async () => {
      const written = await adapter.write(makeCell("raw_source"));
      const result = await adapter.tierUpgrade(
        written.memory_id,
        "llm_derived",
        proof("llm_derived"),
      );

      assert.equal(result.old_tier, "raw_source");
      assert.equal(result.new_tier, "llm_derived");
    });

    it("MUST allow raw_source → human_confirmed", async () => {
      const written = await adapter.write(makeCell("raw_source"));
      const result = await adapter.tierUpgrade(
        written.memory_id,
        "human_confirmed",
        proof("human_confirmed"),
      );

      assert.equal(result.old_tier, "raw_source");
      assert.equal(result.new_tier, "human_confirmed");
    });

    it("MUST allow llm_derived → human_confirmed", async () => {
      const written = await adapter.write(makeCell("llm_derived"));
      const result = await adapter.tierUpgrade(
        written.memory_id,
        "human_confirmed",
        proof("human_confirmed"),
      );

      assert.equal(result.old_tier, "llm_derived");
      assert.equal(result.new_tier, "human_confirmed");
    });

    it("MUST reject human_confirmed → llm_derived", async () => {
      const written = await adapter.write(makeCell("human_confirmed"));

      await assert.rejects(() =>
        adapter.tierUpgrade(written.memory_id, "llm_derived", proof("llm_derived")),
      );
    });

    it("MUST reject llm_derived → raw_source", async () => {
      const written = await adapter.write(makeCell("llm_derived"));

      await assert.rejects(() =>
        adapter.tierUpgrade(
          written.memory_id,
          "raw_source" as "llm_derived",
          proof("raw_source"),
        ),
      );
    });

    it("MUST reject human_confirmed → raw_source", async () => {
      const written = await adapter.write(makeCell("human_confirmed"));

      await assert.rejects(() =>
        adapter.tierUpgrade(
          written.memory_id,
          "raw_source" as "llm_derived",
          proof("raw_source"),
        ),
      );
    });

    it("same-tier transition MUST be rejected because it is not an upgrade", async () => {
      const raw = await adapter.write(makeCell("raw_source"));
      const llm = await adapter.write(makeCell("llm_derived"));
      const human = await adapter.write(makeCell("human_confirmed"));

      await assert.rejects(() =>
        adapter.tierUpgrade(
          raw.memory_id,
          "raw_source" as "llm_derived",
          proof("raw_source"),
        ),
      );
      await assert.rejects(() =>
        adapter.tierUpgrade(llm.memory_id, "llm_derived", proof("llm_derived")),
      );
      await assert.rejects(() =>
        adapter.tierUpgrade(
          human.memory_id,
          "human_confirmed",
          proof("human_confirmed"),
        ),
      );
    });
  });
}
