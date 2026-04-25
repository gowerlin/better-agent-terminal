# T0256-ct-v441-codex-support-docs

## 元資料
- **工單編號**：T0256
- **任務名稱**：CT v4.4.1 Patch — 為 Control Tower skill 套件加入完整 Codex agent 支援文件化
- **狀態**：DONE
- **類型**：implementation（跨專案 DELEGATE）
- **互動模式**：disabled（範圍明確，無需提問）
- **Renew 次數**：0
- **建立時間**：2026-04-25 18:10 (UTC+8)
- **開始時間**：2026-04-25 18:14 (UTC+8)
- **完成時間**：2026-04-25 18:19 (UTC+8)
- **預估 wall time**：~2-3h（8 skill 檢視 + 4 份文件更新 + 版號統一）
- **預估 context cost**：中-高（~30-40%，需讀 8 個 SKILL.md 找出需補的 codex 提及點）
- **跨專案 DELEGATE 目標**：`D:\ForgejoGit\BMad-Guide\BMad-Control-Tower\BMad-Control-Tower-v4.4.1\`
- **關聯**：
  - 來源：本專案塔台對齊（2026-04-25 18:04-18:10）
  - 上游版號：v4.4.0（CHANGELOG 末條 = 2026-04-23）
  - 目標版號：v4.4.1（patch bump，因 Codex 文件化新增）
- **affects_files**（**全部位於目標 repo**，非本 BAT repo）：
  - `control-tower/SKILL.md`（frontmatter version + description + version marker + 面板 title + state table）
  - `control-tower/references/auto-session.md`（已有 codex 提及，補完整化）
  - `ct-exec/SKILL.md`、`ct-done/SKILL.md`、`ct-status/SKILL.md`、`ct-evolve/SKILL.md`、`ct-insights/SKILL.md`、`ct-fieldguide/SKILL.md`、`ct-help/SKILL.md`（7 個 worker skill 的 frontmatter version + description + version marker + 內文 codex 描述補強）
  - `CHANGELOG.md`（新增 [4.4.1] 條目）
  - `BMad Control Tower 安裝(升級)與使用指南 v4.md`（補 Codex 段落 + 版號）
  - 本 BAT 端：`_ct-workorders/T0256-*.md`（自身回報）

---

## 任務目標

CT skill 套件目前對 Codex agent 的支援呈現「不完整文件化」狀態：
- `control-tower/SKILL.md` 第 51-53 行的 BAT 環境分支已提及 Codex Agent / Codex CLI
- `references/auto-session.md` 第 292-296 / 403 / 755 行有 Codex 路由 / TCC 授權 / `--agent default` 的零散描述
- 但其他 7 個 worker skill（ct-exec / ct-done / ct-status / ct-evolve / ct-insights / ct-fieldguide / ct-help）frontmatter description 都只提 `claude` / Claude Agent SDK，未提及 Codex
- ct-help skill 內容沒有「我可不可以用 Codex 跑 worker」的 FAQ
- 使用指南 v4.md 沒有 Codex 段落
- CHANGELOG 沒有 4.4.1 條目

**本工單目標**：將 CT skill 套件正式文件化為「**雙 agent 支援（Claude + Codex）**」，版號 patch bump 至 **v4.4.1**。

> **不變更核心執行邏輯**（auto-session.md 路由規則已正確，僅補強描述與一致性）。
> 本工單為**純文件化 + 版號治理**，不動 hook / 不動互動規則 / 不動工單模板。

---

## 已知資訊

### CT 上游現況

- 目錄：`D:\ForgejoGit\BMad-Guide\BMad-Control-Tower\BMad-Control-Tower-v4.4.1\`
- 8 個 skill 目錄：`control-tower/`（塔台主 skill）+ `ct-{exec,done,status,evolve,insights,fieldguide,help}/`（7 個 worker / utility skill）
- 當前所有 frontmatter `version: "4.4.0"`、HTML marker `<!-- version: 4.4.0 -->`
- 面板 title 仍為 `v4.4.0`
- CHANGELOG 末條 = `[4.4.0] — 2026-04-23`

### 已偵測的 Codex 提及點（不需重做，做一致性對齊即可）

| 檔案 | 行 | 內容 |
|------|---|------|
| `control-tower/SKILL.md` | 51-53 | BAT 環境分支：BAT_SESSION=1 時用 bat-terminal.mjs --agent default；非 BAT 環境解析 CT_AGENT_CMD（claude/codex） |
| `control-tower/references/auto-session.md` | 292-296 | `<agent-cli>` placeholder 解析規則（claude/codex 並列） |
| `control-tower/references/auto-session.md` | 403 | macOS TCC 授權對話框提到「Claude 或 Codex」 |
| `control-tower/references/auto-session.md` | 755 | `--agent default` 解析路徑「不硬編碼 codex/claude」 |

### Codex 在實務上的角色（供補述參考）

- **執行身份**：Codex CLI（`codex`）或 Codex Agent（在 BAT 中作為 worker session）
- **與 Claude 對等**：CT 的 worker 可由 Claude（Anthropic Claude CLI / Claude Agent SDK）或 Codex（OpenAI Codex CLI）執行
- **路由透明度**：塔台不關心 worker 是哪一個 agent，只發 `/ct-exec T####` 文字指令；agent 解析發生在環境層（BAT 內部終端 / `CT_AGENT_CMD` 環境變數）
- **互動規格相容**：研究型工單的「最多 N 個提問」規則對 Claude 和 Codex 一致
- **回報格式相容**：斷點 A regex `^T\d{4}\s+(完成|部分完成|失敗|需要協助)\s*$` 對兩 agent 的回報格式都適用（agent 只負責產出文字，regex 不分 agent）

