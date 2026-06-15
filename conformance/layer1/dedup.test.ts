import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaTestAdapter } from "../adapter.ts";

/**
 * Content-Hash Dedup — ACA Layer 1 §4.1
 */
export function dedupTests(adapter: AcaTestAdapter) {
  describe("Content-Hash Dedup (Layer 1 §4.1)", () => {
    after(() => adapter.cleanup());

    const makeCell = (
      value: string,
      opts?: { namespace?: string; format?: string },
    ) => ({
      agent_id: "test-agent",
      namespace: opts?.namespace ?? "test:dedup",
      memory_type: "fact" as const,
      content: {
        format: opts?.format ?? "text/plain",
        value,
      },
      source: {
        type: "agent" as const,
        ref: "test-session",
        tier: "llm_derived" as const,
      },
      created_by: "test-principal",
    });

    it("same content and format in same namespace MUST raise DuplicateMemoryError", async () => {
      const value = `same-format-${Date.now()}-${Math.random()}`;
      await adapter.write(makeCell(value));

      await assert.rejects(() => adapter.write(makeCell(value)), (err: Error) => {
        assert.ok(
          err.message.includes("Duplicate") || err.message.includes("dedup"),
          `Expected DuplicateMemoryError, got: ${err.message}`,
        );
        return true;
      });
    });

    it("same content with different format MUST produce a different hash and be allowed", async () => {
      const value = `different-format-${Date.now()}-${Math.random()}`;
      const text = await adapter.write(makeCell(value, { format: "text/plain" }));
      const json = await adapter.write(
        makeCell(value, {
          format: "application/json",
        }),
      );

      assert.ok(json.memory_id);
      assert.notEqual(text.content_hash, json.content_hash);
    });

    it("same content in different namespace MUST be allowed", async () => {
      const value = `different-namespace-${Date.now()}-${Math.random()}`;
      await adapter.write(makeCell(value, { namespace: "test:dedup-a" }));
      const result = await adapter.write(
        makeCell(value, { namespace: "test:dedup-b" }),
      );

      assert.ok(result.memory_id);
    });

    it("hash MUST be computed from format:value, not value alone", async () => {
      const value = `hash-format-prefix-${Date.now()}-${Math.random()}`;
      const r1 = await adapter.write(
        makeCell(value, {
          namespace: "test:dedup-hash",
          format: "text/plain",
        }),
      );
      const r2 = await adapter.write(
        makeCell(value, {
          namespace: "test:dedup-hash",
          format: "application/json",
        }),
      );

      assert.notEqual(
        r1.content_hash,
        r2.content_hash,
        "format must be included in content_hash input",
      );
    });
  });
}
