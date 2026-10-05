---
schema_version: 1
schema_kind: workorder
id: T0460
title: "shell:open-external 對 file: 本機路徑以 openPath 開啟時，可執行副檔名（.bat / .cmd / .exe / .ps1 / .vbs / .lnk 等）先跳確認對話框；其他檔案照舊直接開"
type: fix
status: PENDING
repo: better-agent-terminal
project: BUG-105
priority: P2
sizing: S
created_at: "2026-10-05T11:19:13+08:00"
started_at: null
updated_at: "2026-10-05T11:19:13+08:00"
completed_at: null
target_version: next
depends_on: []
related:
  - "T0457（`443ba4e`）回報區「遭遇問題」1：IPC `shell:open-external` 對 `file:///` 走 `shell.openPath`，點擊本機 `.bat` / `.exe` 即執行（PathLinker / TerminalPanel 等呼叫端）"
  - "使用者 2026-10-05 11:19 裁決：可執行副檔名加確認對話框（其他檔案照舊直接開）"
affects_files:
  - electron/main.ts
  - electron/navigation-guard.ts
  - electron/__tests__/
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **使用者裁決**：只對可執行 / 腳本類副檔名跳確認，其餘檔案行為不變。清單至少含 Windows：`.bat` `.cmd` `.com` `.exe` `.msi` `.ps1` `.psm1` `.vbs` `.vbe` `.js` `.jse` `.wsf` `.wsh` `.hta` `.scr` `.pif` `.cpl` `.reg` `.lnk` `.url`；macOS：`.app` `.command` `.pkg` `.dmg` `.terminal`；Linux / 通用：`.sh` `.run` `.AppImage` `.desktop`，以及無副檔名但在 POSIX 有可執行位元的檔案（能判斷才判斷，無法判斷不擋）。大小寫不敏感。清單與判斷抽成純函式（放 `navigation-guard.ts` 或新模組）並單測。"
  - "🔴 對話框：main 端 `dialog.showMessageBox`（以呼叫視窗為 parent），按鈕「取消」（預設、Esc）/「開啟」；文字 i18n 三語（main 端若無 i18n 機制，比照專案既有 main 端對話框做法，回報區說明）；顯示檔名（不顯示完整路徑以外的敏感資訊）；取消則不開啟並回傳可辨識結果。不得用 renderer 自行繞過（判斷在 main）。"
  - "🔴 `http(s)` 走 `openExternal` 的行為不變；`file:` 非可執行檔仍直接 `openPath`；遠端視窗的路徑語意（T0437 / PathLinker server 形式）不在本單範圍，只處理本機開啟。"
  - "🔴 同工作樹有 T0459（研究，只讀）。`main.ts` commit 前 `git diff electron/main.ts` 確認只含本單 hunk。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138；不得以 `git show HEAD:… >` 覆寫取紅燈）；寫檔維持 LF；不 push。"
---

# T0460 — 可執行檔開啟確認

## 驗收條件

- [ ] 純函式測試：各平台副檔名（大小寫）命中、一般檔（`.txt` / `.md` / `.png` / `.pdf`）不命中、無副檔名不誤擋
- [ ] handler 測試（mock `dialog` / `shell`）：可執行檔 → 對話框；取消 → 不 `openPath`；開啟 → `openPath`；非可執行 → 直接 `openPath`、不跳對話框；http(s) → `openExternal` 不變
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 36
- [ ] 回報區附實機步驟（終端輸出中的 `C:\…\x.bat` 連結點擊 → 確認框；`.txt` → 直接開）

## Sub-session 執行指示
1. 讀本工單 + T0457 回報區 + `electron/main.ts` `shell:open-external`（約 :2421）
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 先寫測試（紅）→ 實作（綠）；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
