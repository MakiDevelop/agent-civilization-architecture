# Agent Civilization Architecture

**An Infrastructure Protocol for AI Organizations**

---

Every major coordination technology produces the same pattern: first we build tools, then we build institutions.

AI agents can call tools (MCP), communicate with each other (A2A), and present identities (W3C DID). But nothing governs how agents *organize* — how they form shared memory, establish trust, delegate authority, reach decisions, and evolve their own rules.

Agent Civilization Architecture (ACA) defines a five-layer protocol with a cross-cutting governance plane — the minimum viable institutions that multi-agent systems need to function as organizations without collapse.

```
┌─ Governance Plane: CONSTITUTION ─────────────────────────┐
│  Constrains all layers. Rules about rules.               │
│  Amendment process, knowledge promotion, decay detection │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Layer 5: DECISION — How does the organization decide?   │
│                                                          │
│  Layer 4: AUTHORITY — Who has the right to decide?       │
│                                                          │
│  Layer 3: IDENTITY — Who belongs? Who can act?           │
│                                                          │
│  Layer 2: TRUST — What does the organization believe?    │
│                                                          │
│  Layer 1: MEMORY — What does the organization remember?  │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  Transport: MCP / A2A / REST / File I/O                  │
└──────────────────────────────────────────────────────────┘
```

## Why

As agents scale from 1 to 10 to 1,000, the critical problem shifts from *intelligence* to *civilization*. Without institutions, agent societies fail in the same ways human societies fail: memory corruption, trust collapse, authority disputes, consensus breakdown, and ungovernable rule drift.

No existing framework, platform, or protocol addresses this. Agent frameworks (LangChain, CrewAI) solve coordination. Agent platforms (OpenAI, Anthropic, Google) solve deployment. **Nobody is solving governance.**

> *Microsoft built enforcement. We're writing the constitution.*

## Status

**v0.1 — Architecture Definition + Layer 1-2 Specs** (June 2026)

