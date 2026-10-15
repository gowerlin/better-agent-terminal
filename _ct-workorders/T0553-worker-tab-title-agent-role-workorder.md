---
schema_version: 1
schema_kind: workorder
id: T0553
title: "外部建立分頁的預設標題：Worker 顯示「Claude CLI · Worker · T0551」（Agent 顯示名 · 角色 · 工單號），非 Worker 顯示 Agent 名或命令檔名，拿掉誤導的「Remote:」；使用者 alias 優先，舊分頁重開後也套用"
type: feature
status: DONE
repo: better-agent-terminal
project: "使用者需求（第六十六 session）；延伸 T0538 Worker 分頁標示"
priority: P2
sizing: S
created_at: "2026-10-16T02:56:20+0800"
updated_at: "2026-10-16T03:48:32+08:00"
started_at: "2026-10-16T03:32:12+08:00"
completed_at: "2026-10-16T03:48:32+08:00"
commit: "bb9b9ddf"
target_version: "0.6.1-pre.5（與 T0551 / T0552 同批）"
depends_on: []
related:
  - "T0538（`.worker-badge` 工單小標籤、已回報 ✓、tooltip）；T0537（`towerTerminalId` / `workorder` 存進分頁）；T0130 / T0431（`terminal:created-externally` → `addExternalTerminal`）"
  - "CLAUDE.md「Worker 分頁回收」節的「分頁標示與手動批次關閉（T0538，UI）」"
affects_files:
  - src/stores/workspace-store.ts
  - src/components/TerminalThumbnail.tsx
  - "src/components/WorkspaceView.tsx（若分頁標題 / 小標籤也在這裡渲染）"
  - "src/types/index.ts（若 `TerminalInstance` 需新增欄位，例如 agent preset id）"
  - "electron/**（僅在 `terminal:created-externally` 需多帶 agent preset id 時；本機與遠端 headless 兩條路徑一致）"
  - "src/locales/*.json（角色字樣若需 i18n，三語）"
  - "src/**/__tests__/**、electron/**/__tests__/**（新增 / 更新測試）"
  - "CLAUDE.md（T0538 分頁標示段落補標題規則）"
  - _ct-workorders/T0553-worker-tab-title-agent-role-workorder.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`（`src/styles/settings.css` 的 M 不是你的變更）。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）；e2e 只用隔離實例（需先 `npx vite build`），自訂 CLI 跑 node 腳本，不耗 token（T0537 / T0538 e2e 做法）。"
  - "🔴 T0551（BUG-140，`pty:write` 輸入判定）與 T0552（WSL 精靈）已先行；若你需要改到它們動過的檔案，以 HEAD 現況為準，不要回退它們的變更。"
  - "🔴 不改 T0538 的已回報比對（`findReportingWorkers`）、右鍵選單、批次關閉與 `--close-worker` 行為；只改標題與小標籤的顯示。"
---

# T0553 — Worker 分頁標題：Agent · 角色 · 工單號

## 背景

使用者回報（第六十六 session，附截圖）：塔台經 helper 派出的 Worker 分頁，縮圖標題一律是 `Remote: 'C:\Users\Gower\.local\bin\claude.exe'`，每個都一樣，看不出是哪張單；而且這些是**本機**分頁，「Remote」反而誤導。T0538 的工單小標籤（`.worker-badge`）雖然存在，但被冗長的標題擠到看不見。

來源：`src/stores/workspace-store.ts` `addExternalTerminal`，`title: info.command ? \`Remote: ${info.command.split(' ')[0]}\` : 'Remote Terminal'`。

## 使用者決定（2026-10-16 02:56）

