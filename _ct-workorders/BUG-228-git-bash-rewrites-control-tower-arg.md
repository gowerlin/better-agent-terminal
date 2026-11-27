---
schema_version: 1
schema_kind: bug
id: BUG-228
title: "Windows 的 Git Bash 分頁：「以塔台開啟 Claude」帶入的 `/control-tower` 被 MSYS 改寫成 `C:/Program Files/Git/control-tower`，claude 沒有執行 slash command"
status: FIXED
severity: medium
reproducibility: "always（推測：Windows、塔台分頁的 shell 是 Git Bash 時）"
created_at: "2026-11-27T20:42:33+08:00"
updated_at: "2026-11-27T21:00:28+08:00"
impact:
  - tower-tab
  - claude-cli
links:
  discovered_in: "A-15（`v0.8.0` 實機驗收，T0944，D427）"
  related: [T0944, T0946, D421, D427, D428]
---
# BUG-228 — Git Bash 把 `/control-tower` 改寫成路徑

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（T0944 的功能在 Git Bash 分頁實際上沒有作用；這次能進塔台是模型從字尾猜出來，不可靠） |
| 可重現 | 推測必定：Windows、塔台分頁的 shell 是 Git Bash |
| **狀態** | ✅ FIXED（T0946 `75525d6a`，合併進 `main` `773fe35c`，D432；待發版實機驗收） |
| 回報者 | 塔台於 A-15 實機驗收時發現（使用者回報 A-15 完成，塔台複查不符，U-36 → A） |
| 影響版本 | `v0.8.0`（T0944 起） |

## 現象（預期 vs 實際）

- 預期：「+」→「以塔台開啟 Claude」開的分頁，claude 以 `/control-tower` 啟動，直接執行 control-tower skill。
- 實際：claude 收到的第一則使用者訊息是 `C:/Program Files/Git/control-tower`（BAT `0.8.0`，2026-11-27 20:40，塔台 session `a34eb9f4-d1c0-45d7-9099-e288e5bcecb2`）。claude 沒有把它當 slash command；這次是模型從字尾猜出意圖、自己載入 skill。

## 根因（塔台推測，待 Worker 確認）

`C:/Program Files/Git/` 是 Git for Windows（MSYS2）的根目錄。Git Bash 啟動原生程式（`claude.exe`）時，MSYS 會把看起來像 POSIX 絕對路徑的參數（以 `/` 開頭）轉成 Windows 路徑。T0944 的 `towerLaunchPrompt` 以 `quoteArgForShell(…, 'posix')` 加引號，`/control-tower` 在免引號字元集內，原字串放進命令；即使加了引號，MSYS 的轉換仍會發生（轉換發生在 bash 執行原生程式時，與引號無關）。

待查：helper 派工把 `/ct-exec <工單 ID>` 放在同一位置、同一引號函式（`createAgentPromptCommandBuilder`），落點分頁的 shell 是 Git Bash 時是否也被改寫；過去的 Worker 都正常，可能是派工分頁的 shell 不同。

## 已知的暫時做法

- 塔台分頁改用 PowerShell 當 shell；或進入 claude 後自己打 `/control-tower`。

## 修正紀錄

- 2026-11-27 20:42 → FIXING（T0946，D428）
- 2026-11-27 21:00 → FIXED：根因實測成立（Git Bash／MSYS 改寫以 `/` 開頭的參數，與引號無關）；Git Bash 塔台分頁的啟動命令前加只對該次命令生效的 `MSYS2_ARG_CONV_EXCL`（`isWindowsMsysShell` / `msysArgConvExclusionPrefix`，`src/utils/shell-quote.ts`）；helper 派工不受影響（一律帶 `MSYS_NO_PATHCONV=1`）。合併進 `main` `773fe35c`（D432）。待發版後重驗 A-15 / A-16。
