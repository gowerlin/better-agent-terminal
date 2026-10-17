---
schema_version: 1
schema_kind: workorder
id: T0482
title: "BUG-119 修復 C：文件改回單一 userData 目錄 + 搬移 / 降版說明（README、CLAUDE.md、docs/plan-027）"
type: implementation
status: DONE
repo: better-agent-terminal
project: BUG-119
priority: P2
sizing: S
created_at: "2026-10-13T22:32:56+08:00"
started_at: "2026-10-13T22:45:53+08:00"
updated_at: "2026-10-13T22:48:59+08:00"
completed_at: "2026-10-13T22:48:59+08:00"
target_version: v0.6.0-pre.4
depends_on:
  - T0480
  - T0481
related:
  - "D138；T0479 回報區第 4 節（降版 / 回滾表）、第 5 節表格 C 列"
  - "T0480 / T0481 回報區（以實作結果為準，不以 T0479 規格為準）"
affects_files:
  - README.md
  - CLAUDE.md
  - docs/plan-027-cross-platform-verification.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只改文件；路徑與行為以 T0480 / T0481 實作與回報區為準，有出入以程式碼為準並在回報區列出"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持各檔現況"
---

# T0482 — BUG-119 文件同步

1. README「設定」/「除錯日誌」（T0478 寫成兩目錄）：改為單一 `<appData>/BetterAgentTerminal[-runtime-<N>]/`，`Logs/`、`Crashes/` 在其下；說明升版自動搬移哪些（`Local State`、`snippets.json`、`message-archives`、runtime 目錄改名）、舊 `better-agent-terminal/` 保留不自動清理（舊日誌在那裡）、降版行為（T0479 第 4 節降版表的使用者可見部分）、不要同時執行新舊兩版
2. CLAUDE.md「Logging」：改回單一目錄；「日誌與設定不在同一目錄」段改寫為 BUG-119 已修 + bootstrap 必須是 `main.ts` 第一個 import、不得在 import 期呼叫 `getPath('userData')` 的開發規則；helper env 解析順序（T0481）
3. `docs/plan-027-cross-platform-verification.md:50`、`:92` 過期 `debug.log` 路徑
4. 全 repo grep `better-agent-terminal/`（userData 語境）、`debug.log`、`-runtime-` 確認無殘留過期描述（`_ct-workorders/` 除外）

## 驗收條件

- [x] 文件路徑與 T0480 / T0481 實作一致（回報區附程式碼依據 檔案:行）
- [x] 回報區附 `git diff --stat`

## Sub-session 執行指示

1. 讀本工單 + D138 + T0479 第 4 節 + T0480 / T0481 回報區 + 上列檔案
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 填回報區 → `DONE`；commit；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果摘要

**DONE**。README、CLAUDE.md、`docs/plan-027-cross-platform-verification.md` 已改為單一 userData 目錄 `<appData>/BetterAgentTerminal[-runtime-<N>]/`，並補上升版搬移、舊目錄保留、降版行為、不要同時執行新舊版的說明。全 repo grep 沒有剩下過期的描述。只改文件，沒有動程式碼。

### Landing Zone Check

- 結果：**PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，PASS（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 `REPO_ROOT/_ct-workorders/`，PASS
- C-3（C-0 已 PASS，僅記錄）：`README.md`、`CLAUDE.md`、`docs/plan-027-cross-platform-verification.md` 都存在，判定 present
- C-2：沒有 `branch` 欄位；實際在 `main` 上執行
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只作紀錄）
- 模式：`CT_MODE=yolo`、`CT_INTERACTIVE=0`（沒有互動 Q/A）
- 工單起始 `status` 為 `TODO`（不是 `PENDING`），視同未開始，改成 `IN_PROGRESS`

### 改動內容

**1. `README.md`「設定」/「除錯日誌」**

