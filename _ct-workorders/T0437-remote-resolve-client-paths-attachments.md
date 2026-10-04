---
schema_version: 1
schema_kind: workorder
id: T0437
title: "BUG-105 後續：ALWAYS_LOCAL remote:resolve-client-paths（可達性規則）+ Claude 面板 @ 附件改送 server 形式路徑，不可達者拒絕 + toast"
type: fix
status: DONE
repo: better-agent-terminal
project: BUG-105
priority: P1
sizing: M
created_at: "2026-10-05T05:51:45+08:00"
started_at: "2026-10-05T07:03:46+08:00"
updated_at: "2026-10-05T07:12:21+08:00"
completed_at: "2026-10-05T07:12:21+08:00"
target_version: next
depends_on:
  - T0441
  - T0431
related:
  - "T0421 研究回報區「建議的機制」+ 拆單第 3 列；Q1 裁決：SSH 本機檔案一律拒絕並提示"
  - "BUG-107 / T0435（拖放修好後遠端附件會送 client 路徑，本單是同版擋板）"
  - "D134 追加（T0421 拆單）"
affects_files:
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - electron/remote/path-translator.ts
  - electron/remote/path-aware-channels.ts
  - electron/remote/protocol.ts
  - electron/remote/headless-channel-status.ts
  - src/components/ClaudeAgentPanel.tsx
  - src/components/CodexAgentPanel.tsx
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - electron/remote/__tests__/
  - src/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **規格來源**：T0421 回報區「建議的機制」。可達性：Identity 恆可達；WSL `owns()` 為 true 才可達（其他 distro UNC / 網路分享 → 不可達）；Docker 在 mount 內才可達；SSH 本機檔案一律不可達（Q1）。API 需區分用途（`purpose: 'local-file' | 'workspace-entry'`，後者供 T0438 用：輸入是 server 檔案的 client 形式，可直接 `toServer`）。"
  - "🔴 只做規則判斷，**不做遠端存在探測**。本機視窗行為不變（Identity 原樣）。**不改** `claude:send-message` 簽章（舊 headless server 會靜默丟附件，見 T0421）。"
  - "🔴 不對使用者手打 / 貼上文字做自動改寫（T0421 明確建議）。只轉 BAT 自己產生的附件路徑。"
  - "🔴 新 channel 列 ALWAYS_LOCAL，通過全分類守門（T0416 / T0422）。依賴 T0441（同改 `ClaudeAgentPanel.tsx`）與 T0431（同改 `main.ts` / remote 分類表）。開工前 `git log --oneline -10` 確認；共用檔 commit 前 `git diff <file>` 確認只含本單 hunk。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push；不部署 WSL。"
---

# T0437 — 遠端附件路徑解析

## 範圍

1. main：`remote:resolve-client-paths(paths, purpose)` → `{ input, serverPath | null, reachable, reason? }[]`，用該視窗 `RemoteClient` 目前的 translator
2. Claude 面板（Codex 面板若同機制一併）送出前批次查詢：可達者 `@` 前綴改 server 形式；不可達者移除並 i18n toast（「此檔案不在遠端主機上」）
3. 守門測試：每種 translator（Identity / WSL / Docker / SSH）× 可達 / 不可達 fixture；`purpose` 兩種
4. 回報區附實機步驟（WSL：拖 `\\wsl.localhost\…` 檔與 `C:\…` 檔；SSH：拖本機檔 → toast）

## 驗收條件

- [x] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39（本單範圍全綠、tsc 36；全量另有 2 個他單進行中造成的失敗，見回報區）
- [x] BUG-105 檔補一行「自由文字 / 附件路徑：T0437」註記

## Sub-session 執行指示
1. 讀本工單 + T0421 回報區全文 + T0416 回報區 + `electron/remote/path-translator.ts`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單 + BUG-105；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**（開始 2026-10-05T07:03:46+08:00，Worker，`CT_MODE=yolo`、`CT_INTERACTIVE=0`）

