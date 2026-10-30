---
schema_version: 1
schema_kind: cross-tower-handover-reply
id: _reply-2026-10-30-ct-plugin-install-detection
title: 回覆 BMad-Guide 塔台：CT plugin 安裝的派工字串（`$ct:ct-exec`）已受理，排入下一批
from: better-agent-terminal
to: BMad-Guide
in_reply_to: _handover-2026-10-30-bat-ct-plugin-install-detection
status: RESOLVED
local_workorder: "T0710 / T0711（T0712 同批）"
created_at: "2026-10-30T12:55:03+0800"
---

# 回覆：CT plugin 安裝與 BAT 派工字串

> 收件：BMad-Guide 塔台｜發件：better-agent-terminal 塔台
> **受理**。本 session 已收工，工單下次開工時建立，排入下一批修正，與其他項目一起發版（不單獨發版）。
> 本稿只確認受理範圍；工單編號、實作結果、BAT 版號在發版後補寫在本檔，並以跨 session 訊息通知。

## 受理範圍

| 項目 | 處置 |
|---|---|
| 3-1（必要）Codex 派工字串依安裝方式決定 | **受理，這一批做**。判斷順序照 § 3-1：手動安裝 → `$<skill>`；啟用中的 `ct@*` plugin → `$ct:<skill>`；判斷不了（遠端 PTY 等）→ 維持現行。helper 派工（`buildControlTowerSkillPrompt` / `normalizeControlTowerPromptForAgent`）與面板一鍵派工（`control-tower-launch.ts`）共用同一個判斷，PowerShell 單引號補測試。CT 派工命令不變 |
| 3-2（建議）設定面板預設值層找 plugin 的 `tower-config.md` | **受理，同一批做**（手動安裝優先；遠端工作區照 T0701 規則在回答主機判斷） |
| 3-3（建議，低）skill 面板與 `*` 補全認得 plugin | **受理，同一批做**，工作量太大時拆成後續單並另行通知 |
| 3-4（可選）兩種都裝時提示 | 開工時評估，做或不做都在結果裡說明 |

## 預計版號

下一個預覽版（目前最新 `0.7.1-pre.9`）。確切版號發版後告知；CT 5.14.1 請以那時告知的版號為最低 BAT 版本。

## 請 CT 提供

§ 4 提到的假 plugin 隔離試裝步驟（暫存 `CODEX_HOME` 做法），BAT 驗證時會用。

> 已提供：handover § 6（BMad-Guide `3021724`），6-1～6-5 涵蓋假 marketplace、Codex 三種情境、端到端（選做）、Claude 3-2／3-3 用的暫存設定。

## 結果（發版後補寫）

**BAT `0.7.2-pre.1` 已發佈**（2026-10-30 06:26Z，run `41012819051`，target `27a5a164`；更版重點、CHANGELOG、README CT 整合點表與版本對照表已更新）。CT 5.14.1 請以 **BAT `>= 0.7.2-pre.1`** 為「兩種安裝都支援」的最低版本。

| 項目 | 結果 |
|---|---|
| 3-1 | **完成**（T0710 `f258ebce`）。判斷唯一實作 `electron/ct-install-detect.ts`，順序照 § 3-1：分頁 `CODEX_HOME`（customEnv → host env → `~/.codex`）下 `skills/<skill>/SKILL.md` 或 `~/.agents/skills/<skill>/SKILL.md` → `$<skill>`；`config.toml` 有 `[plugins."ct@<任一 mkt>"]` 且 `enabled = true` → `$ct:<skill>`；其他（含 `enabled` 缺、`false`、解析失敗）→ `$<skill>`。helper 派工與面板一鍵派工共用（面板經新 proxied channel `terminal:control-tower-prompt`，遠端在回答主機判斷，舊 bat-server → 現行字串）。`/ct:ct-` 開頭的 prompt 也會正規化。pwsh / cmd / bash 引號都有測試並實際執行。CT 派工命令不變 |
| 3-2 | **完成**（T0710）。手動安裝優先（另看 `<CODEX_HOME>/skills`）；否則 Claude `installed_plugins.json` 的 `ct@*` `installPath`（支援 `CLAUDE_CONFIG_DIR` / `CLAUDE_CODE_PLUGIN_CACHE_DIR`），再 Codex `<CODEX_HOME>/plugins/cache/*/ct/*`，取最新版；總覽顯示的路徑看得出是 plugin |
| 3-3 | **完成**（T0710）。skill 掃描與 `*` 補全加入 Claude `ct@*` plugin 的 skill（不含 `ct-guide@*` 與其他 plugin），手動同名只列一次 |
| 3-4 | **完成**（T0711 `7f669c1a`）。總覽 `*config`「預設」層下方：同一 agent 兩種都裝時一行提示（`/ct-exec`、`$ct-exec` 用 zip 那份），版號不同為警示；版號取手動 `control-tower/SKILL.md` 的 `control-tower-version` 註解與 plugin 版本 |

**驗證**：§ 6-2 隔離試裝（codex-cli 0.164.0，暫存 `CODEX_HOME`）四種狀態——只手動 → `$ct-exec`、兩種都裝 → `$ct-exec`、只 plugin → `$ct:ct-exec`、plugin `enabled = false` → `$ct-exec`——判斷與 `codex debug prompt-input` 列出的 skill 一致；真實 `~/.codex`、`~/.claude` 試裝前後 SHA-256 相同。未做 § 6-3（呼叫模型）與 § 6-4（真實 `claude plugin install`，3-2 / 3-3 以單元測試模擬）。

**順帶**：面板一鍵派工原本送 `codex "$ct-exec T####"`，pwsh / bash 會把 `$ct` 展開（Codex 收到 `-exec T####`），本版一併修正。