1. **Worker 分頁**（有 `towerTerminalId` + `workorder`）標題：`<Agent 顯示名> · Worker · <工單號>`，例 `Claude CLI · Worker · T0551`。Agent 顯示名取自 agent preset 的顯示名稱（Claude CLI / Codex CLI…，與 Settings 下拉一致）；工單號用正規化後的 `workorder`。
2. 工單小標籤：工單號已在標題中，小標籤改為**只在已回報時顯示 `✓`**（tooltip 維持 T0538 內容：「`<工單>` 的 Worker，由 `<塔台分頁標題>` 派出」+ 回報狀態）。
3. **非 Worker 的外部建立分頁**（raw command 模式，無工單號）：認得的 agent 顯示其顯示名；否則顯示命令檔名（去掉路徑與引號，例 `node`）；沒有命令時用中性名稱（例 `Terminal`）。**拿掉「Remote:」前綴**；只有真正由遠端 server 建立的分頁（`created-externally` 的 `remote: true`）才在名稱上標示遠端（標示方式由你決定，與既有遠端 UI 一致）。
4. **使用者 alias 優先**：分頁有使用者設定的名稱時一律不動。
5. **舊分頁**：BAT 重開後還原的既有分頁也套用新格式（預設標題由資料推得，或還原時重算；只要不是使用者 alias）。
6. 併入 `0.6.1-pre.5`。

## 任務

1. 找出標題 / alias 的資料模型（`title` 與使用者改名的欄位關係），決定「預設標題」的計算方式：建議以 `TerminalInstance` 已有的 `towerTerminalId` / `workorder` + agent preset id 在渲染或還原時推得，避免把舊格式寫死在 registry。若 `terminal:created-externally` 目前沒有帶 agent preset id，補上（本機 `terminal:create-agent-command` 與遠端 headless 兩條路徑一致；raw command 模式可依命令比對已知 preset，比不到就用檔名）。
2. 改 `addExternalTerminal` 與縮圖 / 分頁列顯示；調整 `.worker-badge`（只在已回報時顯示 `✓`），tooltip 不變。
3. 舊資料相容：registry 內舊格式 `Remote: …` 標題的分頁，重開後顯示新格式；使用者 alias 不受影響。
4. 測試：
   - 單元：Worker（claude / codex / 未知 agent）、非 Worker（已知 agent、一般命令含路徑與引號、無命令）、遠端建立、alias 優先、舊 `Remote: …` 資料還原、已回報 ✓。
   - e2e（隔離實例，比照 `e2e/t0538-worker-tab-batch-close.spec.ts`）：派一張 Worker → 縮圖標題為 `<Agent> · Worker · T####`；回報後出現 ✓；改 alias 後顯示 alias。
5. CLAUDE.md T0538 段落補上標題規則。

## 驗收條件

- [ ] Worker 分頁標題 `<Agent 顯示名> · Worker · <工單號>`；已回報時小標籤顯示 ✓，tooltip 不變
- [ ] 非 Worker 外部分頁不再出現 `Remote:` 與完整路徑；遠端建立的分頁有遠端標示
- [ ] alias 優先；舊分頁重開後套用新格式
- [ ] `npm run test:unit` 全綠（含新測試）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功；既有 `e2e/t0538-worker-tab-batch-close.spec.ts`、`e2e/t0537-worker-ownership-persistence.spec.ts` 仍通過
- [ ] CLAUDE.md 已更新

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

DONE — 驗收條件全部達成；commit `bb9b9ddf`（未 push）。

### 產出摘要

**落點檢查**：C-0 PASS（frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 PASS（`src/stores/workspace-store.ts` 等皆存在）；C-2 無 `branch` 欄位（main）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅紀錄）。CT_MODE=yolo、CT_INTERACTIVE=0。

**資料模型發現**：使用者改名（`MainPanel` 雙擊 → `renameTerminal`）寫的是 `title`，`alias` 欄位實際上沒有 UI 會寫。因此「使用者 alias 優先」的實作是：預設標題只在建立時算一次存進 `title`；還原時只重算**舊預設格式**（`Remote: …` / `Remote Terminal`），其他任何標題（含使用者改的名）一律不動。

