---
schema_version: 1
schema_kind: workorder
id: T0566
title: "PLAN-044 實作：yolo 分頁用量限制辨識；Codex 解鎖（+ 延遲）後自動輸入「繼續」，claude 只提示（休眠後補 Enter），週限制只提示；Settings 預設關（D148）"
type: implementation
status: TODO
repo: better-agent-terminal
project: PLAN-044
priority: P2
sizing: M
created_at: "2026-10-16T15:05:50+0800"
updated_at: "2026-10-16T15:05:50+0800"
started_at: ""
completed_at: ""
commit: ""
target_version: "0.6.1-pre.6 或之後（發版時塔台與使用者決定）"
depends_on:
  - "T0563（同改 `src/App.tsx` / `SettingsPanel.tsx` 等；收單後才派）"
  - "T0565（`isYoloTerminal`、塔台 mode）"
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

### 產出摘要

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 回報時間
