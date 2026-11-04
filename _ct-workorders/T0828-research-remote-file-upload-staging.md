---
schema_version: 1
schema_kind: workorder
id: T0828
title: "研究：PLAN-038 本機檔案上傳到遠端暫存目錄（SSH / Docker 附件、WSL 其他 distro、遠端 CLI 貼圖）的設計與拆單"
type: research
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-04T08:52:59+0800"
started_at: ""
updated_at: "2026-11-04T08:52:59+0800"
completed_at: ""
session_ids: []
depends_on: []
related:
  - "PLAN-038；D271；T0421（研究：自由文字路徑轉譯，拆單第 7 列）；T0437（遠端解析本機路徑附件：拒絕並提示）；T0435 / T0436（拖放、圖片附件 client 端讀取）；T0406（`workspace:sync-roots` path sandbox）；PLAN-036 / D134（遠端權杖）"
affects_files:
  - _ct-workorders/T0828-research-remote-file-upload-staging.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 唯讀研究：只寫本工單檔，不改程式、不建檔、不開分支。可讀程式、跑唯讀指令與既有測試；不連任何實際遠端主機、不碰本機 BAT 安裝版與它的 Terminal Server。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台（研究型提問上限依 `research_max_questions`）。不 push。Git：只 commit 本工單檔（`git add <明確路徑>`，不用 `-A` / `.`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0828 — 研究：遠端附件上傳暫存（PLAN-038）

## 元資料

- **工單編號**：T0828
- **任務名稱**：研究：PLAN-038 遠端附件上傳的設計與拆單
- **狀態**：PENDING
- **類型**：research
- **互動模式**：enabled（yolo：問塔台）
- **intervention_type**：context-dependent
- **Renew 次數**：0
- **建立時間**：2026-11-04 08:52 (UTC+8)

## 研究目標

使用者決定 PLAN-038 先研究再實作（D271）。產出可以直接拆成實作工單的設計：遠端視窗（SSH、Docker 掛載以外的路徑、WSL 其他 distro）把本機檔案拖放 / 附加到 Claude 面板（與 Codex 面板，若適用）時，把檔案內容傳到遠端暫存目錄，再把遠端路徑放進 prompt；並評估 WSL claude CLI 分頁 Alt+V 貼圖（讀遠端剪貼簿）能否經同一通道解決。

## 已知資訊

- 現況：T0437 對遠端無法解析的本機路徑附件「拒絕並提示」；T0436 圖片附件在 client 端讀取。
- 遠端連線：`RemoteConnectionRegistry`（PLAN-039）、proxied IPC、headless bat-server（`electron/remote/headless-*.ts`）、frame 協定 `electron/remote/protocol.ts`。
- path sandbox：T0406 `workspace:sync-roots`（client 推送 workspace roots，fail-closed）。

## 調查範圍與要回答的問題

1. **現況盤點**：附件從拖放 / 選檔 / 貼上到送出的完整路徑（本機、各遠端類型），T0437 拒絕點在哪；Codex 面板是否同樣需要。
2. **傳輸通道**：用既有 WSS frame 還是新 channel；分塊大小、單檔與單次總量上限、進度回報、取消、失敗重試；WSS 單 frame 上限與 backpressure；對既有連線的影響（大檔是否卡住其他 IPC）。
3. **遠端暫存目錄**：位置（例 `<dataDir>/uploads/<session>/` 或 `$TMPDIR`）、檔名（避免衝突與路徑穿越）、權限（0700 / 0600）、清理（分頁 / session 結束、BAT 重開、依時間）、磁碟滿的處理。
4. **安全**：誰能呼叫（renderer IPC only，不給 helper 權杖）、與 path sandbox 的關係（暫存目錄是否要加進 roots）、日誌不記內容、上傳後路徑是否揭露給 agent 以外。
5. **各遠端類型差異**：SSH、Docker（掛載內的路徑是否仍直接用）、WSL 其他 distro（同 distro 已可直接轉譯）。
6. **Alt+V 貼圖**：claude CLI 在 WSL / SSH 讀哪個剪貼簿（xclip / wl-paste / WSLg）、BAT 能否攔截並改成上傳後插入路徑；可行性與風險。
7. **測試策略**：哪些可單元測試、哪些需要 e2e（既有 WSL / Docker e2e 基礎設施）。

## 研究指引

- 先讀 T0421 / T0437 回報區（`_ct-workorders/_archive/workorders/`）與 `docs/agent-guide/multi-remote-profiles.md`、`remote-security.md`。
- 結論要「可決策」：每個問題給建議值與理由；列出需要使用者決定的事項（例如大小上限）。

## 預期產出（寫在回報區）

- 〈調查結論〉逐題回答
- 〈建議方向〉方案比較與推薦
- 〈建議下一步〉拆成實作工單（每張：範圍、`affects_files` 預估、規模 S/M/L、依賴、能否並行、驗收方式），以及需要使用者裁決的問題清單

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

### 互動紀錄

### 調查結論

### 建議方向

### 建議下一步

### Renew 歷程

### 遭遇問題

### 回報時間
