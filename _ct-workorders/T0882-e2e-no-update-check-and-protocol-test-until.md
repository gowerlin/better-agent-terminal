---
schema_version: 1
schema_kind: workorder
id: T0882
title: "e2e `launchIsolated` 預寫 `settings.json` 關閉檢查新版（T0864 後續）＋ protocol v1 測試 B 組改 `until()`（T0867 後續）"
type: implementation
status: PENDING
updated_at: "2026-11-20T16:40:41+0800"
repo: better-agent-terminal
project: ""
priority: P2
sizing: S
created_at: "2026-11-20T16:40:41+0800"
depends_on: []
related:
  - "D303；T0864 回報區〈殘留風險 / 後續建議〉1（`src/lib/check-for-updates-migration.ts`，標記 `checkForUpdatesMigrated`）；T0867 回報區〈後續建議〉1；CLAUDE.md「Frontend unit tests」fake timers 規則（T0508）"
affects_files:
  - _ct-workorders/T0882-e2e-no-update-check-and-protocol-test-until.md
  - e2e/fixtures/electron-isolation.ts
  - e2e/
  - electron/__tests__/terminal-server-protocol-v1.test.ts
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只改測試與 e2e fixture，不改產品程式（`src/` 、`electron/` 非 `__tests__` 的檔都不動）。"
  - "🔴 A 項：`launchIsolated` 在 app 啟動前，若該 runtime 的 userData 還沒有 `settings.json`，就寫入 `{ checkForUpdates: false, checkForUpdatesMigrated: true }`（鍵名取自 `src/lib/check-for-updates-migration.ts` 的匯出常數，不要手寫字串）；已有 `settings.json`（`beforeLaunch` 預寫、或以 `runtimeId` 重開）一律不動。要測檢查新版的 spec 必須能關掉這個預寫（新增選項，名稱自訂，寫進 JSDoc）。userData 路徑的算法要與 app 實際用的一致（以 runtime id 推導或其他可靠作法，寫明）；🔴 寫入前確認目標目錄名含 `-runtime-<runtimeId>`（同既有 guard），絕不寫到預設 userData。"
  - "🔴 既有 7 個引用 `checkForUpdates` 的 e2e spec（`site-media`、`t0776`、`t0821`、`t0823`、`t0825`、`t0861`、`t0862`）的行為不得改變：盤點每個 spec 自己寫設定的方式，確認與預寫不衝突；需要時改用新選項，寫進回報區。"
  - "🔴 B 項：`terminal-server-protocol-v1.test.ts` B 組 `a connection that never says hello …` 的 `vi.waitUntil` 改用同檔既有的事件驅動 `until()`（或等效、不在 fake timers 下輪詢的作法），斷言與逾時值的意義不變，不得 skip。同檔若還有其他 fake timers 下的 `vi.waitFor` / `vi.waitUntil` 一併列出並改。"
  - "驗證只用可自動化的方式：`npm run test:unit` 全過、`npm run typecheck:electron` = 0；`npx vite build` 後在本機跑 `t0776`、`t0821`、`t0825`、`t0861` 四個 e2e spec 與任一個沒有寫設定的 e2e spec（自選、寫明），確認通過且隔離實例的 `settings.json` 內容符合預期；`t0862`（只在 GitHub Windows runner）、`site-media`（需 `BAT_SITE_MEDIA=1`）、`t0823`（需安裝環境，若本機不能跑寫明原因）不必跑。不需要人工驗收。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push、不觸發 workflow。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0882 — e2e 不連 GitHub 檢查新版＋ protocol v1 測試 B 組改 `until()`

## 元資料
- **工單編號**：T0882｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-20 16:40 (UTC+8)
- **規模**：S｜**依賴**：無｜**決策**：D303

## 背景
- **A（T0864 後續）**：T0864 把「檢查新版」預設改開，並以 `checkForUpdatesMigrated` 標記做一次遷移。e2e 隔離實例第一次啟動沒有 `settings.json` 時主行程本來就會檢查新版；經 UI 存過設定再以同一 runtime 重開時也會檢查。e2e 的結果因此可能受網路與 GitHub 影響。
- **B（T0867 後續）**：`electron/__tests__/terminal-server-protocol-v1.test.ts` 第 214 行在 fake timers 下用 `vi.waitUntil` 等 `tcpStates`，違反 CLAUDE.md T0508 規則（fake timers 下輪詢會偷推假時鐘）；目前在 Linux 通過，屬潛在的偶發失敗。

## 任務
1. A：`e2e/fixtures/electron-isolation.ts` `launchIsolated` 預寫 `settings.json`（規則見 frontmatter），加關閉選項；盤點 7 個引用 `checkForUpdates` 的 spec。
2. B：B 組改事件驅動等待。
3. 驗證（見 frontmatter）。

## 驗收條件
- [ ] `launchIsolated` 預寫只在沒有 `settings.json` 時發生、可關閉、不會寫到預設 userData（回報區寫明怎麼確認）
- [ ] 7 個 spec 盤點結果（各自是否受影響、是否改用新選項）
- [ ] B 組改寫，同檔其他 fake timers 輪詢一併處理（或寫明沒有）
- [ ] `npm run test:unit` 全過（附 passed / files 數）、`npm run typecheck:electron` = 0
- [ ] 指定 e2e spec 通過（附各自結果）
- [ ] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