**實作**
- 新增 `src/lib/external-terminal-title.ts`（唯一實作）：`externalTerminalTitle`（Worker = `<Agent 顯示名> · Worker · <工單號>`；非 Worker = Agent 名 → 命令檔名 → `Terminal`）、`commandFileName`（去路徑 / 引號 / pwsh `&` / `.exe` 等）、`agentFromCommand`（`claude` / `codex` / `gemini` / `copilot` / `gh copilot`）、`legacyExternalCommand`（認舊標題）、`titleShowsWorkorder`。Agent 顯示名順序：renderer preset 名（`getAgentPreset`，與 Settings 下拉一致）→ main 帶來的 registry 名（自訂 CLI）→ 由命令認出的已知 CLI → 命令檔名 → agent id。
- `electron/terminal-command-handlers.ts`：`terminal:create-agent-command` 把解析出的 `agentId` 與 `agentRegistry` 名稱以 `agent` / `agentName` 帶進 `terminal:created-externally`（本機與 headless 共用 `createWithCommand`，兩條路徑一致）。**只供標題，不傳給 `ptyManager.create`**（避免改到 `agentPreset` 觸發的 env 注入，例如 `DISABLE_UPDATES`）。raw command 模式不帶。
- `src/stores/workspace-store.ts`：`addExternalTerminal` 改用新標題；`remote: true` → `TerminalInstance.remoteOrigin`（新欄位，存 / 讀 registry）；`toTerminalInstance` 還原時重算舊預設標題（load 與 detached adopt 共用）。
- `src/components/TerminalThumbnail.tsx`：標題含工單號時小標籤只在已回報時顯示 `✓`（tooltip 不變；未回報時 tooltip 掛在標題上）；縮圖根元素加 `data-workorder`；`remoteOrigin` → `.remote-origin-badge`（文字沿用既有 `profiles.remote`：REMOTE / 遠端 / 远程，與 Profile 清單的遠端標示一致；tooltip 新 i18n 鍵 `workerTabs.remoteOriginTooltip` 三語）。CSS 在 `src/styles/panels.css`。
- 型別：`src/types/index.ts`（`remoteOrigin`）、`src/types/electron.d.ts` / `electron/preload.ts`（事件 payload 加 `agent` / `agentName` / `remote`）。
- CLAUDE.md：T0538 段落補註，新增「外部建立分頁的標題（T0553）」一條。

**設計決定（我做的）**
1. 遠端標示用縮圖小標籤（REMOTE），而非寫進標題字串：可隨語言顯示、且不污染使用者可改名的 `title`。
2. 使用者把 Worker 改名後標題不再含工單號 → 小標籤恢復 T0538 的 `T####` / `✓ T####`，避免工單號完全看不到（使用者決定 2 的前提是「工單號已在標題中」）。
3. 舊標題 `Remote: 'C:\Program`（舊邏輯在第一個空白截斷含空白路徑）或 `Remote: &`（pwsh）認不出檔名 → Worker 顯示 `Terminal · Worker · T####`，不猜 agent。
4. 舊分頁沒有 `remoteOrigin` 資料，還原後不顯示遠端標籤（無法事後判斷）。

**測試變更**
- 新增：`src/lib/__tests__/external-terminal-title.test.ts`（claude / codex / copilot / 自訂 CLI / 未知 agent、已知 agent、路徑與引號、pwsh `&`、無命令、舊標題辨識）、`src/stores/__tests__/workspace-store.externalTitle.test.ts`（Worker 三種 agent、非 Worker、remoteOrigin 存讀、改名後 save→load 保留、舊 `Remote: …` 還原與存回）、`src/components/__tests__/worker-tab-title.test.tsx`（未回報無標籤 / 已回報 `✓` / tooltip / `data-workorder` / 改名後 T0538 標籤 / 遠端標籤）、`e2e/t0553-worker-tab-title.spec.ts`。
- 更新：`electron/__tests__/terminal-handlers.test.ts`（5 處 payload `toEqual` 加 `agent` / `agentName`，新增 T0553 測試：registry 沒有的 agent 只帶 id、raw command 不帶、PTY 不收到 agent）、`electron/remote/__tests__/headless-terminal.test.ts`（payload 加 `agent` / `agentName`）、`src/stores/__tests__/workspace-store.workerOwnership.test.ts`（舊資料還原的標題 `Remote: claude` → `Claude CLI`，刻意的行為變更）、`e2e/t0538-worker-tab-batch-close.spec.ts`（定位改 `.thumbnail[data-workorder]`，未回報斷言標題 + 無標籤，已回報 `✓`）、`e2e/t0551-close-worker-focus.spec.ts`（只改定位）。

