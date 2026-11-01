---
schema_version: 1
schema_kind: bug
id: BUG-174
title: "終端 `file:///` 連結：路徑含全形字時底線與可點範圍變短；跨行的連結抓不到；OSC 8 超連結點了沒反應"
status: CLOSED
severity: medium
reproducibility: always（路徑含全形字 / 連結跨行 / OSC 8）
created_at: "2026-10-30T15:06:18+0800"
updated_at: "2026-11-01T11:27:01+0800"
closed_at: "2026-11-01T11:27:01+0800"
closed_reason: "verified"
impact:
  - terminal-links
links:
  discovered_in: "GitHub issue #20（2026-10-30，BAT 0.7.1-pre.9，macOS；Claude Code 在 BAT 分頁印出 file:/// 連結）"
  related: [T0713]
---

# BUG-174 — 終端 `file:///` 連結的範圍、跨行與 OSC 8

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（agent 常印出含中文的檔案路徑，點不開或只有部分可點） |
| 可重現 | 必定 |
| **狀態** | 🚫 CLOSED：2026-11-01 T0728 e2e（與 `v0.7.2-pre.6` 相同的產品程式碼）①–⑤ 全 PASS |
| 回報者 | GitHub issue #20 |

## 現象

1. **全形字**：一行印出 `file:///Users/demo/project/00.待我處理/待決事項_20261030_範例_v1.0.md`，滑過時底線比網址短，少的格數 = 網址裡的全形字數；點底線外的尾端（例 `_v1.0.md`）沒反應。同一行網址前面有全形字時，起點也會偏移。
2. **跨行**：路徑太長換到下一行時，整段不再是連結。
3. **OSC 8**：Claude Code 把 Markdown 連結 `[text](file:///...)` 輸出成 OSC 8 超連結，在 BAT 點了沒反應。

## 根因（塔台對照 `27a5a164` 原始碼確認）

- `src/components/TerminalPanel.tsx:398` 起的 `registerLinkProvider`：用 `line.translateToString()` 的**字串索引**當**格子欄位**（`startX = match.index + 1`、`endX = match.index + url.length`）。全形字佔 2 格、字串只佔 1 個字元，每個全形字讓範圍少 1 格。
- 同一段只讀單一列 `getLine(bufferLineNumber - 1)`，沒有串接 `isWrapped` 的續行。
- `new Terminal({...})`（`TerminalPanel.tsx:350`）沒有設定 `linkHandler`，OSC 8 連結走 xterm 預設行為，在 BAT 裡沒有開啟。
- http(s) 連結由 `@xterm/addon-web-links` 處理，不在此問題範圍（是否也受影響由 T0713 確認）。

## 修正

見 T0713。

## 結案紀錄

- **時間**：2026-11-01T11:27:01+0800（第一百零二 session）
- **驗證依據**：T0728（`947cc9bc`，`e2e/v072-pre6-terminal-links.spec.ts`）在隔離實例的 pwsh 分頁（Windows ConPTY）實測：① 含全形字的路徑首末格皆可點、點擊收到完整路徑；② 222 字元換行路徑兩列都開同一路徑；③ OSC 8 hover 顯示目標、點擊開目標；④ `javascript:` 不開、log 只記 scheme 與長度；⑤ WebLinksAddon https 不變。HEAD 與 tag `v0.7.2-pre.6` 之間 `src/` / `electron/` / `scripts/` 無差異（`package.json` 只差版號），等同交付版程式碼。
- **未另驗**：macOS（回報者平台；修正是 xterm buffer 計算，與平台無關）、「單列再縮窗 reflow 成兩列」（單元測試涵蓋）。
- GitHub #20：2026-10-30 已留言（`v0.7.2-pre.2` 修正說明），issue 是否關閉由使用者決定。
