---
schema_version: 1
schema_kind: workorder
id: T0550
title: "WSL 實機驗收（pre.4）：以已安裝 0.6.1-pre.4 的精靈把 WSL bat-server 從 0.5.9-pre.4 升到 pre.4（順驗線上下載），再驗 PLAN-036 遠端功能 / 遠端 Tower 派單與 PLAN-037 工具偵測"
type: verification
status: TODO
repo: better-agent-terminal
project: "PLAN-036 / PLAN-037（順帶 PLAN-031 / D146 下載路徑）"
priority: P2
sizing: M
created_at: "2026-10-16T02:28:10+0800"
updated_at: "2026-10-16T02:28:10+0800"
started_at: ""
completed_at: ""
commit: ""
target_version: "0.6.1-pre.4（已安裝，不改產品程式碼）"
depends_on: []
related:
  - "PLAN-036（headless handler；P0–P3 程式完成，待實機）、PLAN-037（遠端工具偵測 / 安裝，程式完成，待實機）"
  - "PLAN-031 / D146 / T0547 / T0548（安裝檔不內建 baseline → 精靈線上下載 `server-bundle-v0.6.1-pre.4`）"
  - "T0510（以安裝版 exe 起隔離實例做實機驗收的範本：`BAT_E2E_EXECUTABLE`、`--runtime=e2e-…`、Playwright 路徑用正斜線）"
  - "T0434 回報區（遠端 Tower 實機派單步驟）、`npm run smoke:remote:headless`（S1–S13）"
