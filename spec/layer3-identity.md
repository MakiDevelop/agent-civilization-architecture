# Layer 3: Identity — Protocol Specification

**Status**: Draft v0.1 — June 2026

**Civilizational analog**: Citizenship, identity documents, jurisdictional boundaries

**Core question**: Who belongs? Who can act?

---

## 1. Overview

The Identity Layer defines how entities (humans, agents, and systems) are identified, authenticated, and authorized within an agent organization. It sits above Memory (Layer 1) and Trust (Layer 2), providing the "who" that those layers reference but do not define.

Every operation in Layers 1 and 2 references a `principal_id` — the entity performing the action. Layer 3 formalizes what a principal *is*, how principals prove their identity, and how namespace boundaries control what each principal can do.

**Design principle**: This layer defines *interfaces*, not *mechanisms*. A minimal implementation can use static token-to-principal mapping. A production implementation can use W3C DID, OAuth 2.0, or mTLS. The protocol mandates that identity is *verifiable* and *bound to namespace permissions* — it does not mandate how.

---

## 2. Data Model

### 2.1 Principal

A Principal is the fundamental identity unit in ACA. Every action in the system is performed by a Principal.

```json
{
  "principal_id": "string (unique identifier, e.g. 'human:maki', 'agent:planner', 'system:cron')",
  "principal_type": "human | agent | system",
  "display_name": "string (optional, human-readable label)",
  "created_at": "string (ISO 8601)",
  "credentials": ["CredentialRef (see §2.2)"],
  "status": "active | suspended | revoked"
}
```

**Principal Types**:

| Type | Definition | Trust Implications |
|---|---|---|
| `human` | A human operator or reviewer | Can confirm `human_confirmed` tier (Layer 2) |
| `agent` | An AI agent (LLM-based or rule-based) | Cannot confirm `human_confirmed` tier |
| `system` | Automated infrastructure (cron jobs, CI/CD) | Cannot confirm `human_confirmed` tier; used for expire sweeps, background migrations |

**Invariants**:
- Every `principal_id` MUST be unique within an organization.
- `principal_type` MUST NOT change after creation (an agent cannot become a human).
- A `suspended` principal MUST NOT perform write operations but MAY be referenced in audit logs.

**Naming convention**: Principal IDs SHOULD use the format `{type}:{name}` (e.g., `human:maki`, `agent:planner`). This is a SHOULD, not a MUST — implementations MAY use opaque identifiers.

### 2.2 Credential

A Credential binds a Principal to an authentication mechanism. The protocol does not define credential formats — it defines the contract that credentials must satisfy.

```json
{
  "credential_id": "string (unique identifier)",
  "principal_id": "string (the principal this credential authenticates)",
  "credential_type": "bearer_token | api_key | mtls_cert | did_assertion | custom",
  "issued_at": "string (ISO 8601)",
  "expires_at": "string | null (ISO 8601)",
  "status": "active | revoked"
}
```

**Contract**: An implementation MUST provide an `authenticate` function:
```
authenticate(credential_data) → Principal | AuthenticationError
```

The function takes opaque credential data (a token, certificate, or assertion) and returns either the authenticated Principal or an error. The protocol does not specify what `credential_data` looks like — that is mechanism-specific.

### 2.3 Namespace

A Namespace is a jurisdictional boundary for knowledge. It is the primary authorization unit in ACA.

```json
{
  "namespace_id": "string (e.g. 'project:acme', 'shared', 'agent:planner')",
  "owner_principal_id": "string (the principal who created this namespace)",
  "created_at": "string (ISO 8601)",
  "policy": "NamespacePolicy (see §2.4)"
}
```

**Namespace hierarchy convention**: Namespaces use colon-delimited prefixes to express hierarchy: `project:acme`, `project:acme:staging`, `agent:planner`. Hierarchy is advisory — implementations are NOT required to infer permissions from hierarchy (e.g., access to `project:acme` does NOT imply access to `project:acme:staging` unless explicitly granted).

### 2.4 NamespacePolicy

A NamespacePolicy defines the default access rules for a namespace.

```json
{
  "default_read": "owner_only | authenticated | public",
  "default_write": "owner_only | acl",
  "isolation": "strict | permissive",
  "allow_cross_namespace_transfer": "boolean"
}
```

| Policy | Meaning |
|---|---|
| `default_read: owner_only` | Only the namespace owner can read (highest isolation) |
| `default_read: authenticated` | Any authenticated principal can read |
| `default_read: public` | No authentication required to read |
| `default_write: owner_only` | Only the owner can write |
| `default_write: acl` | Write access governed by explicit ACL grants |
| `isolation: strict` | Caller namespace must match target namespace for all operations |
| `isolation: permissive` | Cross-namespace reads allowed; writes still require ACL |

### 2.5 Grant

A Grant is an explicit permission given by one principal to another for a specific namespace.

```json
{
  "grant_id": "string (unique identifier)",
  "granter_principal_id": "string (who gave the permission)",
  "grantee_principal_id": "string (who received the permission)",
  "namespace_id": "string (which namespace)",
  "permissions": ["read", "write", "transfer", "admin"],
  "granted_at": "string (ISO 8601)",
  "expires_at": "string | null",
  "status": "active | revoked"
}
```

**Permission definitions**:

| Permission | Allows |
|---|---|
| `read` | Query and read MemoryCells in the namespace |
| `write` | Create, supersede, and revoke MemoryCells |
| `transfer` | Transfer MemoryCells into or out of this namespace |
| `admin` | Grant/revoke permissions to other principals; modify namespace policy |

**Invariants**:
- Only principals with `admin` permission (or the namespace owner) can create Grants.
- A principal CANNOT grant permissions they do not hold themselves.
- Grant revocation is immediate — cached permissions MUST be invalidated.

