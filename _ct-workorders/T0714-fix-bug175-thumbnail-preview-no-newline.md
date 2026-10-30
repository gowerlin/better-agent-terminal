---
schema_version: 1
schema_kind: workorder
id: T0714
title: "BUG-175：縮圖預覽在輸出沒有換行時不更新、露出 `>0q>4m` 殘骸"
type: implementation
status: PENDING
repo: better-agent-terminal
project: ""
priority: P2
sizing: M
created_at: "2026-10-30T16:25:33+0800"
updated_at: "2026-10-30T16:25:33+0800"
depends_on: []
related:
  - "BUG-175（現象、外部測試者A 截圖描述、使用者判斷）"
  - "BUG-136 / T0666 / T0667（縮圖預覽上限；T0666 實測：Linux / macOS PTY 的全螢幕 TUI 幾乎不送 `\\n`，Windows ConPTY 會插 `\\n`）"
affects_files:
  - src/lib/thumbnail-preview.ts
  - src/lib/__tests__/thumbnail-preview.test.ts
  - "src/components/TerminalThumbnail.tsx（只在需要時）"
  - "src/components/__tests__/terminal-thumbnail-preview.test.tsx（只在需要時）"
  - "CLAUDE.md、docs/agent-guide/ 下的縮圖預覽文件與 docs/agent-guide/README.md（見文件條）"
  - _ct-workorders/T0714-fix-bug175-thumbnail-preview-no-newline.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 1 先確認原因再修：在 `src/lib/thumbnail-preview.ts` 以測試重現：(a) 只用游標定位（`CSI row;col H`、`CSI n B` / `E` / `d` 等）重繪、不送 `\\n` 的輸出，預覽是否停在最後一個 `\\n` 之前的內容；(b) `CSI > 0 q`（XTVERSION）、`CSI > 4 ; n m`（modifyOtherKeys）等帶 `>` / `<` / `=` 私有前綴、或帶中間字元的 CSI，`stripAnsi` 是否沒濾乾淨而留下 `>0q>4m` 之類文字。重現樣本參考 claude CLI 在 macOS / Linux PTY 的實際輸出形態（可用 WSL 或 node-pty 實錄一小段，存成測試 fixture 時去識別化）。原因與使用者判斷（沒有換行）不符 → 不要硬修，回報 PARTIAL 附證據。"
  - "🔴 2 修正方向（實作方式由 Worker 決定，寫進回報區）：預覽要反映畫面最新內容。可行作法例如把游標換列的 CSI（`H` / `f` 換到不同列、`B`、`E`、`d` 等）在預覽層視為換行，或以清畫面 / alt screen 切換（`CSI 2 J`、`CSI ? 1049 h/l`）作為重新開始的分界；不得引進完整終端模擬（例如每個分頁多一個 headless xterm），除非量測證明成本與現行同級並在回報區附數據。`stripAnsi` 補齊 CSI 的完整語法（參數位元組 0x30–0x3F、中間位元組 0x20–0x2F、終止位元組 0x40–0x7E）。"
  - "🔴 3 效能不回歸（BUG-136）：T0667 的三個上限（`PREVIEW_INPUT_TAIL_CHARS` 16 Ki、`PREVIEW_LINES` 8、`PREVIEW_LINE_MAX_CHARS` 256）與 150 ms 批次 flush 不改；新增處理對輸入長度維持線性，測試加一項 1 MiB 無換行輸入的耗時上限（比照既有測試的作法）。"
  - "🔴 4 行為不變：有正常 `\\n` 的輸出（一般 shell、Windows ConPTY）預覽結果與修正前相同（以既有測試與新增對照測試證明）；Claude / Codex 面板訊息走的 `textPreview` 不改行為（除非原因 1 證明它也受影響）。不碰 PTY 輸出、xterm、`onData` 路徑。"
  - "🔴 驗證：`npm run test:unit` 全綠、`npm run typecheck` = 0、`npx vite build` 成功。macOS 實機由塔台發版後請外部測試者A 驗收，本單不需要。"
  - "🔴 文件：CLAUDE.md 目前沒有縮圖預覽一節；若新增規則（例如「預覽層把游標換列視為換行」）屬改這個功能前一定要知道的不變式，新增一節（3–12 行，依 CLAUDE.md 撰寫規則）並把細節寫進 `docs/agent-guide/thumbnail-preview.md`、加進 docs 索引；否則只在 `thumbnail-preview.ts` 檔頭註解補說明，回報區寫明不改 CLAUDE.md 的理由。README / CHANGELOG 不改（發版時塔台處理）。"
  - "🔴 Git：`git commit --only <檔案>`，只 commit 本單 `affects_files`；不 push、不觸發 workflow、不建 tag。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。工單完成狀態寫 `DONE`；BUG-175 與 `_bug-tracker.md` 由塔台更新。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，測試與文件路徑用 `/Users/demo`、`C:\\Users\\demo`，fixture 不得含真實家目錄或專案名稱。yolo：不得問使用者，判讀問題問塔台（每輪最多 3 題）。"
---

# T0714 — BUG-175：縮圖預覽在輸出沒有換行時不更新

## 背景

外部測試者A 在 macOS 上看到縮圖列的 `Claude CLI · Worker · T####` 縮圖都停在 claude 啟動畫面（shell 提示列、`>0q>4m`、`Claude Codev2.1.306`），之後不再更新；塔台分頁的縮圖正常。使用者判斷是「文字沒送換行」：claude 的全螢幕介面以游標定位重繪，macOS / Linux PTY 幾乎不送 `\n`（T0666 已實測 codex 同樣如此），而縮圖預覽以 `\n` 切行取最後 8 行，所以停在最後一個換行之前。`>0q>4m` 看起來是帶 `>` 前綴的 CSI 沒被 `stripAnsi` 濾掉（現行 CSI regex 只認 `[0-9;?]` 參數）。

## 驗收

- [ ] 測試重現兩個現象（無換行不更新、`>` 前綴 CSI 殘骸），確認原因
- [ ] 預覽在只靠游標定位重繪的輸出下顯示最新內容
- [ ] `stripAnsi` 濾掉完整語法的 CSI，不留殘骸
- [ ] 有 `\n` 的一般輸出結果與修正前相同；T0667 上限不變；1 MiB 無換行輸入耗時有上限測試
- [ ] 文件依「文件」條處理
- [ ] `npm run test:unit` 全綠；`npm run typecheck` = 0；`npx vite build` 成功

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

### 產出摘要

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 落點檢查

### 回報時間
