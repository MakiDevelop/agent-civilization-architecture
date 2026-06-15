# Agent Memory 標準化全景調研（2026-06）

## 1. W3C CG 實際進度

### 成立背景與成員

W3C「AI Agent Memory Interoperability Community Group」於 2026-06-03 正式成立，由 **Russell Jackson** 提案（2026-05-18），支持創立的成員包括 **Justin Avery、Eric Jahn** 等人。截至報告撰寫時，W3C 官方頁面顯示該 CG 目前有 **4 名參與者**。社群尚處極早期，尚未列出完整成員名單（預計隨著 CfP 擴散而逐漸增加）。[^1][^2][^3]

### Charter Scope

根據 CfP 公告與 W3C 提案頁面，Charter 明確界定以下 **In-Scope** 項目：[^4][^1]

- **Memory cell shape**：帶有 canonical metadata 的加密記憶單元
- **Identity binding**：後量子簽章（以 ML-DSA-65 / NIST FIPS-204 為 primary reference）
- **Encryption envelope semantics**：per-cell DEK、wallet-derived KEK、rotation versioning
- **Audit anchor properties**：公鏈 receipt；可驗證性不依賴 operator trust
- **Sharing contracts**：temporary / permanent / syndicate；revocation semantics
- **Cryptographic erasure**：DEK 銷毀 + tombstone + content-address blacklist，對齊 GDPR Article 17
- **Crosswalks**：對接 NIST AI RMF 1.0、ISO/IEC 42001:2023、ISO/IEC 27001:2022、EU AI Act 2024/1689，以及 **MCP、AAIF** 生態系

**Out-of-Scope**（明確排除）：[^4]
- 特定區塊鏈選型（協議為 chain-agnostic）
- Vector database 語意（正交關切）
- Agent runtime 語意（由 AAIF goose project 等其他論壇覆蓋）
- Tool-routing 語意（由 **MCP** 覆蓋）

### 與 MCP / A2A 的關係

Charter 明確把 **MCP 定位為 Tool-routing 層**，agent memory interoperability 是 MCP 上層的 persistence 和 identity 問題。AAIF（Anthropic Agent Interoperability Framework）被列為 crosswalk 對象，而非競爭者。換言之，這個 CG 的意圖是在 MCP 完成 tool 標準化後，填補 **memory cell 格式 + 身份綁定 + 稽核錨定**這三塊空白。[^4]

### 已發布草案 / Discussion Paper

截至 2026-06-15，該 CG **尚未發布任何正式草案或 discussion paper**。成立不足兩週，連第一次工作會議都尚未召開。可以對比同樣隸屬 W3C CG 的「AI Agent Protocol CG」（2025-06 成立）在半年後才產出兩份技術文件草案，作為時程參考。[^5]

***

## 2. AMP 名稱碰撞地圖

目前 GitHub 上至少有 **5 個以上**使用「AMP / Agent Memory Protocol」名稱的獨立專案，彼此定位差異顯著：

| 專案 | 擁有者 / 組織 | Stars | 最後 Commit | 定位特色 |
|---|---|---|---|---|
| **agentmemoryprotocol/agentmemoryprotocol** | YouTale AI (claws-kornuta) | 0 | 2026-04-20 | Markdown-first 檔案格式；git-friendly；v0.1 draft，無實作[^6] |
| **akshayaggarwal99/amp** | Akshay Aggarwal | 28 ⭐ | 2026-05-06 | MCP-native；3-layer brain (STM/LTM/Graph)；LoCoMo 測評 81.6% vs Mem0 21.7%；有 `pip install amp-memory`[^7] |
| **mmorris35/agent-memory-protocol** | Mike Morris | 7 ⭐ | 2026-02-13 | HTTP/REST + MCP 雙綁定；Rust 參考實作 Nellie；v0.2 含 admin ops[^8] |
| **smriti-memcore/amp** | smriti-memcore | N/A | 2026-05 | REST API + MCP dual-delivery；OpenAPI 3.0；AMP v1.1[^9] |
| **agentmemoryprotocol.io**（網站） | 不明 | N/A | N/A | v0.1 spec 已出；reference impl 建設中；MCP 整合[^10] |

