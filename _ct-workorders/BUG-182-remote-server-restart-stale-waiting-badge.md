---
schema_version: 1
schema_kind: bug
id: BUG-182
title: "遠端 bat-server 重啟後，重連的視窗裡分頁的等待 ⚠️ 永遠不清除（看過、送 idle 都沒用），工作區總數多算"
status: FIXING
severity: low
reproducibility: always
created_at: "2026-11-01T20:48:44+0800"
updated_at: "2026-11-01T20:50:17+0800"
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
| **狀態** | 🔧 FIXING（T0749） |
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
