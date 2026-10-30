---
schema_version: 1
schema_kind: workorder
id: T0714
title: "BUG-175：縮圖預覽在輸出沒有換行時不更新、露出 `>0q>4m` 殘骸"
type: implementation
status: DONE
repo: better-agent-terminal
project: ""
priority: P2
sizing: M
created_at: "2026-10-30T16:25:33+0800"
updated_at: "2026-10-30T16:56:52+0800"
started_at: "2026-10-30T16:26:33+0800"
completed_at: "2026-10-30T16:56:52+0800"
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

DONE（Worker 範圍全部完成；macOS 實機驗收依工單由塔台發版後請外部測試者A 進行）

### 產出摘要

**原因確認（記憶覆寫 1）— 與使用者判斷相符**

- 實錄：WSL Ubuntu 24.04 以 `script` 錄 claude 2.1.287 在 Linux PTY 的原始輸出（暫存設定目錄 + 假 API key + 不存在的 base URL，不送任何真實請求；錄完已刪除，未存成 fixture）。REPL 進 alt screen（`?1049h`）後 **0 個 `\n`**，以 `\x1b[H` + `\r\x1b[nB`（相對下移）+ `\x1b[row;colH` 重繪；計時器 / 重試倒數只改寫一兩個字。啟動送 `\x1b[>0q`。
- (a) 以修正前的 `outputPreview` 餵這段實錄：每次 flush 都是同一個字串（`Claude Codev2.1.287Opus 5.5 · …` 開頭 256 字）。機制：沒有 `\n` → 一條無限長的行 → `capLine` 留**開頭** 256 字 → 上一次預覽 + 新輸出永遠以舊的開頭為準，停在啟動畫面。測試 `cause 1` 以修正前實作重現（與 BUG-175 截圖同為 `>0q>4mClaude Codev2.1.306`）。
- (b) 舊 CSI regex `[0-9;?]*[A-Za-z]` 不認 `>` / `<` / `=` 前綴、中間位元組與非字母結尾，剩下的 `\x1b[` 被 `\x1b.` 去掉，留下 `>0q`、`>4m`、` q`、`!p`、`5@` 等。測試 `cause 2` 列出 11 種。
- 兩個現象不同原因、同一段輸出。

**修正（`src/lib/thumbnail-preview.ts`，記憶覆寫 2）**

- `stripAnsi`：CSI 改為 ECMA-48 完整語法 `/\x1b\[[0-?]*[ -/]*[@-~]/g`。
- 新增 `markScreenMoves`（stripAnsi 前，一次 regex 掃描）+ `applyScreenMoves`（stripAnsi 後）。追蹤列 / 欄（每次 flush 從未知開始，不跨 flush 保留），留下三種 noncharacter 標記：
  - `SOFT_BREAK`：游標換到另一列（CUP / HVP / VPA / CUU / CUD / CNL / CPL / IND / NEL / RI）後第一段**看得到**的文字前開新行；換列後沒寫字、只寫空白 / 框線、或接著是 `\n` → 不加行。
  - `UPDATE_IN_PLACE`：同上但從第 2 欄以後、看得到的字 < `IN_PLACE_UPDATE_MAX_CHARS`（8）→ 視為原地更新丟掉（只用換行的作法，claude 的倒數 / 計時器每跳一下就多一行，實測預覽會變成一列數字）。
  - `SCREEN_RESET`：`CSI 2 J`、`CSI ? 1049 / 1047 / 47 h|l` → 預覽重新開始。
  - 例外：列號未知時欄 > 1 的 `CSI row;col H` 不換行（ConPTY 重畫 PSReadLine 提示列 `PS C:\…>\x1b[1C\x1b[30;19H> for …` 就是這樣；不加這條，Windows 逐字輸入時提示列會被拆成多行）。
- 沒有引進終端模擬：不量欄寬、不改寫、不留狀態、沒有 headless xterm。`TerminalThumbnail.tsx` 未改、`textPreview` 未改。

**效能（記憶覆寫 3）**：三個上限與 150 ms flush 未改（`limits (T0667)` 測試仍綠）。新處理只跑在 tail 後 ≤ 16 Ki 的輸入上，regex 無巢狀量詞。新增測試：1 MiB 無 `\n`（claude 形態 + 計時器 + codex 形態畫面）直接 `outputPreview` < 200 ms、以 4 KiB chunk 經 `appendPreviewInput` 每 8 chunk flush 全程 < 1000 ms；1 MiB 不完整 `\x1b[` < 200 ms。

**行為不變（記憶覆寫 4）與 ground truth 對照**

以 node-pty（ConPTY）實錄 pwsh / cmd，逐 chunk flush 比較修正前後，並以 xterm 實例算出實際畫面為基準（預覽每行出現在畫面某列的比例 / 畫面最後一列出現在預覽的比例）：

| 錄製 | flush | 與修正前不同 | 修正前 | 修正後 |
|---|---|---|---|---|
| pwsh 指令一次寫入（dir、40 行、Write-Progress、cls） | 3638 | **0** | 67.9% / 68.1% | 67.9% / 68.1% |
| pwsh 逐字輸入（PSReadLine 預測） | 373 | 172 | 54.1% / 21.4% | 56.8% / 21.4% |
| cmd 逐字輸入 | 194 | 192 | 38.2% / 100% | 100% / 100% |
| claude 2.1.287 REPL（Linux PTY，依畫面更新切塊） | 56 | — | **0% / 3.6%** | **51.2% / 87.5%** |