**驗證**
| 項目 | 結果 |
|---|---|
| `npm run test:unit` | PASS — 250 files，4234 passed / 1 skipped |
| `npm run typecheck` | PASS — 0 |
| `npm run typecheck:electron` | PASS — 0 |
| `npx vite build` | PASS |
| e2e `t0553-worker-tab-title.spec.ts`（新） | PASS（連續 4 次）；修 selector 後第一次跑曾有一次 `toHaveCount` 失敗，error-context 被後續執行覆蓋、未能定位是哪一行，之後重跑 4 次皆過 → 視為偶發，記錄供參 |
| e2e `t0538-worker-tab-batch-close.spec.ts` | PASS（已依新標籤規則更新斷言） |
| e2e `t0537-worker-ownership-persistence.spec.ts` | PASS（未修改） |
| e2e `t0551-close-worker-focus.spec.ts` | PASS（只改定位） |

e2e 全部為隔離實例 + 自訂 CLI 跑 node 腳本，未碰使用者 BAT（port 9876）、未耗 token。

**Commit**：`bb9b9ddf feat(worker-tabs): T0553 tab titles name the agent, role and work order`（`git commit --only`，不含 `src/styles/settings.css` 與本工單檔；未 push、未建 tag、未改版號）。

### 互動紀錄

無（CT_INTERACTIVE=0，fire-and-forget）。

### Renew 歷程

無。

### 遭遇問題

- `.main-panel-title` 在工作區內每個分頁各有一個（隱藏的也在 DOM），e2e 改名步驟需以標題文字篩選。
- 實機（非隔離）未驗證遠端 headless 實際派工的標題 / REMOTE 標籤；遠端路徑由 `headless-terminal.test.ts`（真 headless，payload 含 `agent` / `agentName`）與 store 單元測試（`remote: true` → `remoteOrigin`）覆蓋。

### 回報時間

2026-10-16T03:48:32+08:00

---

## 塔台收單（第六十六 session，2026-10-16T03:50:02+0800）

- ✅ **T0553 已確認 DONE**：`bb9b9ddf`（21 檔）。Worker 未 commit 本工單檔，由塔台收單一併 commit。塔台複驗 @ `bb9b9ddf`：`npm run test:unit` 4234 passed / 250 files、`npm run typecheck` = 0、`npm run typecheck:electron` = 0。
- 設計決定 1–4 採納（REMOTE 用縮圖小標籤、改名後恢復 T0538 工單標籤、舊標題認不出檔名時顯示 `Terminal · Worker · T####`、舊分頁無 `remoteOrigin`）。「alias 優先」實為「使用者改名寫入 `title`，還原時只重算舊預設格式」，符合使用者決定 4 的意圖。
- `agent` / `agentName` 只用於標題、不傳給 `ptyManager.create`（不影響 `agentPreset` 相關 env 注入），有測試守住。
- e2e `t0553` 首次執行一次偶發失敗、之後連續 4 次通過：記錄為觀察，pre.5 發版前回歸再跑一次。
- 實機：安裝 pre.5 後確認 Worker 分頁顯示 `Claude CLI · Worker · T####`。Worker 分頁已回收（03:48:46 排程 → 到期 `close requested`）。下一張 T0554 已派。