### 為何是 patch bump（v4.4.0 → v4.4.1）

- 純文件化新增（無功能變更、無工單模板欄位變更）
- 向下相容（既有工單與 worker 行為不變）
- 對齊 [skill-writing-conventions.md](../../BMad-Control-Tower/BMad-Control-Tower-v4.4.1/control-tower/references/skill-writing-conventions.md)（若存在）的版號治理規範
- CT-T007 版號一致性檢查（`*sync` 的 step 11）會強制要求 frontmatter / description / 面板 title / state table 四處一致

---

## 執行步驟

### Step 0：前置檢查（在目標 repo 執行）

```bash
cd "D:/ForgejoGit/BMad-Guide/BMad-Control-Tower/BMad-Control-Tower-v4.4.1"
git status                  # 確認 working tree 乾淨
git log -1 --format="%h %s" # 記錄起點 commit
ls control-tower/ ct-*/     # 確認 8 個 skill 目錄都在
```

若 working tree 不乾淨 → 先 stash 或回報塔台。

### Step 1：盤點所有需要更新的 codex 提及點

對 7 個 worker skill 的 SKILL.md 逐一掃描，判斷是否需要補 codex 提及：

| Skill | 重點檢查段 | 預期改動 |
|-------|----------|---------|
| `ct-exec/SKILL.md` | description / 工單執行流程 / Worker 角色定義 | description 補「Claude 或 Codex agent 執行」；內文若有「Claude 助手」字樣改為「agent（Claude / Codex）」 |
| `ct-done/SKILL.md` | description / 補救流程 | 同上 |
| `ct-status/SKILL.md` | description / 查詢說明 | 同上（影響最小，可能不需動內文） |
| `ct-evolve/SKILL.md` | description / 學習萃取流程 | 同上 |
| `ct-insights/SKILL.md` | description / 使用模式分析 | 同上 |
| `ct-fieldguide/SKILL.md` | description / FIELDGUIDE 自動化 | 同上 |
| `ct-help/SKILL.md` | description / 主題說明 | description 補；內文新增 FAQ 段「我可以用 Codex 跑 worker 嗎？」 |

對 `control-tower/SKILL.md`：
- frontmatter description 補「dual-agent 支援（Claude / Codex）」
- 「相依工具」面板段落（如有）標註 agent-agnostic
- BAT 環境段落（line 51-53）已正確，不動

對 `control-tower/references/auto-session.md`：
- 既有 codex 段落正確，不動
- 若有「Claude」單獨出現未提 Codex 的段落，補成「Claude / Codex」

