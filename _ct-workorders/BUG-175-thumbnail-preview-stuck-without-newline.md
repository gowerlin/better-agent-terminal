---
schema_version: 1
schema_kind: bug
id: BUG-175
title: "縮圖預覽停在 agent 啟動畫面不更新（輸出沒有換行時預覽不前進），並露出 `>0q>4m` 殘骸"
status: FIXED
severity: medium
reproducibility: unknown
created_at: "2026-10-30T16:24:40+0800"
updated_at: "2026-11-01T01:35:45+0800"
impact:
  - terminal-thumbnail
links:
  discovered_in: "外部測試者A 回報（2026-10-30 15:54，macOS，附截圖；使用者轉達）"
  github: "#22（2026-10-30 09:54Z，macOS、0.7.1-pre.9，同一現象；2026-11-01 已留言說明 v0.7.2-pre.3 修正並請回報，issue 保持開啟）"
  related: [BUG-136, T0666, T0667, T0714]
---

# BUG-175 — 縮圖預覽不更新（輸出沒有換行）

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（縮圖列看不到 Worker 進度，要切進分頁才知道） |
| 可重現 | 未確認（外部測試者A 的 macOS 上 3 個 Worker 縮圖都卡住） |
| **狀態** | ✅ FIXED（T0714 `afe57761`：預覽依游標換列分行、原地更新丟棄、清畫面重來；`stripAnsi` 認完整 CSI 語法；`v0.7.2-pre.3` 已發佈；待外部測試者A 與 GitHub #22 回報者 macOS 實機驗收，通過後關 #22） |
| 回報者 | 外部測試者A（使用者轉達，附截圖） |

## 現象

- 縮圖列中 `Claude CLI · Worker · T####` 的縮圖都停在 claude 啟動時的畫面：shell 提示列（`%`、`~/Libr/Cl/...` 路徑）後面接 `>0q>4m`，接著是 `Claude Codev2.1.306`，之後不再更新。
- 預期：縮圖跟著分頁輸出持續更新（顯示最新幾行）。
- 同一張截圖中，塔台分頁的縮圖有在更新（顯示對話文字）。

## 使用者判斷（2026-10-30）

- 「縮圖不更新應該是文字沒送換行的問題」：claude 的全螢幕介面以游標移動重繪，輸出不帶換行，縮圖預覽可能以換行切行，所以不會前進。
- 原先推測是 BUG-136 那次查到的 macOS 終端問題，使用者改為上面的判斷。

## 待查

- 縮圖預覽字串的產生方式（BUG-136 / T0667 加了上限的那段）：是否以 `\n` 切行、沒有換行時是否不更新。
- `>0q>4m`：看起來是終端查詢碼（`CSI > 0 q` XTVERSION、`CSI > 4 m` modifyOtherKeys）沒有被濾掉，以文字出現在縮圖；是否與不更新同一個原因。
- 是否只發生在 macOS，Windows 是否也一樣。

## 修正（2026-10-30T16:57:32+0800，T0714 `afe57761`）

- 原因確認與使用者判斷相符：claude 在 alt screen 以游標定位重繪、0 個 `
`，預覽變成一條無限長的行，`capLine` 只留開頭 256 字 → 停在啟動畫面；`>0q>4m` 是舊 CSI regex 不認 `>` 前綴留下的殘骸。
- 修正：`src/lib/thumbnail-preview.ts` 的 `markScreenMoves` / `applyScreenMoves`（換列後看得到的文字前分行、第 2 欄以後 < 8 字視為原地更新丟掉、`CSI 2 J` / alt screen 切換重新開始）；`stripAnsi` 改 ECMA-48 完整 CSI。T0667 上限與 150 ms flush 不變；1 MiB 無換行輸入 < 200 ms。
- Windows 行為變化：ConPTY 以 `CSI row;1 H` 跳過空白列時，原本黏成一行的兩列會分成兩行（較接近實際畫面）。
- 塔台複驗：縮圖兩個測試檔 39 passed、`npm run typecheck` = 0；Worker：`test:unit` 6167 passed、vite build 成功。
- 已知限制（T0714 回報）：跳脫序列被切在兩次 flush 之間時後半段變文字（未改）；macOS 若看到 `38;5;246m` 之類殘骸可另開單。
