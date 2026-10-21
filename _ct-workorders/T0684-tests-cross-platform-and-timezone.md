---
schema_version: 1
schema_kind: workorder
id: T0684
title: "CI 擋版前置：ubuntu 試跑失敗的 29 項（9 檔）改成跨平台／不依賴時區——寫死 Windows 行為 19 項、時區 10 項"
type: fix
status: TODO
repo: better-agent-terminal
project: BUG-168
priority: P2
sizing: M
created_at: "2026-10-21T21:15:12+0800"
depends_on:
  - "T0683（DONE `a35c4ce3`：`tests.yml`）；GitHub 試跑 run `39605811732`（2026-10-21，ubuntu-24.04，`2dd1dbdc`）：5719 passed、29 failed、6 skipped / 5754，9 檔失敗"
related:
  - "D177（CI 分兩步：試跑全過才設擋版）；BUG-168；T0683 回報區「遭遇問題」第 2 點（WSL 模擬的原因判讀）"
  - "失敗清單（run `39605811732`）：`electron/__tests__/bat-mcp-launch.test.ts` 4、`blocked-hooks-launch.test.ts` 4、`claude-session-name-launch.test.ts` 3（`--mcp-config=`／`--settings=`／`--name=` 的引號：Linux 暫存路徑沒有 `\\`，引號規則不加引號）；`gh-resolver.test.ts` 4（`gh.exe`、Windows 路徑）；`upgrade-rollback-main.test.ts` 1、`wsl-install-bundle.test.ts` 2（`Expected absolute Windows path`）；`scripts/__tests__/e2e-baseline-source.test.mjs` 1（Windows 安裝位置）；`src/lib/__tests__/usage-limit.test.ts` 9、`electron/__tests__/usage-limit-continue.test.ts` 1（句子「resets 4pm (Asia/Taipei)」，runner 時區是 UTC）"
  - "WSL 模擬才失敗、GitHub 通過的 `tls-fingerprint`、`server-bundle-download-retry` 不在本單範圍"
  - "用量限制規則：CLAUDE.md「用量限制自動繼續（PLAN-044 / T0566，D148）」節；辨識唯一實作 `src/lib/usage-limit.ts`"
affects_files:
  - electron/__tests__/bat-mcp-launch.test.ts
  - electron/__tests__/blocked-hooks-launch.test.ts
  - electron/__tests__/claude-session-name-launch.test.ts
  - electron/__tests__/gh-resolver.test.ts
  - electron/__tests__/upgrade-rollback-main.test.ts
  - electron/__tests__/wsl-install-bundle.test.ts
  - electron/__tests__/usage-limit-continue.test.ts
  - src/lib/__tests__/usage-limit.test.ts
  - scripts/__tests__/e2e-baseline-source.test.mjs
  - "產品檔：只在下方 memory_overrides 允許的條件下修改，修改前先問塔台"
  - _ct-workorders/T0684-tests-cross-platform-and-timezone.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 目標：這 29 項在 Windows 與 Linux（ubuntu、UTC 時區）都通過，而且**不降低覆蓋**：Windows 專屬的斷言在 Windows 上照樣要跑；能用注入 `platform`、`path.win32`、明確的 shell family 讓 Linux 也跑到同樣斷言的，優先這樣做。只有行為本身就只存在 Windows（例如 WSL 安裝、Windows 安裝位置）而且無法注入時，才用 `it.skipIf(process.platform !== 'win32')`，並在測試裡註明原因。"
  - "🔴 不要讓測試變成同義反覆：期望值不能直接用被測函式自己算出來；引號類測試要明確寫出各 shell family 的期望字串。"
  - "🔴 時區 10 項：先查清楚原因再改。是測試假設了執行環境的時區 → 在這兩個測試檔內固定時區（例如在檔案層級設定並在結束時還原），不改全域 vitest 設定。若發現 `src/lib/usage-limit.ts` 沒有照句子裡寫的時區（例如 `(Asia/Taipei)`）計算重置時間，系統時區不同的使用者會算錯 → 這是產品問題，**先以 `T0684 提問` 問塔台**（附證據與修法建議），不要自己改產品。"
  - "🔴 產品檔：預設不改。只有當測試失敗的根源是產品用了「跟執行主機平台有關」的判斷去檢查一個本來就是 Windows 的路徑（例如 WSL 安裝只在 Windows 主機發生，卻用 `path.isAbsolute` 而非 `path.win32.isAbsolute`），而且改成明確的 `path.win32` 在 Windows 上行為完全不變時，才可以改；改之前同樣先問塔台。"
  - "🔴 驗證：`npm run test:unit` 在 Windows 全過（記通過數）；再在 Linux 環境跑一次這 9 個檔（可用 WSL 的 Ubuntu，並設 `TZ=UTC`，比照 T0683 的模擬方式，從乾淨 clone 或至少乾淨的 node_modules 安裝），全過；`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功。"
  - "🔴 不改 `package.json`、`vite.config.ts`、`.github/**`（T0685 正在改 `package.json` 與 `tests.yml`）。同時有 T0685 的 Worker 在跑：只動 `affects_files`；commit 用 `git commit --only <檔案>`，不要 `git add -A`。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，測試資料用 `demo`／`tester`／代稱。Git：不 push；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。不跑 Playwright e2e。yolo：不得問使用者，判讀問題問塔台；不得寫出權杖值。"
---

# T0684 — 29 項測試改成跨平台、不依賴時區

## 目標

`tests.yml` 第一次在 GitHub（ubuntu-24.04、UTC）試跑：5719 項通過、29 項失敗（9 檔）。19 項是測試寫死了 Windows 行為（引號規則、`gh.exe`、Windows 路徑、Windows 安裝位置），10 項和時區有關。這 29 項修好、試跑全過之後，才能把 `test:unit` 設成發版擋版（D177）。

## 要做的事

1. 在 Linux（WSL Ubuntu、`TZ=UTC`）重現這 29 項，逐項確認原因。
2. 寫死 Windows 行為的 19 項：優先注入平台／用 `path.win32`／明確 shell family，讓兩個平台都跑到相同斷言；不得不時才 `skipIf` 並註明。
3. 時區 10 項：判斷是測試假設時區還是產品沒照句子裡的時區計算；前者在測試檔內固定時區，後者先問塔台。
4. Windows 與 Linux 各驗證一次，commit（不 push）。

## 驗收

- 這 9 個檔在 Windows 與 Linux（`TZ=UTC`）都全過；回報區附兩個平台的結果。
- 回報區逐項列出處理方式（注入／`path.win32`／固定時區／`skipIf` 與理由），以及 Windows 上的斷言數沒有減少的證據。
- `test:unit` 全過、typecheck 0／0、build 成功；只改 `affects_files`；未 push。

---

## 回報區

### 完成狀態

### 逐項處理（檔案、項目、原因、處理方式）

### 時區判斷

### 驗證結果（Windows／Linux）

### Commit

### 遭遇問題

### 回報時間
