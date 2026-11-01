---
schema_version: 1
schema_kind: bug
id: BUG-182
title: "遠端 bat-server 重啟後，重連的視窗裡分頁的等待 ⚠️ 永遠不清除（看過、送 idle 都沒用），工作區總數多算"
status: FIXED
severity: low
reproducibility: always
created_at: "2026-11-01T20:48:44+0800"
updated_at: "2026-11-01T21:07:44+0800"
fixed_at: "2026-11-01T21:07:44+0800"
fixed_in: "01796a9e"
impact:
  - workspace-waiting-badge
  - remote-profile
links:
  discovered_in: "T0748 回報區〈發現的問題〉1（2026-11-01，WSL 遠端工作區 ⚠️ 驗收，情境 ⑤ 選做）"
  related: [T0748, T0735, T0749]
---

# BUG-182 — 遠端 server 重啟後殘留的等待 ⚠️ 不會清除

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（只在遠端 server 重啟時；提示錯誤、總數多 1，不影響終端功能） |
| 可重現 | 一定（T0748 spec ⑤） |
| **狀態** | ✅ FIXED（T0749，`01796a9e`；待人工驗收） |
| 回報者 | T0748 Worker |

## 現象

- 預期：遠端 server 重啟、視窗重新連上後，舊 PTY 已不存在的分頁不再顯示等待 ⚠️（或在使用者看過後清除）。
- 實際：遠端 profile 視窗的分頁在等待中（OSC `blocked` 或 hook）時，停掉遠端 bat-server 再以同 port / token 啟動，重連後 20 s 仍是實心 ⚠️；該分頁在 server 端沒有任何紀錄（`pty.getCwd` = null、buffer 空、沒有新 shell）。選該工作區與分頁（視窗有焦點）看過也不清除，送 OSC `idle` 也沒有 PTY 收得到。工作區列與總數 badge 一直多算 1，直到使用者 ⏻ 重啟分頁。
- `docs/agent-guide/worker-tab-recycle.md` 的已知限制寫「遠端 server 重啟時舊分頁的標示留到 PTY 結束事件或下一次變更」，但舊 PTY 的結束事件不會再送到，實際上會一直留著。

## 重現

1. 遠端 profile 視窗（WSL 等）的分頁進入 waiting（例如 bash 分頁 `printf '\033]7501;state=blocked:app=codex\007'`）。
2. 停掉遠端 bat-server，再以同 port / token 啟動；視窗自動重連。
3. 工作區列 ⚠️ 仍為實心；選該分頁看過也不清除。
4. 自動化：`e2e/v072-pre8-remote-workspace-waiting.spec.ts` ⑤（INFO 記錄，截圖 `5-after-reconnect.png`）。

## 備註

- 修正方向（待修正單評估）：重連時對該 profile 的分頁做一次 attention 對帳（server 沒有的 PTY 清除 attention），或 renderer 在 PTY 不存在時不把該分頁算成等待。
- 重連後分頁沒有 PTY 本身是否符合預期，T0748 未查。
- 未涵蓋：真正的網路中斷（server 仍在）是否也會殘留。

## 修正（T0749，`01796a9e`，2026-11-01）

- 做法：遠端 profile 視窗收到 `remote:client-status-changed` 由未連線轉已連線時，送一次 proxied `terminal:attention-snapshot(ids)`；server（Electron main 與 headless 共用 `registerAttentionSnapshotHandler`，`electron/terminal-attention.ts`）依自己的現況回 `{ id, alive, attention }`。renderer `reconcileTerminalAttention`（`src/stores/terminal-attention-store.ts`）：PTY 不在 → 比照 PTY 結束（實心 ⚠️、總數清除；沒在看 → 淡化，D203 沿用 PTY 結束的既有處理）；PTY 在 → 以 server 狀態取代（仍在等 → 保留）。不比對時間。
- 驗證：unit（`terminal-attention-store.reconcile.test.ts`、`electron/__tests__/terminal-attention.test.ts`）；e2e ⑤ 改為斷言，WSL 實跑 4 次綠（最終版 spec 2 次），突變檢查（App 不接對帳）→ ⑤ 失敗於 `data-waiting` 仍為 `waiting`。
- 現況記錄（未改）：server 重啟後舊分頁沒有 PTY、不重建 shell，使用者 ⏻ 重啟分頁。
- 真正的網路中斷（server 仍在）：同一個快照涵蓋（PTY 在 → 取 server 現況），unit 驗證，e2e 未做。
