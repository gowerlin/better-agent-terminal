---
schema_version: 1
schema_kind: plan
id: PLAN-062
title: "以「等 stdout / stderr 結束」方式啟動 BAT 的外部程式會一直等（Terminal Server 保留時 crashpad 持有主行程 stdio）"
status: IN_PROGRESS
priority: low
created_at: "2026-11-03T16:27:42+0800"
links:
  source: "T0804 回報區〈結論〉C 觀察 1；D251"
  related: [T0803, T0804, T0805, T0144]
---

# PLAN-062 — Terminal Server 保留時，主行程 stdio 不會關閉

## 動機

T0804 實測：關閉確認預設保留 Terminal Server（T0144）。Terminal Server 是 `chrome_crashpad_handler` 的 client，crashpad 由主行程 `crashReporter.start()`（`electron/main.ts`）啟動並繼承主行程的 stdout / stderr，所以 Terminal Server 活著時 crashpad 不結束，主行程的 stdio 也就不關閉。Playwright `app.close()` 因此等不到 `close`（repo 的 `closeIsolated` 一律勾選結束 server，不受影響）。

推論（未實測 Playwright 以外的情境）：以 pipe 接 BAT 輸出、等 EOF 的外部啟動方式（`out=$(./BAT.AppImage)`、`./BAT.AppImage | tee log`、以 pipe 收 stdout 的服務管理器等）會一直等到 Terminal Server 結束。

## 方向（未研究）

- fork Terminal Server 時不讓它成為 crashpad client，或讓 crashpad 不繼承主行程 stdio；兩者都牽涉 Electron / crashpad 行為，需先實驗。
- 與 T0805（PTY 內 shell 繼承 Terminal Server 描述元，含 crashpad client socket）的結論一起看：若 T0805 的修正讓 server 的 crashpad 連線不外流，可能部分重疊。

## 觸發條件

- 有使用者回報以 pipe / 服務管理器啟動 BAT 時卡住，或 T0805 的修正自然涵蓋本項。

## 狀態

- IDEA（D251，low）。
- 2026-11-03 17:06 T0805 補記：另有一個變體——分頁留下的背景程序繼承了 crashpad client socket，即使選「離開＋結束 Terminal Server」，crashpad 也留到背景程序結束（BUG-205，修 BUG-205 的方案 A 會一併解掉）。原題（保留 Terminal Server 時 server 本身就是 crashpad client）需要 T0805 方案 C（fork server 時不讓它成為 crashpad client，代價是 server 當掉不產生 dump），維持 IDEA。
- 2026-11-03 21:11 → IN_PROGRESS（D258，使用者指示開始）：T0812（研究：現況、候選修法與副作用，之後再開實作單）。
