import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import type { AcaTestAdapter, TrustProof } from "../adapter.ts";

/**
 * Audit Operation — ACA Layer 1 §3.8
 */
export function auditTests(adapter: AcaTestAdapter) {
  describe("Audit Operation (Layer 1 §3.8)", () => {
    after(() => adapter.cleanup());

    const makeCell = (value: string, tier = "raw_source") => ({
      agent_id: "test-agent",
      namespace: "test:audit",
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

    const humanProof = (): TrustProof => ({
      tier: "human_confirmed",
      confirmed_by: "human-reviewer",
      confirmed_at: new Date().toISOString(),
      evidence_ids: [`evidence-${Date.now()}-${Math.random()}`],
      method: "human_review",
    });

    it("MUST return events ordered by timestamp ASC", async () => {
      const written = await adapter.write(makeCell("ordered-events"));
      await adapter.tierUpgrade(written.memory_id, "human_confirmed", humanProof());
      await adapter.expire(written.memory_id);

      const events = await adapter.audit(written.memory_id);

      assert.ok(events.length >= 3);
      for (let i = 1; i < events.length; i += 1) {
        assert.ok(
          Date.parse(events[i - 1].timestamp) <= Date.parse(events[i].timestamp),
          "audit events must be oldest first",
        );
      }
    });

    it("MUST include write, supersede, revoke, tier_upgrade, and expire events", async () => {
      const upgraded = await adapter.write(makeCell("event-tier-upgrade"));
      await adapter.tierUpgrade(upgraded.memory_id, "human_confirmed", humanProof());

      const revoked = await adapter.write(makeCell("event-revoke", "human_confirmed"));
      await adapter.revoke(revoked.memory_id);

      const expired = await adapter.write(makeCell("event-expire", "human_confirmed"));
      await adapter.expire(expired.memory_id);

      const superseded = await adapter.write(makeCell("event-supersede", "human_confirmed"));
      const replacement = await adapter.supersede(
        makeCell("event-supersede-replacement", "human_confirmed"),
        superseded.memory_id,
      );

      const eventSets = await Promise.all([
        adapter.audit(upgraded.memory_id),
        adapter.audit(revoked.memory_id),
        adapter.audit(expired.memory_id),
        adapter.audit(superseded.memory_id),
        adapter.audit(replacement.memory_id),
      ]);
      const operations = new Set(eventSets.flat().map((event) => event.operation));

      assert.ok(operations.has("write"), "must include write events");
      assert.ok(operations.has("tier_upgrade"), "must include tier_upgrade events");
      assert.ok(operations.has("revoke"), "must include revoke events");
      assert.ok(operations.has("expire"), "must include expire events");
      assert.ok(operations.has("supersede"), "must include supersede events");
    });

    it("MUST be accessible even for revoked and expired records", async () => {
      const revoked = await adapter.write(makeCell("accessible-revoked"));
      await adapter.revoke(revoked.memory_id);
      const expired = await adapter.write(makeCell("accessible-expired"));
      await adapter.expire(expired.memory_id);

      const revokedEvents = await adapter.audit(revoked.memory_id);
      const expiredEvents = await adapter.audit(expired.memory_id);

      assert.ok(revokedEvents.length > 0);
      assert.ok(expiredEvents.length > 0);
    });

    it("MUST be append-only from the public protocol surface", async () => {
      const written = await adapter.write(makeCell("append-only"));
      const before = await adapter.audit(written.memory_id);
      await adapter.audit(written.memory_id);
      const afterReadOnlyAccess = await adapter.audit(written.memory_id);
      await adapter.revoke(written.memory_id);
      const afterMutation = await adapter.audit(written.memory_id);

      assert.deepEqual(afterReadOnlyAccess, before, "audit reads must not mutate events");
      assert.ok(
        afterMutation.length >= before.length,
        "later operations must append without deleting previous events",
      );
      for (const event of before) {
        assert.ok(
          afterMutation.some((candidate) => candidate.event_id === event.event_id),
          `missing prior audit event: ${event.event_id}`,
        );
      }
    });
  });
}
