---
schema_version: 1
schema_kind: workorder
id: T0737
title: "pre.7 自動化驗收：BUG-179 重開後 bat-scripts.log 輪替（隔離實例）＋ BUG-177 / 178 從介面操作的 e2e（本機假模型，不耗 token）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-01T17:15:51+0800"
started_at: ""
updated_at: "2026-11-01T17:15:51+0800"
completed_at: ""
depends_on: [T0736]
related:
  - "BUG-179 / T0732（`ce648034`，D198）：`electron/bat-scripts-log-rotation.ts` `rotateBatScriptsLog`，本機 `app.whenReady` 開頭、headless `start()`；T0732 只有單元測試，實機輪替未驗"
  - "BUG-177 / T0729（`ceb24910`）：e2e ⑩ 以 IPC `claude.getSupportedModels` 驗 0 請求 / 0 session 檔"
  - "BUG-178 / T0730（`6f7b3d53`）：`electron/claude-config-dir.ts`；e2e ⑪ / ⑫ 以 `CLAUDE_CONFIG_DIR` 驗 resume 歷史與 plugins；另修 `electron/handlers/ct-config.ts` 預設值層"
  - "`e2e/v072-pre6-claude-panel.spec.ts`、`e2e/fixtures/fake-anthropic-api.ts`、`e2e/fixtures/electron-isolation.ts`；CLAUDE.md「Logging」節 T0732 段、「Claude Agent SDK / CLI」節 Claude 設定目錄段；`docs/agent-guide/logging.md`、`docs/agent-guide/claude-agent-sdk-cli.md`"
affects_files:
  - "e2e/v072-pre7-bat-scripts-log-rotation.spec.ts（新增，檔名可調）"
  - "e2e/v072-pre7-claude-panel-ui.spec.ts（新增，檔名可調；或在 `e2e/v072-pre6-claude-panel.spec.ts` 加情境，但 ①–⑫ 行為不得改）"
  - "e2e/fixtures/（只在需要共用 helper 時擴充）"
  - docs/agent-guide/logging.md
  - docs/agent-guide/claude-agent-sdk-cli.md
  - _ct-workorders/T0737-e2e-pre7-acceptance-log-rotation-config-dir.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 BUG-179 情境（隔離實例的 userData，啟動前在 `<userData>/Logs/` 預先放檔）：① `bat-scripts.log` > 10 MiB → 啟動後改名為 `bat-scripts-<YYYYMMDD-HHMMSS>.log`、原檔不存在或變成新的小檔；debug log 有 `[bat-scripts-log]` 輪替行。② 預先放 3 份舊的 `bat-scripts-<stamp>.log` ＋ 一個 > 10 MiB 的現行檔 → 啟動後只留最近 3 份（依檔名時間戳，最舊的被刪）。③ ≤ 10 MiB → 不動（內容與大小相同）。④ 輪替後在隔離實例的分頁內跑一個 helper（例 `bat-terminal.mjs --version` 以外會寫 log 的呼叫，如 `bat-mcp` / `bat-notify` 的可行路徑，或 hook `report-hook`）→ 新的 `bat-scripts.log` 被建立並有 NDJSON 記錄（寫入路徑不受影響）。⑤（選做）改名失敗（例如預先以獨占方式開著檔案，Windows）→ BAT 照常啟動、debug log 只記一行、不丟例外。⑥（選做）headless bat-server 的 `<dataDir>/Logs`：若能在本機以 temp dataDir 啟動 server bundle / headless entry 就驗，做不到寫原因。檔案大小用稀疏或快速寫入產生，跑完刪掉。"
  - "🔴 BUG-177 情境（從介面操作，不直接呼叫 IPC）：在隔離實例新增 Claude Agent 面板分頁、等候載入模型清單 / 切換模型下拉 → 假 API 收到 0 個模型請求、暫存 HOME 的 `.claude/projects/` 沒有新 session 檔；之後送一則訊息 → 只產生 1 個 session 檔、session 清單（resume 對話框）只出現這一個。"
  - "🔴 BUG-178 情境（從介面操作）：設 `CLAUDE_CONFIG_DIR` 指到暫存目錄（HOME 隔離到另一個暫存目錄）→ 面板送訊息後重開 BAT，從 resume 對話框 / 歷史清單看得到該 session 並能接續，歷史重建；plugins 清單（若面板有顯示）讀自 `CLAUDE_CONFIG_DIR`；Control Tower 總覽的 `*config` 預設值層在 `CLAUDE_CONFIG_DIR/skills/control-tower/references/tower-config.md` 存在時讀得到（T0730 修的 `ct-config.ts`）；HOME 下的 `.claude` 沒有被寫入。與 e2e ⑪ / ⑫ 重複的部分可直接引用其結果，只補介面層。"
  - "🔴 不耗 token：claude 只打 `e2e/fixtures/fake-anthropic-api.ts`（沿用 T0727 的隔離做法：暫存 HOME、`ANTHROPIC_BASE_URL` / 假 key、`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`、拒絕並記錄的 proxy、工作區放 `%ProgramData%`）；不得用使用者的登入或真實 API；回報區列出對外請求數（預期 0）。"
  - "🔴 不改產品程式碼（`src/` / `electron/` / `scripts/` 都不動）；發現產品缺陷 → 記在回報區〈發現的問題〉附重現步驟與證據，由塔台開 BUG，不在本單修。某情境做不到就寫原因與已試過的做法，其餘照做，可回 PARTIAL。"
  - "🔴 隔離：一律用 `e2e/fixtures/electron-isolation.ts` 的隔離實例（`--runtime=e2e-…`、獨立 userData 與 remote port），🔴 絕不碰使用者真正的 `<appData>/BetterAgentTerminal/Logs/bat-scripts.log` 與 userData，不以預設實例啟動 source build，不執行安裝檔。先 `npx vite build`（T0736 完成後才派本單，避免同時 build）。工作區名稱一律 `e2e-t0737-*`。暫存目錄跑完要清掉；清不掉就把路徑寫進回報區。"
  - "🔴 驗證：新 spec 綠（或部分綠並說明），連跑 2 次；重跑 `e2e/v072-pre6-claude-panel.spec.ts`（①–⑫）綠；rotation 相關單元測試（`electron/__tests__/` 下 T0732 的兩個檔）綠；`npm run typecheck` = 0、`npm run typecheck:electron` = 0（spec 若在 tsconfig 範圍外則註明）。`docs/agent-guide/logging.md` 的 T0732 驗證段、`docs/agent-guide/claude-agent-sdk-cli.md` 的 Claude 設定目錄驗證段各補一行指向新 spec。回報區列〈BUG 結案建議〉（每個 BUG：可 CLOSED / 仍需手動，附證據）與〈仍需手動實機驗收〉（例如使用者真實 BAT 重開、真實模型、遠端 headless）。不發版、不改 CHANGELOG、不改 BUG 單狀態（由塔台處理）、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0737 — pre.7 自動化驗收：bat-scripts.log 輪替＋Claude 面板介面 e2e

