---
schema_version: 1
schema_kind: workorder
id: T0548
title: "安裝檔瘦身收尾（T0547 後續）：Windows 改回 normal 壓縮、release.ps1 / real-remote e2e 不再讀安裝目錄 baseline、server bundle 下載對連線錯誤的重試"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-10-16T01:40:03+0800"
updated_at: "2026-10-16T01:40:03+0800"
started_at: ""
completed_at: ""
commit: ""
target_version: "0.6.1-pre.4"
depends_on: [T0547]
related:
  - "T0547 回報區「遭遇問題」1 / 4 / 5（本單三項的來源與證據）；D146"
affects_files:
  - package.json
  - .vscode/scripts/release.ps1
  - e2e/real-remote/t0514-env.mjs
  - e2e/real-remote/t0515-wizard-env.mjs
  - e2e/real-remote/t0520-env.mjs
  - e2e/pre5-ssh-alias.spec.ts
  - e2e/pre6-wizard-acceptance.spec.ts
  - e2e/pre7-acceptance.spec.ts
  - electron/remote/server-bundle-download.ts
  - electron/remote/__tests__/
  - scripts/__tests__/
  - CLAUDE.md
  - docs/server-bundle-distribution.md
  - _ct-workorders/T0548-installer-slim-followups.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF（`.ps1` 依該檔現有換行）。`src/styles/settings.css` 的 M 狀態不是你的變更；commit 用 `--only`。"
  - "🔴 `package.json` 只改 `build.win.compression`（第 1 項）；不升降套件版本，`version` 不動。"
  - "🔴 不得實際執行 `release.ps1`（只能 `-DryRun` 或靜態測試）；real-remote / pre5-7 e2e 需要真實 WSL / SSH 目標，**不要實跑**，只改路徑解析並以單元測試或 `node --check` / 型別檢查驗證。不碰使用者的 BAT（port 9876）與 WSL `Ubuntu-24.04`。"
---

# T0548 — 安裝檔瘦身收尾（T0547 後續）

## 1. Windows 改回 normal 壓縮

T0547 實測（electron-builder 26.8.1）：`compression: "maximum"` 對 NSIS 無效（非 zip 一律 `-mx=9`），zip 只省 0.3%、打包時間 47 s → 375 s。

- 在 `build.win` 加 `compression: "normal"`（平台值優先），頂層 `maximum` 保留給 AppImage（xz）/ dmg（UDBZ）。
- 補 / 改 `scripts/__tests__/` 的設定斷言；`CLAUDE.md`「Packaging / Release 前置檢查」中 T0547 寫的 compression 說明同步改成實際設定。

## 2. 不再讀安裝目錄的 baseline

T0547 起安裝檔沒有 `resources/bat-server-baseline`，以下仍預設讀它：

- `.vscode/scripts/release.ps1`：說明與 DryRun 訊息仍寫「build:release = fetch:baseline + …」、`BAT_BASELINE_VERSION`（已無作用）→ 改寫說明，移除或標示無作用的設定（保留對舊流程無害的部分即可，在回報區說明取捨）。
- `e2e/real-remote/t0514-env.mjs` / `t0515-wizard-env.mjs` / `t0520-env.mjs`、`e2e/pre5-ssh-alias.spec.ts` / `pre6-wizard-acceptance.spec.ts` / `pre7-acceptance.spec.ts`：baseline 來源改為依序 ① 明確參數 / env（`--baseline-dir`、`BAT_E2E_PRE5_SSH_BUNDLE_DIR` 等既有者）→ ② repo 的 `dist-baseline/`（`npm run fetch:baseline` 產出）→ ③ 使用者 userData 的 `bat-server-bundles` cache（含 `.sha256` sidecar 者）→ ④ 舊安裝目錄（T0547 前的安裝版）；都找不到時錯誤訊息說明 `npm run fetch:baseline`。
- `docs/server-bundle-distribution.md` 若有提到這些 e2e 的 baseline 來源，同步。

## 3. 下載對連線錯誤的重試

T0547 觀察：`server-bundle-download.ts` 的 `toAttemptError` 只讀 `e.cause?.code`，Windows 上 Node fetch 的連線錯誤（ECONNREFUSED / ECONNRESET / ETIMEDOUT / ENOTFOUND 等）拿不到 code，重試表對連線錯誤沒有生效，0 秒即失敗。

- 讓連線類錯誤被正確分類並套用既有重試表（從 `cause` 鏈、`AggregateError.errors`、`cause.errno` / `message` 等取得；分類方式寫明）。不改重試次數與間隔的產品值。
- 單元測試：模擬 Windows 形態的 fetch 錯誤（無 `cause.code`、`AggregateError`）會重試；4xx / sha 不符等非暫時性錯誤不重試（既有行為不變）。

## 驗收條件

- [ ] 三項落地，各有測試或靜態驗證
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全綠、`npx vite build` 成功（回報區附數字）
- [ ] 本機 `npm run build:dir` 成功，回報 Windows zip / NSIS 是否仍為 normal（可用 `electron-builder --prepackaged` 只打 zip 量時間，或說明為何不量）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 互動紀錄

### Renew 歷程
無

### 遭遇問題

### 回報時間