**其他同名或高度相關專案**（未列全）：[^11][^12]
- `deep-thinking-lab/open-agent-memory-protocol`（OAMP）— 強調 storage-agnostic 查詢接口
- `edihasaj/universal-memory-protocol`（UMP）— standardizes read/write/revise/forget/exchange
- `AP3X-Dev/agent-memory-protocol` — TypeScript，coding agent memory
- `smriti-memcore/amp`（v1.1）— dual REST+MCP

**活躍度小結**：
- 最活躍的是 `akshayaggarwal99/amp`（有 benchmark 論文、pip 套件），但 Star 數仍偏低（28）
- `agentmemoryprotocol/agentmemoryprotocol` 雖有最完整的規格文件，但 0 stars、純草案
- `mmorris35/agent-memory-protocol` 已有 Rust 生產實作，但社群活躍度低
- 名稱碰撞嚴重，**沒有任何一個專案獲得社群聚合**

另值得注意：MLIR 2026 論文 **"Agent-Memory Protocol (AMP)"** 由 Wu et al. 在 ICML Workshop 發表，定義三個 deterministic operations（redact-at-rest / pack-for-purpose / hydrate-on-return），聚焦 privacy，與上述 open-source 專案完全獨立。[^13]

***

## 3. 學術論文：Taxonomy Survey

### 核心 Forms–Functions–Dynamics 框架

**Hu et al. (2025)《Memory in the Age of AI Agents》**（arXiv:2512.13564，Dec 2025，v2 Jan 2026）是目前最全面的 agent memory survey，提出三維統一分類框架：[^14][^15]

| 維度 | 分類 | 說明 |
|---|---|---|
| **Forms（形式）** | Token-level | 直接在 token 空間壓縮/追加 |
| | Parametric | 微調/梯度更新至模型權重 |
| | Latent | 隱向量表示的 memory state |
| **Functions（功能）** | Factual memory | 事實知識儲存 |
| | Experiential memory | 從互動中積累的 episode / lesson |
| | Working memory | 當前 task context 管理 |
| **Dynamics（動態）** | Formation | 如何寫入記憶 |
| | Evolution | 如何更新 / 遺忘 / 整合 |
| | Retrieval | 如何查詢相關記憶 |

作者群達 50 人以上，覆蓋上海 AI Lab、Fudan、MSRA 等機構。[^14]

### Anatomy of Agentic Memory（2026 年新作）

**Jiang et al. (2026)《Anatomy of Agentic Memory》**（arXiv:2602.19320，Feb 2026，v2 May 2026）提出更偏 system/empirical 的四結構分類，並以 LoCoMo benchmark 實測各架構：[^16][^17]

1. **Lightweight Semantic Memory** — 向量相似度 top-k 檢索；最廣泛使用
2. **Entity-Centric & Personalized Memory** — 以 entity / 用戶 profile 為核心的結構化記錄
3. **Episodic & Reflective Memory** — 時間性 episode + 週期性 reflection 整合（Park 2023 Memory Stream 的直接延伸）
4. **Structured & Hierarchical Memory** — graph-based 或多層 tier（STM/LTM）

該論文更重要的貢獻是提出 **Context Saturation Gap**（\(\Delta = \text{Score}_{\text{MAG}} - \text{Score}_{\text{FullContext}}\)）作為評估 benchmark 有效性的指標，並發現大多數現有 benchmark（HotpotQA、MemBench）在 128k+ 上下文視窗下已達飽和，無法真正測出 external memory 的必要性。[^18][^16]

### 2025–2026 其他 Survey 一覽

根據 Jiang et al. 論文中的比較表格，同期還有：[^19]

| Survey | Taxonomy 取向 |
|---|---|
| The AI Hippocampus (Jia et al. 2026) | Brain-inspired：implicit / explicit / agentic |
| Toward Efficient Agents (Yang et al. 2026) | Efficiency-focused：memory / tool / planning |
| Rethinking Memory Mechanisms (Huang et al. 2026) | Substrate–cognition–subject |
| From Storage to Experience (Luo et al. 2026) | 演化論：storage → reflection → experience |
| Graph-based Agent Memory (Yang et al. 2026) | 知識圖譜 lifecycle |

