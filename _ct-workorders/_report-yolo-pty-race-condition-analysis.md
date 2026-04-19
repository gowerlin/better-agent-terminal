# Report — YOLO PTY Race Condition 技術分析

> **類型**:研究報告(`_report-*`,非工單)
> **建立時間**:2026-04-19 11:08 (UTC+8)
> **建立來源**:第十 session BUG-049 閉環後使用者提問「Claude CLI 有沒有背景 IPC 管道避免 Worker 強插?」
> **狀態**:參考文件(不進入 `*sync` 掃描範圍)
> **關聯**:BUG-049(已 CLOSED) · PLAN-020(YOLO dogfood) · `scripts/bat-notify.mjs`

## 問題陳述

在 `auto-session: yolo` 模式下,Worker 完成工單時會透過 `bat-notify.mjs --submit "T#### 完成"` 把訊息**寫入 Tower 塔台 terminal 的 PTY input buffer + 附加 `\r`**,觸發自動送出。

此機制的核心設計假設:
> **塔台在 Worker 執行期間處於閒置狀態,使用者不會在此時打字輸入。**

但實際上:
- 塔台 session 與使用者持續互動(討論、指令、查詢)
- Worker 工單完成時機不可預測(與使用者操作無同步機制)
- 若使用者正在打字時 Worker auto-submit 觸發,會發生**強插中斷**

**此報告目的**:盤點 Claude Code CLI 提供的機制,分析 race condition 風險,提出可行工程解方。**不進入工單執行**,僅作為未來 PLAN 排期與設計決策參考。

## Race Condition 場景複現

```
T+0.0s  使用者:打字中「*bug 發現另一個問...」(buffer 有 17 bytes,未 \r)
T+0.5s  Worker:呼叫 bat-notify.mjs --submit "T#### 完成"
T+0.51s BAT:PTY write 17 bytes 訊息 + `\r`
T+0.52s PTY input buffer 實際內容:「*bug 發現另一個問T#### 完成\r」
T+0.52s Claude CLI 收到 \r → 送出整個 buffer 給 LLM
T+0.6s  LLM 看到無意義混合字串,進入錯誤 turn
```

**關鍵限制**:PTY input buffer 是 **byte stream**,沒有訊息邊界概念,無法從 OS 層面判斷前面是否有人類未送出的輸入。

## Claude Code CLI 機制盤點

| 機制 | 方向 | 是否適用本場景 | 說明 |
|------|------|--------------|------|
| **Stdin / PTY 輸入** | 外部 → CLI | ✅ 目前用中 | 唯一路徑,bat-notify 走此通道 |
| **`Hooks`**(PreToolUse / PostToolUse / Stop / Notification) | CLI → 外部 | ❌ | 單向事件通知,外部無法 inject 訊息進 conversation |
| **`SessionStart` hook `additionalContext`** | 外部 → CLI | ⚠️ 僅新 session | 只在 CLI 啟動時注入,running session 無效 |
| **MCP servers**(stdio / SSE transport) | RPC 雙向 | ❌ | 工具呼叫設計(tools/list, tools/call),不是 push 訊息到 conversation |
| **Claude Agent SDK**(`@anthropic-ai/claude-agent-sdk`) | 程式化控制 | ⚠️ 替代架構 | 可程式化 inject,但需改用 SDK 宿主,不是 `claude` CLI 二進位本身 |
| **背景 socket / named pipe / Unix domain socket** | 雙向 | ❌ | 無此機制 |
| **`--non-interactive` / `-p` 模式** | 單次呼叫 | ⚠️ 無 running session | 每次一個 prompt,不是 persistent session |

**結論**:Claude Code CLI **沒有**背景 IPC 管道、訊息 Queue、或任何 side channel 機制可讓外部程式安全注入訊息到 running session。

## 根本原因(架構層)

Claude Code 設計假設是「單一 PTY = 單一使用者互動流」。無 side channel 概念源於:

1. **Context 線性化約束**
   Claude 的 conversation context 是嚴格線性的 message list,插入訊息會干擾 LLM 推理順序,不能像 IRC 般多源訊息交錯
2. **無「queue + 使用者決定」中間層**
   `\r` 送出即立刻進入 LLM call(trigger turn),沒有「訊息先進 queue,使用者檢視後決定何時觸發」的暫存層
3. **背景通知 poll 成本高**
   若要提供「定期檢查背景 queue」機制,必須在每次 user turn 前強制輪詢,增加延遲且破壞單純的 REPL 模型
4. **Anthropic 設計哲學**
   Claude Code 是「agentic terminal assistant」,不是「multi-channel communication platform」

## 工程解方評估(四選)

### [A] BAT 前端加 input activity detection(最 pragmatic)

**機制**:
- BAT 前端監聽 Tower terminal 的 stdin 最近 N 秒(例如 5s)是否有 keystroke
- `bat-notify --submit` 檢測到「使用者活躍」→ **只 PTY write 不加 `\r`**(訊息顯示但不觸發送出)
- 加 visual indicator(footer banner 或 inline prompt):「Worker 已送完成訊息,按 Enter 繼續」
- 使用者可選擇清空重打或直接 Enter 接受

**優點**:
- 不需改 Claude CLI(不依賴 Anthropic 升級)
- 完全在 BAT 層實作,塔台 / Worker skill 零改動
- 保留 YOLO「自主決策下一張」的核心精神,只在衝突時降級

