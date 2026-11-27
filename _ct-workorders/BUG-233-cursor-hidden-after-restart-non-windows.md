---
schema_version: 1
schema_kind: bug
id: BUG-233
title: "⏻ 重啟全螢幕程式的分頁後，舊程式隱藏的游標可能仍看不見（`?1049l` 不還原 DECTCEM；WSL / SSH / macOS / Linux 的 shell 不會自己送 `?25h`）"
status: FIXING
severity: low
reproducibility: "推測：非 Windows 主機的 shell（Windows ConPTY 新 shell 通常會送 `?25h`，T0955 實測 Windows 看得到）"
created_at: "2026-11-27T22:38:19+08:00"
updated_at: "2026-11-27T22:38:19+08:00"
impact:
  - terminal-restart
links:
  discovered_in: "T0950 回報區〈後續建議〉1（D440）；T0955 A-23（Windows 游標看得到）"
  related: [T0950, T0955, T0947, T0957, D453]
---
# BUG-233 — ⏻ 後游標可能仍隱藏

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（只影響看不看得到游標，輸入正常） |
| 可重現 | 推測，Windows 不重現（T0955），非 Windows 未實測 |
| **狀態** | ⏳ FIXING（T0957，D453） |
| 回報者 | T0950 Worker 以真 xterm 實測 `?1049l` 不還原隱藏的游標；使用者裁示開單（2026-11-27 22:38） |
| 影響版本 | `v0.8.1-pre.1` |

## 現象（預期 vs 實際）

- 預期：⏻ 重啟後新 shell 的游標看得到。
- 實際（推測）：被 ⏻ 強制結束的全螢幕程式（claude、codex、vim…）若送過 `ESC[?25l`，T0950 在新 PTY 開始時離開 alt screen（`?1049l`）不會還原游標；Windows ConPTY 的新 shell 初始畫面通常會送 `?25h`，WSL / SSH / macOS / Linux 的 bash 不送 → 游標維持隱藏。

## 修正紀錄

- 2026-11-27 22:38 開單 → FIXING（T0957，D453）