- 原本 T0478 的兩欄表格（資料目錄 / 日誌目錄）改為單一「資料目錄」表格，`Logs/`、`Crashes/`、`snippets.json` 都歸在這個目錄下
- 多實例：改為 `BetterAgentTerminal-runtime-<N>/`，所有資料都在裡面（含 snippets）
- 新增「從舊版升級（v0.6.0-pre.3 以前）」小節：
  - 搬移表：`Local State` 缺少時才複製；`snippets.json` 複製或合併，合併前先備份 `.pre-merge-<時間>.bak`；`message-archives/*.jsonl` 沒有同名檔時移動；`Logs/`、`Crashes/` 不搬；runtime 目錄整個改名，terminal server 仍在執行或改名失敗時這次沿用舊目錄
  - 只執行一次（marker `.userdata-migration.json`）
  - 舊 `better-agent-terminal/` 保留，不會自動清理，舊日誌在那裡
  - 降版：預設實例設定與權杖可沿用；新版的 snippets 舊版看不到；降版期間修改的 snippets 再升級時不會重新搬移。runtime 實例降版後會得到空目錄，需手動改名回去
  - ⚠️ 不要同時執行新舊兩個版本，因為鎖檔在不同目錄，會同時寫 `settings.json`
- 「除錯日誌」：「日誌目錄下」改為「資料目錄下」

**2. `CLAUDE.md`「Logging」**

- `Log file location`：改為 `<appData>/BetterAgentTerminal/Logs/...`。legacy `debug.log` 的說明改為「userData 根部」，因為 `moveLegacyDebugLog` 只看目前 userData 的根部，不再碰舊小寫目錄
- 「注意日誌與設定不在同一目錄」整段改寫為「單一 userData 目錄（BUG-119，T0480 起）」，內容包括：
  - 原因
  - bootstrap 的執行順序
  - crashDumps 之後的自檢
  - 🔴 開發規則：① bootstrap 必須是 `main.ts` 的第一個 import，且 bootstrap 只 import `electron` / `path` / `./userdata-migration`；② 任何模組不得在 import 期呼叫 `getPath('userData')`，範本是 `snippet-db.ts` 的 lazy getter
  - 守門測試
  - 舊目錄的處理規則
- 新增「Helper scripts 的 userData（T0481）」條目：
  - 三條本機 PTY 路徑會注入 `BAT_USER_DATA`
  - headless 不注入
  - helper 解析順序：override → `BAT_USER_DATA`（只接受絕對路徑）→ 舊的 `BetterAgentTerminal` + `BAT_RUNTIME` 推測

**3. `docs/plan-027-cross-platform-verification.md`**

- `:50`：mac 的 `~/Library/Application Support/better-agent-terminal/debug.log` 改為 `.../BetterAgentTerminal/Logs/debug-<YYYYMMDD-HHMMSS>.log`
- `:92`：Linux 的 `~/.config/better-agent-terminal/debug.log` 改為 `~/.config/BetterAgentTerminal/Logs/debug-<YYYYMMDD-HHMMSS>.log`

### 程式碼依據（文件 ↔ 實作）

| 文件敘述 | 依據 |
|---|---|
| 目標目錄 `BetterAgentTerminal[-runtime-<N>]`、舊目錄 `better-agent-terminal[-runtime-<N>]` | `electron/userdata-migration.ts:14-15`（`LEGACY_DIR_NAME` / `TARGET_DIR_NAME`）、`:72-76`、`:69`（`-runtime-<id>`） |
| bootstrap 順序：setName → runtime id → migration → setPath；只 import electron / path / migration | `electron/app-paths-bootstrap.ts:13-23`、`:25`、`:29`、`:31-49` |
| bootstrap 是 `main.ts` 的第一個 import | `electron/main.ts:1-3` |
| crashDumps 之後的 userData 自檢 | `electron/main.ts:1403-1413` |
| migration report 以 `[userdata-migration]` 寫進日誌 | `electron/main.ts:1396` |
| marker `.userdata-migration.json`，只執行一次 | `electron/userdata-migration.ts:16`、`:226-229` |
| `Local State` 缺少時才複製（`COPYFILE_EXCL`） | `electron/userdata-migration.ts:108-114` |
| snippets 複製或合併，合併前寫 `.pre-merge-<stamp>.bak` | `electron/userdata-migration.ts:127-135`、`:154` |
| `message-archives` 單檔移動 | `electron/userdata-migration.ts:166-170` |
| `Logs` / `Crashes` 不搬 | `electron/userdata-migration.ts:197`、`:240-241` |
| runtime 實例：兩邊都存在時不合併；server 執行中或 rename 失敗時沿用舊目錄；不帶入預設實例的 snippets | `electron/userdata-migration.ts:246-288` |
| snippets lazy 取得 userData | `electron/snippet-db.ts:48-50` |
| 日誌位置 `<userData>/Logs`，保留 10 個；legacy `debug.log` 只看 userData 根部 | `electron/logger.ts:27-28`、`:82-91`、`:155-171` |
| 本機 PTY 注入 `BAT_USER_DATA`（三條路徑），只在有 `helperDir` 時注入 | `electron/pty-manager.ts:229-236`、`:691-693`、`:757-758`、`:839-840` |
| helper 解析順序，`BAT_USER_DATA` 須為絕對路徑 | `scripts/_bat-cert.mjs:24-31`、`:53`、`:69`；`scripts/_bat-logger.mjs:9-21` |
| 降版、同時執行、mac / Linux Keychain 殘餘風險 | T0479 回報區第 4 節降版表；D138 殘餘風險（文件陳述，非程式碼） |