---

## 3. Operations

### 3.1 Register Principal

Creates a new Principal in the organization.

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | `principal_id`, `principal_type`, `display_name` (optional) |
| **Pre-conditions** | `principal_id` does not already exist. Caller has organization-level `admin` permission. |
| **Processing** | 1. Validate `principal_id` uniqueness. 2. Create Principal record with `status: active`. 3. Append AuditEvent. |
| **Output** | `{ principal_id, principal_type, status: "active" }` |

### 3.2 Authenticate

Validates a credential and returns the associated Principal.

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | Opaque credential data (token, certificate, assertion). |
| **Processing** | 1. Look up credential by type-specific matching. 2. Verify credential is `active` and not expired. 3. Verify associated Principal is `active`. 4. Return Principal. |
| **Output** | `Principal` or `AuthenticationError` |
| **Failure modes** | `InvalidCredentialError` — credential not recognized. `ExpiredCredentialError`. `SuspendedPrincipalError`. |

### 3.3 Authorize

Checks whether an authenticated Principal can perform an action on a namespace.

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | `principal_id`, `namespace_id`, `permission` (read/write/transfer/admin). |
| **Processing** | 1. Check namespace policy defaults. 2. Check explicit Grants. 3. Return decision. |
| **Output** | `{ allowed: boolean, reason?: string }` |

**Fail-closed**: If authorization cannot be determined (missing namespace, unknown principal, system error), the default answer is `{ allowed: false }`.

### 3.4 Grant Permission

Creates or updates a Grant.

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | `granter_principal_id`, `grantee_principal_id`, `namespace_id`, `permissions[]`, `expires_at` (optional). |
| **Pre-conditions** | Granter has `admin` permission on the namespace (or is the namespace owner). Granter holds all permissions being granted. |
| **Processing** | 1. Validate granter authorization. 2. Create Grant record. 3. Append AuditEvent. |
| **Output** | `{ grant_id, grantee_principal_id, namespace_id, permissions }` |

### 3.5 Revoke Grant

Revokes a previously issued Grant.

**Contract**:

| Aspect | Specification |
|---|---|
| **Input** | `grant_id`, `revoked_by` (principal_id). |
| **Pre-conditions** | Revoker has `admin` permission on the grant's namespace. |
| **Processing** | 1. Set Grant status to `revoked`. 2. Append AuditEvent. |
| **Output** | `{ grant_id, status: "revoked" }` |

---

## 4. Integration with Layers 1 and 2

### 4.1 Memory Operations (Layer 1)

Every Layer 1 operation that references `created_by` or `principal_id` MUST resolve to a valid, active Principal. When Layer 3 is enabled:

- `writeMemory`: The `created_by` field is set to the authenticated Principal's `principal_id`. The Authorize check runs before the Write Gate.
- `readMemory`: The Authorize check for `read` permission runs before namespace isolation.
- `transferMemory`: Both `read` on source namespace and `write` + `transfer` on target namespace are checked.
- Audit events: `principal_id` in AuditEvents MUST reference a registered Principal.

### 4.2 Trust Operations (Layer 2)

- `tierUpgrade` to `human_confirmed`: The `confirmed_by` in TrustProof MUST resolve to a Principal with `principal_type: human`. This is the protocol-level enforcement of "human in the loop."
- Trust proof validation: When Layer 3 is enabled, `InvalidTrustProofError` is raised if `confirmed_by` references a non-human principal for `human_confirmed` upgrades.

### 4.3 Backward Compatibility

Layer 3 is OPTIONAL. Implementations that do not implement Layer 3 remain Layer 1+2 conformant. When Layer 3 is not implemented:

- `principal_id` / `created_by` / `confirmed_by` are treated as opaque strings with no verification.
- Namespace isolation uses the existing `caller_namespace` mechanism (Layer 1 §4.3).
- `human_confirmed` tier upgrades rely on the caller to provide accurate `principal_type` — there is no protocol-level enforcement.

---

## 5. Conformance

An implementation is **ACA Layer 3 conformant** if it:

1. Implements the Principal data model with the three principal types.
2. Provides an `authenticate` function that returns a verified Principal.
3. Provides an `authorize` function that enforces namespace-level permissions.
4. Implements Grant-based access control with the four permission types.
5. Enforces fail-closed authorization (deny by default on error).
6. Validates `principal_type: human` for `human_confirmed` tier upgrades.
7. Maintains audit trail for all identity operations (register, grant, revoke).
8. Passes the Layer 3 conformance test suite (forthcoming).

**Note**: Layer 3 conformance requires Layer 1+2 conformance. The layers are cumulative.

---

## Evidence

Production incidents documenting the need for this layer. Full catalog: [evidence/Evidence_Catalog.md](../evidence/Evidence_Catalog.md)

| ID | Summary |
|---|---|
| I-1 | Moltbook misconfiguration exposed 1.5M agent API tokens — full agent impersonation possible |
| I-2 | Compromised credentials from 47 enterprise deployments active for 6 months before discovery |
| I-3 | Only 21.9% of organizations treat agents as independent identity-bearing entities |

---

## References

- W3C Decentralized Identifiers (DIDs): https://www.w3.org/TR/did-core/
- W3C Verifiable Credentials: https://www.w3.org/TR/vc-data-model/
- OAuth 2.0 (RFC 6749): https://tools.ietf.org/html/rfc6749
- RBAC (NIST INCITS 359-2012): Role-Based Access Control standard
- COINE Workshop Series — norms and governance for MAS: https://coin-workshop.github.io/
- Agent Memory Hall v0.7 — reference implementation: https://github.com/MakiDevelop/agent-memory-hall