affects_files:
  - _ct-workorders/T0550-wsl-real-acceptance-pre4-plan036-037.md
  - "e2e/**（僅限新增本單專用的 spec / env 腳本；既有 spec 若需參數化，只能加 env 開關、預設行為不變）"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不改產品程式碼（`electron/**` / `src/**` / `scripts/**` / `package.json`）。發現產品缺陷 → 只記證據，回報區列出，由塔台開 BUG。"
  - "🔴 不碰使用者正在用的 BAT：不連 / 不關 / 不重啟 port 9876 的實例與它的 Terminal Server，不以預設實例啟動安裝版；隔離實例用 `--runtime=e2e-t0550-…`，結束時只殺隔離 userData pid 檔裡的 pid（T0510 做法）。"
  - "🔴 WSL：只動 `Ubuntu-24.04` 的 `~/.local/bat-server` 與其 systemd user service（升級即本單目的）。動之前先備份：`cp -a ~/.local/bat-server ~/.local/bat-server.bak-0.5.9-pre.4-t0550` 與 unit 檔；升級失敗且無法在本單內完成時，還原備份並 `systemctl --user restart` 回 0.5.9-pre.4，回報 PARTIAL。不動其他發行版、Docker、`~/.ssh`、`.wslconfig`。"
  - "🔴 不開真 Claude / Codex 對話、不耗 token：Agent 面板、遠端 Tower 派真 agent 這類需要模型的項目列入「需真人」清單。派單驗證用 smoke S13 / 自訂 CLI 跑 node 腳本的方式（T0529 / T0537 e2e 做法）。"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <本單檔與新增檔>`（`src/styles/settings.css` 的 M 不是你的變更）。"
  - "🔴 需要 sudo 密碼或其他人工輸入才能繼續 → 停在該步，回報 BLOCKED / PARTIAL 並寫明卡點，不要嘗試繞過。"
---

# T0550 — WSL 實機驗收（pre.4）：PLAN-036 / PLAN-037（順帶 PLAN-031 下載）

## 背景

- PLAN-036（headless bat-server 的終端 / Agent / git / fs handler、遠端 Tower 通知）與 PLAN-037（遠端 AI 工具偵測與一鍵安裝）的程式部分都已完成，剩實機驗收。使用者 2026-10-16 決定開這張單做驗收，通過就結案兩個 PLAN。
- 本機 WSL `Ubuntu-24.04` 的 `~/.local/bat-server` 仍是 **0.5.9-pre.4**（T0406 期部署，systemd user service `bat-server.service` active）。它沒有 helper env，smoke S13（遠端 Tower 派單）在這個版本上只會 SKIP。
- 0.6.1-pre.4 起安裝檔不內建 server bundle（D146），WSL / SSH 精靈改為線上下載 `server-bundle-v0.6.1-pre.4`，下載失敗時可改匯入本機 tarball。用**安裝版 pre.4 的隔離實例**（userData 空的，沒有 cache）跑 WSL 精靈，就能同時驗證這條下載路徑。
- 本機已安裝 `C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe` 0.6.1-pre.4。使用者的 BAT 正在執行，不得干擾。

## 任務

### A. 升級 WSL server（順驗 PLAN-031 / D146 下載路徑）

1. 記錄升級前狀態：bundle 版號、service 狀態、`~/.local/bat-server` 目錄結構；完成備份（見 memory_overrides）。
2. 以安裝版 exe 起隔離實例（`BAT_E2E_EXECUTABLE` + `--runtime=e2e-t0550-…`，參考 T0510 與 `e2e/pre6-wizard-acceptance.spec.ts` / `e2e/pre7-acceptance.spec.ts`），對 `Ubuntu-24.04` 跑 WSL 精靈到完成。若既有 spec 無法直接套用，可新增 `e2e/t0550-*.spec.ts`。
3. 判定：
   - A1 `install-server-bundle` 走線上下載：來源 URL 為 `…/releases/download/server-bundle-v0.6.1-pre.4/…`、SHA 驗證通過；隔離 userData 的 `bat-server-bundles/` 出現 tarball 與 `.sha256` sidecar
   - A2 精靈全程完成、profile 可開啟；WSL 上 bundle 版號 = 0.6.1-pre.4、service active、在設定的 port LISTEN
   - A3 `<installRoot>/scripts/bat-terminal.mjs` / `bat-notify.mjs` 與 `<installRoot>/bin/node` 存在（PLAN-036 K 前提）
   - A4（選做，有餘力再做）在**另一個**隔離實例、離線條件下（例如 `BAT_SERVER_BUNDLE_BASE_URL` 指向不可達位址）確認錯誤顯示「匯入本機 tarball」動作，並以 A1 下載的檔案匯入成功。不必重裝 WSL 端
   - 精靈完成後若使用者的 WSL profile 視窗正連著，因 service restart 斷線屬預期，記錄即可

### B. PLAN-036 遠端功能

4. 對升級後的 server 跑 `npm run smoke:remote:headless`（S1–S13），記錄每項結果。**S13（遠端 Tower 派單 → Worker 回報）不得 SKIP**；SKIP 代表 helper env 未注入，屬缺陷。
5. 以隔離實例開 WSL 遠端視窗，自動化可行的 UI 流程（參考 `e2e/pre6-ui-remote-acceptance.spec.ts`）：遠端終端建立 / 輸入輸出、斷線重連後輸出回放（T0403）、git / fs 面板讀取（T0405 / T0406）、遠端分頁派單後出現在正確工作區。逐項判定，做不到的移到「需真人」。

### C. PLAN-037 遠端工具偵測

6. smoke S10 + 隔離實例 UI：工具偵測結果（claude / codex / git / gh 的安裝狀態、版本、登入狀態）與 WSL 實際一致（以 `wsl -d Ubuntu-24.04 -- bash -lc '<tool> --version'` 對照）。**不要按安裝按鈕**（會改動 WSL 的工具版本）；安裝流程列入「需真人」。

### D. 收尾

7. 關閉隔離實例、清理 temp；WSL 保留升級後的 pre.4 server 與備份目錄（備份路徑寫進回報區，由使用者決定何時刪）。
8. 回報區：A / B / C 每項 PASS / FAIL / SKIP + 證據（指令輸出、日誌行、截圖路徑）；發現的產品缺陷（重現步驟、證據）；**需真人清單**（逐項寫清楚怎麼操作、看什麼）。
9. `git commit --only` 本單檔與新增的 e2e 檔；照 ct-exec 收尾通知塔台（yolo：`bat-notify.mjs --submit`，`--source "T0550"`）。

## 驗收條件

- [ ] WSL server 升到 0.6.1-pre.4 且 active（或已還原到 0.5.9-pre.4，並寫明原因）
- [ ] A1–A3、B4（S1–S13 逐項）、B5、C6 皆有判定與證據
- [ ] 需真人清單：每項寫明步驟與判準
- [ ] 未改產品程式碼；使用者的 BAT（9876）、其他發行版、Docker、`~/.ssh` 未被動到
- [ ] commit 只含本單檔與新增的 e2e 檔

## 完成狀態判定

- 全部可自動化項目 PASS → `DONE`（需真人項目不影響 DONE，由塔台轉給使用者）
- 有 FAIL（產品缺陷）或因環境卡住 → `PARTIAL`，寫明 gate 與證據

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

### 產出摘要

### 需真人清單

### 發現的產品缺陷

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 回報時間
