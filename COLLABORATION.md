# Maki × AI 協作全貌

> 一份活文件，記錄人機協作框架的說明、願景、現狀、和可持續優化項目。
> 最後更新：2026-06-18（mk-agentOS Council Session — Phase 0 ratified + Phase 1 W1-W4 實作）

---

## 這是什麼

一個人（Maki）和多個 AI Agent（Claude / Codex / Gemini / qwen3.6 / gemma4 / Grok）之間的深度協作系統。不是「用 AI 當工具」，而是建了一套**人機混合的決策與進化基礎設施**。

核心特徵：
- **治理優先於技術** — 先有規則，才有實作
- **多 Agent 不是多工具** — 每個 Agent 有角色、守備範圍、挑戰權
- **記憶是制度** — 不屬於任何 Agent 或 session，屬於系統
- **進化是設計目標** — 不只要能用，要越用越好

---

## 四層架構

```
┌─────────────────────────────────────────────────┐
│  ACA — Agent Civilization Architecture          │
│  憲法層：誰能做什麼、風險怎麼分級、記憶怎麼治理  │
│  時間尺度：幾乎不變（修憲級）                     │
├─────────────────────────────────────────────────┤
│  ACE — Agent Context Exchange                   │
│  協作層：manifest 共享狀態、三權力、防 monopoly   │
│  時間尺度：每個 session 運作（程序）               │
├─────────────────────────────────────────────────┤
│  Baton — Session Evolution                      │
│  進化層：anti-patterns 累積、infra 狀態、follow-up│
│  時間尺度：跨 session 學習（持續進化）             │
├─────────────────────────────────────────────────┤
│  mk-agentOS — Convention Envelope               │
│  信封層：ABI freeze、偏好注入、反思迴圈、健康探測  │
│  時間尺度：跨層連接（讓三層資料真正流動）           │
└─────────────────────────────────────────────────┘
```

### mk-agentOS（信封）

讓 Agent 在每個 session 開始時就知道偏好、錯誤、系統狀態 — 不需要 Maki 重新解釋。
它是現有基礎設施的 convention 信封，不加入 daemon 或 dashboard。

| 項目 | 位置 |
|---|---|
| ABI freeze spec（5 介面、6 個月凍結） | `~/.agentOS/abi.md` |
| 子系統登記 | `~/.agentOS/registry.yaml` |
| Preference schema | `~/.agentOS/schemas/preference-explicit.md` |
| Post-session reflection | `~/.claude/scripts/post-session-reflect.sh` + `analyze-session.py` |
| Failure patterns（12 條） | `~/.claude/failure-patterns.json` |
| Session start injection protocol | `~/.claude/skills/start/SKILL.md` Step 1.7 |
| Council 設計 evidence | `~/Documents/agent-council/2026-06-18-agentos-council/` |

### ACA（憲法）

定義 AI 系統的制度基礎：記憶、信任、身份、權限、決策五層 + 治理平面。

| 項目 | 位置 |
|---|---|
| 5 層 spec + conformance tests | `agent-civilization-architecture/spec/` |
| 治理執行指令 | `~/Documents/mk-governance/CIVILIZATION_EXECUTION_DIRECTIVE_v1.1.md` |
| RFC-001（Anti-Ouroboros） | `agent-civilization-architecture/rfcs/` |
| 在 CLAUDE.md 中的實例化 | `~/.claude/rules/civilization-stack.md` |

### ACE（協作）

多 Agent 通訊協定。核心機制是 Session Manifest — 所有 Agent 共讀共寫的 shared state。

| 項目 | 位置 |
|---|---|
| ACE v2.3 charter | `~/.claude/rules/agent-comm-protocol.md` |
| Calibrated Synthesis 三紀律 | 同上（v3 NOW section） |
| 三權力（Routing / Sub-tasks / Goal Drift Challenge） | 同上 |
| Session manifest 範例 | `~/Documents/agent-council/*/\_manifest.md` |
| 設計 evidence | `~/Documents/agent-council/2026-05-24-briefing-context-redesign/` |

### Baton（進化）

跨 session 的狀態交棒，讓 AI 在協作中持續累積經驗。

