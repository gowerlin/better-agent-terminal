---
schema_version: 1
schema_kind: plan
id: PLAN-056
title: "一個塔台統籌多個獨立 repo 時，指揮塔面板看不到子 repo `_ct-workorders/` 的工單（GitHub #21）：先與 CT 塔台聯合研究，未必要改程式"
status: IDEA
priority: medium
created_at: "2026-10-30T15:47:21+0800"
links:
  source: "GitHub issue #21（2026-10-30，BAT 0.7.2-pre.1、CT 5.14.2，Windows 11）"
  related: [T0583, T0523, T0701]
  cross_tower: "_handover-2026-10-30-multi-repo-tower-layout.md（→ BMad-Guide 塔台）"
---

# PLAN-056 — 多 repo 塔台與指揮塔面板

## 動機

GitHub #21：上層目錄放塔台（BAT workspace 指向這裡），底下兩個獨立 git repo（前端、後端，與團隊共用、各自有 remote，不能合成 monorepo）。CT 的落點檢查 C-0 / C-1 要求執行紀錄放在 Worker cwd 所在 repo 的 `_ct-workorders/`，所以子 repo 的工單寫在子 repo 裡；BAT 指揮塔面板只讀 workspace 那一層（`ControlTowerPanel.tsx` 的 `ctDirPath`），結果：

1. 工單列表跳號，子 repo 的工單看不到（回報者的實例：上層 130 張、子 repo 共 63 張看不到）。
2. 看不到子 repo 工單的狀態。
3. 子 repo 工單不能用面板的「執行」／「補結」一鍵派工。

現行替代：每個子 repo 另開一個 BAT workspace，要來回切換、看不到整條編號。

## 使用者指示（2026-10-30）

先開 PLAN 研究，並與 CT 塔台聯合研究：**不一定要改程式支援，也可能是專案目錄規劃習慣或 BAT workspace 切分習慣的問題**。

## 候選方向（未定案，研究要比較）

| # | 方向 | 誰要改 | 備註 |
|---|---|---|---|
| A | BAT 自動往下掃（有 `.git` + `_ct-workorders/` 的子目錄，限深度） | BAT | issue 提案 A；要掃目錄、可能抓到不相關的 repo |
| B | CT 在上層登記子 repo 清單，BAT 讀清單 | CT + BAT（新契約） | issue 提案 B；明確，但兩邊配合 |
| C | **執行紀錄留在塔台 repo**：工單標明目標 repo（例 `target_repo` / `workdir`），Worker cwd 在子 repo、工單檔在塔台 repo | CT 為主（落點檢查 C-0 / C-1 放寬）；BAT 可能只需讓派工能指定 cwd 與工單位置 | 類似 worktree 隔離派工的 `CT_HOME`（T0583：Worker cwd ≠ 工單所在）；面板不用改就看得到全部工單 |
| D | **每個 repo 一個 BAT workspace、各自一個塔台**，上層塔台以 CT 跨專案協調（COORDINATED / DELEGATE）統籌 | 不改程式；改使用習慣 | 編號各自獨立（可用工單前綴），CT 已有規則；成本是多個塔台 |
| E | **只改目錄規劃**：例如子 repo 不放 `_ct-workorders/`，或塔台放在其中一個產品 repo | 不改程式 | 要確認是否違反 CT 規則、是否污染共用 repo |

## 研究要回答的問題

1. CT 落點檢查 C-0 / C-1 的設計目的是什麼？方向 C 放寬後會失去什麼保護（Worker 改錯 repo、commit 落錯 repo）？
2. 子 repo 與團隊共用時，`_ct-workorders/` 放進子 repo 是否本來就不理想（會推到共用 remote）？
3. 方向 D 的 CT 跨專案協調現在是否足以應付「一個人、一台 BAT、多個 repo」的日常？
4. 若要改程式，BAT 最小改動是什麼？面板合併顯示、來源標示、同編號處理、一鍵派工的 `--cwd`、檔案監看、遠端工作區。
5. 結論可能是「文件說明建議的目錄與 workspace 切分」而不是改程式；要寫在哪（CT 文件、BAT README、BAT 網站）。

## 下一步

1. 已發 HANDOVER 給 BMad-Guide 塔台（CT 維護方），請 CT 先就 C-0 / C-1 的設計與方向 C、D、E 表示意見。
2. 收到 CT 回覆後，BAT 塔台決定：只寫使用建議、開研究工單、或開實作工單；並回覆 GitHub #21（對外留言前先給使用者確認）。

## CT 回覆（2026-10-30，BMad-Guide `_reply-2026-10-30-multi-repo-tower-layout.md`，CT D463 / T0368）

- **BAT 不需要改程式。** 前提更正：工單跑進子 repo 是因為 Worker cwd 在子 repo（Worker 在 cwd 底下找工單、`repo` = cwd 的 git toplevel），不是 C-0 / C-1 要求；`parent_workorder` 不是 CT 欄位。
- 推薦方案 1（= 方向 E）：上層 `git init` 當個人塔台 repo、`.gitignore` 排除子 repo、工單全放上層（`repo: <上層>`、`project: <子 repo>`、`affects_files` 從上層寫），Worker 在上層執行、產品用 `git -C <子 repo>` commit；面板與一鍵派工現有行為即可；限制：不能 `isolation: worktree`。推論、未實機驗證。方案 2 = 方向 D（現有文件已涵蓋）。
- 方向 C：直接放寬不接受；宣告式分離要 CT + BAT 新契約，目前不建議。方向 A / B：不會成為 CT 契約；BAT 若想為既有使用者做唯讀顯示由 BAT 自行決定。
- CT 待辦：下一版補〈巢狀的獨立 repo〉文件（含拋棄式目錄實機驗證），補好後通知 BAT。
