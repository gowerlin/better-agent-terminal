---
schema_version: 1
schema_kind: workorder
id: T0388
title: "PLAN-036 P0-A：headless handler 共用骨架 + 防漂移守門（channel parity test / electron-free guard / vitest headless harness）"
type: implementation
status: TODO
priority: P1
sizing: M
created_at: "2026-10-04T23:58:00+08:00"
updated_at: "2026-10-04T23:58:00+08:00"
started_at: null
completed_at: null
target_version: next
depends_on: []
related:
  - "PLAN-036 / D129"
  - "T0386 回報區 §1、§3、§6、建議工單清單 A"
  - "T0392（BUG-095，平行；會把 `claude:abort-session` 加進 `PROXIED_CHANNELS`）"
affects_files:
  - electron/handlers/types.ts
  - electron/remote/headless-entry.ts
  - electron/remote/headless-handlers.ts
  - electron/remote/__tests__/headless-parity.test.ts
  - electron/remote/__tests__/helpers/headless-harness.ts
  - electron/remote/__tests__/
  - scripts/build-server-bundle.mjs
  - tests/headless-server.test.ts
interaction:
  mode_hint: on
  interactive: false
  intervention_type: none
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`** 等會動到工作區他人未提交修改的 git 操作（L138：本專案常有多個 Worker 平行，曾因 stash 還原他單的工單編輯）。比對 baseline 用 `git show HEAD:<path>` 或 `git worktree add` 到 scratchpad。"
  - "🔴 不得碰使用者 WSL 內的 `bat-server.service` / `~/.local/bat-server`；本機 headless 實驗用 scratchpad + port 0 或非 9876 / 9877 埠。"
  - "🔴 本單**不改** `electron/main.ts`（T0387 執行中、T0389 排隊中）與 `electron/remote/protocol.ts`（T0392 平行中）。"
  - "🔴 child_process 一律 `execFile` / `spawn` + array args，timeout 必設。不 push。"
---

# T0388 — headless handler 骨架 + 防漂移守門

## 背景

PLAN-036（T0386 研究、D129）：headless bat-server 需與 Electron main **共用同一份 handler 註冊模組**（`registerXxxHandlers(register, deps)` + DI）。本單建立骨架與守門，**不搬任何既有 handler**（P0-B / C 做）。

## 範圍

1. `electron/handlers/types.ts`（新）：`HandlerRegistrar = (channel, fn) => void`、`HostDeps` 介面（`emit` / `dataDir` / `homeDir` / `helperDir?` / `getSettings` / `notifier?` / `onSettingsSaved?` / `pathGuard?`，依 T0386 §3；欄位可先宣告、後續單填實作）。不得 import `electron`
2. **channel parity test**（`electron/remote/__tests__/headless-parity.test.ts`）：對 `PROXIED_CHANNELS` 每個 channel，斷言 headless registry `hasHandler`，**或**列在明確清單 `HEADLESS_UNSUPPORTED`（暫時未支援，附階段標記 P0/P1/P2/P3）或 `ALWAYS_LOCAL_CHANNELS`。清單放在可被產品程式碼引用的模組（例如 `electron/remote/headless-channel-status.ts`），初始把目前 headless 沒有的 channel 全列入，日後每張上線單從清單移除
   - ⚠️ T0392 平行把 `claude:abort-session` 加入 `PROXIED_CHANNELS`：若 T0392 先 commit，本單清單需含它（P1）；若本單先 commit，回報區註明，由 T0392 補
3. **electron-free guard**：以 esbuild 打包 `server-entry.ts`（設定從 `scripts/build-server-bundle.mjs` 讀，**不要手抄 externals**——塔台 23:33 實測手抄會漏 6 項），攔截 `electron` 的 import：只允許既有 lazy try/catch 點（T0386 指 `remote-server.ts` / `secrets.ts`，請複核），其他來源 fail
4. **vitest headless harness**（`electron/remote/__tests__/helpers/headless-harness.ts`）：檔頭 `// @vitest-environment node`；in-process `createHeadlessServer` + `ws` client，port 0、`mkdtemp` dataDir；提供 `invoke(channel, ...args)`。把 `tests/headless-server.test.ts`（tsx 腳本）的案例併入 vitest，原檔移除
5. `scripts/build-server-bundle.mjs:358-367` 的 `electron/handlers/` 複製步驟：esbuild 從 import 圖打包即可，移除該步驟（或改為只在目錄非空時警告），避免「目錄不存在靜默略過」的假象；確認 `build-server-bundle` 仍可跑（`BAT_SERVER_ALLOW_MISSING_NATIVE=1` schema-only 即可）

## 驗收

- parity test、electron-free guard、harness 案例皆在 `npm run test:unit` 內通過；故意在 parity 清單外加一個假 channel 會紅（回報區附一次負向驗證輸出，驗完還原）
- `npm run test:unit` 全綠（基線 **920**，若 T0387 / T0392 先 commit 以 HEAD 為準；回報新數字）
- `npx vite build` exit 0；`npx tsc --noEmit` ≤ **40**
- 回報區列出 `HEADLESS_UNSUPPORTED` 初始清單統計（各階段幾個）

## Sub-session 執行指示

1. 讀取本工單 + PLAN-036 + **T0386 回報區**
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. commit 僅實際改動檔 + 新測試檔 + 本工單檔（`git commit --only ...`）；`AGENTS.md` 若 dirty 不要碰
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
