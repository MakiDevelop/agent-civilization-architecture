import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaTestAdapter, TrustProof } from "../adapter.ts";

/**
 * TrustProof — ACA Layer 2 §2.2
 */
export function trustProofTests(adapter: AcaTestAdapter) {
  describe("TrustProof (Layer 2 §2.2)", () => {
    after(() => adapter.cleanup());

    const makeCell = (tier = "raw_source") => ({
      agent_id: "test-agent",
      namespace: "test:trust-proof",
      memory_type: "fact" as const,
      content: {
        format: "text/plain",
        value: `trust-proof-${tier}-${Date.now()}-${Math.random()}`,
      },
      source: {
        type: "agent" as const,
        ref: "test-session",
        tier: tier as "raw_source" | "llm_derived" | "human_confirmed",
      },
      created_by: "test-principal",
    });

    const validProof = (tier: "llm_derived" | "human_confirmed"): TrustProof => ({
      tier,
      confirmed_by: tier === "human_confirmed" ? "human-reviewer" : "agent-processor",
      confirmed_at: new Date().toISOString(),
      evidence_ids: [`evidence-${Date.now()}-${Math.random()}`],
      method: tier === "human_confirmed" ? "human_review" : "automated_check",
    });

    it("MUST require TrustProof on tier upgrade", async () => {
      const written = await adapter.write(makeCell());

      await assert.rejects(() =>
        adapter.tierUpgrade(
          written.memory_id,
          "human_confirmed",
          undefined as unknown as TrustProof,
        ),
      );
    });

    it("MUST require confirmed_by, confirmed_at, evidence_ids, and method", async () => {
      const cases = [
        { confirmed_by: "" },
        { confirmed_at: "" },
        { evidence_ids: undefined },
        { method: undefined },
      ];

      for (const patch of cases) {
        const written = await adapter.write(makeCell());
        const invalid = {
          ...validProof("human_confirmed"),
          ...patch,
        } as unknown as TrustProof;

        await assert.rejects(() =>
          adapter.tierUpgrade(written.memory_id, "human_confirmed", invalid),
        );
      }
    });

    it("human_confirmed proof.tier MUST match requested tier", async () => {
      const written = await adapter.write(makeCell());

      await assert.rejects(() =>
        adapter.tierUpgrade(written.memory_id, "human_confirmed", validProof("llm_derived")),
      );
    });

    it("structurally invalid proof MUST be rejected", async () => {
      const written = await adapter.write(makeCell());
      const invalid = {
        tier: "human_confirmed",
        confirmed_by: "human-reviewer",
        confirmed_at: new Date().toISOString(),
        evidence_ids: `evidence-${Date.now()}-${Math.random()}`,
        method: "not-a-method",
      } as unknown as TrustProof;

      await assert.rejects(() =>
        adapter.tierUpgrade(written.memory_id, "human_confirmed", invalid),
      );
    });

    it("valid TrustProof MUST be persisted on upgraded memory", async () => {
      const written = await adapter.write(makeCell());
      const proof = validProof("human_confirmed");
      await adapter.tierUpgrade(written.memory_id, "human_confirmed", proof);

      const { records } = await adapter.read({ memory_id: written.memory_id });

      assert.equal(records.length, 1);
      assert.deepEqual(records[0].trust_proof, proof);
    });
  });
}
