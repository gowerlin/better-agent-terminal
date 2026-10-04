---
schema_version: 1
schema_kind: workorder
id: T0398
title: "BUG-102：PtyManager 的 UTF-8 locale env 依平台決定，不再對 Linux 寫死 en_US.UTF-8"
type: fix
status: PENDING
repo: better-agent-terminal
project: BUG-102
priority: P2
sizing: S
created_at: "2026-10-05T01:36:55+08:00"
target_version: next
depends_on: []
related:
  - "BUG-102（T0396 smoke 發現）"
  - "T0399（同批平行，e2e；只動 e2e/）"
affects_files:
  - electron/pty-manager.ts
  - electron/pty-locale-env.ts
  - electron/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **不得部署到 WSL、不得 restart `bat-server.service`**：修完由塔台以 `npm run deploy:headless:dev` 部署並跑 `npm run smoke:remote:headless` 驗證（需先徵得使用者同意，會中斷使用者的遠端終端）。"
  - "🔴 **不執行 `npx vite build`**：T0399 平行在跑 vite build + Playwright；build 由塔台複驗時跑。"
  - "🔴 child_process（若需探測 `locale -a`）一律 `execFile` + array args、timeout 5s、結果快取；禁用 shell-spawning exec API。探測失敗不可讓 PTY 建立失敗。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0398 — PTY locale env 依平台決定（BUG-102）

## 元資料
- **工單編號**：T0398
- **任務名稱**：BUG-102 修復
- **狀態**：PENDING
- **建立時間**：2026-10-05 01:36 (UTC+8)
- **intervention_type**：fire-and-forget
- **affects_files**：`electron/pty-manager.ts`、`electron/pty-locale-env.ts`（新增，名稱可調整，回報區說明）、`electron/__tests__/`

## 背景

`electron/pty-manager.ts` 三個 spawn 路徑（:506 附近 terminal-server 路徑、:566 附近 direct、:647 附近 child_process fallback）組 `envWithUtf8` 時，**在 `...customEnv` 之後**寫死 `LANG` / `LC_ALL: 'en_US.UTF-8'`。

- WSL Ubuntu 24.04 預設只有 `C.UTF-8`，沒有 `en_US.UTF-8` ⇒ 每個遠端終端開頭印 `bash: warning: setlocale: LC_ALL: cannot change locale (en_US.UTF-8)`，locale 退回 `C`（T0396 smoke 實測，對象為 headless server，PtyManager 經 T0389 DI 共用）
- 寫在 `customEnv` 之後 ⇒ 使用者在設定裡自訂的 `LANG` 也會被蓋掉

## 範圍

1. 抽出單一 helper（例如 `electron/pty-locale-env.ts` 的 `resolvePtyLocaleEnv(...)`），三個路徑共用，消除三份重複
2. 決策規則（塔台指定，Worker 照做；有更好理由要偏離時在回報區說明）：
   - **win32**：維持現行行為（`LANG` / `LC_ALL=en_US.UTF-8`），避免 Git Bash / MSYS 既有行為回歸
   - **customEnv 優先**：使用者自訂的 `LANG` / `LC_ALL` / `LC_CTYPE` 一律不覆寫
   - **darwin**：維持 `en_US.UTF-8`（macOS 一律有，且無 `C.UTF-8`）
   - **linux**（含 WSL headless）：
     - 繼承的 `LANG` 已是 UTF-8 且可用 → 沿用
     - 否則依序挑第一個可用：`C.UTF-8` → `en_US.UTF-8`（以 `locale -a` 探測，結果快取，比對時忽略大小寫與 `utf8` / `UTF-8` 寫法差異）
     - 探測失敗 → `C.UTF-8`
     - **不設 `LC_ALL`**（除非 customEnv 指定），只設 `LANG`，讓使用者 shell 的 `LC_*` 設定仍有效
3. `PYTHONIOENCODING` / `PYTHONUTF8` / `TERM*` 等其他 env 不動

## 驗收條件

- [ ] unit：helper 依 platform × 繼承 env × customEnv × `locale -a` 結果（含失敗）的矩陣測試；win32 與 darwin 的輸出與修改前完全相同
- [ ] unit：三個 spawn 路徑都改走 helper（可用既有 PtyManager 測試的 spawn mock 斷言 env）
- [ ] `npm run test:unit` 全綠（基線 1141）；`npx tsc --noEmit` ≤ 40
- [ ] 回報區附「修改前 / 修改後」三平台 env 對照表

## Sub-session 執行指示

1. 讀本工單 + BUG-102 + `electron/pty-manager.ts` 三處 env 組裝 + 既有 `electron/__tests__/` 中 PtyManager 相關測試
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**（不要寫 `FIXED`）
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### env 對照表

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題

### 回報時間