文件與實作沒有不一致。補充兩點：

- README 對 `Local State` 的描述是「Windows 上解開遠端存取權杖的金鑰存在這裡；macOS / Linux 的金鑰在 Keychain / libsecret，升版後權杖不變尚待實機確認」。這是依 D138 殘餘風險所寫，不是程式碼行為
- T0480 新增了 runtime id 白名單：id 不合法時不搬移任何東西。這屬於邊緣情況，README 沒有寫

### 驗證

| 項目 | 結果 | 證據 |
|---|---|---|
| 文件路徑與 T0480 / T0481 實作一致 | ✅ PASS | 見上表 |
| 全 repo grep `better-agent-terminal/`、`better-agent-terminal\`、`debug.log`、`-runtime-`（排除 `_ct-workorders/`、`package-lock.json`、GitHub URL） | ✅ PASS | 剩下的命中都屬於以下其中一種：(a) 本單新寫的「舊版目錄」說明；(b) `README.md:165` 的原始碼樹狀圖（repo 目錄名，不是 userData）；(c) `claude-runtime-router` / `codex-runtime-resolver` 等模組名與 CSS class；(d) T0480 / T0481 的程式碼、測試、e2e，都是目前正確的行為。另外補查 `(APPDATA\|Application Support\|.config)/better-agent-terminal`、`bat-scripts.log`、`server-cert.json` 的文件描述，沒有過期內容；`docs/remote-dev-overview.md:391-393` 寫的是 headless `<dataDir>`，不受影響 |
| `npx vite build` | ✅ exit 0 | 純文件改動，依 CLAUDE.md No Regressions 規則仍跑了一次 |
| 引用 README 的單元測試 `src/__tests__/copy-remote-path.test.tsx` | ✅ 7/7 | 只用檔名字串，不讀實際檔案，跑一次確認 |
| 實機 / release | 不適用 | 純文件 |

### `git diff --stat`

```
 CLAUDE.md                                          |  5 +--
 README.md                                          | 40 ++++++++++++++++------
 .../T0482-bug119-docs-single-userdata.md           |  6 ++--
 docs/plan-027-cross-platform-verification.md       |  4 +--
 4 files changed, 37 insertions(+), 18 deletions(-)
```

（工單檔的行數是開工時的 metadata 變更，不含本回報區。）

換行沿用各檔現況：三個檔案在工作目錄中都是 LF。git 的 `LF will be replaced by CRLF` 警告來自 autocrlf 設定，本單沒有改變換行。

### 偏離 / 範圍外發現

- 無偏離
- 範圍外（交塔台參考）：release notes 需要說明 runtime 實例的 snippets 改為各自一份（T0479 第 4 節）。README 已寫一句，但 release notes 不在本單範圍

### Commit

只 stage 本單的 3 個 affects_files 加上工單檔；未 push，未觸發 workflow。
