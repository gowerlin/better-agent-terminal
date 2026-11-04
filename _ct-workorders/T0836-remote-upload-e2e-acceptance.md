---
schema_version: 1
schema_kind: workorder
id: T0836
title: "PLAN-038 U5：遠端上傳 e2e 與實機驗收清單（SSH sshd 容器、Docker 掛載外、WSL 其他 distro、WSL Alt+V 現況、SSH Ctrl+V 貼圖）"
type: verification
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-04T09:17:09+0800"
started_at: ""
updated_at: "2026-11-04T09:17:09+0800"
completed_at: ""
session_ids: []
depends_on: [T0834, T0835]
related:
  - "PLAN-038；D272；T0828 回報區（〈調查結論〉7，〈建議下一步〉第 5 列）；`e2e/real-remote/`（t0510 / t0514 / t0520 / t0663 的 sshd / server Dockerfile）、`t0743` 系列、`t0550-wsl-acceptance.spec.ts`"
affects_files:
  - _ct-workorders/T0836-remote-upload-e2e-acceptance.md
  - e2e/
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只新增 e2e spec 與驗收紀錄，不改產品程式；發現缺陷寫進回報區〈發現的問題〉由塔台開 BUG，不在本單修。"
  - "🔴 e2e 一律隔離 runtime；不碰本機 BAT 安裝版與它的 Terminal Server、不連真實遠端主機（只用本機容器）；不動使用者既有的 WSL 發行版（WSL 其他 distro 的情境若需要新發行版，列進〈待實機驗收〉交使用者）。"
  - "🔴 yolo：不得問使用者；問題問塔台。不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0836 — PLAN-038 U5：e2e 與實機驗收

## 元資料
- **工單編號**：T0836｜**類型**：verification｜**狀態**：PENDING｜**建立**：2026-11-04 09:17 (UTC+8)
- **依賴**：T0834、T0835｜**規模**：M

## 任務指令

1. 以 `e2e/real-remote/` 的 sshd / server 容器寫 e2e：SSH 視窗 Claude 面板附加本機檔 → 遠端暫存檔存在、內容雜湊相同、權限 0600、prompt 內是遠端路徑；面板關閉後暫存被刪；超過 50 MiB 退回拒絕。
2. Docker 掛載外附件、終端拖放、SSH Ctrl+V 貼圖：能自動化的寫 e2e，不能的列〈待實機驗收〉步驟（照 `work-order-template.md` § 撰寫 verification 工單的驗收步驟，分頁以標題描述）。
3. WSL Alt+V 現況（T0828 推論可用）：列成使用者實機確認步驟。
4. 回報區列出每項 PASS / FAIL / 待實機，附指令與輸出。
5. **塔台補充（開工前併入，來自 T0834 / T0835 回報）**：另列入驗收或〈待實機驗收〉——
   - SSH 視窗終端分頁 Ctrl+V 貼圖上傳後，claude CLI 是否把貼上的 `.png` 路徑認成圖片附件（T0828 推論）；codex CLI 收到路徑文字。
   - 終端分頁關閉後 10 s（`PTY_UPLOAD_DISPOSE_GRACE_MS`）暫存被刪、⏻ 重啟保留（T0835）。
   - 面板上傳中：進度、送出鍵停用、取消保留草稿（T0834）。
   - 已知不支援（只確認提示正確，不算 FAIL）：macOS Finder 複製的檔案貼進終端（T0435 / T0436 原則，照舊 T0437 拒絕）。
   - BUG-211（T0842）：遠端視窗附 3 張 > 8 MiB 圖片 → 提示、不送出、連線不斷；2 張照常 —— 能自動化就寫進 e2e，否則列〈待實機驗收〉。

### 驗收條件
- [ ] 新 e2e spec 在本機可跑通（附輸出）；`npm run test:unit` 不受影響
- [ ] 〈待實機驗收〉清單可直接交給使用者執行

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

### 產出摘要

### 發現的問題

### 待實機驗收

### 互動紀錄

### 遭遇問題

### 回報時間
