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

// --- Layer 3: Identity ---

export interface Principal {
  principal_id: string;
  principal_type: "human" | "agent" | "system";
  display_name?: string;
  status: "active" | "suspended" | "revoked";
}

export interface Grant {
  grant_id: string;
  granter_principal_id: string;
  grantee_principal_id: string;
  namespace_id: string;
  permissions: Array<"read" | "write" | "transfer" | "admin">;
  granted_at: string;
  expires_at?: string | null;
  status: "active" | "revoked";
}

export interface AuthorizeResult {
  allowed: boolean;
  reason?: string;
}

export interface AcaIdentityAdapter {
  registerPrincipal(
    principalId: string,
    principalType: "human" | "agent" | "system",
    displayName?: string,
  ): Promise<Principal>;

  authenticate(credentialData: unknown): Promise<Principal>;

  authorize(
    principalId: string,
    namespaceId: string,
    permission: "read" | "write" | "transfer" | "admin",
  ): Promise<AuthorizeResult>;

  grantPermission(
    granterPrincipalId: string,
    granteePrincipalId: string,
    namespaceId: string,
    permissions: Array<"read" | "write" | "transfer" | "admin">,
  ): Promise<Grant>;

  revokeGrant(grantId: string, revokedBy: string): Promise<{ grant_id: string; status: "revoked" }>;

  getPrincipal(principalId: string): Promise<Principal | null>;

  suspendPrincipal(principalId: string): Promise<Principal>;

  cleanup(): Promise<void>;
}

// --- Layer 4: Authority ---

export type Capability =
  | "write_memory" | "read_memory" | "supersede_memory" | "revoke_memory"
  | "transfer_memory" | "tier_upgrade" | "propose_decision" | "ratify_decision"
  | "veto_decision" | "grant_authority" | "revoke_authority" | "escalate"
  | "execute_tool" | "break_glass" | "modify_governance"
  | string;

export type Constraint =
  | "cannot_deploy" | "cannot_delete_memory" | "cannot_override_decision"
  | "cannot_self_approve" | "cannot_modify_governance" | "requires_independent_review"
  | string;

export interface Role {
  role_id: string;
  display_name: string;
  scope: string;
  capabilities: Capability[];
  constraints: Constraint[];
  risk_threshold?: number | null;
  escalation_target?: string | null;
  status: "active" | "suspended" | "revoked";
}

export interface RoleAssignment {
  assignment_id: string;
  principal_id: string;
  role_id: string;
  assigned_by: string;
  assigned_at: string;
  expires_at?: string | null;
  scope_namespace?: string | null;
  delegation_allowed: boolean;
  status: "active" | "revoked";
}

export interface CheckAuthorityResult {
  allowed: boolean;
  roles: string[];
  constraints_applied: string[];
}

export interface IndependentReviewRecord {
  review_id: string;
  decision_id: string;
  reviewer_principal_id: string;
  reviewer_role_id: string;
  position: "approve" | "oppose" | "conditional_approve";
  reasoning: string;
  risk_categories_addressed: string[];
  evidence_ids: string[];
}

export interface AcaAuthorityAdapter {
  defineRole(role: Omit<Role, "status">): Promise<{ role_id: string; status: "active" }>;

  assignRole(
    principalId: string,
    roleId: string,
    assignedBy: string,
    opts?: { scopeNamespace?: string; delegationAllowed?: boolean },
  ): Promise<RoleAssignment>;

  revokeRoleAssignment(assignmentId: string, revokedBy: string): Promise<{ assignment_id: string; status: "revoked" }>;

  checkAuthority(
    principalId: string,
    action: string,
    namespace?: string,
  ): Promise<CheckAuthorityResult>;

  escalate(
    decisionId: string,
    reason: string,
    escalatedBy: string,
  ): Promise<{ escalation_id: string; target_role: string; status: "pending" }>;

  submitIndependentReview(
    decisionId: string,
    position: "approve" | "oppose" | "conditional_approve",
    reasoning: string,
    riskCategories: string[],
    evidenceIds: string[],
  ): Promise<IndependentReviewRecord>;

  getRole(roleId: string): Promise<Role | null>;

  cleanup(): Promise<void>;
}

// --- Layer 5: Decision ---

export type DecisionStatus = "proposed" | "under_review" | "ratified" | "in_effect" | "superseded" | "revoked";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface DecisionProposal {
  assumptions: string[];
  evidence_ids: string[];
  risks: string[];
  trade_offs: string[];
  rollback_plan: string;
  implementation_steps: string[];
}