## 元資料

- **工單編號**：T0737
- **類型**：implementation（驗收用 e2e）
- **優先級**：P2
- **建立時間**：2026-11-01T17:15:51+0800
- **預估規模**：M

## 背景

使用者要求安排 `v0.7.2-pre.7` 的自動驗收（與 pre.8 的 T0736 一起）。HEAD 的 `src` / `electron` / `scripts` 與 pre.8 發版 commit `cf71bf6f` 相同；pre.7 → pre.8 之間的產品變動只有 T0735（工作區 ⚠️），與本單三個 BUG 無關，以 source build 驗即可涵蓋 pre.7 的修正。

- BUG-179（`bat-scripts.log` 啟動輪替）：T0732 只有單元測試，回報寫明實機輪替未驗。
- BUG-177 / BUG-178：已有 e2e ⑩–⑫，但以 IPC 直接呼叫；本單補使用者操作介面的路徑與 `*config` 預設值層。

## 範圍

1. BUG-179 情境 ①–④（⑤⑥ 選做）。
2. BUG-177、BUG-178 介面情境。
3. 重跑既有 spec / 單元測試；docs 驗證段各一行。

## 不做

- 不改產品程式碼、不修發現的缺陷、不改 BUG 單狀態。
- 不在使用者正在用的 BAT 上驗。

## 驗收

- [ ] BUG-179 ①–④ PASS（⑤⑥ 做了或寫原因）
- [ ] BUG-177、BUG-178 介面情境 PASS / 未涵蓋與原因
- [ ] 對外請求數 0
- [ ] `v072-pre6-claude-panel` ①–⑫ 綠、rotation 單元測試綠、兩個 typecheck = 0
- [ ] 〈BUG 結案建議〉與〈仍需手動實機驗收〉

---

## 回報區

### 完成狀態

### 相關通過案例判定

### 發現的問題

### BUG 結案建議

### 仍需手動實機驗收

### 互動紀錄

### 回報時間