- **落點檢查**：PASS —— C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT=`D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 PASS（`electron/main.ts` 等皆存在）；C-2 不適用（無 `branch`，HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 依賴：T0441 / T0431 皆 `DONE`（`git log --oneline -10` 開工時 HEAD=`e8b9af3`）
- 驗收：
  - `npm run test:unit`：**2511 passed / 2 failed / 1 skipped**（158 files）。2 個失敗皆**非本單**：`electron/remote/__tests__/headless-helper-env.test.ts`（tower PTY 多出 `BAT_HELPER_NODE` / `PATH`）與 `scripts/__tests__/smoke-remote-headless.test.mjs` S13 `REMOTE_TOWER_ENV_KEYS` —— 皆來自同工作樹另一 Worker 進行中的 `electron/remote/headless-entry.ts` 未提交改動（T0456 helper node），本單未碰該檔。另一輪曾見 `scripts/__tests__/crlf-hashbang.test.mjs`（T0454 未追蹤檔）暫時失敗，後續輪次已綠。本單相關範圍 `npx vitest run electron/__tests__ src/__tests__ + resolve-client-paths / headless-parity / path-aware-channels-coverage / proxied-channels-binding`：**58 files / 984 tests 全綠**
  - `npx tsc --noEmit`：**36**（≤ 39）；剩餘錯誤皆為既有的 `CodexAgentPanel.tsx` 型別債，本單改動行無錯
  - 未跑 `npx vite build` / `npm run test:e2e`（工單 L141 指示）；未用 stash / reset / checkout / restore；未 push；未部署
  - BUG-105 已補「自由文字 / 附件路徑：T0437」註記

### 產出摘要

**機制**（規格：T0421 回報區「建議的機制」）

- 新 channel `remote:resolve-client-paths(paths, purpose)` → `{ input, serverPath | null, reachable, reason? }[]`
  - 分類：`PROXIED_CHANNELS`（只為 IPC binding）+ `ALWAYS_LOCAL_CHANNELS` + `PATH_FREE_CHANNELS`（`ALWAYS_LOCAL (never proxied)…`，參數不被自動轉換），headless 不回應 —— parity / path coverage / binding 三道既有守門全過
  - main：`registerHandler('remote:resolve-client-paths', …)` 用視窗 registry entry 的 profile；detached 工作區視窗（handler 拿到 `windowId=null`）在 `bindProxiedHandlersToIpc` 內、ALWAYS_LOCAL 短路**之前**改走 `resolveDetachedClientPaths`（父視窗 profile，T0446 綁定規則；unresolved → 全拒）
  - translator 選擇（`clientPathTranslatorForBinding`）：未綁 / local profile → Identity；remote profile → slot 服務該 profile 時用 `RemoteClient` 目前的 translator（新增唯讀 getter `pathTranslator`），否則由 profile `createTranslator`；**需映射的 targetOS（WSL / Docker / SSH）卻只有 Identity（auth 前 fallback / profile 不完整）→ null，全部不可達**（fail-closed，避免 client 路徑原樣通過）
- 可達性規則（`resolveClientPaths`，`electron/remote/path-translator.ts`，只做規則判斷、不探測遠端）：
  | translator | `local-file` | `workspace-entry` |
  |---|---|---|
  | Identity | 恆可達，原樣 | 恆可達，原樣 |
  | WSL | `owns()` 才可達 → `toServer`；他 distro UNC / 網路分享 → `outside-wsl-distro` | `toServer` |
  | Docker | 在 mount 內才可達；否則 `outside-docker-mounts` | `toServer`（mount 外的 container 路徑原樣） |
  | SSH | 一律 `ssh-local-file`（Q1） | `toServer`（home 外的 server 路徑原樣） |
  | null | `no-translator` | `no-translator` |
  非字串 / 空字串 → `invalid-path`；`paths` 非陣列或未知 `purpose` → throw
- 共用型別 + renderer helper：`src/lib/client-paths.ts`（`ClientPathPurpose` / `ResolvedClientPath` / `splitResolvedPaths`（答案與輸入逐一配對，不符或缺漏即拒，fail-closed）/ `resolveAttachmentPaths`（IPC 失敗 → 全拒並 `debug.log`）/ `attachmentDisplayNames`）
- 面板（Claude + Codex，同機制一併）：`handleSend` 在所有前置攔截（CLI-only 指令、`/snippet`、Codex 快取過期確認）之後、清空輸入之前批次查詢；可達者以 server 形式組 `@` 前綴；不可達者移除並 toast `claude.attachmentNotOnRemoteHost`（en / zh-TW / zh-CN，帶檔名）；若移除後沒有文字、圖片、可達附件 → 不送出，只移除不可達的附件 chip。toast 用既有 `CtToast` / `useCtToast` 掛在面板根節點（`position: relative`，顯示於面板右上）
- 本機視窗：Identity → 路徑原樣，行為不變（多一次本機 IPC）；`claude:send-message` 簽章未改；使用者手打 / 貼上文字不改寫

**檔案**

- `electron/remote/path-translator.ts`：`resolveClientPaths` / `clientPathTranslatorForProfile`
- `electron/main.ts`：handler、`clientPathTranslatorForBinding`、`resolveDetachedClientPaths`、bind 內 detached 分流
- `electron/remote/protocol.ts` / `headless-channel-status.ts` / `path-aware-channels.ts`：分類
- `electron/remote/remote-client.ts`：`get pathTranslator()`（**超出 affects_files**，一行唯讀 getter，滿足「用該視窗 RemoteClient 目前的 translator」）
- `electron/preload.ts` / `src/types/electron.d.ts`：`remote.resolveClientPaths`
- `src/lib/client-paths.ts`（**新檔，超出 affects_files**：型別需 electron / preload / renderer 共用，helper 供兩個面板共用以免重複）
- `src/components/ClaudeAgentPanel.tsx` / `CodexAgentPanel.tsx`、`src/locales/{en,zh-TW,zh-CN}.json`
- 測試：`electron/remote/__tests__/resolve-client-paths.test.ts`（30：4 translator × 可達 / 不可達 × 2 purpose、批次順序、null translator、非法輸入、`clientPathTranslatorForProfile`、分類守門 + headless 不回應）、`src/__tests__/attachment-remote-paths.test.tsx`（10：Claude / Codex × 全可達 / 部分不可達 + toast / 全不可達且無文字不送出；本機 Identity 原樣；helper）

**實機步驟（待使用者以新 build 驗證）**

1. WSL 視窗（例 `Ubuntu-24.04`）開 Claude 面板：
   - 拖入 `\\wsl.localhost\Ubuntu-24.04\home\<u>\repo\a.ts` → 送出，agent 收到 `@/home/<u>/repo/a.ts`（`Read` 成功）
   - 拖入 `C:\Users\<u>\Documents\b.txt` → 送出，agent 收到 `@/mnt/c/Users/<u>/Documents/b.txt`
   - 拖入 `\\wsl.localhost\<其他 distro>\…` 或 `\\server\share\…` → 面板右上 toast「此檔案不在遠端主機上，未附加：…」，prompt 不含該路徑
2. SSH 視窗：拖入任一本機檔（含 home 內）→ toast，不送該路徑；若只附這個檔且無文字 → 不送出、附件 chip 消失
3. Docker 視窗：mount 內的 host 檔 → `@/<container 路徑>`；mount 外 → toast
4. 本機視窗：附件照舊送 `@C:\…`，無 toast
5. 「附加檔案」按鈕（`dialog:select-files`）選的非圖片檔走同一流程；圖片附件不受影響（T0436 data URL）

### 遭遇問題

1. **legacy 遠端 profile（`targetOS` 未設 / `'local'`）視為 Identity 恆可達**：依規格（Identity 恆可達）照做；若該 profile 實際連到另一台機器，本機檔案路徑仍會原樣送出（行為同本單之前）。殘留風險，若要收緊需塔台決定（例：remote profile 一律 `local-file` 不可達）
2. **WSL `/mnt/<drive>` 假設 automount root 為 `/mnt`**（T0421 §2 已記，與 T0416 / T0393 同前提）
3. 送出前多一個 `await`（IPC），極短時間內連按兩次 Enter 理論上可能重送；本機 IPC 為毫秒級，未另加送出鎖
4. 同工作樹有其他 Worker 平行改動（`headless-entry.ts`、`scripts/*`、`vite.config.ts` 等），導致全量 unit test 2 個非本單失敗（見完成狀態）；本單 commit 以 `git commit --only` 只含本單檔案
5. 執行指示第 1 步的「T0416 回報區」未逐字通讀：改以 T0416 落地的守門（`path-aware-channels-coverage.test.ts` / `headless-parity.test.ts` / `proxied-channels-binding.test.ts`）與 `path-aware-channels.ts` 現況為準，三者皆綠

### 回報時間
2026-10-05T07:12:21+08:00
