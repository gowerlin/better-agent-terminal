---
schema_version: 1
schema_kind: workorder
id: T0667
title: "修正：縮圖預覽字串無上限累積（alt screen 輸出無 `\\n` 時），Renderer 成本隨分頁輸出量成長（BUG-136 假設 C）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: BUG-136
priority: P1
sizing: S
created_at: "2026-10-19T11:57:29+0800"
started_at: null
updated_at: "2026-10-19T11:57:29+0800"
completed_at: null
depends_on: [T0666]
related:
  - "BUG-136（OPEN；§ 第三輪）"
  - "T0666 回報區 § 4 原始碼對照、§ 5 實測、§ 建議方向「修正方向草案 S」"
affects_files:
  - src/components/TerminalThumbnail.tsx
  - src/lib/thumbnail-preview.ts
  - src/lib/__tests__/thumbnail-preview.test.ts
  - src/components/__tests__/terminal-thumbnail-preview.test.tsx
  - _ct-workorders/T0667-fix-thumbnail-preview-unbounded-growth.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 範圍只限縮圖預覽字串的累積 / 清理 / 截短。**不得改 `src/components/TerminalPanel.tsx`**（含 isActive effect 的 `clearTextureAtlas()` + `refresh()`，Win11 修正，不得退化）；不改主行程、PTY、xterm 設定、GPU 相關程式碼。"
  - "🔴 縮圖既有行為不得退化：一般 shell 輸出照舊顯示最後 8 行；通知徽章、Worker 徽章（⚠️ / ? / ✓）、usage-limit 徽章、標題與點擊行為不變。"
  - "🔴 可以把純邏輯抽到 `src/lib/thumbnail-preview.ts`（不 import DOM / electron），檔名可依現有慣例調整，回報寫明實際檔名；`affects_files` 以外的檔案不要動，需要動時先問塔台。"
  - "🔴 只 commit 本單相關檔案（`git commit --only` 或明確列檔）；不 push；不改 BUG-136、其他工單、塔台狀態檔。"
  - "🔴 yolo Worker：不問使用者；範圍內猜錯會返工的問題依 ct-exec § Questions For Tower 問塔台（每輪 ≤ 3 題）。"
---

# T0667 — 修正：縮圖預覽字串無上限累積

## 背景

T0666 找到一個和 GPU 無關、會隨分頁輸出量成長的 Renderer 熱點：

- 位置：`src/components/TerminalThumbnail.tsx` 的 `scheduleBatchedPreviewUpdate` / `stripAnsi`。
- 每 150 ms 做一次：把上次的預覽加上新輸出，跑 `stripAnsi`（11 次 `replace`），再 `split('\n').slice(-8)`，然後 `setPreview` 寫進 `.thumbnail-preview`（`white-space: pre`，單行文字節點）。
- 這段由全域 `pty.onOutput` 觸發，**分頁沒有 active 時也會跑**。
- **只有遇到 `\n` 才會截短**：
  - Codex 用 alt screen，以 `CSI row;col H` 定位畫面。在 Linux / macOS PTY 上，輸出幾乎沒有 `\n`（WSL 實測：145 KB 輸出中 `\n` = 0），預覽字串會一直變長。
  - Windows ConPTY 會插入 `\n`，所以 Windows 上看不到這個問題。
- 實測成本：JS 處理 1 MiB 要 5.5 ms；DOM layout（Electron 41.2.1）1 M 字元要 126 ms、4 M 字元要 512 ms。

Claude `onStream` 那條路徑（`combined.split('\n').slice(-8)`）也是同樣的模式，要套用同一個上限。

## 要做的事

1. **輸入端上限**：合併前，待處理的原始輸出（`pending` 與上次的預覽）只保留尾端，例如最後 16 KiB。切點要避開 escape sequence 中間：從尾端視窗內第一個 `\x1b` 或換行之後開始。實作時可以調整成等價的做法。
2. **輸出端上限**：`stripAnsi` 與 `slice(-8)` 之後，每行再限制長度（例如 300 字元，縮圖只顯示約 30 個字），整體上限約 2 KiB。常數放在同一處並寫註解，說明數值是怎麼來的。
3. **Claude `onStream` 路徑**套用同一個函式與上限。
4. **單元測試**（`npm run test:unit` 可跑）：
   - 餵約 10 MB 沒有 `\n` 的串流（含 `CSI H` 定位與 SGR），斷言預覽快取長度 ≤ 上限，且多次 flush 後不再成長。
   - 一般 shell 輸出（多行含 `\n`）→ 仍是最後 8 行，內容與修正前相同。
   - 切點落在 escape sequence 中間時，結果不得殘留半截序列（例如開頭不得是 `[31m` 之類的殘渣）。
   - 若 `TerminalThumbnail` 有元件測試慣例，加一個元件層級的測試：大量無換行輸出後，`.thumbnail-preview` 的 textContent 長度 ≤ 上限。
5. 回報區附修正前後的比較：同一份 10 MB 輸入，預覽長度與單次 flush 時間（Node 量即可）。

## 驗收

- `npm run test:unit` 全綠；回報數字（passed / files），與基線 5597 / 317 比較並說明差異。
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0。
- `npx vite build` 成功。
- `git diff --stat` 只有 `affects_files` 內的檔案。
- 回報區說明：是否完全沒有動到 `TerminalPanel.tsx`；縮圖既有行為（8 行、徽章）有沒有用測試或手動方式確認過。

## 不做

- GPU 崩潰（同一個 CHECK 出現 6 次）另案處理，本單不碰。
- 縮圖改從 xterm buffer 讀取（方案 M）不做。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 驗證結果

### 遭遇問題

### 回報時間
