# Next Session — ACA

> Last updated: 2026-06-15

## Immediate

1. **Conformance tests 補齊** — supersede / revoke / transfer / expire / audit tests（目前只有 write + tier-upgrade + anti-ouroboros）
2. **Layer 3 Identity spec 起草** — `spec/layer3-identity.md`（Principal + NamespaceACL contract）

## AMH v1.0 Alignment

AMH repo 需要補齊才能 claim ACA Layer 1+2 conformant:
- SQLite `patchTier` 實作
- MCP `amh_tier_upgrade` tool
- CLI `tier-upgrade` command
- `TrustProofSchema.parse` 完整驗證
- 舊 `decision` records migration
- `content_hash` rehash migration（算法從 `value` 改為 `format:value`）

## Publication

- **X thread** — 草稿在 `~/Documents/agent-council/aca-review/x-thread-draft.md`，待審閱後發佈
- **NeurIPS SEA 2026** — abstract 在 `~/Documents/agent-council/aca-review/neurips-sea-abstract.md`，deadline ~Sep 2026
- **WMAC @ AAAI 2027** — position paper，deadline ~Oct 2026
- **COINE @ AAMAS 2027** — full paper，deadline ~Feb 2027

## Key References

- COINE workshop: https://coin-workshop.github.io/
- MS Agent Governance Toolkit: microsoft/agent-governance-toolkit
- Shumailov et al. (2024) model collapse: training-time analog to Anti-Ouroboros
- NeurIPS 2025 Temporal Graph: runtime hallucination propagation
- EU AI Act Articles 9, 12, 13, 14
