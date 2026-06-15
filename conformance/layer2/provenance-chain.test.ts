import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaTestAdapter, TrustProof } from "../adapter.ts";

/**
 * ProvenanceChain — ACA Layer 2 §2.3
 */
export function provenanceChainTests(adapter: AcaTestAdapter) {
  describe("ProvenanceChain (Layer 2 §2.3)", () => {
    after(() => adapter.cleanup());

    const makeCell = (value: string, tier = "raw_source") => ({
      agent_id: "test-agent",
      namespace: "test:provenance",
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

    const proof = (tier: "llm_derived" | "human_confirmed"): TrustProof => ({
      tier,
      confirmed_by: tier === "human_confirmed" ? "human-reviewer" : "agent-processor",
      confirmed_at: new Date().toISOString(),
      evidence_ids: [`evidence-${Date.now()}-${Math.random()}`],
      method: tier === "human_confirmed" ? "human_review" : "automated_check",
    });

    it("tier upgrade MUST append transition with correct tier_before and tier_after", async () => {
      const written = await adapter.write(makeCell("tier-upgrade-chain"));
      await adapter.tierUpgrade(written.memory_id, "llm_derived", proof("llm_derived"));

      const { records } = await adapter.read({ memory_id: written.memory_id });
      const chain = records[0].provenance_chain;
      const transition = chain?.transitions.at(-1);

      assert.ok(chain, "upgraded record must have provenance_chain");
      assert.equal(transition?.type, "tier_upgrade");
      assert.equal(transition?.tier_before, "raw_source");
      assert.equal(transition?.tier_after, "llm_derived");
      assert.equal(transition?.from_memory_id, written.memory_id);
      assert.equal(transition?.to_memory_id, written.memory_id);
    });

    it("transfer MUST preserve source chain and append transfer transition", async () => {
      const written = await adapter.write(makeCell("transfer-chain"));
      await adapter.tierUpgrade(written.memory_id, "llm_derived", proof("llm_derived"));
      const before = await adapter.read({ memory_id: written.memory_id });
      const beforeTransitions =
        before.records[0].provenance_chain?.transitions.length ?? 0;

      const transfer = await adapter.transfer(
        written.memory_id,
        "test:provenance-target",
        "test-agent-target",
      );
      const after = await adapter.read({ memory_id: transfer.new_memory_id });
      const chain = after.records[0].provenance_chain;
      const transition = chain?.transitions.at(-1);

      assert.ok(chain, "transferred record must have provenance_chain");
      assert.ok(chain.transitions.length >= beforeTransitions + 1);
      assert.equal(transition?.type, "transfer");
      assert.equal(transition?.from_memory_id, written.memory_id);
      assert.equal(transition?.to_memory_id, transfer.new_memory_id);
    });

    it("supersede MUST inherit old chain and append supersede transition", async () => {
      const target = await adapter.write(makeCell("supersede-chain"));
      await adapter.tierUpgrade(target.memory_id, "human_confirmed", proof("human_confirmed"));
      const before = await adapter.read({ memory_id: target.memory_id });
      const beforeTransitions =
        before.records[0].provenance_chain?.transitions.length ?? 0;

      const replacement = await adapter.supersede(
        makeCell("supersede-chain-replacement", "human_confirmed"),
        target.memory_id,
      );
      const after = await adapter.read({ memory_id: replacement.memory_id });
      const chain = after.records[0].provenance_chain;
      const transition = chain?.transitions.at(-1);

      assert.ok(chain, "replacement record must have provenance_chain");
      assert.ok(chain.transitions.length >= beforeTransitions + 1);
      assert.equal(transition?.type, "supersede");
      assert.equal(transition?.from_memory_id, target.memory_id);
      assert.equal(transition?.to_memory_id, replacement.memory_id);
    });

    it("chain MUST be append-only: transitions array grows and never shrinks", async () => {
      const written = await adapter.write(makeCell("append-only-chain"));
      await adapter.tierUpgrade(written.memory_id, "llm_derived", proof("llm_derived"));
      const first = await adapter.read({ memory_id: written.memory_id });
      const firstTransitions =
        first.records[0].provenance_chain?.transitions.length ?? 0;

      await adapter.tierUpgrade(
        written.memory_id,
        "human_confirmed",
        proof("human_confirmed"),
      );
      const second = await adapter.read({ memory_id: written.memory_id });
      const secondTransitions =
        second.records[0].provenance_chain?.transitions.length ?? 0;

      const transfer = await adapter.transfer(
        written.memory_id,
        "test:provenance-append-target",
        "test-agent-target",
      );
      const third = await adapter.read({ memory_id: transfer.new_memory_id });
      const thirdTransitions =
        third.records[0].provenance_chain?.transitions.length ?? 0;

      assert.ok(firstTransitions > 0);
      assert.ok(secondTransitions >= firstTransitions + 1);
      assert.ok(thirdTransitions >= secondTransitions + 1);
    });
  });
}