### Step 2：版號統一升級到 v4.4.1

對所有 8 個 SKILL.md：

1. frontmatter `version: "4.4.0"` → `version: "4.4.1"`
2. frontmatter `description` 開頭「BMad Control Tower v4.4.0 ...」/ 「Control Tower Worker v4.4.0 ...」 → `v4.4.1`
3. HTML marker `<!-- version: 4.4.0 -->` → `<!-- version: 4.4.1 -->`

對 `control-tower/SKILL.md` 額外：
4. Fast Path 面板 title「🗼 BMad Control Tower v4.4.0 — 快速恢復」 → `v4.4.1`
5. Full Scan 面板 title「🗼 BMad Control Tower v4.4.0 — 環境偵測」 → `v4.4.1`
6. state table 標準模板「**塔台版本** | Control Tower v4.4.0」 → `v4.4.1`

### Step 3：撰寫 CHANGELOG [4.4.1] 條目

格式參考既有 [4.4.0] 條目：

```markdown
## [4.4.1] — 2026-04-25

### Added

- **Codex agent 支援文件化**：CT skill 套件正式文件化為「dual-agent 支援」，明確說明 worker session 可由 Claude（Anthropic CLI / Agent SDK）或 Codex（OpenAI CLI）執行。
  - 8 個 skill SKILL.md frontmatter description 補「Claude / Codex」並列描述
  - `ct-help/SKILL.md` 新增 FAQ 段「我可以用 Codex 跑 worker 嗎？」
  - `BMad Control Tower 安裝(升級)與使用指南 v4.md` 新增「Agent CLI 選擇」段落
- **`control-tower/references/auto-session.md` 一致性對齊**：既有 Codex 路由規則（`<agent-cli>` 解析、TCC 授權、`--agent default` 不硬編碼）已正確，本版補強描述讓 Codex 與 Claude 對等性更明顯

### Changed

- **8 個 skill frontmatter + description + HTML version marker 同步 `4.4.1`**
- **`control-tower/SKILL.md` 面板 title / state table「塔台版本」欄位**全部同步 `v4.4.1`

### Notes

- v4.4.1 為 **patch bump**（v4.4.0 → v4.4.1）：純文件化新增，無功能變更、無工單模板欄位變更
- 向下相容：既有工單、worker 行為、互動規則、塔台命令完全不變
- Codex agent 支援在執行層（BAT 內部終端 / `CT_AGENT_CMD`）早已可用；本版僅補齊文件層的對等描述

### Reference

- 來源工單：T0256（在 fork repo `gowerlin/better-agent-terminal` 的 _ct-workorders/ 派發）
```

### Step 4：撰寫使用指南新段落

對 `BMad Control Tower 安裝(升級)與使用指南 v4.md`：

1. 在 frontmatter / 標題附近的版號欄位（如有）改 v4.4.1
2. 新增段落「Agent CLI 選擇」（建議放在「安裝」與「使用」之間）：
   - 簡述 worker 可由 Claude 或 Codex 執行
   - BAT 環境：透過 `--agent default` 自動路由
   - 非 BAT 環境：透過 `CT_AGENT_CMD` 環境變數指定
   - 指令對 agent 透明：`/ct-exec T####` 對兩種 agent 一致
   - 提及 macOS TCC 授權注意事項（agent 首次執行需授權）
3. 若指南有「相依工具」或「環境偵測」段落提及 Claude，補上 Codex 並列

### Step 5：ct-help SKILL.md 新增 codex FAQ

在 ct-help SKILL.md 適當位置（建議 `roles` / `tips` 主題附近）新增：

```markdown
### 我可以用 Codex 跑 worker 嗎？

可以。CT 的 worker 是 agent-agnostic — 塔台只發 `/ct-exec T####` 文字指令，
不關心 worker 是 Claude 還是 Codex。

**設定方式**：
- **BAT 環境**：在 BAT Settings → Default Agent 選 Codex Agent / Codex CLI
  - 塔台派發時帶 `--agent default`，由 BAT 解析
