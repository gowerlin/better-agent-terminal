---
schema_version: 1
schema_kind: workorder
id: T0553
title: "外部建立分頁的預設標題：Worker 顯示「Claude CLI · Worker · T0551」（Agent 顯示名 · 角色 · 工單號），非 Worker 顯示 Agent 名或命令檔名，拿掉誤導的「Remote:」；使用者 alias 優先，舊分頁重開後也套用"
type: feature
status: TODO
repo: better-agent-terminal
project: "使用者需求（第六十六 session）；延伸 T0538 Worker 分頁標示"
priority: P2
sizing: S
created_at: "2026-10-16T02:56:20+0800"
updated_at: "2026-10-16T02:56:20+0800"
started_at: ""
completed_at: ""
commit: ""
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

### 產出摘要

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 回報時間