| Component | Specification | Reference Implementation |
|---|---|---|
| Layer 1: Memory | [**Spec Draft**](spec/layer1-memory.md) | [Agent Memory Hall v0.6](https://github.com/MakiDevelop/agent-memory-hall) |
| Layer 2: Trust | [**Spec Draft**](spec/layer2-trust.md) | Agent Memory Hall v0.6 (partial) |
| Layer 3: Identity | [Defined](spec/architecture.md#layer-3-identity--who-belongs-who-can-act) | Agent Memory Hall v0.6 (minimal) |
| Layer 4: Authority | [Defined](spec/architecture.md#layer-4-authority--who-has-the-right-to-decide) | — |
| Layer 5: Decision | [Defined](spec/architecture.md#layer-5-decision--how-does-the-organization-decide) | — |
| Constitution Plane | [Defined](spec/architecture.md#governance-plane-constitution--how-do-the-rules-evolve) | — |

## Key Innovations

**Anti-Ouroboros Rule** — LLM-derived knowledge cannot supersede LLM-derived knowledge without human intervention. This is the first protocol-level defense against *runtime belief amplification* — distinct from training-time model collapse (Shumailov et al., 2024). No other memory system implements this structural constraint. [Details →](spec/layer2-trust.md#31-anti-ouroboros-rule)

**Source Tier Provenance** — Every memory carries a trust classification (`raw_source` / `llm_derived` / `human_confirmed`) that travels with the memory across transfers. Trust is inherited, not re-earned. Tier transitions are monotonically non-decreasing. [Details →](spec/layer2-trust.md#21-source-tier)

**Mandatory Dissent** — For high-risk decisions, the protocol requires at least one structurally assigned dissenter. A Critical decision without recorded dissent is a protocol violation.

**Constitution as Governance Plane** — Unlike traditional layered architectures, ACA's constitutional governance is not a top layer but a cross-cutting plane that constrains all layers — just as a national constitution constrains legislation, judiciary, and executive simultaneously.

## Reading the Spec

| Document | Purpose |
|---|---|
| [Architecture v0.1](spec/architecture.md) | Start here — problem definition, five-layer + governance plane design, design principles |
| [Layer 1: Memory](spec/layer1-memory.md) | Protocol contract — data model, operations, governance gates, conformance criteria |
| [Layer 2: Trust](spec/layer2-trust.md) | Protocol contract — source tiers, Anti-Ouroboros rule, provenance chain, consumer responsibilities |
| [Civilization Theory](research/civilization-theory.md) | Research — why agent organizations need the same institutions as human civilizations |
| [Governance Roadmap](research/governance-roadmap.md) | Research — from memory system to governance protocol |
| [Landscape Analysis](research/landscape-2026-06.md) | Research — W3C CG status, competitive analysis |

## Reference Implementation

[Agent Memory Hall](https://github.com/MakiDevelop/agent-memory-hall) (`@chibakuma/agent-memory-hall` on npm) is the reference implementation for Layers 1-2.

```bash
npx @chibakuma/agent-memory-hall serve
```

## Roadmap

### Protocol Development

| Phase | Deliverable | Target |
|---|---|---|
| v0.1 Spec | Architecture definition + Layer 1-2 protocol contracts | **June 2026** ✓ |
| v1.0 Spec | Layer 1-3 formal specification + conformance test suite | Q3 2026 |
| v1.0 Ref Impl | AMH upgraded: TierGate interface, NamespaceACL, ProvenanceChain | Q3 2026 |
| Extension RFC | Layer 4 (Authority) — Role Manifest, Chair Mechanism, Mandatory Dissent | Q4 2026 |
| Extension RFC | Layer 5 (Decision) — Decision Proposal, Consensus, Lifecycle state machine | Q1 2027 |
| Extension RFC | Constitution Plane — Knowledge Promotion, Amendment Process, Decay Detection | Q2 2027 |
| Multi-language | Python + Rust conformance-passing implementations | 2027 |

### Academic Publication

| Target | Estimated Submission | Focus |
|---|---|---|
| **NeurIPS SEA Workshop 2026** | Sep 2026 | Anti-Ouroboros: runtime belief amplification vs training-time model collapse |
| **WMAC @ AAAI 2027** | Oct 2026 | Position paper: Organizational Cognition for Multi-Agent Systems |
| **COINE @ AAMAS 2027** | Feb 2027 | Full paper: ACA as protocol-level instantiation of COINE governance for LLM-native MAS |

Academic framing: *"Organizational Cognition for Multi-Agent Systems: A Layered Architecture for Memory, Trust, Authority, and Collective Decision-Making"*

## Relationship to Existing Standards

| Standard | What it solves | What ACA adds |
|---|---|---|
| **MCP** | How agents access tools | How agent *organizations* govern knowledge and decisions |
| **A2A** | How agents communicate | How agents *trust* what they hear |
| **W3C DID** | Who is this agent | What is this agent *authorized* to do |
| **MS Agent Governance Toolkit** | Policy enforcement for agent security | The *constitution* that tells enforcement what is legitimate |

ACA is complementary to all four. It occupies the institutional layer that none of them address.

## EU AI Act Alignment

ACA's design directly maps to EU AI Act (2024/1689) requirements for high-risk AI systems (Chapter III, effective August 2026):

| EU AI Act Article | Requirement | ACA Layer |
|---|---|---|
| Article 9 | Risk management system | Layer 5: Decision |
| Article 12 | Automatic logging (6-month retention) | Layer 1: Memory (audit trail) |
| Article 13 | Transparency of outputs | Layer 2: Trust (source tier) |
| Article 14 | Human oversight | Layer 4: Authority (Chair mechanism) |
| Annex IV | Audit-ready technical documentation | Cross-layer (conformance suite) |

## License

[Apache License 2.0](LICENSE)

## Author

**Makito Chiba** — [GitHub](https://github.com/MakiDevelop) | [Blog](https://blog.chibakuma.com)

Informed by operational experience running a seven-agent council across 60+ collaborative sessions. ACA is the first open protocol that operationalizes the [COINE community's](https://coin-workshop.github.io/) decade of governance research for LLM-native multi-agent systems.
