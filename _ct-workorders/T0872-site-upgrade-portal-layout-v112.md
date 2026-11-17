---
schema_version: 1
schema_kind: workorder
id: T0872
title: "BAT 網站 vitepress-portal-layout 從 v1.1.1 升到 v1.1.2（BMad-Guide HANDOVER）"
type: implementation
status: PENDING
created_at: "2026-11-17T08:44:58+0800"
started_at: ""
updated_at: "2026-11-17T08:44:58+0800"
completed_at: ""
session_ids: []
repo: better-agent-terminal
project: PLAN-049
priority: P2
sizing: S
depends_on: [T0871]
related:
  - "D296；BMad-Guide HANDOVER `D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\_ct-workorders\\_handover-2026-11-17-portal-layout-skill-v112-bat.md`（對方 commit `593f13c`，D762／D763）；回覆 `_ct-workorders/_reply-2026-11-17-portal-layout-skill-v112-bat.md`；前一張 T0871（v1.1.1）"
affects_files:
  - _ct-workorders/T0872-site-upgrade-portal-layout-v112.md
  - site/.vitepress/theme/portal-layout/
  - site/.vitepress/theme/index.ts
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只改 `site/.vitepress/theme/portal-layout/`（整包覆蓋）與 `site/.vitepress/theme/index.ts` 的**註解**版號（與本工單回報區）。`custom.css`、`config.mts`、元件都不改；若覺得非改不可，停下來問塔台。不改產品（`electron/**`、`src/**`、`scripts/**`）、不改 workflow。"
  - "🔴 skill 本體在 BMad-Guide repo，**唯讀**：只複製檔案進 `site/.vitepress/theme/portal-layout/`，不得寫入 `D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\` 底下任何檔案；複製進來的檔保持原樣。skill 缺陷記在回報區〈skill 回饋〉。Timeline 兩檔照舊不複製。"
  - "🔴 yolo：不得問使用者；問題問塔台。不 push（push 到 main 會觸發 Pages 部署 = 對外發佈）、不發版。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
  - "ℹ️ 主 checkout 根目錄的 `node_modules` 不完整；本單只需 `site/` 自己的 `node_modules`（已存在，缺就在 `site/` 內 `npm ci`）。不要在 repo 根目錄跑 `npm ci`。"
  - "ℹ️ 全站 `layout-check --figure-test all` 很久：用背景執行（`run_in_background`）。v1.1.2 有 stderr 進度輸出。"
---

# T0872 — BAT 網站 vitepress-portal-layout 從 v1.1.1 升到 v1.1.2

## 元資料
- **工單編號**：T0872｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-17 08:44 (UTC+8)
- **規模**：S｜**依賴**：T0871（DONE，已上線）｜**決策**：D296｜**來源**：BMad-Guide 塔台 HANDOVER（跨專案）

## 背景
T0871 把 BAT 網站升到 skill v1.1.1（`5a7e2478`，已上線）。BMad-Guide 收了 T0871 的 3 項回饋出 v1.1.2。塔台已核對：skill 目錄 commit `eee355b`、zip SHA-256 與 HANDOVER 相同；網站 `portal-layout/` 6 檔與 v1.1.2 比對**只有 `figure-zoom.ts` 不同**。

v1.1.2 的變化（摘自 HANDOVER，以 skill 文件為準）：
- 開啟倍率：頁面倍率 > 符合畫面 × 1.02 才用頁面倍率，否則用符合畫面。BAT 預期只有 `QuestionFlow` 在 390 寬從 100% 變成約 99.2%（整張看得見），桌面寬度不變。
- `layout-check.mjs` 新增 `--save-baseline <file>`／`--baseline <file>`／`--baseline-warn`（頁高 ±1px、主內容寬、按鈕數、應有按鈕數）、stderr 進度（`--quiet` 關）、門檻附近標 `nearThreshold`。

## 必讀（唯讀，`BG` = `D:\ForgejoGit\@Gower_Labs\BMad-Guide`）
1. HANDOVER：`BG\_ct-workorders\_handover-2026-11-17-portal-layout-skill-v112-bat.md`（含建議步驟與兩項已知狀況）
2. `BG\Portal-Layout-Skill\vitepress-portal-layout-v1.1.2\SKILL.md`〈v1.1.1 → v1.1.2〉、`references\apply-guide.md` § 9〈升級前後比對〉、§ 11
3. 驗證腳本 `BG\Portal-Layout-Skill\vitepress-portal-layout-v1.1.2\scripts\layout-check.mjs`
4. T0871 回報區（`_ct-workorders/T0871-site-upgrade-portal-layout-v111.md`）：layout-check 參數（`--base /better-agent-terminal/`、`--allow-origins https://fonts.googleapis.com,https://fonts.gstatic.com`）、全站 15 頁、按鈕 15

## 任務
1. **升級前 baseline**：把目前（v1.1.1）的建置複製到 scratchpad，用 v1.1.2 的 `layout-check.mjs` 在複本上 `--save-baseline`（2560／1920／1366／390 × 深淺色；`--collapse all` 也另存一份）。
2. **覆蓋**：整包覆蓋 `portal-layout/` 6 檔，覆蓋前後 `cmp`（預期覆蓋前只有 `figure-zoom.ts` 不同、覆蓋後全部一致）。Timeline 不複製。`index.ts` 只改註解版號。
3. **升級後比對**：`npm run build`，同寬度與外觀 `--layout-test --figure-test all --baseline <before.json> --json <after.json>`（背景執行）；`--collapse all` 也比對。`--full-page` 目視一輪。
4. 若 `--baseline` 只報零星頁高差異：先單頁重量；重量後一致就判為量測雜訊，回報區附數字（HANDOVER〈已知狀況〉第 1 點）。

## 驗收條件
- [ ] `cd site && npm run build` 成功，無新增警告
- [ ] 6 檔與 skill v1.1.2 `assets/theme/` `cmp` 一致；Timeline 未複製；`custom.css`／`config.mts`／元件未改
- [ ] `--baseline` 比對：寬度、頁高、按鈕數差異 0（零星頁高差異依任務 4 處理並附數字）；展開與 `--collapse all` 兩組
- [ ] layout-check 全站 15 頁 × 4 寬 × 深淺色 `--layout-test --figure-test all` **失敗 0**、`hostIssues` 0、`missing` 0
- [ ] `steps.open`（開啟倍率）只有 `QuestionFlow` 390 寬改變（附前後數值）；桌面寬度不變
- [ ] commit 只含本單範圍，不 push

## 收尾
- 回報後塔台請使用者決定 push（會觸發 Pages 部署）；push 後確認 Pages 綠燈與 `link-check`。
- 塔台更新 `_reply-2026-11-17-portal-layout-skill-v112-bat.md` 並通知 BMad-Guide 塔台（含〈skill 回饋〉；HANDOVER〈已知狀況〉兩項不必回報）。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
