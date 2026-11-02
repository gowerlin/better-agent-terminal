---
schema_version: 1
schema_kind: workorder
id: T0779
title: "PLAN-053 第一步：Electron 41.2.1 → 41.10.7（同一條 41 線的最後一版，大版本不變）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: M
created_at: "2026-11-02T14:07:33+0800"
depends_on: [T0780]
related:
  - "PLAN-053（2026-11-02 調為 high）；D221；T0668（Electron 41 停止更新查證：41.10.7 是 41 線最後一版）；BUG-164 / T0669（macOS `disable-skia-graphite`）"
  - "CLAUDE.md「Electron Runtime」「本機開發：npm 12 install scripts」「Packaging / Release 前置檢查」節；`docs/agent-guide/packaging-release-checks.md`、`docs/agent-guide/npm12-install-scripts.md`"
affects_files:
  - package.json
  - package-lock.json
  - CLAUDE.md
  - "docs/agent-guide/*.md（只在描述目前 Electron 版本的地方）"
  - _ct-workorders/PLAN-053-electron-42-upgrade.md
  - _ct-workorders/T0779-electron-41-10-7-patch-bump.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 派工時機：塔台等 T0780 收單後才派（兩張都要 build，不並行）。"
  - "🔴 現況（塔台 2026-11-02 查證）：`package.json` `\"electron\": \"^41.2.1\"`，`package-lock.json` 鎖 41.2.1，`node_modules/electron` 41.2.1；npm 上 electron@41 最新 41.10.7、`latest` 45.2.1。本單**只**升到 41.10.7，不升大版本（42+ 屬 PLAN-053 主升級，另開單）。"
  - "🔴 升級做法：`npm install electron@41.10.7`（`package.json` 變成 `^41.10.7`）。之後檢查 `git diff package-lock.json`：只允許 `node_modules/electron` 這一項（version / resolved / integrity）以及它自己的相依（若有）改變。其他套件也被改動 → 不得 commit lock，停下回報 PARTIAL（列出 diff）。`node -p \"require('electron/package.json').version\"` 與 `npx electron --version` 都要是 41.10.7。npm 12 install scripts：electron 已在 `allowScripts`，postinstall 會下載 binary；若沒下載（`path.txt` 不存在）照 `docs/agent-guide/npm12-install-scripts.md` 手動補跑，不用 `--dangerously-allow-all-scripts`。"
  - "🔴 不改的東西：`@lydell/node-pty`、`@kutalia/whisper-node-addon` 等原生模組（ABI 在 41 線內不變，CLAUDE.md「Electron Runtime」）；electron-builder、vite 系列、內嵌 claude / codex 版本；macOS `disable-skia-graphite`（T0669）與任何 GPU / Graphite 設定。不用 `npm rebuild`。"
  - "🔴 驗證（全部要有輸出佐證）：`node scripts/verify-native-modules.js` 綠；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠；`npm run test:legacy` 全綠（或與基線相同、逐項說明）；`npx vite build`；`npm run build:dir` 成功後 `node scripts/verify-packaged-native.js --platform win --out release --arch x64` 綠（L136：VS Code Insiders 可能鎖 `release\\win-unpacked\\resources\\app.asar`，遇到鎖檔先回報，不強制刪）；打包產物的 Electron 版本確認為 41.10.7（例：`release/win-unpacked` 執行檔 FileVersion 或 `process.versions.electron`）。"
  - "🔴 e2e 冒煙（source build、隔離實例、假模型，不用真實模型）：至少跑 `e2e/t0572-new-pty-initial-size.spec.ts`（PTY / Terminal Server）、一支 Claude 面板相關、一支 Dialog / Esc 相關（例 t0776）、一支工作區 ⚠️ 相關（例 t0735），共 ≥ 4 支，記錄每支結果；若有 spec 在 41.2.1 上原本就失敗，要先在升級前的 HEAD 重現並註明，不算回歸。只結束隔離實例自己的程序，絕不碰使用者的 BAT（`%APPDATA%\\BetterAgentTerminal`）。"
  - "🔴 macOS / Linux：本機無法驗證，回報寫「未驗證，待 CI 三平台 build 與 `macos-acceptance.yml`」，不要寫成通過。"
  - "🔴 文件：CLAUDE.md「Electron Runtime」節第一點補上目前版號（41.10.7，T0779）與 41 線已停止更新、主升級見 PLAN-053；`docs/agent-guide/` 只改描述「目前版本」的句子，實測紀錄裡的「以 41.2.1 實測」是歷史，保留不改。PLAN-053 文末補〈T0779 結果〉（版本、驗證摘要、未驗證平台），狀態維持 IDEA、不改優先度。"
  - "🔴 不發版、不改 CHANGELOG、不 push。公開 repo 去識別化（D176）。yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0779 — Electron 41.2.1 → 41.10.7

## 元資料

- **工單編號**：T0779
- **類型**：implementation（相依套件修補版升級）
- **優先級**：P1
- **建立時間**：2026-11-02T14:07:33+0800
- **預估規模**：M（改動小，驗證多）
- **派工順序**：T0780 收單後

## 背景

Electron 41 這條線已停止更新（最後一版 41.10.7，T0668 查證）。塔台 2026-11-02 發現 BAT 不只停在停更的版本線上，連 41 線之後的 8 個修補小版本都沒裝：lock 鎖在 41.2.1。npm 上 `latest` 已是 45.2.1。修補版通常含 Chromium 安全修正（推論）。使用者決定 PLAN-053 調為 high，先開本單在 41 線內升到最後一版；大版本升級另開單（D221）。

## 範圍

1. `npm install electron@41.10.7`，確認 lock 只改 electron。
2. 驗證（typecheck、unit、legacy、vite build、`build:dir`＋打包產物檢查、e2e 冒煙 ≥ 4 支）。
3. CLAUDE.md「Electron Runtime」、docs 目前版本描述；PLAN-053 補結果。

## 不做

- 不升 42+；不改原生模組、electron-builder、vite、內嵌 CLI；不改 GPU / Graphite 設定；不發版。

## 驗收

- [ ] `package.json` `^41.10.7`、lock 只改 electron，`electron --version` = 41.10.7
- [ ] verify-native-modules、typecheck 0 / 0、`test:unit`、`test:legacy`、`vite build` 綠
- [ ] `build:dir` ＋ `verify-packaged-native.js` 綠，打包產物 Electron = 41.10.7
- [ ] e2e 冒煙 ≥ 4 支結果（含原本就失敗者的說明）
- [ ] macOS / Linux 標「未驗證」
- [ ] CLAUDE.md / docs / PLAN-053 更新

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

### 產出摘要

### 驗證

### 行為變化

### 遭遇問題

### 互動紀錄

### 後續建議

### commit 狀態

### 回報時間
