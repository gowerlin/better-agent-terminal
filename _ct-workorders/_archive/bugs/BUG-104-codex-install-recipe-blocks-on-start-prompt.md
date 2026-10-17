---
schema_version: 1
schema_kind: bug
id: BUG-104
title: "remote-tools 的 codex 安裝食譜在 BAT 安裝分頁卡在 installer 的「Start Codex now? [y/N]」互動提示，完成標記 / toast / 重新偵測都要等使用者回答"
status: CLOSED
severity: medium
reproducibility: always
created_at: "2026-10-05T04:07:57+08:00"
updated_at: "2026-10-05T04:38:12+08:00"
impact:
  - remote-tools
links:
  fix_workorder: T0415
  related: [T0414, T0409, T0412, PLAN-037]
---

# BUG-104 — codex 安裝食譜卡在互動提示

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（未發行功能；使用者在分頁按 Enter 可解，但看起來像當掉；回答 `y` 會在安裝分頁啟動 codex TUI） |
| 可重現 | 100%（T0414 WSL 實機：install.sh 從 `/dev/tty` 讀 `Start Codex now? [y/N]`，標記等了約 10 分鐘直到送出 Enter） |
| **狀態** | 🚫 CLOSED（2026-10-05 04:38，WSL 實機 PASS + 使用者裁決） |
| 回報者 | T0414 Worker（回報區「遭遇問題」1） |

## 修復方向

- codex 食譜改 `curl -fsSL https://chatgpt.com/codex/install.sh | CODEX_NON_INTERACTIVE=1 sh`（install.sh usage：`CODEX_NON_INTERACTIVE  Set to 1, true, or yes to skip prompts`；`prompt_yes_no` 直接選 No）
- 副作用：`Uninstall the existing <npm|bun|brew>-managed Codex now?` 也自動選 No（只留 PATH 衝突提示）

## 修復紀錄

- T0415（`1dd0647`）：codex 食譜改 `curl -fsSL https://chatgpt.com/codex/install.sh | CODEX_NON_INTERACTIVE=1 sh`；快照 diff 只有 codex 行（塔台複驗）；1641 tests
- 04:16 塔台以 `scripts/remote-tools-install-check.mjs --tool codex --yes` 在 WSL 重裝（使用者同意）：輸出跑到 `Codex CLI 0.160.0 installed successfully.`，**無** `Start Codex now?`，標記 exit 0（323 ms）

## 關閉原因

- 2026-10-05 04:38 使用者裁決 CLOSED。證據：04:16 WSL 重裝 codex 無互動提示，標記 exit 0
