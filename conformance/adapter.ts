/**
 * ACA Conformance Test Adapter
 *
 * Implement this interface to test your ACA implementation against
 * the conformance suite. The tests verify protocol behavior, not
 * implementation internals.
 */

export interface MemoryCell {
  aca_version: string;
  memory_id: string;
  status: "active" | "superseded" | "revoked" | "expired";
  agent_id: string;
  namespace: string;
  memory_type: "fact" | "preference" | "constraint" | "lesson" | "risk";
  content: { format: string; value: string };
  source: {
    type: "human" | "agent" | "system" | "document";
    ref: string;
    tier: "raw_source" | "llm_derived" | "human_confirmed";
  };
  content_hash: string;
  created_at: string;
  created_by: string;
  valid_until?: string | null;
  supersedes?: string | null;
  trust_proof?: TrustProof | null;
  provenance_chain?: ProvenanceChain | null;
}

export interface TrustProof {
  tier: "raw_source" | "llm_derived" | "human_confirmed";
  confirmed_by: string;
  confirmed_at: string;
  evidence_ids: string[];
  method:
    | "human_review"
    | "peer_consensus"
    | "automated_check"
    | "cross_reference";
}

export interface ProvenanceChain {
  origin: {
    memory_id: string;
    agent_id: string;
    namespace: string;
    tier: string;
    created_at: string;
  };
  transitions: Array<{
    type: "transfer" | "supersede" | "tier_upgrade";
    from_memory_id: string;
    to_memory_id: string;
    performed_by: string;
    performed_at: string;
    tier_before: string;
    tier_after: string;
  }>;
}

export interface AuditEvent {
  event_id: string;
  memory_id: string;
  operation: string;
  principal_id: string;
  timestamp: string;
  correlation_id?: string | null;
  details?: string | null;
}

export interface WriteResult {
  memory_id: string;
  content_hash: string;
  governance_applied: string[];
}

export interface SupersedeResult {
  memory_id: string;
  superseded_id: string;
  governance_applied: string[];
}

export interface TierUpgradeResult {
  memory_id: string;
  old_tier: string;
  new_tier: string;
}

export interface ReadResult {
  records: MemoryCell[];
  next_cursor: string | null;
}

export interface AcaTestAdapter {
  write(cell: Partial<MemoryCell>): Promise<WriteResult>;

  read(query: {
    memory_id?: string;
    namespace?: string;
    memory_type?: string;
    agent_id?: string;
    limit?: number;
    filterInactive?: boolean;
  }): Promise<ReadResult>;

  supersede(
    newCell: Partial<MemoryCell>,
    targetId: string,
  ): Promise<SupersedeResult>;

  revoke(memoryId: string): Promise<{ memory_id: string; status: string; already_revoked: boolean }>;

  tierUpgrade(
    memoryId: string,
    newTier: "llm_derived" | "human_confirmed",
    trustProof: TrustProof,
  ): Promise<TierUpgradeResult>;

  transfer(
    memoryId: string,
    targetNamespace: string,
    targetAgentId: string,
  ): Promise<{ new_memory_id: string; source_memory_id: string }>;

  expire(memoryId: string): Promise<{ memory_id: string; status: string }>;

  audit(memoryId: string): Promise<AuditEvent[]>;

  cleanup(): Promise<void>;
}
