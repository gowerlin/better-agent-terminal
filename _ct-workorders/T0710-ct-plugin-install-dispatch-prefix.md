---
schema_version: 1
schema_kind: workorder
id: T0710
title: "CT plugin 安裝：Codex 派工字串依安裝方式送 `$ct-exec` / `$ct:ct-exec`，設定面板與 skill 面板認得 plugin 安裝"
type: implementation
status: PENDING
repo: better-agent-terminal
project: ""
priority: P1
sizing: M
created_at: "2026-10-30T13:05:12+0800"
started_at: ""
updated_at: "2026-10-30T13:05:12+0800"
completed_at: ""
depends_on: []
related:
  - "BMad-Guide HANDOVER `D:/ForgejoGit/@Gower_Labs/BMad-Guide/_ct-workorders/_handover-2026-10-30-bat-ct-plugin-install-detection.md`（§ 2 實測表、§ 3 各項、§ 6 假 plugin 隔離試裝步驟；行號以 BAT `6e00031c` 為準）"
  - "本 repo 回覆稿 `_ct-workorders/_reply-2026-10-30-ct-plugin-install-detection.md`（受理範圍；本單不改它，由塔台發版後補寫）"
  - "CLAUDE.md「BAT MCP shim」節（`createAgentPromptCommandBuilder`、`resolveDispatchShell` 引號 family）、「指揮塔總覽（T0701）」節（`ct:read-config-sources` 在回答主機判斷）、「Child Process Spawning」節"
affects_files:
  - electron/terminal-command-handlers.ts
  - "electron/ct-install-detect.ts（新檔，名稱可調；判斷的唯一實作）"
  - electron/handlers/ct-config.ts
  - electron/handlers/claude.ts
  - "面板一鍵派工需要的 IPC：electron/preload.ts、`src/types` 的 electronAPI 型別、electron/remote/protocol.ts（PROXIED_CHANNELS）、electron/remote/headless-channel-status.ts、headless 端 handler 註冊處"
  - src/utils/control-tower-launch.ts
  - "src/App.tsx、src/components/WorkspaceView.tsx（只在 control-tower-launch 介面改成非同步時調整呼叫點）"
  - "顯示 skill 來源的元件（只在 3-3 新增來源標示時）"
  - "測試：electron/__tests__/、src/utils/__tests__/shell-quote.test.ts、src/utils/__tests__/（control-tower-launch）"
  - CLAUDE.md
  - "docs/agent-guide/ct-plugin-install.md（新檔）、docs/agent-guide/README.md"
  - _ct-workorders/T0710-ct-plugin-install-dispatch-prefix.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 判斷唯一實作：新模組（建議 `electron/ct-install-detect.ts`，不 import electron，本機與 headless 共用）提供 Codex skill 呼叫名稱判斷與 CT plugin 位置查找。helper 派工、面板一鍵派工、ct-config、skill 掃描一律呼叫它，不得在 consumer 內聯路徑規則。"
  - "🔴 3-1 判斷順序（照 handover § 3-1，不得更改）：① `<CODEX_HOME>/skills/<skill>/SKILL.md` 或 `<home>/.agents/skills/<skill>/SKILL.md` 存在 → `$<skill>`；② 否則 `<CODEX_HOME>/config.toml` 有 `[plugins.\"ct@<任一 marketplace>\"]` 且該表 `enabled = true` → `$ct:<skill>`；③ 其他（讀不到、解析失敗、沒有 enabled 行、遠端判斷不了）→ 維持現行 `$<skill>`。plugin 名稱 `ct` 寫死、marketplace 名稱不寫死。`CODEX_HOME` 用新分頁實際拿到的 env（派工時組出的 PTY env / customEnv 優先，再來 host `process.env`），未設才用 `<home>/.codex`；不得寫死 `~/.codex`。"
  - "🔴 config.toml：不新增執行期依賴（新增要塔台決策，且牽動 `build.files` 白名單）。只需辨識 `[plugins.\"ct@…\"]` 表頭與表內的 `enabled = true|false`；其他內容忽略；解析不了一律走 ③。檔案讀取設大小上限與錯誤處理，不得讓派工失敗。"
  - "🔴 Claude 端字串不變（`/ct-exec`）。`scripts/bat-terminal.mjs` 的 `--skill` 白名單不改，CT 派工命令不變。`normalizeControlTowerPromptForAgent` 在 Codex 時要同時處理 `/ct-` 與 `/ct:ct-` 開頭，結果依同一判斷給 `$<skill>` 或 `$ct:<skill>`。"
  - "🔴 面板一鍵派工（`src/utils/control-tower-launch.ts`）與 helper 派工共用同一判斷。renderer 不能讀檔：經 IPC 由主行程判斷；遠端工作區走 proxied channel，在回答主機（headless）判斷，舊 bat-server 沒有 handler → 走 ③。新 channel 要列進 `PROXIED_CHANNELS` 並在 `headless-channel-status.ts` 分類（有測試守門）。命名與參數形狀自行決定，回報區寫明。"
  - "🔴 引號：`$ct:ct-exec` 在 PowerShell 會被當變數、在 bash 雙引號內也會展開。派工命令與面板命令在 pwsh / cmd / bash family 都要補測試（`shell-quote.test.ts` 已有單引號測試，比照補），確認送進 shell 的字面值是 `$ct:ct-exec`。"
  - "🔴 3-2（`electron/handlers/ct-config.ts` 預設值層）：手動安裝存在就照舊用它；否則找 plugin：Claude 讀 `installed_plugins.json` 中 `ct@*` 的 `installPath`（位置依 `CLAUDE_CONFIG_DIR` / 預設 `~/.claude/plugins/`，cache 可被 `CLAUDE_CODE_PLUGIN_CACHE_DIR` 改，handover § 1 / § 3-2），Codex 找 `<CODEX_HOME>/plugins/cache/*/ct/*/skills/control-tower/references/tower-config.md`（多版本取最新，版本比較方式自定並測試）。來源路徑要能讓使用者看出是 plugin。遠端照 T0701 規則在回答主機判斷。"
  - "🔴 3-3（`electron/handlers/claude.ts` skill 掃描與 `*` 補全）：只加 `ct@*` plugin 的 skill（不擴及其他 plugin）。手動安裝與 plugin 同名時只列一次、以手動那份為準（與 Claude 實際行為一致）。若工作量明顯超出（例如要改大量 UI），可回報 PARTIAL 並寫出剩餘範圍，由塔台另開單。"
  - "🔴 3-4（兩種都裝時提示）：只評估、不實作。回報區寫：偵測成本、建議的提示位置與文字、是否建議做。"
  - "🔴 日誌：派工記錄判斷結果（`$<skill>` / `$ct:<skill>` 與原因 manual / plugin / fallback-<原因>），不記 config.toml 內容。沿用 `logger`，不用 `console.log`。"
  - "🔴 子程序：本單原則上不需要 child_process；若要呼叫 `codex`，照 CLAUDE.md「Child Process Spawning」（`execFile` + timeout）。"
  - "🔴 驗證：單元測試用暫存目錄模擬 CODEX_HOME / home / Claude plugin 目錄，涵蓋 handover § 6-2 三種情境（只 plugin → `$ct:ct-exec`；兩種都裝 → `$ct-exec`；只手動或 plugin `enabled = false` → `$ct-exec`）、沒有 config.toml、壞掉的 toml、`~/.agents/skills`、遠端/舊 server fallback、3-2 多版本取最新、3-3 去重。`npm run test:unit` 全綠、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功。選做：機器上有 `codex plugin` 子命令時照 § 6-1 / 6-2 在暫存 `CODEX_HOME`（短路徑）跑一次並用判斷函式核對結果；**不得**動真實 `~/.codex`、`~/.claude`（前後比對 `~/.codex/config.toml`、`~/.claude/plugins/*.json` SHA-256），**不做** § 6-3（要複製 auth.json、會呼叫模型）。沒做就寫明原因。"
  - "🔴 文件：CLAUDE.md 新增一節（3–12 行：用途、判斷順序、唯一實作位置、必守規則、連到 docs），細節寫 `docs/agent-guide/ct-plugin-install.md` 並加進 `docs/agent-guide/README.md` 索引。README / CHANGELOG / release-note 不改（發版時塔台處理）。"
  - "🔴 Git：`git commit --only <檔案>`，只 commit 本單 `affects_files`；不 push、不觸發 workflow、不建 tag。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。工單完成狀態寫 `DONE`。回覆稿、`_tower-state.md` 等塔台檔不要改。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，測試與文件的範例路徑用 `C:\\Users\\demo`、`/Users/tester`。yolo：不得問使用者，判讀問題問塔台（每輪最多 3 題）。"
