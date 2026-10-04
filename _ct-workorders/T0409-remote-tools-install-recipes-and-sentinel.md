---
schema_version: 1
schema_kind: workorder
id: T0409
title: "PLAN-037 C：安裝食譜（tool × pkgManager × 權限 × musl → InstallPlan）+ 完成標記 wrap / match + 來源 host 白名單"
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
  - "T0407 回報區 §2 官方安裝方式表、§4 完成標記、§6 安全（本單規格來源）"
  - "T0408（同批平行；提供 `src/types/remote-tools.ts`）"
  - "D133"
affects_files:
  - src/lib/remote-tools/recipes.ts
  - src/lib/remote-tools/sentinel.ts
  - src/lib/remote-tools/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **只做純邏輯**：不改 `electron/`、元件、locales；不接線。"
  - "🔴 型別以 T0408 的 `src/types/remote-tools.ts` 為準；若 T0408 尚未 commit，先在本單檔內宣告最小必要的本地型別並在回報區標註，**不要自己建立或修改 `src/types/remote-tools.ts`**（T0408 擁有該檔）。"
  - "🔴 **偵測結果只能映射成 enum**（pkgManager / privilege / musl / os family）：版本、路徑等字串**絕不**插進產出的指令。"
  - "🔴 不在任何機器上實際執行安裝指令。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0409 — 安裝食譜 + 完成標記（PLAN-037 C）

## 元資料
- **工單編號**：T0409
- **任務名稱**：remote-tools recipes + sentinel
- **狀態**：PENDING
- **建立時間**：2026-10-05 02:51 (UTC+8)
- **intervention_type**：fire-and-forget

## 背景

使用者裁決（T0407 Q2 / Q3）：安裝前顯示**確認框**（完整指令、官方文件 URL、腳本 URL、是否需 sudo、安裝位置、完整性機制、非官方來源警示），確認後在遠端終端分頁打入並送出；**使用者空間優先**（claude / codex / uv 用官方 install.sh 裝 `~/.local/bin`，免 sudo），git / gh / rg 走發行版套件管理器（gh 用官方簽章 repo）。指令尾端附完成標記，偵測到標記即重新偵測。**完整規格以 T0407 回報區 §2 / §4 / §6 為準。**

## 範圍

1. `src/lib/remote-tools/recipes.ts`
   - `buildInstallPlan(toolId, env)` → `InstallPlan | { unsupported: reason }`；`env` 只含 enum（pkgManager、privilege、musl、osFamily）
   - `InstallPlan`：`command`（單行或以 `&&` 串接）、`needsSudo`、`installLocation`、`docsUrl`、`scriptUrl?`、`integrity`（說明文字 key，供 i18n）、`unofficial?`（Alpine gh）、`prerequisites?`（Alpine claude 需先 `apk add bash curl libgcc libstdc++ ripgrep`）
   - 權限處理：`root` ⇒ 去掉 `sudo` 前綴；`sudo-missing` 且需要 root ⇒ unsupported；`password-required` ⇒ 照常帶 sudo（使用者在分頁輸入）
   - macOS 無 brew 時 git 只給手動指引（unsupported + reason）
   - 更新食譜：claude `claude update`
   - 常數表中所有 URL 的 host 僅限白名單：`claude.ai`、`code.claude.com`、`chatgpt.com`、`github.com`、`cli.github.com`、`astral.sh`、`docs.astral.sh`、`git-scm.com`、`nodejs.org`（docs 用）；以測試守門
2. `src/lib/remote-tools/sentinel.ts`
   - `wrapWithSentinel(command, nonce)`：附加 `; printf '\n__BAT_TOOL_DONE_%s_%s__\n' '<nonce>' "$?"`；`nonce` 必須符合 `^[0-9a-f]{16}$`，否則 throw
   - `createSentinelMatcher(nonce)`：餵入 pty output chunk（可跨 chunk、含 ANSI），偵測到 `__BAT_TOOL_DONE_<nonce>_<code>__` 回傳 exit code；**終端回顯的 printf 格式字串不得被誤判**
   - `generateNonce()`（crypto random 16 hex）

## 驗收條件

- [ ] 食譜矩陣測試：每個工具 × {apt, dnf, apk, brew, none} × {root, passwordless, password-required, sudo-missing} × musl 的預期結果（可用 snapshot，但關鍵案例要有明確斷言：root 去 sudo、Alpine claude 前置、Alpine gh unofficial、macOS 無 brew 的 git unsupported）
- [ ] 安全測試：URL host 白名單；以惡意 env（非 enum 值、含 `;` / `$(` 的字串）呼叫時 throw 或 unsupported，產出指令不含任何來自輸入的字串
- [ ] sentinel 測試：跨 chunk、ANSI 夾雜、回顯的格式字串不誤判、錯 nonce 不匹配、exit code 0 / 非 0 / 多位數
- [ ] `npm run test:unit` 全綠（基線 1309）；`npx tsc --noEmit` ≤ 40

## Sub-session 執行指示
1. 讀本工單 + **T0407 回報區 §2 / §4 / §6** +（若已存在）`src/types/remote-tools.ts`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題

### 回報時間
