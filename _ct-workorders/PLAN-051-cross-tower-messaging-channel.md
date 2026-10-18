---
schema_version: 1
schema_kind: plan
id: PLAN-051
title: "BAT 跨塔台傳訊通道：不同專案的塔台（含 codex 塔台）經 BAT 互相送訊息，不依賴 Claude Code 的 SendMessage"
status: IDEA
priority: low
created_at: "2026-10-18T17:25:09+0800"
links:
  source: "使用者 2026-10-18 第八十一 session：問「ListAgents 問題 Codex 也有支援嗎」→ 塔台說明 codex 不在 ListAgents、沒有 SendMessage → 使用者「另開一張 PLAN 記下來」"
  related: [PLAN-050, PLAN-048, D167, D149, T0643, T0647, D169]
---

# PLAN-051 — BAT 跨塔台傳訊通道

## 動機

跨專案的塔台協作（例：BAT 塔台 ↔ BMad-Guide 塔台的委派單、回函、版號通知）目前靠 Claude Code 的 ListAgents / SendMessage。PLAN-050 讓 Claude 塔台在 ListAgents 上可辨識，但：

- **codex 塔台**不會出現在 ListAgents，也沒有 SendMessage，兩個專案只要有一邊是 codex 塔台，就只能用 `_reply-*.md` 檔案請使用者轉交。
- SendMessage 只限同一台機器的 Claude session；BAT 的遠端（WSL / SSH / Docker）塔台與本機塔台之間也沒有直接管道。

BAT 已有的塔台 ↔ Worker 通道（派工、`bat-notify`、`question:*`）以分頁 ID 與範圍權杖定位，不分 agent；把類似的機制延伸到「塔台 ↔ 塔台」，可讓不同 agent、不同專案的塔台用同一套方式傳訊。

## 初步想法（未研究）

- 收件人以 `scope: 'towers'`（T0643）列出的塔台分頁為準；傳送端必須是已宣告的塔台，收件端也必須是已宣告的塔台。
- 投遞方式可沿用 `bat-notify` 的預填 / `--submit`（yolo 才自動送出），或比照 `question:*` 做成結構化、可查詢的訊息 store（內容只在主行程記憶體、日誌不記內容，D155）。
- 需要放寬 D149：塔台目前只能對自己的 Worker 寫入；跨塔台寫入是新的權限，需使用者決策。
- CT 端需要對應規則（跨塔台選收件人、何時改用此通道、與 `_reply-*.md` 的分工），完成後以 CT-T### 委派。

## 待研究 / 待決

1. 需求是否成立：實際上有多少跨專案協作的對象是 codex 塔台或遠端塔台（目前實例都是兩個 Claude 塔台，PLAN-050 已涵蓋）。
2. 投遞語意：一次性通知 vs 可查詢的訊息箱；收件塔台忙碌時的行為（排隊、預填、或只在下一次互動時提示）。
3. 安全：跨塔台寫入的權限範圍、訊息內容的遮罩與保存、防止 prompt injection（收到的訊息應被視為資料而非指令，比照 SendMessage 的處理）。
4. 遠端：headless 與本機之間是否要通（跨 RemoteServer）。
5. 與 PLAN-050 `scope: 'towers'` 的關係：收件人清單是否直接沿用。

## 研究結論與決定（T0647 / D169，2026-10-18）

- **維持 IDEA**（使用者 2026-10-18 18:2x 選推薦）。目前所有跨塔台往來都是「兩個 Claude 塔台、同一台機器」；失敗兩次皆為認錯收件人，PLAN-050 已解決；codex 塔台或遠端塔台卡住的案例 0 件。
- **前提更正**（T0647 Q1-3 實測，查證 2026-10-18）：
  - 動機第二點「SendMessage 只限同一台機器」不正確：連上 Remote Control 後可送到別台機器與雲端 session（雲端 session 目前不能回覆）。但 WSL 2 / container 與 host 之間互相送不到，所以 BAT 的 WSL / Docker 遠端塔台與本機塔台之間仍不通。
  - 動機第一點「codex 沒有 SendMessage」需修正：codex `0.163.0` 有 Stable 的 `codex queue --thread <UUID|名稱> --message <文字>`（經共用 app-server daemon，可 `--remote`），只限 codex ↔ codex；缺的是 codex ↔ Claude 的跨 agent 路徑。BAT 以系統管理員權限執行時注入 `features.daemon_auto_start=false`，此時 BAT 的 codex 分頁不在共用 daemon 上。
- **重新評估的觸發條件**（任一成立就重開）：① 實際出現一邊是 codex 塔台的跨專案往來；② 遠端（WSL / SSH / Docker）塔台需要和本機塔台往來，且不能用 Remote Control；③ SendMessage 在 BAT 塔台上出現無法繞過的限制（例如兩邊權限模式造成 hold、被組織設定 deny）。
- **日後要做時的依據**：T0647 回報區 Q2（推薦 (b) 結構化訊息箱，不推薦預填 / `--submit`）、Q3（只放寬「已宣告塔台 → 其他已宣告塔台，寫進 store」，PTY 只收 BAT 固定提示行）、Q4（第一版只限同一 host）、Q5 介面契約草案 C-1–C-9 與切分（M，可分兩單）。
- 衍生：codex 共用 daemon 環境變數繼承風險 → T0648 探針（D169）。
