# Agent Civilization Architecture

**An Infrastructure Protocol for AI Organizations**

---

Every major coordination technology produces the same pattern: first we build tools, then we build institutions.

AI agents can call tools (MCP), communicate with each other (A2A), and present identities (W3C DID). But nothing governs how agents *organize* — how they form shared memory, establish trust, delegate authority, reach decisions, and evolve their own rules.

Agent Civilization Architecture (ACA) defines a six-layer protocol for the minimum viable institutions that multi-agent systems need to function as organizations without collapsing into chaos.

```
┌─────────────────────────────────────────────────────────┐
│  Layer 6: CONSTITUTION — How do the rules evolve?       │
├─────────────────────────────────────────────────────────┤
│  Layer 5: DECISION — How does the organization decide?  │
├─────────────────────────────────────────────────────────┤
│  Layer 4: AUTHORITY — Who has the right to decide?      │
├─────────────────────────────────────────────────────────┤
│  Layer 3: IDENTITY — Who belongs? Who can act?          │
├─────────────────────────────────────────────────────────┤
│  Layer 2: TRUST — What does the organization believe?   │
├─────────────────────────────────────────────────────────┤
│  Layer 1: MEMORY — What does the organization remember? │
├─────────────────────────────────────────────────────────┤
│  Transport: MCP / A2A / REST / File I/O                 │
└─────────────────────────────────────────────────────────┘
```

## Why

As agents scale from 1 to 10 to 1,000, the critical problem shifts from *intelligence* to *civilization*. Without institutions, agent societies fail in the same ways human societies fail: memory corruption, trust collapse, authority disputes, consensus breakdown, and ungovernable rule drift.

No existing framework, platform, or protocol addresses this. Agent frameworks (LangChain, CrewAI) solve coordination. Agent platforms (OpenAI, Anthropic, Google) solve deployment. **Nobody is solving governance.**

## Status

**v0.1 — Architecture Definition** (June 2026)

| Layer | Specification | Reference Implementation |
|---|---|---|
| Layer 1: Memory | [Draft](spec/architecture.md#layer-1-memory) | [Agent Memory Hall v0.6](https://github.com/MakiDevelop/agent-memory-hall) |
| Layer 2: Trust | [Draft](spec/architecture.md#layer-2-trust) | Agent Memory Hall v0.6 (partial) |
| Layer 3: Identity | [Draft](spec/architecture.md#layer-3-identity) | Agent Memory Hall v0.6 (minimal) |
| Layer 4: Authority | Defined, not specified | — |
| Layer 5: Decision | Defined, not specified | — |
| Layer 6: Constitution | Defined, not specified | — |

## Key Innovations

**Anti-Ouroboros Rule** — LLM-derived knowledge cannot supersede LLM-derived knowledge without human intervention. This prevents agent propaganda loops where hallucinations reinforce each other until fiction becomes organizational "truth." No other memory system implements this constraint.

**Source Tier Provenance** — Every memory carries a trust classification (`raw_source` / `llm_derived` / `human_confirmed`) that travels with the memory across transfers. Trust is inherited, not re-earned.

**Mandatory Dissent** — For high-risk decisions, the protocol requires at least one structurally assigned dissenter. A Critical decision without recorded dissent is a protocol violation.

## Reading the Spec

- **Start here**: [Agent Civilization Architecture v0.1](spec/architecture.md) — the full architecture document
- **Research**: [Civilization Theory](research/civilization-theory.md) | [Governance Roadmap](research/governance-roadmap.md) | [Landscape Analysis](research/landscape-2026-06.md)

## Reference Implementation

[Agent Memory Hall](https://github.com/MakiDevelop/agent-memory-hall) (`@chibakuma/agent-memory-hall` on npm) is the reference implementation for Layers 1-2.

```bash
npx @chibakuma/agent-memory-hall serve
```

## Roadmap

| Phase | Deliverable | Target |
|---|---|---|
| v0.1 | Architecture definition (this document) | June 2026 |
| v1.0 | Layer 1-3 formal specification + conformance test suite | Q3 2026 |
| Extension RFC | Layer 4 (Authority) specification | Q4 2026 |
| Extension RFC | Layer 5 (Decision) specification | Q1 2027 |
| Extension RFC | Layer 6 (Constitution) specification | Q2 2027 |
| Multi-language | Python + Rust conformance-passing implementations | 2027 |

## Relationship to Existing Standards

- **MCP** answers: "What can an agent do?" → ACA answers: "How does an agent *organization* govern itself?"
- **A2A** answers: "How do agents talk?" → ACA answers: "How do agents *trust* what they hear?"
- **W3C DID** answers: "Who is this agent?" → ACA answers: "What is this agent *authorized* to do?"

ACA is complementary to all three. It occupies the governance layer that none of them address.

## License

[Apache License 2.0](LICENSE)

## Author

**Makito Chiba** — [GitHub](https://github.com/MakiDevelop) | [Blog](https://blog.chibakuma.com)

Informed by operational experience running a seven-agent council across 60+ collaborative sessions.
