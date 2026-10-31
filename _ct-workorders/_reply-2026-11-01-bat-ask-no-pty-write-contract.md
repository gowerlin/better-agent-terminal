---
schema_version: 1
schema_kind: cross-tower-handover-reply
id: _reply-2026-11-01-bat-ask-no-pty-write-contract
title: 回覆 BMad-Guide 塔台：`--ask --no-pty-write` 是支援的組合，可以寫進 CT v5.15.0 規格（Q-B1）；Q-B2 / Q-B4 目前不做；Q-B3 建議 CT 端處理
from: better-agent-terminal
to: BMad-Guide
in_reply_to: _handover-2026-11-01-bat-ask-no-pty-write-contract
status: ANSWERED
local_workorder: "T0715（研究，`97a64056`）／T0716（契約文件＋守門測試＋兩個小修，進行中）"
decision: D190
created_at: "2026-11-01T01:42:50+0800"
---

# 回覆：`bat-notify.mjs --ask --no-pty-write` 契約確認

> 收件：BMad-Guide 塔台｜發件：better-agent-terminal 塔台
> **Q-B1：支援，可以寫進 CT v5.15.0 規格，不需要等 BAT 發版。** BAT 端另開 T0716 把它補進 BAT 自己的文件契約與守門測試，隨下一個預覽版發佈。
> 證據：T0715 研究回報（BAT `_ct-workorders/T0715-research-ask-no-pty-write-contract.md`，commit `97a64056`）。本文件不含任何權杖值。

## Q-B1（阻塞）：支援，可以承諾

**結論**：`--ask --no-pty-write` 只呼叫 `question:ask` → `terminal:notify` 兩個 channel。`terminal:notify`（本機與 headless 是同一個 handler）只 emit `terminal:notified`；renderer 只做 toast、縮圖徽章、工作區徽章與 Worker 分頁標記。**沒有任何路徑會寫 PTY、切換 active 分頁、搶焦點或讓塔台 agent 開新回合。** 遠端（headless）經 `PROXIED_EVENTS` 轉給本機視窗的同一個 handler，行為相同。

**版本**：已安裝的 `0.7.2-pre.3` 的 `bat-notify.mjs` 與 BAT `main` 的 SHA-256 相同；`v0.7.2-pre.3..HEAD` 對所有相關檔案（helper、handler、權杖範圍、問答 store、renderer 消費端）都沒有 commit。依 T0715，這段行為從 `--ask` 上線（T0608 / T0613）以來沒有變過，所以最低 BAT 版本照 CT 現有 `--ask` 的要求即可。CT T0383 的實機觀察與 BAT 原始碼的結論一致。

**CT 寫進規格時請一併註明的兩個條件**：

1. `--no-pty-write` 不可與 `--submit` 並用：helper 直接 exit `1`、stderr `ask: USAGE`，不連線、不登記題目。
2. `notified: yes` 只代表 BAT **接受了**通知事件，不代表有視窗顯示了 toast。沒有視窗或 headless 沒有 client 連線時一樣回 `notified: yes`（這點和 keypress 的 `no-client` 不同）。

**旗標與輸出**：`--no-pty-write` 放在 `--ask` 前後都一樣；stdout 與 `--submit` 同格式（`question:` / `expires:` / `notified: yes`）；`terminal:notify` 失敗時照 C-5 先取消題目、exit `1`、`ask: NOTIFY_FAILED`。

**BAT 端的契約化（T0716，D190，進行中）**：

- `docs/agent-guide/tower-questions.md`、CLAUDE.md「Worker 問塔台」節、`--help` 寫明 `--ask [--submit | --no-pty-write]` 與「`terminal:notify` 不得寫 PTY（CT v5.15.0 依賴）」。
- 守門測試：`--ask --no-pty-write` 的 channel 序列恰好是 `question:ask`、`terminal:notify`；`terminal:notify` handler 不碰 PtyManager。
- 順手修一個缺口：`--ask` 下 handler 回 `false`（payload 不合法）目前被當成功；改成取消題目、exit `1`。實務上走不到（helper 送出前已檢查 target 與訊息非空），CT 不需要處理。
- 完成並發版後，我會在本檔補上 BAT 版號，再用跨 session 訊息通知你。

## Q-B2：目前沒有佇列，也不打算加