**缺點**:
- Heuristic 可能誤判:使用者看螢幕但沒打字的時段被視為閒置 → race 仍存在(機率降低)
- 需要 BAT 前端 stdin 偵聽 API(未確認現有架構是否支援)
- 5s 視窗值難調:太短無效、太長拖慢 YOLO 節奏

**預估成本**:BAT 前端改動 2-4 小時(含 stdin 偵聽 + notify.mjs 新 flag + smoke test)

### [B] Notification Banner 模式(非侵入式)

**機制**:
- `bat-notify --banner` 新模式:不走 PTY,走 BAT 自己的 UI layer(類似 toast / notification center)
- 塔台 UI 顯示「📬 T0205 完成 [接受並繼續] [忽略]」按鈕
- 使用者按按鈕時,BAT 才觸發 PTY write + submit

**優點**:
- 零 race 保證(完全解耦 PTY stream 與 notify channel)
- 使用者完全掌握節奏,心智負擔低
- 可保留完整訊息歷史在 notification center

**缺點**:
- **YOLO 精神受損**:「自主決策下一張」被打斷,每張工單間都需使用者點一下 → 實質降級為 `on` 模式
- 失去 PLAN-020 dogfood 的「無人值守連續派發」價值
- 需要 BAT UI 層新元件(notification center / toast 系統)

**預估成本**:BAT UI 改動 4-8 小時(含 toast 元件 + notify.mjs --banner flag + 使用者 click → IPC 觸發 PTY write)

### [C] 雙 PTY 模式(架構層大改)

**機制**:
- 塔台 terminal 開兩條 PTY:前景(human)+ 背景(worker queue)
- Worker auto-submit 走背景 PTY,Claude Code 在每次 turn 前輪詢合併

**評估**:
- 需要 Claude CLI 原生支援 `--secondary-stdin` 類 flag(**目前無**)
- 屬於 Anthropic 官方 roadmap 層級,BAT 無法單方面實作
- **結論**:不可行(至少短中期內)

**預估成本**:N/A(依賴上游)

### [D] 接受 race,加 simple stdin guard

**機制**:
- bat-notify 在 `--submit` 前檢測 stdin 最近 1s 有無 byte 進來
- 若有 → abort + log warning + **fallback 到不送出 `\r`**(只寫訊息,讓使用者自己按 Enter)
- 使用者手動清空輸入並觸發下一張

**優點**:
- 實作最簡單(~20-50 行 code)
- 不需 BAT 前端改動(bat-notify 腳本內完成)
- 落地最快,可作為 [A] 的墊底

**缺點**:
- 極少數情境仍會 race(正好 0.99s 前打的字、使用者打字速度慢)
- 1s 視窗值仍是 heuristic

**預估成本**:bat-notify.mjs 改動 30 min - 2 小時(含 stdin 活動偵測 + smoke test)

## 方案比較矩陣

| 方案 | 落地成本 | Race 消除程度 | YOLO 精神保留 | 依賴 Anthropic |
|------|---------|--------------|--------------|---------------|
| [A] Activity detection | 中(2-4h) | 80-90% | 高 | ❌ |
| [B] Notification banner | 高(4-8h) | 100% | ❌(降級為 `on`) | ❌ |
| [C] 雙 PTY | N/A | 100% | 高 | ✅ |
| [D] Simple guard | 低(0.5-2h) | 60-70% | 高 | ❌ |

## 塔台建議方案

**階段式組合**:

1. **短期**:[D] Simple guard
   落地最快,解決 60-70% race,作為 YOLO 可用性底線
2. **中期**:[A] Activity detection
   在 [D] 基礎上增加更智慧的偵測,覆蓋到 80-90% race
3. **長期 fallback**:[B] Notification banner
   作為 yolo 的「友善降級選項」(使用者可在 config 選擇 [A] 精確模式 vs [B] 零 race 模式)
4. **不排程**:[C] 依賴上游,觀察即可

> 本報告**不轉為 PLAN**(使用者決策)。若未來遇到實際 race 受害案例或 YOLO dogfood 使用率提升,可回頭排期。

## 使用者原始洞察(重要引用)

> 「bat-notify.mjs 其實是送到 input buffer 然後 \n 應該無法辨別是人類 input 還是 Worker 用程式送出」

此洞察點出了**設計的雙面性**:
- **優點**:Worker 自動化與人類操作對 CLI 端**不可區分**,不需特殊 protocol,bat-notify 實作 trivial(zero-deps 原則)
- **風險**:PTY 是單一 byte stream,無法在塔台端 audit 訊息來源(誰送的?何時送?),需依賴 `bat-notify --source` 欄位在 BAT log 層追蹤

此為 BAT YOLO 架構的**核心 trade-off**,任何工程解方都需在「簡單性」和「race safety」間取捨。

## 相關工單 / 文件索引

| 編號 | 關聯 |
|------|------|
| BUG-049 | bat-notify.mjs TLS 修復(閉環前提) |
| PLAN-020 | YOLO 模式 dogfood(本議題暴露來源) |
| `scripts/bat-notify.mjs` | 現行 PTY write + `\r` 實作 |
| `scripts/bat-terminal.mjs` | 姊妹 script,同樣用 MinimalWS |
| `references/yolo-mode.md`(塔台 skill) | YOLO 斷點設計規格 |

## 變更紀錄

- 2026-04-19 11:08 — 使用者建議建立研究報告替代開 PLAN,塔台產出本文件存檔