### Park et al. 2023 後續引用與延伸

Park et al. 2023《Generative Agents》引入了 **Memory Stream**（recency × importance × relevance 三因子加權檢索）+ **Reflection**（高階摘要）架構，成為現代 agent memory 的基礎藍圖。[^20][^21]

直接延伸與引用的代表作品：
- **MemGPT / Letta**（Packer et al. 2023）：將 OS 分頁概念帶入 LLM context 管理，發展成 Letta 的 MemFS 路線[^22][^23]
- **TravelAgent**（2025）：在城市建環境中實作 Memory Stream + Reflection + Planning 完整管線[^24]
- **Frontiers in Psychology（2025）**：以 attention weight 優化 generative agent 記憶檢索[^25]
- **A-Mem（2026）**：Agentic memory，動態組織 memory node；在 OpenReview 獲正面評價[^26]
- Anatomy of Agentic Memory 中的 MAGMA、LEGOMem、TiMem 等均大量引用並延伸 Park 架構[^19]

Semantic Scholar 記錄 Park et al. 2023 的引用在 2025 年已超過 **2,000+** 次，是 2023–2026 被引用最廣泛的 agent 論文之一。[^27][^28]

***

## 4. 既有標準的借鑑性分析

下表分析企業知識管理與身份管理領域現有標準在 agent memory 場景的適用性：

| 標準 | 核心設計目的 | Agent Memory 可借鑑點 | 侷限 |
|---|---|---|---|
| **W3C Verifiable Credentials v2.0**（2025-05 正式 Rec）| 可驗證宣稱（issuer–holder–verifier 三方）；cryptographic proof[^29][^30] | Memory cell 的 **provenance 聲明**（誰建立 / 何時建立 / 信任度），加上 selective disclosure 做到 per-field 隱私控制[^31] | 設計為靜態憑證，memory 是動態讀寫物件；versioning 語意不足 |
| **SKOS（Simple Knowledge Organization System）** | 概念術語體系、概念關係（broader/narrower/related）、mapping | Memory node 之間的 **語義關係標記**（e.g., `skos:related`、`skos:broadMatch` 做跨框架 memory crosswalk） | 無 time-series；無加密；無 access control |
| **Dublin Core Metadata Terms** | 基礎 metadata（creator, date, subject, format）| Memory cell 的 **canonical metadata schema** 的底層詞彙，可直接借用 `dc:created`, `dc:modified`, `dc:subject`[^32] | 語彙極簡，無 confidence score、decay、revocation 語意 |
| **OASIS XACML / ALFA** | Attribute-based access control policy | Memory **sharing contract** 的表達語言（who can read/write memory under what conditions） | XML-heavy；agent 場景需 JSON-native 替代 |
| **W3C DID Core** | 去中心化識別符 | Agent identity binding；memory 的 author DID 追蹤；跨 operator 的 memory 所有權確認[^33] | 實作複雜；多數 memory 場景不需去中心化 |

**實用建議**：agent memory cell 的 metadata schema 可以 **Dublin Core 為基礎詞彙**，以 **VC v2.0 封裝 provenance proof**（issuer = agent framework，subject = memory cell ID），並用 **SKOS 表達 concept graph links**。這三層疊加可在不重發明輪子的前提下，涵蓋 W3C CG charter 提到的大部分 metadata 需求。

***

## 5. Letta Context Repositories 深度解析

### 規格摘要（2026-02 發布）

Letta 於 2026-02-12 推出 **Context Repositories**（又稱 MemFS），是 Letta Code 記憶系統的完整重寫。核心設計如下：[^34][^35]

**儲存模型**：
- 記憶體以本地 **git 倉庫**形式儲存，每次記憶變更都自動生成 git commit（含有意義的 commit message）
- 目錄結構：`system/`（固定載入 system prompt）+ 任意層 memory files
- 每個 memory file 含 **YAML frontmatter**（description 欄位），讓 agent 僅透過 filetree + frontmatter 判斷是否需要完整讀取（progressive disclosure）[^34]