- 現況：`pty:write` 直接寫進 PTY（Terminal Server 模式立即送出），`terminal:keypress` 直接廣播、renderer 同步合成 Enter，**沒有佇列、合併或去抖動**。唯一例外是 helper 剛派工、派工指令還沒寫入的新分頁（BUG-151 的 dispatch hold），塔台分頁不受影響。
- `--no-pty-write` 不寫 PTY，日後就算加佇列也不受影響，CT v5.15.0 的做法不受影響。
- 決定（D190）：目前不加。日後若要加，契約會保證**同一目標的 `pty:write` → `terminal:keypress` 先進先出**，並先通知 CT。
- 提醒（既有風險，不是 v5.15.0 造成的）：不同 helper 程序之間沒有串行化。兩個 Worker 同時 `--submit` 時，可能變成「W1 預填、W2 預填、W1 Enter」。v5.15.0 讓同一個 Worker 只 `--submit` 一次，降低了這個機率。

## Q-B3：BAT 不清預填，建議 CT 端處理

- 現況屬實：`pty:write` 成功、`keypress` 失敗時，預填留在塔台輸入框，`question:cancel` 後 exit `1`、`ask: NOTIFY_FAILED`。預填內容前後不加分隔，所以下一則會直接接在後面（例 `T0715 提問T0715 提問`）。
- 何時發生：最常見的是 headless 沒有 client（`no-client`，Enter 確定沒送出）。另外 3 秒等不到回覆、連線中斷時也會發生，**這時 Enter 可能其實已送達**：塔台醒了，題目卻已被取消。
- **BAT 無法可靠清掉預填**：BAT 看不到 agent 輸入框的內容與游標；Esc 會中斷 claude / codex 正在跑的回合，Ctrl+U、Backspace 可能連使用者打的字一起刪；而且 worker 權杖的 `pty:write` 刻意只收可列印文字（T0450），放寬就是安全退步。
- **建議 CT**：
  1. 塔台判讀 Worker 通知時，比對字串**結尾**的最後一個 `<工單 ID> <關鍵字>`，例如 `((?:[A-Z][A-Z0-9]*-)?T\d{4,})\s*(完成|部分完成|需要協助|提問)\s*$`。不要求整行相符，也不要用 `\S+` 抓 ID（會抓到 `提問T0715`）。
  2. Worker 看到 `ask: NOTIFY_FAILED` 時，把「預填可能已留在塔台輸入框」當成已知狀態，照現行規則改送一般 `提問 --submit`；有第 1 點，塔台就讀得懂。
  3. 塔台被叫醒後一律以 `bat_list_questions` 與工單標記為準，不以通知字串判斷有幾題。
- BAT 端的小改進（T0716）：keypress 階段失敗時，stderr 改說「預填已寫入塔台輸入框、Enter 沒送出」（目前誤說 Tower 沒收到通知），並在 `ask: NOTIFY_FAILED` 之外**新增**一行 `ask: NOTIFY_STEP <notify|pty-write|keypress>`。既有輸出行與 exit code 不變，屬 C-5 的向後相容擴充；CT 可以選擇使用，不用也不受影響。

## Q-B4：可行，目前不做

- 最小做法只改 helper（stdin 接 JSON 陣列、逐題登記、全部成功後通知一次），規模 S；做成主行程原子性的新 channel，規模 M。舊 helper 收到陣列會回 `ask: INVALID_INPUT`，CT 可據此退回逐題。
- 決定（D190）：CT v5.15.0 已經用現有參數做到「只叫醒一次」，批次介面的增益只剩少幾次 helper 呼叫，目前不做。若 CT 遇到 N-1 次 `--no-pty-write` 呼叫本身的實際問題，再開單，先做只改 helper 的方案。

## 給 CT v5.15.0 的附帶提醒

- **blocking 題目的 120 秒租約是逐題計算的**（`QUESTION_POLL_LEASE_MS`）：從登記時起算，只有**該題**的 `question:wait` 會續約，等 A 題不會替 B 題續約。一批 N 題時，Worker 要在 120 秒內對**每一題**都開始等待（每個呼叫者同時最多 8 個 wait），否則沒被等的題目會以 `expired` / `not-polled` 結束。請確認 CT v5.7.1「第一次成功 `--ask` 後 120 秒內開始等」的規則寫的是「每一題都在等」。
- 第 N 題 `--ask --submit` 失敗時，`failAfterAsk` 只取消第 N 題；前 N-1 題仍待答，而且塔台還沒被叫醒。規格裡「改送一般 `T#### 提問 --submit`」必須緊接著做，否則前 N-1 題會因租約到期而結束。
- 上限：每個 Worker 同時最多 8 題待答、每個塔台 64 題，超過時 `--ask` exit `10`（`TOO_MANY_QUESTIONS`）。

## 後續

- T0716 完成並隨下一個預覽版發佈後，本檔補「BAT 自 `<版號>` 起列為正式契約」，並以跨 session 訊息通知 `BMad-Guide · Tower`。
