---
schema_version: 1
schema_kind: workorder
id: T0566
title: "PLAN-044 實作：yolo 分頁用量限制辨識；Codex 解鎖（+ 延遲）後自動輸入「繼續」，claude 只提示（休眠後補 Enter），週限制只提示；Settings 預設關（D148）"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-044
priority: P2
sizing: M
created_at: "2026-10-16T15:05:50+0800"
updated_at: "2026-10-16T16:01:01+0800"
started_at: "2026-10-16T15:26:12+0800"
completed_at: "2026-10-16T16:01:01+0800"
commit: "2e3305a9"
target_version: "0.6.1-pre.6 或之後（發版時塔台與使用者決定）"
depends_on:
  - "T0563（同改 `src/App.tsx` / `SettingsPanel.tsx` 等；收單後才派）"
  - "T0565（`isYoloTerminal`、塔台 mode）"
  - "T0567（同改 `src/**`；收單後才派）"
related:
  - "PLAN-044、D148"
  - "T0564 回報區（訊息原文、時間格式、結構化來源評估、推薦設計 §3、實作建議 §4）——本單的技術依據，開工前完整閱讀"
  - "T0545 / `electron/close-worker.ts`（main 端排程、等安靜、使用者輸入取消範本）、T0551（`isTerminalAutoReply`）"
  - "T0536（headless scheduler + `PROXIED_EVENTS` 範本）"