| 項目 | 位置 |
|---|---|
| Baton v1 SPEC + PyPI package | `~/GitHub/session-baton/` |
| Baton v2 SPEC（Council R1+R2 結果） | `~/GitHub/session-baton/spec/SPEC-v2.md` |
| Server 端實作（memhall 內） | `~/GitHub/memory-hall/` — `/v1/baton/read` + `/v1/baton/write` |
| Council 設計 evidence | `~/Documents/agent-council/2026-06-18-baton-v2-design/` |

---

## 支撐基礎設施

### memhall（記憶系統）

唯一的跨 session 記憶層。mem0 已 deprecated。

| 項目 | 位置 |
|---|---|
| Server code | `~/GitHub/memory-hall/` |
| Primary | mini2 `100.89.41.50:9100` |
| Backup | mini1 `100.122.171.74:9100` |
| 本機 fallback | `~/.claude/loop/batons/{namespace}.json` |
| 治理規則 | `~/.claude/CLAUDE.md` §6 + `rules/session-memory.md` |

### 七位一體 Council

| 成員 | 角色 | 呼叫方式 |
|---|---|---|
| Maki | Chair — 最終決策權 | 本人 |
| Claude | Architect / Judge | 直接對話 |
| Codex | Engineer + Default Dissenter | CLI File I/O |
| Gemini | Analyst | CLI File I/O |
| qwen3.6 | Primary Local Brain | Ollama（MBP / DGX） |
| gemma4:31b | Writing Specialist | Ollama（on-demand） |
| Perplexity Max | Scout-1（human-mediated） | Maki 手動 |
| SuperGrok | Scout-2（human-mediated） | Maki 手動 |
| Grok Build | Tool seat（非投票） | CLI |

### CLAUDE.md + rules/

Agent 行為的靜態規則。分為 CONSTITUTIONAL（不變）和 OPERATIONAL（可動態化到 Baton）。

| 項目 | 位置 |
|---|---|
| Global CLAUDE.md | `~/.claude/CLAUDE.md`（~450 行，含 9 節） |
| Always-on rules（6 檔） | `~/.claude/rules/`（fast-path / scope-discipline / no-guessing / session-memory / safe-operations / infrastructure-quick-ref） |
| Path-scoped rules（12 檔） | `~/.claude/rules/`（agent-comm-protocol / agent-routing-default / discovery-phase 等） |

---

## 願景

**短期**（Baton v2 落地後）：
- 每個 session 的起點比上一個更高 — anti_patterns 累積、discovery 不重來、follow-up 不消失
- CLAUDE.md 從 450 行降到 ~320 行 — OPERATIONAL 規則動態化到 Baton
- 所有 Agent 共用同一份進化狀態 — 不只是 Claude 記得，Codex / Gemini 也記得

**中期**（3-6 個月）：
- anti_patterns 自然升級為 rules/ — 從教訓到原則的有機路徑
- 新 Agent 加入時有即時可用的操作記憶 — 不需要從零建立 context
- Council 決策品質可追溯 — evidence chain 從 Baton → ACE manifest → memhall decision

**長期**：
- 人機協作的制度化 — 不依賴特定 AI 供應商，任何 Agent 都能接入
- Maki 的注意力投回人類該做的事 — 寫作、思考、產品決策、家人
- 這套框架本身成為可分享的知識 — blog、開源、教學

---

## 目前發展階段

| 組件 | 狀態 | 成熟度 |
|---|---|---|
| ACA（5 層 spec） | 已發布，34 conformance tests | Production |
| ACE（v2.3 charter） | 已 ratify，多次 dogfood | Production |
| Baton v1 | 已實作，PyPI package | Production |
| Baton v2 | SPEC 完成（Council R1+R2），待實作 | Design-complete |
| memhall | 穩定運行，primary (mini2) + backup (mini1) | Production |
| CLAUDE.md + rules/ | 持續維護，~450 行 | Production（待 Baton v2 精簡） |
| Council 七位一體 | 日常使用，preset routing | Production |
| mk-brain（PKI） | 4000+ 書籤，RAG 運行中 | Production |
| mk-agentOS | ABI freeze + registry + reflection hook + preference injection | Phase 1 MVP |

---

## 可持續優化項目

### P0（下一步）

