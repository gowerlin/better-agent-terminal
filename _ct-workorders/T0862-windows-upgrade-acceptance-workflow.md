---
schema_version: 1
schema_kind: workorder
id: T0862
title: "PLAN-065 W6：Windows 真實升級驗收（windows-upgrade-acceptance.yml＋spec、兩個 desktop-build 版本跑情境 1–7）、nsis 驗收腳本加 holder 檢查、docs / CLAUDE.md"
type: implementation
status: PENDING
repo: better-agent-terminal
project: PLAN-065
priority: P2
sizing: M
created_at: "2026-11-04T18:28:20+0800"
depends_on: [T0858, T0859, T0860, T0861]
related:
  - "PLAN-065；D286；T0856 回報區〈調查結論〉Q7 與〈建議下一步〉W6；T0820（Windows runner 實測做法）；T0783（`desktop-build.yml`）；T0797（手動驗收 workflow 前例）；T0740 / T0801（`e2e/manual/nsis-reinstall-acceptance.ps1`）"
affects_files:
  - _ct-workorders/T0862-windows-upgrade-acceptance-workflow.md
  - .github/workflows/windows-upgrade-acceptance.yml
  - e2e/
  - e2e/manual/nsis-reinstall-acceptance.ps1
  - docs/agent-guide/pty-holder.md
  - docs/agent-guide/README.md
  - CLAUDE.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 這是發第一個有 holder 的版本（`0.7.5-pre.1`）前唯一能驗證該版解除安裝程式與 quit 行為的關卡：情境 1–7 全部 PASS 才算 DONE；任何一項 FAIL → 回報 PARTIAL / FAILED 並寫清楚證據，不得自己改產品程式（另開單由塔台決定）。"
  - "🔴 workflow：只 `workflow_dispatch`、唯讀權杖、不傳任何 secret、不建 tag / GitHub Release / `server-bundle-v*`、不部署 Pages、不放進發版關卡（比照 `docker-acceptance.yml` / `linux-acceptance.yml`）。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 push 與觸發 workflow：派工時另行授權（見下方〈塔台授權〉）；未授權前只寫 workflow 與 spec、在本機做能做的檢查，跑 CI 的部分列〈待授權〉。"
  - "🔴 L185：情境 7 以 `<INSTDIR>\\BetterAgentTerminal.exe`＋`ELECTRON_RUN_AS_NODE` 跑計時器模擬內嵌 claude，不開真的 claude / codex、不登入任何服務、不呼叫模型。回報不記權杖或環境變數值（只記名稱）。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。不碰本機 BAT 安裝版，不在本機執行任何安裝檔。"
  - "公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0862 — PLAN-065 W6：Windows 真實升級驗收

## 元資料
- **工單編號**：T0862｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-04 18:28 (UTC+8)
- **規模**：M｜**決策**：D286｜**依賴**：T0858、T0859、T0860、T0861（workflow 骨架可以先寫）

## 背景
第一個有 holder 的版本 N 的解除安裝程式與 quit 行為，要到 N → N+1 升級時才會執行，發佈後就改不了（T0856 Q4 / Q7）。所以發 `0.7.5-pre.1` 前，必須用同一分支打出的兩個 `desktop-build` 版本（`0.0.0-exp.<run>`，兩次自然不同版號）實際跑過升級。

## 任務
1. `.github/workflows/windows-upgrade-acceptance.yml`：輸入兩個 desktop-build run id（A、B），在 Windows runner 跑下面的情境，結果寫進 job summary 與 artifact。
2. spec（Playwright＋`Get-CimInstance`，比照 T0820）涵蓋：
   1. per-user `/S /currentuser` 從 A 升到 B；
   2. per-machine `/allusers`；
   3. 同版重裝；
   4. 從 B 降回 A；
   5. 從 B 降到現行正式版 `0.7.4-pre.9`（沒有 holder）：終端結束並走既有的 recovery / 說明，不卡住；
   6. 真的解除安裝：holder 結束、holder 根目錄刪除、userData 保留；
   7. 分頁裡有安裝目錄下的程序（模擬內嵌 claude）：BAT 先結束它並記錄，安裝程式不需要等 15 s。
   每個情境檢查：shell 與長命令（`ping -t`）的 pid 升級前後相同、conhost 還在、holder 的路徑、重開後有紀錄的情境沒有 Recovery 提示、新版接回後持續收到輸出、toast 文字、holder 目錄的清理。
3. `e2e/manual/nsis-reinstall-acceptance.ps1` 加 holder 檢查（holder 目錄與 manifest；有開分頁時 pid 不變），沒有 holder 的版本照舊判讀。
4. 文件：新增 `docs/agent-guide/pty-holder.md`（整體架構、holder 位置、協定 v1 摘要、安裝 / 解除安裝 / 升級 / 降級流程、已知限制、驗證清單），`docs/agent-guide/README.md` 索引；`CLAUDE.md` 新增一節（照撰寫規則：用途、必守規則、唯一實作位置、不變式、連到 docs）。

## 塔台授權
（派工時由塔台填寫：可否 push 分支、可否觸發 `desktop-build.yml` 兩次與本 workflow。）

### 驗收條件
- [ ] 情境 1–7 全部 PASS（附 run id 與 summary）
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npm run test:legacy` 全過、`npx vite build` 成功
- [ ] CLAUDE.md ≤ 100k 字元（回報實際字元數）
- [ ] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
