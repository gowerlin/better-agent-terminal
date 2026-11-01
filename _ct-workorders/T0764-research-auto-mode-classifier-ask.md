---
schema_version: 1
schema_kind: workorder
id: T0764
title: "研究：auto mode 的 classifier 決定「詢問」或「擋下」時，hook 與 ⚠️ 的行為（真實模型 Haiku 5.5，≤ US$0.5）"
type: research
status: PENDING
updated_at: "2026-11-02T02:23:44+0800"
session_ids: []
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-02T02:23:44+0800"
depends_on: [T0763]
related:
  - "T0747 回報區（auto mode 三個動作皆放行、未觸及詢問路徑）；`docs/agent-guide/blocked-state.md`（`PermissionDenied` 只在 classifier 拒絕時執行）；D210（費用上限）"
  - "`e2e/v072-pre8-workspace-waiting-real-agents.spec.ts`（T0747 真實模型 spec，預設 skip）"
affects_files:
  - e2e/
  - docs/agent-guide/blocked-state.md
  - _ct-workorders/T0764-research-auto-mode-classifier-ask.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 真實模型上限（D210）：只用 Haiku 5.5；合計 ≤ 10 回合、≤ US$0.5；超過即停並回報。每回合記錄 transcript 費用；classifier 的請求讀不到時照實寫。"
  - "🔴 動作清單（塔台定義，只用這些，全部無害、都在暫存目錄）：A. 讀一個公開網址（`curl -sI https://example.com`）；B. 在工作區外的暫存目錄 `%TEMP%/bat-t0764-outside/` 寫一個檔；C. 刪除 B 寫的那個檔；D. 對暫存目錄裡的本機 bare repo 做 `git push`（暫存目錄內建立、跑完刪除）；E. 安裝套件類動作只用 `npm view <pkg> version`（唯讀）。🔴 不得執行清單外的動作；不碰使用者 repo、`~/.claude`、全域設定。"
  - "🔴 記錄每個動作：classifier 結果（放行 / 詢問 / 擋下）、claude 送出的 hook 事件（`PermissionRequest` / `PermissionDenied` / 其他）、BAT `blocked` 狀態與縮圖 / 工作區 ⚠️；詢問時以滑鼠與鍵盤各回答一次（觀察 T0757 修正後是否清除）。結論：是否需要改 hook 表或 ⚠️ 規則，附建議（不實作）。"
  - "🔴 不改產品程式碼；spec 可加情境（預設 skip、須明確環境變數才跑）。build 在主 checkout（Lane A 最後一張）。殘留（`~/.claude.json` projects key 等）照實寫，能刪就刪、刪前確認是本單產物。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單範圍；同一 checkout 有其他 Worker 並行，不得 commit 或改動別人的未提交變更；`CLAUDE.md`、`docs/agent-guide/*.md` 等共用檔若已有別人的未提交修改，等對方 commit 後再改（`git diff <檔>` 確認）。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。用 Python 改檔一律 `newline=''`。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。不 push、不發版。"
---
# T0764 — 研究：auto mode 的 classifier 決定「詢問」或「擋下」時，hook 與 ⚠️ 的行為（真實模型 Haiku 5.5，≤ US$0.5）

## 元資料

- **工單編號**：T0764
- **類型**：research
- **優先級**：P3
- **建立時間**：2026-11-02T02:23:44+0800
- **預估規模**：S

## 背景

T0747 在 auto mode 下三個動作都被 classifier 放行，沒有觸及「詢問 / 擋下」路徑，不知道那時 hook 與 ⚠️ 的行為。D210 排入本批，費用上限 US$0.5。

## 範圍

以塔台定義的無害動作觸發 classifier 的詢問 / 擋下，記錄 hook 與 ⚠️。只研究、不改產品程式碼。

## 不做

- 不實作；不超過費用上限；不執行清單外動作。

## 驗收

- [ ] 動作 × classifier 結果 × hook × ⚠️ 表
- [ ] 費用與回合數在上限內
- [ ] 建議（需不需要改、改哪裡）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