affects_files:
  - electron/**
  - src/**
  - e2e/**
  - CLAUDE.md
  - _ct-workorders/T0566-usage-limit-auto-continue.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 規格以 D148 為準，與 T0564 §3 推薦一致之處照做；不一致時以 D148 為準並在回報區註明。"
  - "🔴 **claude 分頁絕不送文字**（CLI 內建自動繼續，雙送會造成兩個續行 turn）；只允許在畫面為 `Your usage limit has reset` + `Press enter to continue`（stale）時送 Enter。claude 內建不可用（API key、舊 CLI、關閉、限制對話框開著）→ 只提示。"
  - "🔴 非時間型限制（spend cap、credits、seat、org budget）不做任何自動動作；週 / 超過 5 h 15 min 的重置只提示。"
  - "🔴 自動寫入走標記為自動的路徑，**不得**被當成使用者輸入（否則會取消同一分頁的 `--close-worker` 延遲）；使用者輸入的判斷沿用 `isTerminalAutoReply`（T0551）。"
  - "🔴 No Regressions：`--close-worker`、`bat-notify --submit`、T0562 / T0565、Worker 標題、`pty:write` 既有行為不變。Settings 預設關，未開啟時行為與現在完全相同（偵測也不應改變任何畫面以外的行為；提示可在開關關閉時仍顯示，請在回報區說明你的選擇）。"
  - "🔴 不為了觸發限制而消耗額度：e2e 用自訂 CLI 跑 node 腳本印出限制訊息（比照 `e2e/t0553-worker-tab-title.spec.ts`），隔離實例，不動使用者自己的 BAT（9876）。"
  - "🔴 驗收前必跑：`npm run test:unit` 全綠（以派工時 HEAD 為基線，加上新測試）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功。"
  - "🔴 commit：`git add` 本單實際改動的檔後 `git commit --only <那些檔>`（`src/styles/settings.css` 的 M 若不是你的變更不要納入）。不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。"
  - "🔴 不要呼叫 `bat-terminal.mjs --close-worker`；通知塔台之後不要再執行任何指令。"
---

# T0566 — 用量限制辨識與自動繼續（PLAN-044 / D148）

## 規格（D148，使用者選定）

| 分頁 | BAT 行為 |
|---|---|
| **Codex**（yolo） | 辨識 `You've hit your usage limit … Try again at <time>.` → 排程「重置時間 + 延遲」→ 到期再確認畫面仍是限制訊息、等待期間無使用者輸入 → 送出設定文字 + Enter。重置距今 > 5 h 15 min（週）→ 只提示 |
| **claude**（yolo） | 不送文字。辨識限制並提示：CLI 顯示 `continuing automatically at …` → 提示「CLI 將於 … 自動繼續」；週 / 超過 24 h / `Automatic continue stopped` → 提示「不會自動繼續」；stale（`Press enter to continue`）→ 依同一套延遲 / 取消規則只送 Enter；內建不可用 → 只提示 |
| 非 yolo 分頁 | 不自動動作（是否顯示提示由你決定並說明） |

- **yolo 判斷**：T0565 的 `isYoloTerminal`（塔台 `--mode yolo` 或 Worker `CT_MODE=yolo`）。
- **Settings**（三語）：開關預設**關**；文字預設「繼續」；延遲預設 2 分（夾 0–60）；說明 claude CLI 2.1.234 起自己會自動繼續、BAT 只處理 Codex 與 claude 休眠後的 Enter。
- **取消**：等待期間本機視窗的使用者輸入（非 `isTerminalAutoReply`）；到期再確認時畫面已不是限制訊息；分頁結束；開關關閉；yolo 被移除。同一分頁連續自動送出上限 2 次，之後只提示。

## 補充（使用者外部查證，2026-10-16）

第三方轉述官方文件：`autoContinueAtUsageLimit` 只從使用者設定、`--settings`、managed settings 讀取；這些都沒設而**專案層** `.claude/settings.json` / `settings.local.json` 有設時，功能會被關閉。BAT 不讀設定檔判斷，一律以畫面為準（看得到 `continuing automatically` 才當 CLI 接手，否則依 D2 只提示）。

## T0565 收單後的塔台裁決（2026-10-16）

- **`isYoloTerminal` 改為塔台宣告優先**：分頁 `role === 'tower'` 且有 `towerMode` → 以 `towerMode === 'yolo'` 為準；否則看 `customEnv.CT_MODE === 'yolo'`。只改 `PtyManager.isYoloTerminal` 這一處並補測試（T0565 原為 OR）。
- **已知限制**：BAT 重開但 Terminal Server 存活（T0108 replay）時，PTY 沒有 role / mode / `customEnv` 記錄，自動繼續不會套用，直到 CT 再次 `--set-role`（Worker 則不會恢復）。寫進 CLAUDE.md，不在本單處理。
- T0565 回報區「CLAUDE.md 待補」的文字併入 CLAUDE.md「塔台分頁標題（T0562，D147）」一節。

## 設計依據

以 T0564 回報區 §1–§4 為技術依據（訊息原文與分類規則、時間格式、偵測放 main 端 PTY 輸出尾巴並只認行首完整句型 + 比對後安靜、送出前 renderer 再確認、scheduler 結構比照 `WorkerCloseScheduler`、headless 共用與 `PROXIED_EVENTS`、自動寫入路徑不算使用者輸入、Enter 沿用 `dispatchSyntheticEnterKeydown`）。T0564 標 [推] 的項目（replay 是否經過輸出 hook、bracketed paste 對 codex composer 的效果等）請實測確認並記錄。

## 驗收條件

- [ ] 句型比對單元測試：claude（session / weekly / Opus / Sonnet / Fable / 通用 / 非時間型 / 預警句 / `continuing automatically` / `Automatic continue stopped` / stale）與 codex（各方案句、`Try again at` / `later`、模型專屬、非時間型）的正負樣本，含「對話內容引用該句」的負向樣本
- [ ] 時間解析：12 h 整點 / 有分鐘、跨日、跨年、IANA 時區（claude）、本地時區（codex）、已過期、> 7 天 → 不排
- [ ] scheduler：延遲、以最新為準、使用者輸入取消、自動回應不取消、上限 2 次、週只提示、分頁消失、開關關閉、自動寫入不取消 `--close-worker` 延遲
- [ ] e2e（隔離實例，自訂 CLI node 腳本記錄 stdin，延遲設 0）：codex 樣式訊息 → stdin 收到「繼續」+ Enter；claude 樣式 + `continuing automatically` → 不送；claude stale → 只收到 Enter；非 yolo 分頁 → 不送；等待中打字 → 取消
- [ ] headless：同一 scheduler，client 輸入才算使用者輸入；無 client 時不送並記日誌
- [ ] 日誌 `[usage-limit]`（偵測、排程、取消、送出、再確認失敗）
- [ ] CLAUDE.md 新增一節（規格、句型來源版本、Settings、限制）；併入 T0565 回報區「CLAUDE.md 待補」的文字
- [ ] `npm run test:unit` / `npm run typecheck` / `npm run typecheck:electron` / `npx vite build` 全過

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

**DONE**。驗收條件 8 項全過（見下方驗收表）。

落點檢查：**PASS**。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 工單在 REPO_ROOT 內；C-3 `affects_files` 只有 glob 與本工單 → not applicable；C-2 無 `branch` 欄位（目前 `main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。工單原狀態 `TODO`，照 `IN_PROGRESS` → `DONE` 處理。派工時 HEAD `c71bb43d`。

### 產出摘要

**規格對照 D148**：與 T0564 §3 一致處照做，無與 D148 衝突之處。T0565 收單裁決（`isYoloTerminal` 塔台宣告優先）已實作。

**新增**
- `src/lib/usage-limit.ts`（main / headless / renderer 共用，純函式）：句型分類 `classifyUsageLimitScreen`（只認行首完整句、允許 TUI 前綴 ≤ 8 個非字母數字字元、前面有字母 / 引號 / 反引號不認；畫面最後 40 個非空行中最下面一句為準；codex 折行最多併 8 行）、決策 `decideUsageLimit`、時間解析 `parseClaudeResetTime`（IANA 時區，含 DST）/ `parseCodexResetTime`（本地時區）、`plainTextFromOutput`（去 ANSI，游標換行 CSI / 單獨 CR → 換行，`CSI C` → 空白，跨 chunk 暫存）、Settings 正規化 `normalizeUsageLimitConfig`、renderer 再確認 `usageLimitRecheckFailure`、事件型別。
- `electron/usage-limit-continue.ts` `UsageLimitContinueScheduler`（不 import electron，本機與 headless 共用；結構比照 `WorkerCloseScheduler`）：輸出尾巴 → 安靜 5 s 分類 → 提示 / 排程 / 取消；`handledSeq`（使用者輸入或自動送出時，當下為止的行記為已處理，舊訊息不再觸發）；計時器每 ≤ 60 s 對牆上時鐘（休眠跨過到期可補送）；到期再確認；連續上限 2 次（使用者輸入或距上次送出 > 30 min 重算）；headless `canDeliver`。
- `src/stores/usage-limit-store.ts`：renderer 狀態（`useUsageLimitStatus`）、送出器註冊、`runUsageLimitContinue`（未掛載分頁 fallback：文字 + `\r` 皆 `{ auto: true }`）。

**修改**
- `electron/pty-manager.ts`：`PtyManagerDeps.onPtyOutput`（在 `enqueuePtyOutput`，try/catch）；`isYoloTerminal` 改塔台宣告優先。
- `electron/handlers/pty.ts`：`pty:write` 第三參數 `{ auto: true }` → 不算使用者輸入（不 `noteUserInput`，不取消 `--close-worker`）；新增 `onUserInput` dep。
- `electron/main.ts`：建 scheduler（事件只送本機視窗，不經 broadcastHub）、`createElectronPtyDeps` 接 `onPtyOutput` / `onPtyExit`、`settings:save` → `refreshConfig`、quit 時 dispose、`PersistedSettings` 三個欄位。
- `electron/remote/headless-entry.ts`：`createHeadlessPtyModule` 建同一 scheduler（設定讀 `<dataDir>/settings.json`，TTL 5 s）、`usageLimitCanDeliver = countBroadcastReceivers(undefined) > 0`。
- `electron/remote/protocol.ts` / `path-aware-channels.ts`：`PROXIED_EVENTS` 加 `terminal:usage-limit-status` / `terminal:usage-limit-continue`（含分類說明）。
- `electron/preload.ts`、`src/types/electron.d.ts`：`pty.write(id, data, opts?)`（無 opts 時照舊 2 參數）、`onUsageLimitStatus` / `onUsageLimitContinue`。
- `src/components/TerminalPanel.tsx`：合成 Enter 抽成 `dispatchEnter`（`bat-notify --submit` 行為不變）；註冊用量限制送出器（讀 xterm 最後 40 行再確認 → 文字 `{ auto }` → 300 ms → 合成 Enter，該次 `onData` 以 `{ auto }` 寫入，送完把焦點還給原元素）。
- `src/App.tsx`：兩個事件以 `ownsTerminalForCloseRequest` 交給持有分頁的視窗；`pty:exit` 清徽章。
- `src/components/TerminalThumbnail.tsx` + `src/styles/panels.css`：`.usage-limit-badge`（排程中 `⏳ <時刻>`，提示「限制」；`data-usage-limit`；三語 tooltip）。
- Settings：`src/types/index.ts`（3 欄位）、`src/stores/settings-store.ts`（3 setter，延遲夾 0–60）、`src/components/SettingsPanel.tsx`（Advanced 分頁「用量限制自動繼續」：開關、文字、延遲；開關關時兩欄停用）、`src/locales/{en,zh-TW,zh-CN}.json`（`settings.usageLimit*`、`usageLimit.*`；說明含 claude CLI 2.1.234 起會自動繼續、BAT 只處理 Codex 與休眠後的 Enter）。
- `CLAUDE.md`：新增「用量限制自動繼續（PLAN-044 / T0566，D148）」一節（規格、句型來源版本、辨識 / 排程 / 送出 / Settings / headless / 日誌 / 已知限制 / 驗證）；T0565 回報區「CLAUDE.md 待補」併入「塔台分頁標題（T0562，D147）」一節（契約 `--mode`、主行程 `mode`、新 bullet「yolo 判定」含塔台宣告優先與 T0108 replay 已知限制、headless、驗證清單）。

**我做的選擇（工單要求說明）**
- **開關關閉時**：完全不偵測、不提示、不送（`onOutput` 立即返回）——行為與現在完全相同。
- **非 yolo 分頁**（開關開啟時）：顯示提示徽章 `not-yolo`（「不是 yolo 分頁，BAT 不自動繼續」），不動作。
- **提示形式**：縮圖徽章 + tooltip（不另做 toast，避免多分頁同時撞限制時洗版）。

**T0564 [推] 項目實測 / 判定**
- replay 是否經過輸出 hook：**不經過**（程式碼確認 `handleReplayBuffer` 直接 `broadcast`，未走 `enqueuePtyOutput`），且 replay 的 PTY 本來就沒有 yolo 記錄 → 只提示 / 不偵測，與工單已知限制一致。
- bracketed paste 對 codex composer：**未包 bracketed paste**，改用與 `bat-notify --submit` 預填相同的一般寫入 + 間隔 300 ms 合成 Enter（codex 塔台實際已在用的路徑）。真 codex composer 未實測（不能耗額度），列為已知風險。
- ConPTY 輸出經純文字擷取後的行首辨識：headless e2e（真 node-pty / cmd + node 腳本）與隔離實例 e2e（pwsh + ConPTY）皆實測成功。

**驗收結果**

| 項目 | 結果 |
|---|---|
| 句型單元測試（`src/lib/__tests__/usage-limit.test.ts`，48） | PASS：claude session / weekly / Opus / Sonnet / Fable / 通用 / 非時間型 / 預警句 / `continuing automatically` / `Automatic continue stopped|cancelled` / stale；codex 4 種方案句、`Try again at` / `later`、模型專屬、非時間型、折行；對話引用負向樣本（行中、引號、反引號、列表說明） |
| 時間解析 | PASS：12 h 整點 / 分鐘、跨日、跨年、IANA（Asia/Taipei、America/New_York DST、UTC）、未知時區 → 本地、codex 本地時區 / 序數 / 窄不換行空白、已過期、> 7 天 → 不排 |
| scheduler（`electron/__tests__/usage-limit-continue.test.ts`，21） | PASS：延遲、以最新為準、重繪不重設、使用者輸入取消（且之後不重排）、自動回應不取消、上限 2 次與重算、週 / 無時間 / 非時間型只提示、分頁消失、開關關閉、yolo 移除、到期再確認失敗、休眠跨過到期、claude 自動 / D2 / stale；`{ auto }` 寫入不取消 `--close-worker` 延遲（真 PtyManager + WorkerCloseScheduler） |
| e2e（`e2e/t0566-usage-limit-continue.spec.ts`，隔離實例，延遲 0） | PASS（12 s）：codex → stdin `["繼續","\r"]`；claude + `continuing automatically` → 不送、徽章 `cli-auto`；claude stale → 只有 `\r`；非 yolo → 不送、徽章 `not-yolo`；等待中打字 → 徽章消失、日誌 `cancelled (user input while waiting`。目視截圖確認徽章 |
| headless（`electron/remote/__tests__/headless-usage-limit-e2e.test.ts`，4，真 headless + 真 node-pty） | PASS：yolo PTY 收到 continue（文字 `繼續`）、非 yolo 只提示、client 一般寫入取消而 `{ auto }` 不取消、無 client 不送並記日誌、未開啟無任何事件 |
| 日誌 `[usage-limit]` | PASS：偵測 / 排程 / 取消 / 送出 / 再確認失敗（main 與 renderer，e2e 斷言） |
| CLAUDE.md | 已新增並併入 T0565 待補 |
| `npm run test:unit` | PASS：**264 files / 4597 passed / 3 skipped**（派工 HEAD `c71bb43d` 基線依新增推算為 261 files / 4523 passed：本單新增 3 檔 74 測試；輸出中的 `AttachConsole failed` 為 node-pty 已知 stderr 雜訊） |
| `npm run typecheck` / `npm run typecheck:electron` | 0 / 0 |
| `npx vite build` | 成功 |
| 回歸 e2e | PASS：`t0535-close-worker`、`t0551-close-worker-focus`、`t0562-tower-tab-title`（與 t0566 一起 4 passed，1.8 min） |

**改動檔案**（皆在 `affects_files`；`src/styles/settings.css` 的 M 非本單，未納入）：見產出摘要；新增 `src/lib/usage-limit.ts`、`src/lib/__tests__/usage-limit.test.ts`、`src/stores/usage-limit-store.ts`、`electron/usage-limit-continue.ts`、`electron/__tests__/usage-limit-continue.test.ts`、`electron/remote/__tests__/headless-usage-limit-e2e.test.ts`、`e2e/t0566-usage-limit-continue.spec.ts`。

**commit**：`git commit --only` 上述檔案與本工單；不 push、不觸發 workflow、不建 tag。

### 互動紀錄

無（`CT_INTERACTIVE=0`，fire-and-forget）。

### Renew 歷程

無。

### 遭遇問題

1. **無真實樣本**（承 T0564）：句型全部來自 CLI 二進位字串；真實 TUI 排版（前綴、折行、Ink 重繪）以假 CLI 腳本 + 真 ConPTY 驗證。首次真實撞限制時請留意 `[usage-limit]` 日誌；CLI 改字串需同步 `src/lib/usage-limit.ts`。
2. **codex composer 對「一般寫入 + 300 ms + 合成 Enter」未在真 codex 驗證**：與 `bat-notify --submit` 同路徑，理論上相同；若真實 codex 把 Enter 當換行，需調 `USAGE_LIMIT_ENTER_DELAY_MS`。
3. **誤判風險**：agent 回覆在行首引用整句 codex 限制訊息、且之後安靜，yolo codex 分頁會多送一次文字（上限 2 次）。已以行首 / 引號 / 最下面一句 / 安靜 5 s 降低。
4. **兩台 BAT 互為 remote**：server 端 BAT 的事件只送本機視窗（避免遠端 client 重複送），而那些分頁由 client 持有 → 不送（只有 headless bat-server 走 client 路徑）。已寫入 CLAUDE.md 已知限制。
5. 測試寫法：vitest fake timers 在 tick 中建立的 0 ms 計時器會延到 +1 ms，測試以 `advanceTimersByTime(1)` 推進（產品行為不受影響）。
6. 收尾順序：程式與回報同一 commit，最終狀態 / commit hash 另以一個只含本工單的 commit 寫入。

### 回報時間

2026-10-16T16:00:03+0800