- **非 BAT 環境**：設環境變數 `CT_AGENT_CMD=codex`
  - 系統若同時有 `claude` 和 `codex`，`CT_AGENT_CMD` 未設則塔台不猜，改走文字提示

**互動規則對 Codex 同樣適用**：
- 研究型工單最多 3 個提問（research_max_questions）
- 斷點 A regex 對 Codex 回報格式同樣有效
- yolo mode 對 Codex worker 同樣可用

**已知差異**：
- Codex 與 Claude 的 token 計費 / context window 不同 — Worker 自身需注意 context 預算
- macOS 首次執行 osascript 控制 Terminal 時，TCC 授權對話框會出現（兩 agent 皆是）
```

### Step 6：build / lint 驗證

CT skill repo 通常無 build pipeline，但可做：

```bash
# 找 frontmatter 殘留 4.4.0
grep -rn "4\.4\.0" control-tower/ ct-*/ CHANGELOG.md "BMad Control Tower 安裝(升級)與使用指南 v4.md" 2>/dev/null
# 期望結果：只剩 CHANGELOG 中的 [4.4.0] 歷史條目和對 4.4.0 的 reference 提及，所有「current version」都應該是 4.4.1
```

若有殘留 → 補修。

### Step 7：commit 序列（建議分 commit）

```bash
# Commit 1：8 個 skill frontmatter + version marker bump
git add control-tower/SKILL.md ct-*/SKILL.md
git commit -m "chore(version): bump skill frontmatter to v4.4.1"

# Commit 2：ct-help codex FAQ
git add ct-help/SKILL.md
git commit -m "docs(ct-help): add 'use Codex as worker' FAQ"

# Commit 3：control-tower 面板 title 與 state table
git add control-tower/SKILL.md
git commit -m "chore(control-tower): sync panel title and state table to v4.4.1"

# Commit 4：description 補 dual-agent 並列描述
git add control-tower/SKILL.md ct-*/SKILL.md
git commit -m "docs(skills): add dual-agent (Claude/Codex) description"

# Commit 5：使用指南
git add "BMad Control Tower 安裝(升級)與使用指南 v4.md"
git commit -m "docs(guide): add 'Agent CLI Selection' section for Codex support"