- [ ] **Baton v2 實作** — memhall server 端加 revision CAS + session-baton models 升級 v2 schema
- [ ] **CLAUDE.md 精簡** — Baton v2 穩定後，逐步移走 OPERATIONAL 規則（目標 -130 行）
- [ ] **memhall HMAC auth** — STG-022 S2.1，memory-hall `get_principal()` 改為真實驗 HMAC（4-8h）

### P1（近期）

- [ ] **anti_patterns 升級路徑** — 從 Baton 教訓自動 surface 為 rule candidate，三層升級（New → Candidate → Proposed → Promoted）
- [ ] **discovery_cache 冷啟動** — 為主要目標（mini1/mini2/DGX/VPS 群）建立第一份 discovery 資料
- [ ] **memhall S2.1 HMAC auth** — DEC-014 P0 項目，write endpoint 加 HMAC 驗證

### P2（中期）

- [ ] **Baton v2.1 擴展** — preferences.maki / doc_routing / trigger_conditions / agents_involved
- [ ] **跨 namespace Baton 視圖** — home + project:abd-ai-hub 的 follow-up 彙整
- [ ] **Council 決策品質回溯** — evidence chain 串接（Baton → ACE → memhall）
- [ ] **mk-agentOS weekly pattern-digest** — mini2 cron 每週一產出 `~/.claude/pattern-digest/YYYY-WW.md`
- [ ] **mk-agentOS implicit preference capture** — 週期分析 session entries 推斷 implicit preferences（needs Maki ratify gate）
- [ ] **analyze-session.py 閾值 tune** — 目前 scope_expansion 偵測過敏（83 violations/day）

### P3（長期探索）

- [ ] **ACA 社群推廣** — blog 系列、conference talk、開源 community building
- [ ] **新 Agent 自動 onboarding** — 讀 Baton 即獲得操作記憶，無需人工 briefing
- [ ] **協作品質量化** — session 間進步度、anti_pattern 下降率、follow-up 清除率

---

## 關鍵決策紀錄

| ID | 日期 | 決策 | 位置 |
|---|---|---|---|
| DEC-005 | 2026-04 | 安全紅線定義 | `~/.claude/CLAUDE.md` §7 |
| DEC-014 | 2026-04-20 | Agent Security Hygiene 三層防禦 | `~/.claude/rules/agent-security-hygiene.md` |
| DEC-018 | 2026-04-18 | memhall 取代 mem0 為唯一記憶系統 | `~/.claude/CLAUDE.md` §6 |
| DEC-BATON-001~004 | 2026-06-17 | Baton v1 spec ratify | `~/GitHub/session-baton/spec/SPEC.md` |
| — | 2026-05-24 | ACE v2.0 charter（manifest 共享狀態） | `~/.claude/rules/agent-comm-protocol.md` |
| — | 2026-05-31 | ACE v2.3（Calibrated Synthesis + scale-trigger DORMANT） | 同上 |
| — | 2026-06-18 | Baton v2 SPEC（Council R1+R2，待 ratify） | `~/GitHub/session-baton/spec/SPEC-v2.md` |
| — | 2026-06-18 | mk-agentOS Phase 0 ratified（定義/naming/ABI/mem0退役/cron ownership） | `~/Documents/agent-council/2026-06-18-agentos-council/` |
| — | 2026-06-18 | mk-agentOS Phase 1 W1-W4 實作（ABI+registry+reflection+injection+preferences seed） | `~/.agentOS/` |

---

## 相關 Repo 索引

| Repo | 用途 | 位置 |
|---|---|---|
| `agent-civilization-architecture` | ACA spec + conformance（本 repo） | `~/GitHub/agent-civilization-architecture/` |
| `session-baton` | Baton spec + PyPI package | `~/GitHub/session-baton/` |
| `memory-hall` | memhall server 實作 | `~/GitHub/memory-hall/` |
| `agent-memory-hall` | memhall npm reference impl | `~/GitHub/agent-memory-hall/` |
| `mk-governance` | 治理文件歸檔 | `~/Documents/mk-governance/` |
| `agent-council` sessions | Council session evidence | `~/Documents/agent-council/` |

---

> 這份文件本身也是協作的產物 — 由 Maki 發起，Claude 起草，
> 建立在七位一體 Council 兩年來的累積之上。
