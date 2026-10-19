---
schema_version: 1
schema_kind: workorder
id: T0667
title: "修正：縮圖預覽字串無上限累積（alt screen 輸出無 `\\n` 時），Renderer 成本隨分頁輸出量成長（BUG-136 假設 C）"
type: implementation
status: DONE
repo: better-agent-terminal
project: BUG-136
priority: P1
sizing: S
created_at: "2026-10-19T11:57:29+0800"
started_at: "2026-10-19T11:58:58+08:00"
updated_at: "2026-10-19T12:05:27+08:00"
completed_at: "2026-10-19T12:05:27+08:00"
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

**DONE** — 縮圖預覽在輸入端與輸出端都有上限；驗收項目全部通過。

**落點檢查（Landing Zone Check）：PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：`src/components/TerminalThumbnail.tsx` 存在，其餘新檔的上層目錄存在 → PASS（僅供參考）
- C-2：工單沒有 `branch` 欄位；目前分支 `main`
- 沒有設定 `CT_HOME`（不是 worktree 派工）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

### 產出摘要

**Commit**：`a9f0ad5a` fix(thumbnail): cap the preview text so output without \n cannot grow it (T0667, BUG-136)

| 檔案 | 變更 |
|---|---|
| `src/lib/thumbnail-preview.ts`（新增，檔名照工單） | 純邏輯，不 import DOM / electron。常數 `PREVIEW_LINES` = 8、`PREVIEW_LINE_MAX_CHARS` = 256、`PREVIEW_MAX_CHARS` = 8 × 256 + 7 = **2055**、`PREVIEW_INPUT_TAIL_CHARS` = 16 Ki；檔頭註解寫明數值怎麼來的。函式：`tailPreviewInput`（切尾端）、`appendPreviewInput`（累積）、`stripAnsi`（從元件原封不動搬過來）、`outputPreview`（PTY）、`textPreview`（Claude） |
| `src/components/TerminalThumbnail.tsx` | 移除元件內的 `stripAnsi`；`scheduleBatchedPreviewUpdate` 改用 `appendPreviewInput`，flush 改用 `outputPreview`；Claude `onStream` 與 `onMessage` 改用 `textPreview`。其餘（快取、訂閱、徽章、標題、點擊、右鍵選單）沒動 |
| `src/lib/__tests__/thumbnail-preview.test.ts`（新增） | 17 個測試 |
| `src/components/__tests__/terminal-thumbnail-preview.test.tsx`（新增） | 4 個元件層級測試 |

**實作細節**
1. **輸入端**：`tailPreviewInput(raw)` 只保留最後 16 Ki；切點從尾端視窗內第一個 `\x1b`（從 ESC 開始）或第一個 `\n`（從換行之後開始）中較前面的那個開始。兩者都沒有時保留純切點，並去掉開頭落單的 low surrogate。累積時 `appendPreviewInput` 在長度超過 2 × 16 Ki 才切，所以很多小 chunk 時每個字元的攤銷成本是 O(1)，不會每個 chunk 都掃一次 16 Ki；flush 時 `outputPreview` 會再切到剛好 16 Ki。
2. **輸出端**：`stripAnsi` → `split('\n').slice(-8)` → 每行保留**前** 256 字元（縮圖靠左顯示、`overflow: hidden`，修正前看到的也是行首；切點避開半個 surrogate pair）。8 行 × 256 字元，總長自然 ≤ 2055（約 2 KiB），所以沒有另外設總長上限。
3. **Claude**：`onStream`（前次預覽 + 串流文字）與 `onMessage`（`msg.content`）都經 `textPreview`，上限相同；和修正前一樣不做 ANSI 清理，避免方框字元等被拿掉。`onMessage` 不在工單第 3 點的明列範圍內，但它是同一個檔案、同樣的 `split('\n').slice(-8)` 寫法，單一訊息過長時也會產生超長預覽，所以一併套用。

**修正前後比較（Node 24，同一份輸入）**

輸入：約 10 MB 的 codex 式 alt screen 重繪（每格 `CSI row;1H` + SGR 256 色 + 文字 + `CSI 0m` + `CSI K`，總長 10,486,918 字元，`\n` = 0）；每 32 個 frame（一個 frame 是一個 chunk）flush 一次，共 120 次 flush，模擬元件的 150 ms 批次。

| | 預覽長度（最後） | 單次 flush（最後一次） | 單次 flush（最大） | 120 次 flush 合計 |
|---|---|---|---|---|
| 修正前（T0666 的程式碼） | **6,777,519** 字元 | 9.4–9.7 ms | 10.1–10.5 ms | 613–618 ms |
| 修正後（T0667） | **256** 字元 | 0.01 ms | 0.06–0.24 ms | 3 ms |

一次 flush 整份 10 MB：修正前 6,777,519 字元 / 11.7–12.3 ms；修正後 256 字元 / 0.04–0.05 ms。（兩次執行的範圍。）