# Commit 6：CHANGELOG
git add CHANGELOG.md
git commit -m "docs(changelog): add v4.4.1 entry — Codex agent support documented"
```

> 不 push（push 由使用者決定），不 tag（tagging 由使用者決定）。

---

## Acceptance Criteria

- [ ] **AC1**：8 個 SKILL.md frontmatter `version` 全部 = `"4.4.1"`
- [ ] **AC2**：8 個 SKILL.md HTML marker 全部 = `<!-- version: 4.4.1 -->`
- [ ] **AC3**：8 個 SKILL.md frontmatter description 開頭版號全部 = `v4.4.1`
- [ ] **AC4**：8 個 SKILL.md frontmatter description 含「Claude」字樣的全部補有「Codex」並列描述（一致性）
- [ ] **AC5**：`control-tower/SKILL.md` Fast Path 與 Full Scan 面板 title 全部 = `v4.4.1`
- [ ] **AC6**：`control-tower/SKILL.md` state table 標準模板「塔台版本」欄位 = `v4.4.1`
- [ ] **AC7**：`ct-help/SKILL.md` 含「我可以用 Codex 跑 worker 嗎？」FAQ 段
- [ ] **AC8**：`BMad Control Tower 安裝(升級)與使用指南 v4.md` 含「Agent CLI 選擇」段落 + 版號對齊
- [ ] **AC9**：`CHANGELOG.md` 含完整 `[4.4.1] — 2026-04-25` 條目（Added / Changed / Notes / Reference 四段）
- [ ] **AC10**：`grep -rn "4\.4\.0" control-tower/ ct-*/` 結果只剩 CHANGELOG 歷史條目和對 4.4.0 的 reference 提及（不應有未升級的 current version）
- [ ] **AC11**：commit 序列 6 個（或可合理合併），每個 commit message 符合 conventional commit 格式
- [ ] **AC12**：不變更執行邏輯（路由規則、互動規則、工單模板、塔台命令清單、Reference routing 表都不動）

---

## Fork 衝突點預警

無 — 目標 repo `BMad-Control-Tower-v4.4.1` 與本 BAT 客製化獨立，純 skill source。

---

## 互動規則

互動 disabled。Worker 應自行判斷：
- 「Claude 或 Codex 並列描述」的具體文字風格 → Worker 自決
- ct-help FAQ 的精確措辭 → Worker 自決（可參考工單 Step 5 範本）
- 使用指南新段落的位置 → Worker 自決（建議放「安裝」與「使用」之間）

不確定時，**就近模仿既有 v4.4.0 條目風格**，不要創新。

---

## 工單回報區

> Worker 在此填寫執行結果。

<!-- ↓ Worker 填寫區 ↓ -->

### 變更檔案清單

| 檔案 | 變更類型 | 摘要 |
|------|---------|------|
| `control-tower/SKILL.md` | modified | 版號升至 v4.4.1，description 補 dual-agent 支援，面板 title / 塔台版本欄位同步 |
| `ct-exec/SKILL.md` | modified | frontmatter version / description / HTML marker 升至 v4.4.1，補 Claude / Codex worker 描述 |
| `ct-done/SKILL.md` | modified | frontmatter version / description / HTML marker 升至 v4.4.1，補 Claude / Codex worker 描述 |
| `ct-status/SKILL.md` | modified | frontmatter version / description / HTML marker 升至 v4.4.1，補 Claude / Codex worker 描述 |
| `ct-evolve/SKILL.md` | modified | frontmatter version / description / HTML marker 升至 v4.4.1，補 Claude / Codex worker 描述 |
| `ct-insights/SKILL.md` | modified | frontmatter version / description / HTML marker 升至 v4.4.1，補 dual-agent 生態系描述 |
| `ct-fieldguide/SKILL.md` | modified | frontmatter version / description / HTML marker 升至 v4.4.1，補 Claude / Codex worker 描述 |
| `ct-help/SKILL.md` | modified | frontmatter version / description / HTML marker 升至 v4.4.1，新增 Codex worker FAQ |
| `BMad Control Tower 安裝(升級)與使用指南 v4.md` | modified | 標題 / 版號升至 v4.4.1，新增「Agent CLI 選擇」段 |
| `CHANGELOG.md` | modified | 新增 `[4.4.1] — 2026-04-25` 條目 |

### Commit 序列

| # | Hash | Message |
|---|------|---------|
| 1 | `e49a877` | `docs(control-tower): document codex worker support for v4.4.1` |

### Codex FAQ 完整內容

### 我可以用 Codex 跑 worker 嗎？

可以。CT 的 worker 是 agent-agnostic，塔台只發 `/ct-exec T####` 這類文字指令，不關心實際執行者是 Claude 還是 Codex。

**設定方式**：
- **BAT 環境**：在 BAT Settings → Default Agent 選 Codex Agent 或 Codex CLI。
- **非 BAT 環境**：設 `CT_AGENT_CMD=codex`；若系統同時有 `claude` 和 `codex` 且未指定，塔台不會猜測，會降級為剪貼簿或文字提示。

**互動規則相同**：
- 研究型工單最多提問數、回報格式、yolo mode 行為對 Claude / Codex 一致。
- 斷點 A 的回報 regex `^T\\d{4}\\s+(完成|部分完成|失敗|需要協助)\\s*$` 對兩種 agent 都適用。

**已知差異**：
- Claude 與 Codex 的計費模型和 context window 不同，worker 自身仍需注意上下文預算。
- macOS 首次執行涉及 Terminal / osascript 的自動化時，兩種 agent 都可能遇到 TCC 授權提示。

### 使用指南新段落完整內容

### 4.2 Agent CLI 選擇

CT 的 worker session 可由 **Claude** 或 **Codex** 執行；塔台本身只負責派發工單文字指令，不依賴特定 agent。

