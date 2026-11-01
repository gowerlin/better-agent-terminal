---
schema_version: 1
schema_kind: workorder
id: T0730
title: "BUG-178：Claude 面板讀 session 歷史 / session 清單 / plugins 時依 `CLAUDE_CONFIG_DIR`（未設才 `<home>/.claude`）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-01T11:51:27+0800"
started_at: ""
updated_at: "2026-11-01T11:51:27+0800"
completed_at: ""
depends_on: [T0729]
related:
  - "BUG-178（T0727 回報區〈發現的問題〉2）；使用者 2026-11-01 第一百零二 session 選「兩個都現在修」"
  - "既有正確做法：`electron/handlers/claude.ts`、`electron/bat-mcp-launch.ts`、`electron/ct-install-detect.ts`（優先 `CLAUDE_CONFIG_DIR`）；T0711 回報區提到設定面板「預設值」層找手動安裝沒看 `CLAUDE_CONFIG_DIR`"
  - "`e2e/v072-pre6-claude-panel.spec.ts`（T0727 / T0729）"
affects_files:
  - electron/claude-agent-manager.ts
  - "electron/ 下共用的 Claude 設定目錄解析函式（新增或沿用既有的，位置由你決定並在回報說明）"
  - "electron/__tests__/（解析函式與 consumer 的測試）"
  - "T0711 提到的「預設值」層檔案（若確認同一問題）"
  - e2e/v072-pre6-claude-panel.spec.ts
  - CLAUDE.md
  - docs/agent-guide/claude-agent-sdk-cli.md
  - _ct-workorders/BUG-178-claude-history-ignores-claude-config-dir.md
  - _ct-workorders/T0730-fix-claude-config-dir-history-plugins.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 開工先 grep `electron/` 與 `src/` 中組 `.claude` 路徑的地方（`homedir()` 搭 `.claude`、`CLAUDE_CONFIG_DIR`），回報區列出完整清單與逐處處置（已正確 / 本單修 / 不屬 Claude 設定目錄不動）。"
  - "🔴 解析規則：`CLAUDE_CONFIG_DIR`（非空）優先，未設才 `<home>/.claude`；env 來源以實際 spawn CLI 的 env 為準（面板 session 的 spawn env，含 runtime 選擇後的值），不要只看主行程 `process.env` 而與 CLI 不一致。抽成單一函式，consumer 一律經它；與既有三處的規則若有差異，回報說明並統一（不改既有三處的對外行為，除非是同一個錯）。"
  - "🔴 行為不變：沒設 `CLAUDE_CONFIG_DIR` 的使用者讀到的路徑與現在完全相同。T0711 的「預設值」層若確認同一問題，一併修；若判斷不屬同一問題，寫在回報區由塔台決定。"
  - "🔴 驗證：e2e 新增情境：改用 `CLAUDE_CONFIG_DIR` 指到暫存目錄（HOME 仍隔離到另一個暫存目錄）時，④ resume 後歷史仍重建、plugins 從 `CLAUDE_CONFIG_DIR` 讀；T0727 / T0729 的既有情境仍綠。單元測試涵蓋設 / 未設 / 空字串。`npm run test:unit` 全過；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` 成功。只用假 API、不耗 token；隔離規則同 T0727。"
  - "🔴 CLAUDE.md 若新增「唯一實作」規則，依檔頭撰寫規則只寫一兩句＋連結，細節寫 docs。BUG-178 修好後由你改 `FIXED`（附 commit 與驗證摘要）；`_bug-tracker.md` 由塔台重建，不要改。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。測試失敗輸出不得傾印整個 `process.env`。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0730 — BUG-178：Claude 面板依 `CLAUDE_CONFIG_DIR` 讀歷史與 plugins

## 元資料

- **工單編號**：T0730
- **類型**：implementation
- **優先級**：P2
- **建立時間**：2026-11-01T11:51:27+0800
- **預估規模**：S

## 背景

T0727 發現 `loadSessionHistory`、`listSessionsFallback` 與 installed plugins 讀取固定用 `os.homedir()/.claude`，但 CLI 在設了 `CLAUDE_CONFIG_DIR` 時寫到該目錄；設了這個變數的使用者，分頁還原 / resume 時面板看不到舊訊息，plugins 也從錯的位置載入。使用者決定現在修（在 T0729 之後，同一檔案）。

## 範圍

1. 盤點並統一 Claude 設定目錄的解析。
2. 修正面板歷史、session 清單、plugins 讀取（及 T0711 預設值層，若同一問題）。
3. 單元測試＋e2e 情境；BUG-178 改 FIXED；docs / CLAUDE.md。

## 不做

- 不改沒設 `CLAUDE_CONFIG_DIR` 時的行為。
- 不碰 BUG-177（T0729）的改動。

## 驗收

- [ ] 路徑盤點清單與逐處處置
- [ ] `CLAUDE_CONFIG_DIR` e2e 情境綠，既有情境仍綠
- [ ] `test:unit` 全過、兩個 typecheck = 0、`vite build` 成功
- [ ] BUG-178 = FIXED

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 互動紀錄

### 回報時間
