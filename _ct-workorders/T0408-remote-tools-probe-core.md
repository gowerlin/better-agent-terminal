---
schema_version: 1
schema_kind: workorder
id: T0408
title: "PLAN-037 A：remote-tools 偵測核心——固定 probe 腳本 + 輸出解析 + RemoteToolsReport 型別（不接線）"
type: impl
status: PENDING
repo: better-agent-terminal
project: PLAN-037
priority: P2
sizing: M
created_at: "2026-10-05T02:51:49+08:00"
target_version: next
depends_on:
  - T0407
related:
  - "T0407 回報區 §0 實測、§1 工具清單、§2 登入判斷表、§3 偵測設計、§6 安全（本單規格來源）"
  - "D133（PLAN-037 波次：T0408 A ∥ T0409 C → T0410 D → T0411 B → T0412 E ∥ T0413 F → T0414 G → T0405 → T0406）"
affects_files:
  - electron/remote-tools/probe-script.ts
  - electron/remote-tools/parse.ts
  - electron/remote-tools/__tests__/
  - src/types/remote-tools.ts
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **只做純邏輯與型別，不接線**：不得改 `electron/main.ts`、`electron/remote/protocol.ts`、`electron/remote/headless-entry.ts`、`electron/preload.ts`、`src/types/electron.d.ts`（接線是 T0411）。新檔不得 import electron。"
  - "🔴 T0409 平行中（`src/lib/remote-tools/*`）：本單型別 `src/types/remote-tools.ts` 先 commit 越早越好；T0409 會讀它。"
  - "🔴 probe 腳本：**零插值**常數；禁止出現 `gh auth token` / `--show-token`；登入檢查丟棄 stdout；不讀 credential 檔內容（只 `[ -e ]`）。"
  - "🔴 WSL 只做唯讀實測（跑 probe 腳本本身可以，它是唯讀的）；不安裝任何東西、不 restart `bat-server.service`。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0408 — remote-tools 偵測核心（PLAN-037 A）

## 元資料
- **工單編號**：T0408
- **任務名稱**：remote-tools probe + parse + 型別
- **狀態**：PENDING
- **建立時間**：2026-10-05 02:51 (UTC+8)
- **intervention_type**：fire-and-forget

## 背景

PLAN-037（D131 / D133）：遠端 AI 工具套件「檢查＋一鍵安裝」。T0407 研究完成並經使用者裁決 Q1-Q3。本單是偵測的**純邏輯核心**，供 T0411（headless / main 接線）與 T0410（面板）使用。**完整規格以 T0407 回報區 §3 為準**，本單只摘要要點。

## 範圍

1. `src/types/remote-tools.ts`：`RemoteToolsReport`（`schemaVersion: 1`）與相關 enum
   - 工具 id：`claude` / `git` / `gh` / `codex` / `curl` / `bash` / `rg` / `uv` / `python3` / `node`（分級見 T0407 §1：必要 / 建議 / 可選 / 前置）
   - 每工具：`status: ok | missing | interop-only | not-on-path | too-old | error`、`path?`、`version?`、`login?: loggedIn | loggedOut | unknown | n/a`、`serverVisible: boolean`
   - 環境：os family / id / version、`arch`、`musl`、`pkgManager: apt | dnf | yum | apk | brew | none`、`privilege: root | passwordless | password-required | sudo-missing`、`isWsl`
2. `electron/remote-tools/probe-script.ts`：兩個**常數** POSIX sh 腳本（login 視角完整 probe、server 視角 PATH-only probe），輸出以 `__BAT_TOOLS_PROBE_V1_BEGIN__` / `_END__` 包住的 `key=value` 行；另匯出 login shell 選擇函式（路徑過 `/^\/[A-Za-z0-9._\/-]+$/`、basename ∈ {bash, zsh, sh, dash, ksh}，否則 `/bin/sh`）與 execFile 參數組裝（`-l -i -c`、timeout 20s、stdin 為 `/dev/null`）——**本單不實際接 child_process 到 handler**，但可提供一個 `runProbe(execFileImpl)` 之類可注入的函式
   - WSL：`/proc/sys/fs/binfmt_misc/WSLInterop` 存在或有 `$WSL_DISTRO_NAME` 時，`^/mnt/[a-z]/` 路徑歸 `interop-only` 且**不執行**
   - 額外掃 `~/.local/bin`、`/usr/local/bin`、`/opt/homebrew/bin` 找 `not-on-path`
   - 版本：`--version | head -n1`，有 `timeout` 就 `timeout 5`
   - 登入：只取 exit code（claude `auth status`、codex `login status`、gh `auth status --hostname github.com` 加 `timeout 8`，逾時 → unknown）
3. `electron/remote-tools/parse.ts`：標記之間只接受白名單 key、value 只留可列印字元且 ≤ 256；版本解析重用 `electron/claude-resolver.ts` 的正規式與 `HEALTHY_MIN`（claude 低於 → `too-old`）、`codex-runtime-resolver.ts` 的 `parseCodexVersion`；git / gh 用 `\d+\.\d+\.\d+`

## 驗收條件

- [ ] parse 單元測試 fixture（至少）：WSL interop 遮蔽（codex / npm 解析到 `/mnt/c/...`）、首次安裝後 `not-on-path`、Alpine root 無 sudo + musl、macOS（brew、無 `timeout`）、全部未安裝 / 未登入、gh 逾時、惡意輸出（標記外雜訊、非白名單 key、超長 / 控制字元 value）
- [ ] 守門測試：probe 常數不含 `gh auth token`、`--show-token`、`$(` 以外的插值來源（確認沒有 `${...}` 引用外部輸入的模板拼接）；新檔不 import electron
- [ ] **WSL 唯讀實測**：以 `wsl.exe -d Ubuntu-24.04 -- bash -l -i -c <probe>`（execFile + array args）實際跑 login probe，parse 結果附在回報區；預期與 T0407 §0 一致（git ok、claude missing、codex interop-only…）
- [ ] `npm run test:unit` 全綠（基線 1309）；`npx tsc --noEmit` ≤ 40

## Sub-session 執行指示
1. 讀本工單 + **T0407 回報區 §0-§3、§6** + `electron/claude-resolver.ts`、`electron/codex-runtime-resolver.ts`、`electron/remote/arch-detect.ts`（timeout / NAME_RE 範式）
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 先寫並 commit 型別（讓 T0409 可用）→ probe / parse → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### WSL 實測 parse 結果

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題

### 回報時間