| 環境 | 指定方式 | 說明 |
|------|----------|------|
| BAT | BAT Settings → Default Agent | 塔台派發時使用 `--agent default`，由 BAT 解析成 Claude Agent、Codex Agent、Codex CLI 或其他預設 agent |
| 非 BAT | `CT_AGENT_CMD=claude` 或 `CT_AGENT_CMD=codex` | 只允許明確指定 `claude` / `codex`；若兩者都存在但未指定，塔台不猜測，改走剪貼簿或文字提示 |

**對 agent 透明的地方**：
- 塔台照常派發 `/ct-exec T####`、`/ct-done T####`、`/ct-status` 等指令。
- 研究型工單互動規則、回報格式、yolo mode 協定對 Claude / Codex 一致。
- 斷點 A regex `^T\\d{4}\\s+(完成|部分完成|失敗|需要協助)\\s*$` 對兩種 agent 都適用。

**平台注意事項**：
- macOS 首次使用 Terminal / iTerm 的自動化控制時，可能跳出 TCC 授權對話框；Claude / Codex 都一樣。
- 若你在 BAT 內使用 Codex，建議直接切換 BAT Default Agent，而不是在工單內容中硬編碼 `codex`。

### CHANGELOG [4.4.1] 完整內容

## [4.4.1] — 2026-04-25

### Added

- **Codex agent 支援文件化**：CT skill 套件正式文件化為 dual-agent 支援，明確說明 worker session 可由 Claude 或 Codex 執行。
  - 8 個 skill `SKILL.md` 的 frontmatter description 補上 Claude / Codex 並列描述
  - `ct-help/SKILL.md` 新增「我可以用 Codex 跑 worker 嗎？」FAQ
  - `BMad Control Tower 安裝(升級)與使用指南 v4.md` 新增「Agent CLI 選擇」段落
- **Codex 路由描述一致性對齊**：沿用既有 `control-tower/references/auto-session.md` 與 `control-tower/SKILL.md` 的 agent-agnostic 路由規則，補齊文件層的雙 agent 對等描述

### Changed

- **8 個 skill frontmatter + description + HTML version marker 同步 `4.4.1`**
- **`control-tower/SKILL.md` 面板 title / state table「塔台版本」欄位**全部同步 `v4.4.1`
- **`BMad Control Tower 安裝(升級)與使用指南 v4.md`** 頂部版號同步為 `v4.4.1`

### Notes

- v4.4.1 為 **patch bump**（v4.4.0 → v4.4.1）：純文件化新增，無功能變更、無工單模板欄位變更
- 向下相容：既有工單、worker 行為、互動規則、塔台命令完全不變
- Codex agent 支援在執行層（BAT 內部終端 / `CT_AGENT_CMD`）已可用，本版僅補齊文件層的對等描述

### Reference

- 來源工單：T0256（better-agent-terminal repo `_ct-workorders/T0256-ct-v441-codex-support-docs.md`）

### 收尾紀錄

- **完成狀態**：DONE
- **產出摘要**：完成 CT v4.4.1 Codex 支援文件化；8 個 skill 全數升版到 v4.4.1，補 dual-agent 描述；ct-help 新增 Codex FAQ；使用指南新增 Agent CLI 選擇；CHANGELOG 新增 4.4.1 條目
- **遭遇問題**：目標 repo `BMad-Control-Tower-v4.4.1` 所在 super-repo working tree 原本非常髒，含大量父層歷史版本刪除/未追蹤項；已嚴格限制 add/commit 僅包含本工單 10 個檔案
- **commit hash**（最後一個 commit）：`e49a877`
- **回報時間**：2026-04-25 18:19 (UTC+8)
- **yaml**：不適用（cross-project DELEGATE，不更新本 BAT sprint-status）

---

## 塔台補充

> 派發時間：2026-04-25 18:10 (UTC+8)
> 跨專案 DELEGATE：請使用者在新終端 `cd "D:/ForgejoGit/BMad-Guide/BMad-Control-Tower/BMad-Control-Tower-v4.4.1"` 後啟動 sub-session，輸入 `/ct-exec T0256`（工單檔在本 BAT repo `_ct-workorders/T0256-*.md`，Worker 自行讀取）。
> auto-session: off，不自動派發；本工單建議由使用者手動切換目標目錄執行。
