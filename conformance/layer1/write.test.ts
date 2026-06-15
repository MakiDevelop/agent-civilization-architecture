import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaTestAdapter } from "../adapter.ts";

/**
 * Write Operation — ACA Layer 1 §3.1
 */
export function writeTests(adapter: AcaTestAdapter) {
  describe("Write Operation (Layer 1 §3.1)", () => {
    after(() => adapter.cleanup());

    const makeCell = (value: string, opts?: Record<string, unknown>) => ({
      agent_id: "test-agent",
      namespace: "test:write",
      memory_type: "fact" as const,
      content: { format: "text/plain", value },
      source: {
        type: "agent" as const,
        ref: "test-session",
        tier: "llm_derived" as const,
      },
      created_by: "test-principal",
      ...opts,
    });

    it("MUST return memory_id and content_hash on success", async () => {
      const result = await adapter.write(makeCell("basic write test"));
      assert.ok(result.memory_id, "must return memory_id");
      assert.ok(result.content_hash, "must return content_hash");
      assert.ok(
        Array.isArray(result.governance_applied),
        "must return governance_applied array",
      );
    });

    it("MUST produce an audit event with operation:write", async () => {
      const result = await adapter.write(makeCell("audit write test"));
      const events = await adapter.audit(result.memory_id);
      assert.ok(events.length > 0, "must have at least one audit event");
      assert.equal(events[0].operation, "write");
    });

    it("MUST reject duplicate content_hash in same namespace", async () => {
      const value = `dedup-test-${Date.now()}`;
      await adapter.write(makeCell(value));
      await assert.rejects(() => adapter.write(makeCell(value)), (err: Error) => {
        assert.ok(
          err.message.includes("Duplicate") || err.message.includes("dedup"),
          `Expected DuplicateMemoryError, got: ${err.message}`,
        );
        return true;
      });
    });

    it("MUST allow same content in different namespaces", async () => {
      const value = `cross-ns-${Date.now()}`;
      await adapter.write(makeCell(value, { namespace: "test:ns-a" }));
      const result = await adapter.write(
        makeCell(value, { namespace: "test:ns-b" }),
      );
      assert.ok(result.memory_id);
    });

    it("MUST reject empty content.value", async () => {
      await assert.rejects(() => adapter.write(makeCell("")));
    });

    it("MUST reject missing source.tier", async () => {
      const cell = makeCell("no-tier");
      (cell.source as Record<string, unknown>).tier = undefined;
      await assert.rejects(() => adapter.write(cell));
    });

    it("MUST produce audit event for rejected writes", async () => {
      const value = `rejected-audit-${Date.now()}`;
      const first = await adapter.write(makeCell(value));
      try {
        await adapter.write(makeCell(value));
      } catch {
        // expected duplicate
      }
      const events = await adapter.audit(first.memory_id);
      const rejections = events.filter((e) => e.operation === "rejected");
      assert.ok(
        rejections.length > 0,
        "Rejected write must produce audit event with operation:rejected",
      );
    });

    it("content_hash MUST be computed from format:value not value alone", async () => {
      const value = `hash-scope-${Date.now()}`;
      const r1 = await adapter.write(
        makeCell(value, {
          content: { format: "text/plain", value },
        }),
      );
      const r2 = await adapter.write(
        makeCell(value, {
          content: { format: "application/json", value },
          namespace: "test:hash-scope",
        }),
      );
      assert.notEqual(
        r1.content_hash,
        r2.content_hash,
        "Different formats with same value must produce different hashes",
      );
    });
  });
}
