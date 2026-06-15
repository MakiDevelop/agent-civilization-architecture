import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaTestAdapter, TrustProof } from "../adapter.ts";

/**
 * Tier Upgrade Operation — ACA Layer 1 §3.5
 *
 * The ONLY mechanism for tier transitions. Exempt from dedup gate.
 */
export function tierUpgradeTests(adapter: AcaTestAdapter) {
  describe("Tier Upgrade Operation (Layer 1 §3.5)", () => {
    after(() => adapter.cleanup());

    const makeCell = (tier: string) => ({
      agent_id: "test-agent",
      namespace: "test:tier-upgrade",
      memory_type: "fact" as const,
      content: {
        format: "text/plain",
        value: `tier-upgrade-${tier}-${Date.now()}-${Math.random()}`,
      },
      source: {
        type: "agent" as const,
        ref: "test",
        tier: tier as "raw_source" | "llm_derived" | "human_confirmed",
      },
      created_by: "test-principal",
    });

    const humanProof: TrustProof = {
      tier: "human_confirmed",
      confirmed_by: "human-reviewer",
      confirmed_at: new Date().toISOString(),
      evidence_ids: [],
      method: "human_review",
    };

    const llmProof: TrustProof = {
      tier: "llm_derived",
      confirmed_by: "agent-processor",
      confirmed_at: new Date().toISOString(),
      evidence_ids: [],
      method: "automated_check",
    };

    it("MUST allow raw_source → llm_derived", async () => {
      const w = await adapter.write(makeCell("raw_source"));
      const result = await adapter.tierUpgrade(w.memory_id, "llm_derived", llmProof);
      assert.equal(result.old_tier, "raw_source");
      assert.equal(result.new_tier, "llm_derived");
    });

    it("MUST allow raw_source → human_confirmed with TrustProof", async () => {
      const w = await adapter.write(makeCell("raw_source"));
      const result = await adapter.tierUpgrade(w.memory_id, "human_confirmed", humanProof);
      assert.equal(result.new_tier, "human_confirmed");
    });

    it("MUST allow llm_derived → human_confirmed with TrustProof", async () => {
      const w = await adapter.write(makeCell("llm_derived"));
      const result = await adapter.tierUpgrade(w.memory_id, "human_confirmed", humanProof);
      assert.equal(result.new_tier, "human_confirmed");
    });

    it("MUST reject tier downgrade (human_confirmed → llm_derived)", async () => {
      const w = await adapter.write(makeCell("human_confirmed"));
      await assert.rejects(
        () => adapter.tierUpgrade(w.memory_id, "llm_derived", llmProof),
        (err: Error) => {
          assert.ok(
            err.message.includes("downgrade") || err.message.includes("Downgrade"),
            `Expected TierDowngradeError, got: ${err.message}`,
          );
          return true;
        },
      );
    });

    it("MUST reject tier downgrade (llm_derived → raw_source)", async () => {
      const w = await adapter.write(makeCell("llm_derived"));
      await assert.rejects(() =>
        adapter.tierUpgrade(w.memory_id, "raw_source" as "llm_derived", {
          ...llmProof,
          tier: "raw_source" as "llm_derived",
        }),
      );
    });

    it("MUST NOT trigger dedup gate (same content, upgraded tier)", async () => {
      const w = await adapter.write(makeCell("raw_source"));
      const result = await adapter.tierUpgrade(w.memory_id, "human_confirmed", humanProof);
      assert.ok(result.memory_id, "Tier upgrade on existing content must succeed (dedup exempt)");
    });

    it("MUST produce audit event with operation:tier_upgrade", async () => {
      const w = await adapter.write(makeCell("raw_source"));
      await adapter.tierUpgrade(w.memory_id, "human_confirmed", humanProof);
      const events = await adapter.audit(w.memory_id);
      const upgrades = events.filter((e) => e.operation === "tier_upgrade");
      assert.ok(upgrades.length > 0, "Must produce tier_upgrade audit event");
    });

    it("upgraded memory MUST be readable with new tier", async () => {
      const w = await adapter.write(makeCell("raw_source"));
      await adapter.tierUpgrade(w.memory_id, "human_confirmed", humanProof);
      const { records } = await adapter.read({ memory_id: w.memory_id });
      assert.equal(records.length, 1);
      assert.equal(records[0].source.tier, "human_confirmed");
    });
  });
}