export interface Decision {
  decision_id: string;
  title: string;
  status: DecisionStatus;
  risk_level: RiskLevel;
  proposer_principal_id: string;
  proposal: DecisionProposal;
  reviews: IndependentReviewRecord[];
  ratification: { ratified_by: string; rationale: string; review_addressal?: string | null } | null;
  created_at: string;
  effective_at?: string | null;
  review_deadline?: string | null;
  supersedes?: string | null;
}

export interface AcaDecisionAdapter {
  proposeDecision(
    title: string,
    riskLevel: RiskLevel,
    proposal: DecisionProposal,
    proposerPrincipalId: string,
  ): Promise<{ decision_id: string; status: "proposed"; risk_level: RiskLevel }>;

  reviewDecision(decisionId: string): Promise<{ decision_id: string; status: "under_review"; review_deadline: string }>;

  ratifyDecision(
    decisionId: string,
    ratifiedBy: string,
    rationale: string,
    reviewAddressal?: string,
  ): Promise<{ decision_id: string; status: "ratified" }>;

  vetoDecision(
    decisionId: string,
    vetoedBy: string,
    reason: string,
  ): Promise<{ decision_id: string; status: "revoked"; reason: string }>;

  implementDecision(
    decisionId: string,
    implementedBy: string,
    notes: string,
  ): Promise<{ decision_id: string; status: "in_effect"; effective_at: string }>;

  getDecision(decisionId: string): Promise<Decision | null>;

  cleanup(): Promise<void>;
}

// --- L5.obligation: Work-State Sub-Layer (RFC-001) ---

export type ObligationStatus = "pending" | "in_progress" | "blocked" | "stale" | "closed" | "abandoned";
export type ActionType = "refresh_evidence" | "query_owner" | "escalate" | "read" | "summarize" | "route_attention" | "propose_low_risk" | string;

export interface ObligationPacket {
  obligation_id: string;
  promise: string;
  owner: string;
  fallback_owner: string;
  status: ObligationStatus;
  evidence: Array<{ ref: string; result: string }>;
  missing_evidence: string[];
  blocked_by: string[];
  stale_if: { type: "ttl"; seconds: number } | { type: "external_condition"; ref: string };
  allowed_next_actions: ActionType[];
  created_at: string;
  last_touched_at: string;
}

export interface PolicyEvaluation {
  risk_tier: RiskLevel;
  operation_permissions: string[];
  evaluator_id: string;
  evaluated_at: string;
  policy_version: string;
  evaluator_scope: string;
  evidence_refs: string[];
  bound_obligation_id: string;        // MUST match the obligation this evaluation authorizes
}

export interface ObligationResult {
  obligation_id: string;
  status: ObligationStatus;
}

export interface AcaObligationAdapter {
  createObligation(packet: ObligationPacket, evaluation: PolicyEvaluation): Promise<ObligationResult>;

  closeObligation(obligationId: string, actorId: string, actorSourceTier: "raw_source" | "llm_derived" | "human_confirmed", evidence: string[]): Promise<ObligationResult>;

  updateStatus(obligationId: string, newStatus: ObligationStatus, actorId: string): Promise<ObligationResult>;

  readObligation(obligationId: string): Promise<ObligationPacket | null>;

  evaluateStale(obligationId: string, evaluatorId: string): Promise<{ obligation_id: string; is_stale: boolean }>;

  getEvaluation(obligationId: string): Promise<PolicyEvaluation | null>;

  writeToSurface(obligationId: string, surface: string, actorId: string): Promise<{ allowed: boolean; reason?: string }>;

  cleanup(): Promise<void>;
}

// --- Governance Plane ---

export type RuleCategory = "immutable" | "structural" | "operational";

export interface GovernanceRule {
  rule_id: string;
  version: number;
  status: "active" | "suspended" | "archived";
  category: RuleCategory;
  title: string;
  specification: string;
  enforced_at_layers: number[];
  created_by_decision?: string | null;
}

export interface GovernanceAmendment {
  amendment_id: string;
  target_rule_id: string;
  proposed_specification: string;
  rationale: string;
  decision_id: string;
}

export interface AcaGovernanceAdapter {
  defineRule(rule: Omit<GovernanceRule, "version" | "status">): Promise<{ rule_id: string; version: number; status: "active" }>;

  proposeAmendment(
    targetRuleId: string,
    proposedSpec: string,
    rationale: string,
    proposerPrincipalId: string,
  ): Promise<{ amendment_id: string; decision_id: string; risk_level: RiskLevel }>;

  suspendRule(ruleId: string, reason: string): Promise<{ rule_id: string; status: "suspended" }>;

  getRule(ruleId: string): Promise<GovernanceRule | null>;

  healthCheck(timeWindowDays: number): Promise<{ dormant_rules: string[]; unexercised_roles: string[] }>;

  cleanup(): Promise<void>;
}
