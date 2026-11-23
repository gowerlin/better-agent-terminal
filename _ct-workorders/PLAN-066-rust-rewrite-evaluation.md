---
schema_version: 1
schema_kind: plan
id: PLAN-066
title: "評估 BAT 改用 Rust 改寫：Tauri、全原生 Rust GUI、局部改寫三條路線的效能、記憶體、維護性比較（含小型 PoC）"
status: IN_PROGRESS
priority: high
created_at: "2026-11-23T15:13:04+0800"
links:
  source: "使用者 2026-11-23 第一百二十七 session `*plan`；D304"
  related: [T0885, PLAN-059, PLAN-065, PLAN-053]
---

# PLAN-066 — 評估 BAT 改用 Rust 改寫

## 元資料

- **標題**：評估 BAT 改用 Rust 改寫（Tauri / 全原生 / 局部改寫）
- **狀態**：IN_PROGRESS
- **優先級**：🔴 High
- **類型**：架構調整
- **建立時間**：2026-11-23 15:13 (UTC+8)

## 動機

近來許多開源專案改用 Rust 重寫。使用者想知道 BAT（Electron 45＋React＋Node 主行程）改用 Rust 有哪些優缺點，特別是效能、記憶體與維護性，再決定要不要做、做哪一部分。

## 範圍（D304，使用者裁決）

- 三條路線都比，以「維持現狀（Electron）」為基準：
  1. **Tauri**：Rust 後端＋保留 React 前端，改用系統 WebView（Windows WebView2、macOS WKWebView、Linux WebKitGTK）。
  2. **全原生 Rust GUI**：整個 app 以 Rust 重寫、含 UI（類 WezTerm / Zed 的 GPU 繪圖）。
  3. **局部改寫**：Electron 不動，把熱點模組（Terminal Server / PTY holder、helper 腳本等）改成 Rust。
- 深度：程式碼盤點＋量測現行 BAT 基線＋**小型 PoC**（最小 Tauri 原型與同規格的最小 Electron 原型，xterm＋PTY，實測記憶體、啟動時間、輸出吞吐）。PoC 在 repo 外，不碰產品程式碼。
- 產出：工單回報區＋可分享的長文報告頁（私人 Artifact）。

## 階段

1. 研究 **T0885**（research，唯讀＋repo 外 PoC）→ 推薦路線與是否值得做。
2. 依研究結論與使用者裁決，再決定是否拆實作 PLAN / 工單，或 DROPPED。

## 狀態

- 2026-11-23 15:13（D304）建立並 **IN_PROGRESS**：使用者 `*plan` 開單並決定範圍（三條路線、加 PoC、🔴 High、工單回報＋長文報告頁）；派研究單 T0885。
- 2026-11-23 15:17（D305）：使用者指示改用 worktree 實驗，T0885 以 `--isolation worktree` 重派（分支 `ct/T0885`）。
- 2026-11-23 15:59（D306）：T0885 DONE。結論：**不建議 Tauri / 全原生改寫**（記憶體大頭是 shell 與 Chromium，換語言動不到；Windows WebView2 也是 Chromium；Claude Agent SDK 沒有 Rust 版；Linux CJK 輸入法退步；規模 XL）。唯一明顯收益在 PTY 持有（Node 每個 PTY 約 14 MB → Rust 約 0.15 MB），可局部改寫 Terminal Server／PTY holder（10 分頁約 −160 MB，規模 M）；建議先研究 Node 端能否省掉每個 PTY 的 Worker。報告頁 https://claude.ai/artifact/LYTj1aGEZKq2bu6SMm6ZqT。待使用者裁決 Q1 / Q5 / 分支處置。
- 2026-11-23 16:20（D307）：使用者接受**不做整體改寫**（Tauri / 全原生）；`ct/T0885` 保留不合併。照建議順序在 **`v0.8.x` 分支**做局部改進（main 不動）：① 研究 Node 端省 Worker（**T0886**）→ Node 端修正，或 ② 設計 → ③ Rust Terminal Server → ④ 驗收。發版：先 `desktop-build.yml` 只 build 給使用者實機試，驗過再發 `v0.8.0-pre.1`。
- 2026-11-23 17:39（D308）：T0886 DONE。Node 端共用一個 conout Worker 後，10 PTY 持有者 178 → 39 MB，行為與現況相同；**不做 Rust Terminal Server**（第 2–4 項不開，T0887 未達標再評估）。開實作單 **T0887**（Windows Terminal Server 共用 conout Worker，分支 `ct/T0887` 從 `v0.8.x` 建立）；direct 模式與主執行緒讀 conout 先不做。
- 2026-11-23 18:10（D309）：T0887 DONE，10 分頁 Terminal Server 164.6 → 38.8 MB（框架 655.5 → 528.3 MB），fast-forward 合進 `v0.8.x`（`a05a9c79`）。待使用者授權 push `v0.8.x` → W6 → `desktop-build.yml` 試用 → `v0.8.0-pre.1`。