---

# T0710 — CT plugin 安裝：Codex 派工字串與面板支援

## 背景

CT 5.14.0 起除了 zip 手動安裝，另提供 plugin（`ct@control-tower`）。Codex 只裝 plugin 時，skill 名稱是 `ct:ct-exec`，`$ct-exec` 不會注入 SKILL.md，而且**不會報錯**，Worker 可能照沒有 skill 的方式亂做。BAT 目前 Codex 一律送 `$ct-exec`。Claude 端三種安裝都能用 `/ct-exec`，不用改。

BMad-Guide 塔台的 HANDOVER（見 `related`）有實測表、程式位置、建議判斷順序與隔離試裝步驟，開工先讀 § 2、§ 3、§ 6。

## 範圍

| 項目 | 處置 |
|---|---|
| 3-1 Codex 派工字串依安裝方式決定（helper 派工 + 面板一鍵派工） | 做（必要） |
| 3-2 ct-config 預設值層找得到 plugin 的 `tower-config.md` | 做 |
| 3-3 skill 面板與 `*` 補全認得 `ct@*` plugin | 做（太大可 PARTIAL） |
| 3-4 兩種都裝時提示 | 只評估，寫建議 |

規則細節見 frontmatter `memory_overrides`。

## 驗收

- [ ] 判斷有單一實作，helper 派工、面板一鍵派工、ct-config、skill 掃描都經它
- [ ] 三種安裝情境的派工字串正確（只 plugin → `$ct:ct-exec`；兩種都裝 / 只手動 → `$ct-exec`）；判斷不了 → `$ct-exec`
- [ ] `CODEX_HOME` 依新分頁的 env，不寫死 `~/.codex`
- [ ] `$ct:ct-exec` 在 pwsh / cmd / bash 的送出字面值正確（有測試）
- [ ] 遠端工作區在回答主機判斷；舊 bat-server 沒有 handler 時維持現行
- [ ] 3-2：只裝 plugin 時預設值層讀得到 `tower-config.md`，且看得出來源是 plugin
- [ ] 3-3：只裝 plugin 時 skill 面板與 `*` 補全有 CT skill，手動與 plugin 同名只列一次
- [ ] 3-4 評估寫在回報區
- [ ] 沒有新增執行期依賴
- [ ] CLAUDE.md 一節 + `docs/agent-guide/ct-plugin-install.md` + docs 索引
- [ ] `npm run test:unit` 全綠；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` 成功

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 待塔台決策（僅 yolo Worker 有問題時）

（沒有提問就刪除本段）

### 完成狀態

### 產出摘要

### 3-4 評估

### 隔離試裝（§ 6-2，選做）

### 互動紀錄

### Renew 歷程

### 遭遇問題

### sprint-status.yaml 已更新

### 回報時間
