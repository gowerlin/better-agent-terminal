---
schema_version: 1
schema_kind: workorder
id: T0829
title: "PLAN-043 小項：BAT 被強制結束時不留下孤兒 wsl.exe（keep-alive）＋ plan-007 checklist 的 NAT 措辭"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-04T08:52:59+0800"
started_at: ""
updated_at: "2026-11-04T08:52:59+0800"
completed_at: ""
session_ids: []
depends_on: [T0827]
related:
  - "PLAN-043 範圍 3；D271；T0384（`electron/wsl-keepalive.ts` keep-alive holder，回報區提出孤兒 `wsl.exe` / Job Object）；T0383 / T0653（NAT 不需強制改）；PLAN-035（`_ct-workorders/_archive/plans/`）"
affects_files:
  - _ct-workorders/T0829-wsl-orphan-keepalive-and-doc.md
  - electron/wsl-keepalive.ts
  - electron/main.ts
  - electron/__tests__/
  - docs/plan-007-release-checklist.md
  - docs/wsl-deployment.md
  - CHANGELOG.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 不新增 npm 依賴、不新增原生模組（`allowScripts` 是政策，CLAUDE.md「本機開發：npm 12 install scripts」）。若評估後唯一可行的是原生 Job Object API，先停，依 ct-exec § Questions For Tower 問塔台並附方案比較，不要自行加依賴。"
  - "🔴 keep-alive 正常路徑行為不變：何時啟動、哪些 distro、BAT 正常結束時的停止都照舊；只補「BAT 主行程被強制結束（工作管理員 / 當機 / NSIS 強制結束）」後不留下 `wsl.exe`。Child Process 規則照 CLAUDE.md（`execFile` / `spawn` ＋陣列參數，不經 shell）。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0829 — 孤兒 wsl.exe ＋ NAT 措辭（PLAN-043 小項）

## 元資料

- **工單編號**：T0829
- **類型**：implementation
- **狀態**：PENDING
- **建立時間**：2026-11-04 08:52 (UTC+8)
- **依賴**：T0827（同改 `electron/main.ts`，等它 commit 後再派）
- **預估規模**：S；Context Window 風險：低

## 任務指令

### 前置條件
- `electron/wsl-keepalive.ts` 與 `electron/main.ts` 的 `wslKeepAlive` / `syncWslKeepAlive`
- `_ct-workorders/_archive/workorders/T0384-wsl-keepalive-holder.md`（回報區的孤兒 `wsl.exe` 說明）
- `_ct-workorders/PLAN-043-wsl-automation-phase2-3.md`

### 任務

**A. 孤兒 `wsl.exe`**
1. 先實測 / 讀碼確認現況：BAT 主行程被 `taskkill /F` 後，keep-alive 的 `wsl.exe`（與 distro 內的對應程序）是否殘留、殘留多久、對使用者的影響（distro 一直不閒置關機）。
2. 設計不需原生模組的解法，候選（Worker 評估後選一或組合，寫明理由）：
   - keep-alive 指令改成「stdin 關閉就結束」（例如 distro 內 `read` / `cat` 等待 stdin EOF，BAT 以 pipe 持有 stdin；主行程死亡 → pipe 關閉 → 結束）。須確認 `wsl.exe` 確實轉送 stdin EOF。
   - 啟動時清理上一次殘留：記錄 keep-alive 的 pid（與啟動時間 / 指令特徵）到 userData，下次啟動時只結束確認屬於 BAT 的那幾個（不得誤殺使用者自己的 `wsl.exe`）。
   - 其他（說明）。
3. 實作＋單元測試；Windows 實機以「啟動 BAT 開發版或隔離 runtime → 有 WSL keep-alive → `taskkill /F` 主行程 → 觀察 `wsl.exe`」驗證，記錄指令與結果。🔴 不碰使用者執行中的 BAT 安裝版；若需要 WSL profile 才會啟動 keep-alive 而環境做不到，改以單元 / 整合測試證明並在回報區列〈待實機驗收〉。

**B. 文件**
- `docs/plan-007-release-checklist.md` 約第 63 行：「Confirm `%UserProfile%\.wslconfig` uses `networkingMode=mirrored` (or document NAT mode …)」改為與 `docs/wsl-deployment.md` 一致：NAT 一般可用、連線測試失敗才需處理（2026-11-02 使用者決定下次 WSL 工單一併改）。
- 若 A 改變了 keep-alive 行為，`docs/wsl-deployment.md` 相關描述同步。

### 驗收條件
- [ ] `npm run typecheck:electron` = 0、`npm run typecheck` = 0
- [ ] `npm run test:unit` 全過；`npx vite build` 成功
- [ ] keep-alive 正常啟停的既有測試不改語意仍通過
- [ ] 強制結束情境的驗證證據（實機或測試）
- [ ] `CHANGELOG.md` `[Unreleased]` 一條；commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

### 產出摘要

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 回報時間