- ConPTY 的差異逐行分類過：修正後才有的行**全部**是 ConPTY 以 `CSI row;1 H` 跳過空白列、修正前被黏成一行的畫面列（例：`… 著作權所有，並保留一切權利。C:\…>` → 兩行；`目錄:…TempMode …` → 兩行）。沒有任何一處變差。這是 Windows 上可見的行為變化，寫進 docs「行為變化」與測試 `ConPTY skipping a blank row`。
- 只用 `\n` 換列的輸出：T0667 既有 5 個 shell 樣本、200 chunk 分批測試全數不變；新增 4 個 ConPTY 樣本（含 PSReadLine 重畫、`\x1b[16C` 欄移動）及 7 字元切塊逐 flush 對照與修正前相同。
- 既有測試調整：T0667 兩個「~10 MB alt screen 不再成長」測試原本斷言「後續 flush 長度都相同」，那是因為預覽卡在單一條 256 字行；改為斷言每次 flush 都是最新畫面的最後 8 列（`row 33`–`row 40`）且 ≤ `PREVIEW_MAX_CHARS`。

**文件（記憶覆寫 文件）**：屬改功能前必知的不變式 → CLAUDE.md 新增「終端縮圖預覽（T0667 / T0714，BUG-175）」節（7 行，放在「終端連結」節之後）、新增 `docs/agent-guide/thumbnail-preview.md`（規則、實錄、對照數據、行為變化、已知限制、驗證清單）、`docs/agent-guide/README.md` 索引加一列。README / CHANGELOG 未改。

**修改檔案**

- `src/lib/thumbnail-preview.ts`
- `src/lib/__tests__/thumbnail-preview.test.ts`（+17 測試：BUG-175 兩原因、各標記規則、claude session、codex 每個切點、1 MiB 耗時、ConPTY 對照）
- `src/components/__tests__/terminal-thumbnail-preview.test.tsx`（+1：經 150 ms flush 的 claude 形態輸出；調整 1 個 T0667 斷言）
- `CLAUDE.md`、`docs/agent-guide/thumbnail-preview.md`（新）、`docs/agent-guide/README.md`

**驗證**

- `npm run test:unit`：344 files / 6167 passed、3 skipped、0 failed — PASS
- `npm run typecheck`：exit 0（0 errors）— PASS
- `npx vite build`：exit 0 — PASS
- macOS 實機：本單不需要（塔台發版後請外部測試者A 驗收）

**Commit**：`afe57761` fix(thumbnail): follow cursor-move redraws and strip every CSI in the preview (T0714, BUG-175)。未 push、未觸發 workflow、未建 tag。

**去識別化**：測試 fixture 與文件只用 `demo@mac ~/proj`、`/Users/demo/proj`、`C:\Users\demo`；diff 掃描無真實家目錄 / 主機名 / 帳號。實錄檔只留在 session scratchpad，WSL 端暫存已刪。

**已知限制 / 後續建議（給塔台）**

- 原地更新判斷只看起始欄與長度：從第 2 欄以後寫、少於 8 字的新內容會被丟；≥ 8 字的原地更新會變成一行。
- 跨 flush 不保留游標，flush 開頭的 `CUP`（列未知、欄 > 1）會接在上一行後面。
- 跳脫序列被切在兩次 flush 之間時後半段變成文字（T0714 前即如此，未改）：ConPTY 實錄 0 次；Linux PTY 未量到。若 macOS 驗收看到 `38;5;246m` 之類殘骸，可另開單在 `TerminalThumbnail` flush 時保留結尾不完整的序列到下一次 flush。
- 預覽是「最近寫出的列」不是「畫面最下面 8 列」（全螢幕 TUI 最下面是輸入框 / 狀態列）。
- 未實錄 codex 0.163 與 claude 2.1.306 本身（WSL 的 claude 是 2.1.287、未登入；codex 用合成畫面測）。

### 互動紀錄

無（yolo，未向塔台提問）。

### Renew 歷程

無。

### 遭遇問題

- 第一版只把換列當換行：claude 實錄的預覽變成一列列倒數數字（實際畫面沒有那些行），所以加了「原地更新」規則；第一版也讓 Windows PSReadLine 逐字輸入時提示列被拆成多行，所以加了「列號未知、欄 > 1 不換行」。兩者都以實錄與 xterm 實際畫面驗證後才定案。
- 暫時在 repo 根目錄放過驗證用的 vitest 設定與 `.t0714tmp/`（vitest 不能從 C: 的 scratchpad 跨磁碟載入測試），驗證後已刪除，未進 commit；`git status` 乾淨（除本工單）。

### 落點檢查

- 結果：PASS
- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 REPO_ROOT 下 → PASS
- C-3：`src/lib/thumbnail-preview.ts` 等皆存在 → PASS
- C-2：工單無 `branch` 欄位；目前 `main`
- `CT_HOME` 未設定（非 worktree）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE` = `yolo`、`CT_INTERACTIVE` = `0`

### 回報時間

2026-10-30T16:56:08+0800