**Agents 的 memory 管理機制**（三個內建 skills）：[^34]
- **Memory initialization**：開新 agent 時，fan out 多個 subagent 至 git worktree，平行掃描 codebase + Claude Code/Codex 歷史對話，merge 回 `main`
- **Memory reflection**：Sleep-time background process，週期性 review 近期對話 → persist 重要資訊 → auto-merge
- **Memory defragmentation**：長期使用後，subagent 重組 15–25 個 focused files（拆大檔、合重複、重新層級化）

**Multi-agent 協作**：每個 subagent 開 **git worktree** 做隔離，parallel write 後以標準 git conflict resolution 合併。[^36][^34]

**啟用方式**：在 Letta Code CLI 執行 `/memfs` 指令，會 detach `memory()` tool 並將舊 memory blocks sync 到 git-backed filesystem。[^34]

### 與我們要做的東西重疊度分析

| 面向 | Letta Context Repos | 我方目標（AMP 類方向） | 重疊度 |
|---|---|---|---|
| **記憶格式** | Markdown + YAML frontmatter | Markdown + YAML frontmatter | ⚠️ **高度重疊** — 幾乎相同 |
| **版本控制** | Git-native（commit, branch, merge, worktree） | Git-friendly（可選） | ⚠️ **高度重疊** |
| **Progressive disclosure** | filetree + frontmatter 作為 navigation signal | 同概念 | ⚠️ **重疊** |
| **MCP 整合** | Agent 透過 bash/CLI tool 操作；非純 MCP tool 接口 | 明確要 MCP tool 接口（`amp_store`, `amp_search`） | 🔶 **部分差異** |
| **互通性** | 封閉在 Letta Code 生態；不同框架無法直接讀取 | 跨 framework 的開放標準是核心目標 | ✅ **差異明顯** |
| **加密 / 身份** | 無（純 local filesystem） | W3C CG charter 強調 post-quantum 身份綁定 | ✅ **差異明顯** |
| **稽核 / GDPR** | 無 | Cryptographic erasure + audit anchor | ✅ **差異明顯** |
| **Sharing contracts** | 無 | Temporary/permanent/syndicate revocation | ✅ **差異明顯** |
| **目標用戶** | Letta Code 用戶（coding agent） | 所有 agent framework | ✅ **更廣** |

**結論**：Letta Context Repositories 在 **檔案格式和 git 版本控制** 層面和我們方向高度重疊，甚至可視為 open-standard 版本的先行驗證。差異在於 Letta 是 proprietary runtime（雖 open-source），而我們的方向是 **跨框架互通的 open spec**，加上 Letta 完全不處理加密、身份綁定、稽核等企業合規需求。

**建議**：可以把 Letta Context Repos 視為「單機 coding agent 場景的 reference implementation 概念驗證」，參考其 filetree + frontmatter + git-worktree multi-agent 模式，但在 spec 設計上要超越它，覆蓋 identity、encryption envelope、cross-framework portability 等企業場景。

***

## 競爭格局總結

| 層次 | 現有解決方案 | 空白 |
|---|---|---|
| **W3C 標準層** | AI Agent Memory Interop CG（2026-06-03，4 人，無草案）；Agent Identity Registry CG（2026-04）| 缺乏任何可用草案；至少 12–18 個月內不會有 Recommendation |
| **Open spec 層** | 5+ 個 AMP 變體，無一獲社群聚合；OAMP、UMP 等各自為政 | 急需一個有 reference impl + benchmark 驗證的主導 spec |
| **Framework 層** | Letta MemFS（git-backed）、Mem0、Zep（graph）、Redis agent-memory | 格式不互通；跨 framework 遷移代價大 |
| **學術層** | Hu et al. 2025 forms-functions-dynamics；Jiang et al. 2026 empirical taxonomy | 缺乏與工程規格的橋接 |
| **企業標準借鑑** | VC v2.0、SKOS、Dublin Core、DID Core 均可用但未整合 | 尚無人把這些標準接線進 agent memory 場景 |

---

## References