以上只量 JS。修正前的 677 萬字元還要寫進 `white-space: pre` 的文字節點：依 T0666 § 5 的 DOM layout 實測（1 M 字元 126 ms、4 M 字元 512 ms）推估每次要數百毫秒以上（推論，本單沒有在 Electron 重量）；修正後最多 2055 字元。

### 驗證結果

| 項目 | 結果 | 證據 |
|---|---|---|
| `npm run test:unit` | **PASS** | 319 files passed、5618 passed / 3 skipped（5621）。基線 317 / 5597 → +2 個檔案、+21 個測試，正好是本單新增的 2 個測試檔（17 + 4 個測試）；沒有其他測試數變動 |
| `npm run typecheck` | **PASS**（0） | exit 0 |
| `npm run typecheck:electron` | **PASS**（0） | exit 0 |
| `npx vite build` | **PASS** | exit 0，4 段皆 `✓ built` |
| `git diff --stat`（commit `a9f0ad5a`） | **PASS** | 只有 4 個產品檔，加上本工單檔，都在 `affects_files` 內 |
| 新測試在舊程式上會失敗 | **PASS** | 暫時把 `TerminalThumbnail.tsx` 換回 HEAD 版本跑元件測試：2 個上限測試（10 MB PTY、Claude 串流）失敗，2 個既有行為測試通過；之後換回新版本 |

**工單第 4 點的測試對照**
- 約 10 MB 無 `\n`（含 `CSI H` 與 SGR）：lib 測試與元件測試各一個，斷言每次 flush 的長度 ≤ `PREVIEW_MAX_CHARS`、前幾次之後長度不再變動、不含 `\x1b`。
- 一般 shell 輸出：5 個樣本（PowerShell 提示字元、`ls`、30 行 SGR + OSC 標題、`\r` 進度列 + DEC private mode、Powerline / 方框 / 點字字元）加上一個 200 chunk × 每 7 個 flush 一次的情境，都和保留在測試內的修正前演算法（`legacyOutputPreview`）結果**完全相同**；元件測試斷言 `.thumbnail-preview` 是最後 8 行。
- 切點落在 escape sequence 中間：構造一個尾端視窗剛好從 `\x1b[31m` 的 `1m` 開始的輸入，斷言從下一個 ESC 開始、預覽為 `tail`；另外在 60 種偏移下斷言預覽開頭不是 `[31m` / `31m` 之類的殘渣。
- 元件層級：`.thumbnail-preview` 的 textContent 長度 ≤ 上限（PTY 與 Claude 串流各一個）。

**是否動到 `TerminalPanel.tsx`**：完全沒有（`git diff HEAD~1 -- src/components/TerminalPanel.tsx` 為空）。主行程、PTY、xterm 設定、GPU 相關程式碼也都沒動。

**縮圖既有行為**
- 8 行：上述 lib 測試與元件測試確認（和修正前結果相同）。
- 沒有輸出時的 `$ _` 與點擊 → `onClick`：元件測試確認。
- 徽章（通知 ●、Worker ⚠️ / ? / ✓、usage-limit）與標題：本單沒有改到這些程式碼；既有的 `worker-tab-attention` / `worker-tab-marker` / `worker-tab-title` / `open-claude-as-tower-menu` / `remote-codex-degrade` 測試（都會 render 縮圖）在完整 unit 執行中全部通過。
- 沒有做實機手動確認（本單沒有要求 runtime smoke）。

### 遭遇問題

- 沒有阻礙。沒有問塔台的問題。
- 行為差異（刻意的，供塔台判斷）：
  1. 超過 256 字元的行只保留行首 256 字元。縮圖只看得到約 30 字，所以看不出差別。
  2. 沒有 `\n` 的長行（codex），預覽會停在那一行的行首，直到某次 flush 收到超過 16 Ki 的新輸出，輸入切點越過舊內容時才更新。修正前則是永遠停在這個分頁最早的輸出，所以這點沒有變差。
  3. Claude `onMessage` 也套用了上限（理由見「實作細節」第 3 點）。
- 修正前後的 Node 量測腳本放在 Worker 的 scratchpad，沒有進 repo（`C:\Users\Gower\AppData\Local\Temp\claude\D--ForgejoGit--Gower-Labs-BMad-Guide-better-agent-terminal-better-agent-terminal\dded06f5-f396-459f-bd92-0403e5e1c752\scratchpad\bench.mjs`）。
- 後續建議：BUG-136 第三輪若要確認 Linux / macOS 實機效果，可以在 WSL / SSH 遠端分頁開 codex，比較修正前後 Renderer 的 CPU 用量（本單沒做）。

### 互動紀錄

無（yolo；沒有向塔台提問）。

### 回報時間

2026-10-19T12:04:39+08:00
