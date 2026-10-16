---
schema_version: 1
schema_kind: workorder
id: CT-T013
title: "【受派】CT 下一版：Tower 啟動時呼叫 BAT `bat-terminal.mjs --set-role tower`，把塔台分頁標題設為 `<Agent 顯示名> · Tower`（D147）"
type: implementation
status: PENDING
repo: BMad-Guide
project: D147
priority: P3
sizing: XS
created_at: "2026-10-16T14:36:25+0800"
updated_at: "2026-10-16T14:36:25+0800"
depends_on:
  - "T0562（BAT 端能力；介面契約以 T0562 為準）"
related:
  - D147
  - T0562
  - CT-T011（`worker_auto_close`，同類「CT 呼叫 BAT helper、BAT 太舊時降級」範本）
interaction:
  mode_hint: ask
  interactive: true
  intervention_type: delegate
renew_count: 0
---

# CT-T013 — Tower 啟動時設定塔台分頁標題

## 跨專案協調

- **協調類型**：DELEGATE
- **來源專案**：better-agent-terminal（D147 / T0562）
- **目標專案**：BMad-Control-Tower（`D:\ForgejoGit\@Gower_Labs\BMad-Guide\BMad-Control-Tower\`，現行 v5.1.0；由 **BMad-Guide 塔台**派發執行，本檔為需求規格）
- **時機**：T0562 合入並隨 BAT 版本發佈後（預計 `0.6.1-pre.6`）；CT 端必須能在舊 BAT 上安全降級，所以也可先發

## 需求

使用者要求：在 BAT 中執行 `/control-tower`（或 `$control-tower`）後，該分頁標題變成 `<Agent 顯示名> · Tower`（例 `Claude CLI · Tower`），與 BAT 的 Worker 分頁標題（`Claude CLI · Worker · T####`）一致。標題由 BAT 組出並套用（含「使用者改過名就保留」），CT 只負責在啟動時呼叫一次。

## BAT 介面（摘自 T0562「介面契約」，以 T0562 為準）

```
"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-terminal.mjs" --set-role tower [--terminal-id <id>] [--agent <id>]
```

- `--terminal-id` 預設取 env `BAT_TERMINAL_ID`
- `--agent`：顯示名提示（`claude` / `codex`），分頁本身有 agent 設定時以分頁為準
- exit `0` 已處理 / `3` NOT_FOUND / `1` 用法錯誤、連線失敗、權杖不允許、BAT 太舊（舊 helper 印 `Unknown option`；新 helper 對舊 BAT 印 `set-role: UNSUPPORTED`）

## 修改清單

1. **`control-tower/SKILL.md` Startup Protocol** 與 `references/auto-session.md`（BAT 內部終端路由一節）：Tower 啟動、完成 BAT 偵測且 Tower dispatch env 齊全（`BAT_SESSION=1` + `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` / `BAT_TERMINAL_ID`）時，執行一次上述指令；`--agent` 依目前 agent（Claude → `claude`，Codex → `codex`）。
   - helper 路徑解析與既有派工相同（`BAT_HELPER_DIR` 優先，安裝路徑 fallback；Windows 路徑不轉 POSIX）；遠端分頁用 `"${BAT_HELPER_NODE:-node}"`。
   - **任何非 0 exit 一律視為不支援**：不重試、不降級成其他方式、不影響 Tower 啟動與狀態面板；面板可加一行 `分頁標題：已設定 / 不支援（BAT 太舊）/ 略過（非 BAT）`。
   - 非 BAT 環境、或 env 不齊：略過，不嘗試。
2. **只在 Tower session 執行**：ct-exec / ct-done / ct-status 等 Worker / 工具 skill **不得**呼叫（Worker 分頁的標題由 BAT 建立時決定）。
3. **重複啟動**：同一分頁再次 `/control-tower` 照常呼叫（BAT 端冪等）。
4. 版本說明 / CHANGELOG 註明需要 BAT `>= 0.6.1-pre.6`（以 T0562 實際發佈版號為準），舊 BAT 不受影響。

## 驗收

- 在新 BAT（含 T0562）中啟動 Tower → 分頁標題變 `Claude CLI · Tower`（Codex 為其顯示名）；面板顯示已設定
- 在舊 BAT 中啟動 Tower → 啟動正常、無錯誤中斷；面板顯示不支援
- 非 BAT 終端 → 無任何呼叫
- Worker（ct-exec）分頁啟動 → 不呼叫
