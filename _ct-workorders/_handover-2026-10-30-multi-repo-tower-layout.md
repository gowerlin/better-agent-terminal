---
schema_version: 1
schema_kind: cross-tower-handover
type: HANDOVER
from: better-agent-terminal
to: BMad-Guide
status: ACKNOWLEDGED
local_workorder: "BMad-Guide T0368（回覆稿 BMad-Guide/_ct-workorders/_reply-2026-10-30-multi-repo-tower-layout.md，CT D463）"
created_at: "2026-10-30T15:47:21+0800"
title: "HANDOVER（聯合研究）—— 一個塔台統籌多個獨立 repo 時，子 repo 的執行紀錄在 BAT 指揮塔面板看不到（GitHub #21）；請 CT 先就落點檢查 C-0 / C-1 與目錄、workspace 切分習慣表示意見"
related:
  - "BAT PLAN-056（`_ct-workorders/PLAN-056-multi-repo-tower-workorder-visibility.md`）"
  - "GitHub https://github.com/gowerlin/better-agent-terminal/issues/21"
  - "BAT `27a5a164` 起 `src/components/ControlTowerPanel.tsx` 的 `ctDirPath = ${workspaceFolderPath}/_ct-workorders`"
---

# HANDOVER：多 repo 塔台的工單落點與 BAT 面板

> 發起：better-agent-terminal 塔台｜接收：BMad-Guide · Tower（CT 維護方）
> 性質：**HANDOVER（聯合研究）**。BAT 使用者的看法是：**不一定要改程式**，也可能是專案目錄規劃或 BAT workspace 切分的習慣問題。請 CT 先表示意見，BAT 再決定要不要改程式、改哪邊。

## 1. 回報內容（GitHub #21，CT 5.14.2、BAT 0.7.2-pre.1、Windows 11）

```
project-a/                 ← BAT workspace 指向這裡；塔台在這裡
├── _ct-workorders/        ← 塔台狀態、決策、BUG、統籌工單
└── src/
    ├── app-frontend/      ← 獨立 git repo（與團隊共用，各自 remote）
    │   └── _ct-workorders/
    └── app-backend/       ← 獨立 git repo
        └── _ct-workorders/
```

- 依 CT 落點檢查，Worker 改 `app-frontend` 時 C-0（`repo` = `basename(git rev-parse --show-toplevel)`）、C-1（工單檔在 `REPO_ROOT` 底下）要求執行紀錄寫進 `app-frontend/_ct-workorders/`。塔台用一條編號序列（例：`T0183` 統籌單在上層，`T0184` 在 backend，`T0185` 在 frontend 並帶 `parent_workorder: T0183`），塔台本身運作正常。
- BAT 面板只讀 workspace 那一層 `_ct-workorders/`：工單跳號（實例：上層 130、子 repo 63 張看不到）、看不到子 repo 狀態、不能一鍵派工。替代做法是每個子 repo 開一個 BAT workspace。
- 回報者提兩個方向：A BAT 自動往下掃子 repo；B CT 在上層登記子 repo 清單、BAT 讀。

## 2. BAT 塔台整理的候選方向（含不改程式的）

| # | 方向 | 誰要改 |
|---|---|---|
| A | BAT 自動往下掃子 repo 的 `_ct-workorders/` | BAT |
| B | CT 登記子 repo 清單，BAT 讀（新契約） | CT + BAT |
| C | 執行紀錄留在塔台 repo，工單標明目標 repo；Worker cwd 在子 repo、讀塔台 repo 的工單（類似 BAT worktree 隔離派工的 `CT_HOME`：Worker cwd ≠ 工單所在） | CT（C-0 / C-1）為主；BAT 視需要讓派工可指定 cwd |
| D | 每個 repo 一個 BAT workspace、一個塔台，上層以 CT 跨專案協調（COORDINATED / DELEGATE）統籌 | 不改程式，改習慣 |
| E | 只改目錄規劃（例如子 repo 不放 `_ct-workorders/`、塔台放在別處） | 不改程式 |

## 3. 請 CT 回覆

1. C-0 / C-1 的設計目的；方向 C（執行紀錄留在塔台 repo）是否可接受，放寬會失去什麼保護。
2. 執行紀錄寫進與團隊共用的子 repo（會推到共用 remote），CT 是否本來就建議這樣做。
3. 「一個人、一台 BAT、多個共用 repo」CT 建議的目錄與塔台配置（方向 D / E 是否就是建議做法），以及現有文件是否已涵蓋。
4. 若 CT 認為需要 BAT 配合（方向 A / B / C），請說明 CT 期望的介面；BAT 再評估並開單。

回覆稿照慣例寫在 BMad-Guide repo 的 `_reply-…`，並以跨 session 訊息通知 `better-agent-terminal · Tower`。BAT 收到回覆後才決定是否改程式，並回覆 GitHub #21。
