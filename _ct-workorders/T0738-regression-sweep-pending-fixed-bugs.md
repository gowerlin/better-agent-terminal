---
schema_version: 1
schema_kind: workorder
id: T0738
title: "待驗收 FIXED BUG 自動化盤點：逐張對照既有自動化證據、在 HEAD 重跑相關 e2e、分類為可結案 / 可補 e2e / 只能手動或特定環境"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: L
created_at: "2026-11-01T17:20:13+0800"
started_at: ""
updated_at: "2026-11-01T17:20:13+0800"
completed_at: ""
depends_on: [T0737, T0741]
related:
  - "`_ct-workorders/_bug-tracker.md`〈✅ 已修復〉；各 BUG 單的修正工單與回報區"
  - "`e2e/`（72 支 spec，含 t0523 / t0524 / t0530 / t0531 / t0532 / t0539 / t0578 / t0580 等）、`e2e/fixtures/electron-isolation.ts`"
  - "全域 R-G003（BUG 狀態判準）；T0736 / T0737（pre.8 / pre.7 自動驗收，本單不重做那些 BUG：177 / 178 / 179）"
affects_files:
  - _ct-workorders/T0738-regression-sweep-pending-fixed-bugs.md
  - "e2e/（只在〈範圍〉第 3 點新增 spec 時；最多 3 支；不改既有 spec 的行為）"
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 對象（目前 FIXED、本單要逐張處理）：BUG-105、107、108、111、116、118、127、128、129、130、131、132、133、134、135、137、146、147、156、159、171、175。不含 BUG-177 / 178 / 179（T0737）。以 BUG 單內容與其修正工單回報區為準，單內有多段更正以最後一段為準。"
  - "🔴 每張產出一列：修正 commit / 版本、既有自動化證據（單元測試檔、e2e spec、CI 檢查，附路徑）、本次在 HEAD 重跑的結果（PASS / FAIL / 未跑＋原因）、分類與建議：(A) 證據足以 CLOSED（寫出依據：e2e 在 HEAD 綠＋修正已在交付版、或 CI 打包檢查、或回報區已記錄的使用者 / 外部測試者實測）；(B) 可在本機 Windows 補 e2e（寫出情境與做法）；(C) 只能手動或需特定環境（寫出需要什麼：macOS / Linux 實機、Docker 執行中、WSL 安裝 server bundle、遠端主機、真實模型、OS 拖放等）。證據不足一律歸 B 或 C，不得猜成 A。"
  - "🔴 範圍：① 對照表；② 在 HEAD 以隔離實例重跑對照到的既有 e2e（先 `npx vite build`），記錄每支結果與耗時；③ 對 B 類中最有價值、各自 ≤ 1 個情境的，最多新增 3 支 spec（其餘列為後續候選，由塔台開單）；④ 環境探測只做唯讀查詢：`docker info` 能否連上 engine、`wsl -l -v`、是否以系統管理員執行、內嵌 / 系統 codex 版本 —— 只記結果。⑤ BUG-116 / 118（mac / Linux 打包）可用 `gh run view <run> -R gowerlin/better-agent-terminal --log` 唯讀查 `v0.7.2-pre.8` 發版 run `41277080514` 的 `verify-packaged-native.js` 輸出當證據。"
  - "🔴 不得做（會動到使用者環境或不可逆）：不建立 / 刪除 / 停止任何 Docker 容器或映像、不在使用者的 WSL 安裝或移除 server bundle、不連 SSH 遠端、不改系統時間（BUG-171 只驗『結束隔離實例自己的 Terminal Server 程序 → recovery 依序執行、新 shell 不被套 exit 1』這條，程序以隔離 userData 的 pid 檔辨識，🔴 絕不碰使用者 BAT 的 Terminal Server）、不執行安裝檔。會寫系統剪貼簿的 spec（例如 t0524 貼圖）：先備份剪貼簿文字、跑完還原；無法安全還原就不跑並註明。Docker / WSL / 遠端相關 spec 一律不跑，歸 C 並寫明需要什麼，由塔台與使用者決定。"
  - "🔴 不改產品程式碼（`src/` / `electron/` / `scripts/` 都不動）；不改 BUG 單狀態與 `_bug-tracker.md`（由塔台依本單建議處理）；重跑發現 FAIL → 記在〈發現的問題〉附重現步驟、log 位置，判斷是產品回歸還是測試過時，不在本單修。"
  - "🔴 隔離：一律用 `e2e/fixtures/electron-isolation.ts` 的隔離實例，不以預設實例啟動 source build、不碰使用者正在用的 BAT 與 userData；T0737 與 T0741 都完成後才派本單（避免同時 build）。暫存目錄跑完要清掉；清不掉就把路徑寫進回報區。需要 LLM 的 spec 只能打本機假模型（`e2e/fixtures/fake-anthropic-api.ts` 或 spec 自帶的假 API），不得用真實登入；回報對外請求數。"
  - "🔴 驗證：新增 spec（若有）連跑 2 次綠；`npm run typecheck` = 0、`npm run typecheck:electron` = 0。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，外部測試者一律用代稱。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0738 — 待驗收 FIXED BUG 自動化盤點

## 元資料

- **工單編號**：T0738
- **類型**：implementation（驗收盤點＋回歸重跑）
- **優先級**：P2
- **建立時間**：2026-11-01T17:20:13+0800
- **預估規模**：L

## 背景

使用者要求把 pre.6 以前還沒驗收的項目也安排自動驗收。熱區有 22 張 FIXED BUG（不含 T0737 處理的 177 / 178 / 179）在等驗收，其中不少修正工單當時已寫了 e2e，但沒有在新版上重跑；另有部分只能在 macOS / Linux、Docker、WSL、遠端主機或真實模型上驗。本單先把每張的證據與可自動化程度盤清楚，重跑既有 e2e，讓塔台依 R-G003 結案或另開補 e2e 的工單。

本機環境（塔台唯讀探測，供參考，Worker 以自己的探測為準）：🔴 **本機 BAT 是以系統管理員身分執行**（17:49 以 `WindowsPrincipal.IsInRole(Administrator)` = True 確認；17:20 那次以 Git Bash `whoami /groups` 判成非系統管理員是錯的，T0740 也偵測到提權）→ Worker 分頁同樣提權，BUG-159（需一般權限）無法在本機 BAT 分頁內驗，歸 C、寫明需要一般權限的 BAT；`docker --version` = 29.9.2（engine 是否執行未查）、WSL 有 `Ubuntu-24.04`。

## 範圍

1. 22 張 BUG 的對照表與分類（A / B / C）。
2. 重跑對照到的既有 e2e。
3. B 類最多補 3 支 spec。
4. 唯讀環境探測、CI 打包證據。

## 不做

- 不改產品程式碼、不改 BUG 狀態、不動 Docker / WSL / 遠端 / 系統時間 / 安裝檔。
- pre.6 / pre.5 需要真實模型（Task*、背景 Agent 卡片、SDK 0.3 真實對話）與 NSIS 重裝的項目不在本單（塔台另與使用者確認）。

## 驗收

- [ ] 22 張逐張一列（證據、重跑結果、分類與依據）
- [ ] 重跑的 e2e 清單與結果
- [ ] 新增 spec（若有）連跑 2 次綠、兩個 typecheck = 0
- [ ] 環境探測結果
- [ ] 〈A 類結案建議〉〈B 類後續候選〉〈C 類需要的環境〉三份清單

---

## 回報區

### 完成狀態

### 對照表

### 重跑結果

### 發現的問題

### A 類結案建議

### B 類後續候選

### C 類需要的環境

### 互動紀錄

### 回報時間