1. [Call for Participation in AI Agent Memory Interoperability Community ...](https://www.w3.org/community/ai-agent-memory-interop/2026/06/03/call-for-participation-in-ai-agent-memory-interoperability-community-group-community-group/) - This group was originally proposed on 2026-05-18 by Russell Jackson. The following people supported ...

2. [sysbotcg | Community and Business Groups - W3C](https://www.w3.org/community/blog/author/sysbotcg/) - Call for Participation in AI Agent Memory Interoperability Community Group Community Group · sysbotc...

3. [Current Groups - W3C](https://www.w3.org/community/groups/) - AI Agent Memory Interoperability. Created on 3 June 2026 (4 participants). The AI Agent Memory Inter...

4. [Proposed Group: AI Agent Memory Interoperability Community ...](https://www.w3.org/community/blog/2026/05/18/proposed-group-ai-agent-memory-interoperability-community-group-community-group/) - The AI Agent Memory Interoperability Community Group exists to develop, evolve, and document an open...

5. [W3C AI Agent Protocol Community Group Latest Progress (June 2025)](https://agent-network-protocol.com/blogs/posts/w3c-agent-protocol-progress-202506.html) - The mission of the AI Agent Protocol Community Group is to develop open, interoperable protocols tha...

6. [agentmemoryprotocol/agentmemoryprotocol: Agent ... - GitHub](https://github.com/agentmemoryprotocol/agentmemoryprotocol) - Agent Memory Protocol (AMP). An open standard for portable, structured AI agent memory. License: Apa...

7. [akshayaggarwal99/amp - The Agent Memory Protocol - GitHub](https://github.com/akshayaggarwal99/amp) - AMP: The Agent Memory Protocol — Open source, MCP-native memory server for AI agents. Give your LLMs...

8. [mmorris35/agent-memory-protocol: Agent Memory Protocol ... - GitHub](https://github.com/mmorris35/agent-memory-protocol) - Agent Memory Protocol (AMP) defines a standard interface for agent memory operations. Like MCP stand...

9. [smriti-memcore/amp: Agent Memory Protocol (AMP) - GitHub](https://github.com/smriti-memcore/amp) - AMP is an open specification that defines a standard interface for persistent memory in AI agent sys...

10. [Agent Memory Protocol](https://agentmemoryprotocol.io) - AMP is under active development. Star the repo to get notified when the spec and reference implement...

11. [deep-thinking-lab/open-agent-memory-protocol - GitHub](https://github.com/deep-thinking-llc/open-agent-memory-protocol) - Open Agent Memory Protocol (OAMP) — A standard for storing, exchanging, and querying memory data bet...

12. [Universal Memory Protocol (UMP) - an open standard for ... - GitHub](https://github.com/edihasaj/universal-memory-protocol) - UMP standardizes how agents read, write, revise, forget, and exchange memory across tools, runtimes,...

13. [Agent-Memory Protocol: A Privacy-Focused Protocol for LLM Agents ...](https://proceedings.mlr.press/v317/wu26a.html) - We introduce the Agent-Memory Protocol (AMP), a privacy-first protocol for LLM Agents and User Memor...

14. [[2512.13564] Memory in the Age of AI Agents - arXiv](https://arxiv.org/abs/2512.13564) - This work aims to provide an up-to-date landscape of current agent memory research. We begin by clea...

15. [Paper page - Memory in the Age of AI Agents - Hugging Face](https://huggingface.co/papers/2512.13564) - This survey provides an updated overview of agent memory research, distinguishing its forms, functio...

16. [[2602.19320] Anatomy of Agentic Memory: Taxonomy and Empirical ...](https://arxiv.org/abs/2602.19320) - Abstract page for arXiv paper 2602.19320: Anatomy of Agentic Memory: Taxonomy and Empirical Analysis...

17. [Paper page - Anatomy of Agentic Memory: Taxonomy and Empirical ...](https://huggingface.co/papers/2602.19320) - Agentic memory systems enable large language model (LLM) agents to maintain state across long intera...

18. [FredJiang0324/Anatomy-of-Agentic-Memory - GitHub](https://github.com/FredJiang0324/Anatomy-of-Agentic-Memory) - [2026/02/23] Our survey Anatomy of Agentic Memory is released on arXiv! See paper for details. [2026...

19. [Anatomy of Agentic Memory: Taxonomy and Empirical Analysis of ...](https://arxiv.org/html/2602.19320v1) - Memory in the Age of AI Agents Hu et al. (2025) proposes a “forms–functions–dynamics” framework that...

20. [Generative Agents: Interactive Simulacra of Human Behavior - arXiv](https://arxiv.org/abs/2304.03442) - In this paper, we introduce generative agents--computational software agents that simulate believabl...

21. [[PDF] Generative Agents: Interactive Simulacra of Human Behavior](https://3dvar.com/Park2023Generative.pdf) - Our architecture comprises three main components. The first is the memory stream, a long-term memory...

22. [Letta (formerly MemGPT) - GitHub](https://github.com/letta-ai/letta) - Install the Letta Code CLI tool: npm install -g @letta-ai/letta-code; Run letta in your terminal to ...

23. [Rearchitecting Letta's Agent Loop: Lessons from ReAct, MemGPT ...](https://www.letta.com/blog/letta-v1-agent) - Letta Code is the memory-first agent. Instead of working in independent sessions, you work with a pe...

24. [TravelAgent: Generative agents in the built environment](https://journals.sagepub.com/doi/10.1177/23998083251360458) - Typical GA architectures include a Memory Stream for recording experiences, Reflection for synthesiz...

25. [Enhancing memory retrieval in generative agents through LLM ...](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1591618/full) - This system calculates and ranks attention weights between an agent's current state and stored memor...

26. [A-Mem: Agentic Memory for LLM Agents | OpenReview](https://openreview.net/forum?id=FiM0M8gcct) - The concept of a dynamically evolving memory structure is intuitive and compelling, as it mirrors th...

27. [Generative Agents: Interactive Simulacra of Human Behavior](https://www.semanticscholar.org/paper/Generative-Agents:-Interactive-Simulacra-of-Human-Park-O%E2%80%99Brien/5278a8eb2ba2429d4029745caf4e661080073c81/figure/3) - This work describes an architecture that extends a large language model to store a complete record o...

28. [[PDF] Generative Agents: Interactive Simulacra of Human Behavior](https://www.semanticscholar.org/paper/Generative-Agents:-Interactive-Simulacra-of-Human-Park-O'Brien/5278a8eb2ba2429d4029745caf4e661080073c81) - This work describes an architecture that extends a large language model to store a complete record o...

29. [Verifiable Credentials Data Model v2.0 - W3C](https://www.w3.org/TR/vc-data-model-2.0/) - A verifiable credential is a specific way to express a set of claims made by an issuer, such as a dr...

30. [W3C Verifiable Credentials 2.0: The New Standard Reshaping ...](https://vidos.id/blog/w3c-verifiable-credentials-2-0-the-new-standard-reshaping-enterprise-digital-identity) - The recent publication of the W3C Verifiable Credentials 2.0 standard as an official W3C Recommendat...

31. [Verifiable Credentials - Agntcy](https://docs.agntcy.org/identity/credentials/) - A verifiable credential is a structured and cryptographically verifiable way to express claims made ...

32. [DCMI: Metadata Basics - Dublin Core](https://www.dublincore.org/resources/metadata-basics/) - Dublin Core™ metadata, or perhaps more accurately metadata "in the Dublin Core™ style", is metadata ...

33. [Agent Identity Registry Protocol Community Group - W3C](https://www.w3.org/community/agent-identity/) - The group's work addresses how AI agents can present cryptographically verifiable credentials that b...

34. [Introducing Context Repositories: Git-based Memory for Coding ...](https://www.letta.com/blog/context-repositories/) - We're introducing Context Repositories, a rebuild of how memory works in Letta Code based on program...

35. [Letta | Machines that learn](https://www.letta.com) - Context Repositories: Git-based Memory FEB 2026. A rebuild of how agent memory works, using programm...

36. [Letta's next phase](https://www.letta.com/blog/our-next-phase) - Feb 12, 2026. Introducing Context Repositories: Git-based Memory for Coding Agents. We're introducin...

