---
schema_version: 1
schema_kind: bug
id: BUG-085
title: Codex CLI 0.160 在提權的 Windows 上拒絕啟動 daemon，Codex CLI 終端 preset 直接失敗
status: FIXING
severity: medium
reproducibility: conditional
created_at: "2026-10-04T20:21:50+08:00"
updated_at: "2026-10-04T20:39:03+08:00"
impact:
  - codex-cli-terminal-preset
  - ct-dispatch-codex-cli（提權環境）
links:
  research_workorder: T0375
  fix_workorder: T0377
  decision: D124
  related: [BUG-083]
---

# BUG-085 — Codex CLI 0.160 在提權 Windows 上拒絕啟動 daemon

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（T0375 確認：Codex Agent 面板不受影響，維持 medium） |
| 可重現 | 條件式 100%：Windows + BAT 行程為提權（UAC 停用 `EnableLUA=0`，或使用者以系統管理員執行 BAT） |
| **狀態** | ⏳ FIXING（T0377，2026-10-04 20:39） |
| 回報者 | 使用者（2026-10-04 20:19，實機截圖） |

## 現象

BAT 終端分頁啟動 Codex CLI preset（實際指令 `codex --yolo`）：

```
$ codex --yolo
Error: start the Windows daemon from a non-elevated terminal; shared clients must not inherit administrator privileges
To work without the background server, rerun the same command with --no-daemon (including resume or fork and its arguments).
```

- **預期**：Codex CLI 正常進入互動介面
- **實際**：立即 exit，回到 shell prompt

## 塔台初步事實（2026-10-04 20:20，環境檢查，未做程式碼分析）

| 項目 | 值 |
|------|----|
| `HKLM\...\Policies\System` `EnableLUA` | **0**（UAC 停用；`ConsentPromptBehaviorAdmin=0`）⇒ 所有程序皆完整管理員權杖 |
| BAT 主行程父行程 | `explorer.exe`（20:11:08 啟動），非安裝程式提權拉起；無 AppCompat `RUNASADMIN` 旗標 |
| BAT 子 shell 是否提權 | `True`（`WindowsPrincipal.IsInRole(Administrator)`） |
| 終端分頁實際解析到的 codex | `%LOCALAPPDATA%\Programs\OpenAI\Codex\bin\codex.exe` → `codex-cli 0.160.0`（使用者自裝，PATH 第一順位；非 BAT 內嵌） |
| BAT 安裝版 | `1.26.1004195815`（使用者本機 build，程式碼等同 `v0.5.9-pre.4`）；內嵌 `@openai/codex-sdk` 0.160.0 |
| 相關程式碼位置 | `src/types/agent-presets.ts:75`（`codex-cli` preset）、`electron/agent-runtime/agent-registry.ts:157-161, 430` |

⇒ 根因層：**環境（UAC 關閉）× Codex 0.160 新增的 Windows daemon 提權檢查**。非 BAT 回歸，但 BAT 的 Codex CLI preset 在此類環境無法使用，產品面可補強。

## 未知（交 T0375 研究）

1. Codex Agent 面板（SDK 走 `codex exec`）是否同樣被 daemon 提權檢查擋下？
2. 是否有 config / env 可關閉 daemon（取代 argv `--no-daemon`）？
3. `--no-daemon` 對 resume / fork / 其他子命令的影響，以及舊版 codex 不認得該旗標時的行為
4. BAT 偵測提權後自動補旗標的可行性與注入點

## 使用者繞法

- 終端分頁手動執行 `codex --yolo --no-daemon`
- （影響全機，不建議為此變更）重新啟用 UAC：`EnableLUA=1` + 重開機

## 研究結論（T0375，`e9e27ec`）

| 路徑 | 結果 |
|------|------|
| 終端 Codex CLI preset / `codex resume` / `codex fork` | ❌ 受影響（ConPTY 實測 exit 1） |
| Tower / remote 以 codex-cli 派發的 Worker 終端 | ❌ 受影響（同一個 `buildLaunchCommand()`，靜態推導） |
| Codex Agent 面板（SDK → `codex exec`，含 resume） | ✅ 不受影響（隔離 CODEX_HOME smoke `pong` ×2；使用者 20:22 實機亦正常） |
| `codex --version` / 模型清單 | ✅ 不受影響 |

- 停用 daemon 的手段：`--no-daemon`（舊版 0.133 exit 2）、`--disable daemon_auto_start`（舊版 exit 1）、**`-c features.daemon_auto_start=false`（0.160 / 0.133 皆可）**、`config.toml [features]`（侵入使用者設定）；**沒有 env 開關**
- 修復方案見 D124 / T0377

