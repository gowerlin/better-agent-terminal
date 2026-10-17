---
schema_version: 1
schema_kind: workorder
id: T0362
title: "prompt argv 依 shell family quoting（採 PR #19 骨架 + 修正其 cmd 分支兩處缺陷）"
type: fix
status: DONE
priority: P2
sizing: S
created_at: "2026-09-02T15:09:29+08:00"
updated_at: "2026-09-02T15:20:25+08:00"
started_at: "2026-09-02T15:11:23+08:00"
completed_at: "2026-09-02T15:20:25+08:00"
target_version: next
depends_on: []
related:
  - "PR #19（gowerlin/better-agent-terminal，外部貢獻者 RicoChen727）"
  - "PR #18（已 merge，commit 238ac3d，引入 shellFamily 佈線）"
affects_files:
  - src/utils/shell-quote.ts
  - src/utils/__tests__/shell-quote.test.ts
  - electron/main.ts
  - CHANGELOG.md
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **不要 merge PR #19，也不要 checkout 它的 branch**。本工單是在 main 上重新實作，只借用其設計骨架。塔台已判定該 PR 的 `cmd` 分支有兩處確認缺陷，照 merge 會把缺陷帶進 main。"
  - "🔴 **不要試圖為 cmd 發明 `%VAR%` 逃逸**。互動式 cmd.exe 的百分比展開在命令列上無法逃逸（`%%` 只在批次檔折疊）。正解是**不動 `%`** 並把這個限制寫成註解，不是找一個更聰明的替換。硬要「修」它就是 PR #19 踩的坑。"
  - "本工單不改 `detectShellFamily` / `quoteCommandPath` 既有行為，也不碰 `agentCustomArgs` 的處理方式。"
---

# T0362 — prompt argv 依 shell family quoting

- **狀態**：DONE
- **任務類型**：fix
- **工作量預估**：S
- **Context Window 風險**：低

## 背景

PR #18（已 merge）把 `ShellFamily` 佈線到 `buildAgentPromptCommand`，但**只用在
`resolveClaudeBaseCommand`**。prompt argv 本身仍走 `electron/main.ts:523` 的私有
POSIX-only helper：

```ts
function shellQuoteForTerminalCommand(value: string): string {
  if (/^[a-zA-Z0-9._\-\/=:@]+$/.test(value)) return value
  return "'" + value.replace(/'/g, "'\\''") + "'"
}
```

⇒ shellFamily 這條線在 argv quoting 上是**斷的**。`terminal-command-handlers.ts:219`
實際會解析出 `pwsh`（Windows 主要情境），但 argv 仍以 POSIX 規則包。

### 現況嚴重度（塔台評估，供你判斷取捨，不是要你重新評估）

POSIX `'…'` 與 pwsh 單引號**在字串不含撇號時結果相同**，而塔台派工的 prompt
（`/ct-exec T0362`、`$ct-exec T0362`）都不含 `'`。⇒ **現行派工路徑沒有壞**，
本修復針對的是「prompt 含 `'`」時 POSIX 的 `'\''` 在 PowerShell 不是合法逃逸。

**latent、低頻、但真實。** 不要因為「沒壞」就縮小範圍，也不要因為「是 bug」就擴大範圍。

### 為什麼不直接 merge PR #19

`gemini-code-assist` 對其 `cmd` 分支留了**兩則 HIGH review，作者三個月未回應**，
塔台獨立複核認為**兩則都成立**。且該 bot 已於 2026-07-17 停止服務，不會再有自動複驗。

## 範圍

### Part A — `src/utils/shell-quote.ts`：新增 `quoteArgForShell(arg, shell)`

沿用 PR #19 的介面與 posix / pwsh 實作（塔台複核為正確）：

| shell | 規則 | 備註 |
|-------|------|------|
| 安全字元直通 | `/^[a-zA-Z0-9._\-=:@/]+$/` 命中則原樣回傳 | 與現行私有 helper 字元集**完全相同**，勿增減 |
| `posix` | `'…'` 包裹，`'` → `'\''` | 與 `quoteCommandPath` 的 posix 分支一致 |
| `pwsh` | `'…'` 包裹，`'` → `''` | PowerShell 單引號 double-up |
| `cmd` | **見 Part B** | PR #19 此分支有缺陷，不可照抄 |

### Part B — `cmd` 分支：修正 PR #19 的兩處缺陷

#### B-1　`%` 不得替換為 `%%`

PR #19 寫 `.replace(/%/g, '%%')`。**錯誤**：`%%` 折疊為 `%` 只發生在**批次檔**解析，
互動式 / PTY 中的 `cmd.exe` 不折疊 ⇒ 使用者輸入 `100% done` 會被改成 `100%% done`，
**為了防罕見情況而在常見情況製造回歸**。

**正解**：`%` 原樣保留。並在函式 doc comment 明確記載此限制：

> 互動式 cmd.exe 無法逃逸 `%VAR%` 展開；若變數存在則必然展開。
> 這是 cmd 本身的限制，非本函式缺陷。呼叫端若需字面 `%VAR%`，須改走非 cmd shell。

⚠️ 見 `memory_overrides` 第 2 條 —— **不要嘗試發明替代逃逸**。

#### B-2　`"` 逃逸應為 `\"`，且須處理反斜線串

PR #19 寫 `.replace(/"/g, '""')`。**錯誤**：Windows `CommandLineToArgvW` 認的是 `\"`。

但 `.replace(/"/g, '\\"')` 這種天真寫法**同樣不對** —— 反斜線在引號前需成對加倍。
請實作標準演算法（Microsoft "Everyone quotes command line arguments the wrong way" 規則）：

- 引號前的連續反斜線串長度加倍，然後補 `\` 再接 `"`
- 字串結尾（閉合引號前）的連續反斜線串長度加倍
- 其他位置的反斜線不動

**測試至少要涵蓋**：`a\"b`、`a\\"b`、結尾為 `\` 的字串（如 `C:\path\`）、`say "hi"`、
`100% done`、`it's me`、含空白、含 `&` / `|` / `^` 等 cmd metacharacter。

> 註：包在雙引號內已能保護 `&` `|` `<` `>` `^`；`%` 是唯一穿透雙引號的，即 B-1 的限制。

### Part C — `electron/main.ts`：拆除私有 helper

1. 刪除 `shellQuoteForTerminalCommand`（`:523-526`）
2. import 改為 `import { quoteArgForShell, type ShellFamily } from '../src/utils/shell-quote'`
3. `:624` 改為 `quoteArgForShell(normalized.prompt, opts.shellFamily ?? 'posix')`

**`agentCustomArgs` 維持現狀不重新 quote** —— PR #19 的這個判斷是對的（使用者自撰設定文字，
可能已自帶引號），沿用並在 commit message 記明。

### Part D — CHANGELOG + 出處標註

- CHANGELOG 增一條，註明源自社群 PR #19
- commit message **必須**含：
  ```
  Co-authored-by: RicoChen727 <ren.asus@gmail.com>
  ```
  設計骨架來自其 PR，我方修正 cmd 分支。出處要保留。

## 明確排除（不要做）

- ❌ 不要 merge PR #19 / 不要 checkout `fix/prompt-argv-shell-quote`
- ❌ 不要改 `detectShellFamily` 或 `quoteCommandPath` 的既有行為
- ❌ 不要改 `agentCustomArgs` 的處理
- ❌ 不要在 PR #19 上留言（塔台負責對外回覆）
- ❌ 不要碰 `AGENTS.md`（既有 dirty）
- ❌ 不要 push（未授權）

## 驗收條件

- [x] AC-1 `npm run test:unit` 全綠，基線由 **511** 提升；新增 cases 覆蓋 Part B 列出的全部字串
- [x] AC-2 `npx vite build` 成功（CLAUDE.md「No Regressions Policy」）
- [x] AC-3 `electron/main.ts` 已無 `shellQuoteForTerminalCommand` 殘留（grep 零命中）
- [x] AC-4 安全字元直通 regex 字元集與原 helper **完全相同**（回歸保護：現行派工 prompt 行為零改變）
- [x] AC-5 `cmd` 分支不含任何 `%` 替換；doc comment 已記載該限制
- [x] AC-6 commit 含 `Co-authored-by: RicoChen727 <ren.asus@gmail.com>`
- [x] AC-7 `git diff --stat` 僅動 `affects_files` 四檔（`AGENTS.md` 既有 dirty 不計、不得 commit）

## Sub-session 執行指示

1. 讀取本工單全部內容
2. 填入 `started_at`（**用 `date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，見全域 R-G001）
3. 讀 `src/utils/shell-quote.ts` 現況 + `electron/main.ts:515-630`
4. 實作 Part A → B → C → D
5. 跑 AC-1 / AC-2
6. 填寫回報區、更新 `status` / `completed_at`
7. commit（`git commit --only` 精確指定路徑，避免掃進 `AGENTS.md`）
8. 依 `auto-session: on` 協定通知塔台（`bat-notify.mjs`，**不加 `--submit`**）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**

### Landing Zone Check

| 檢查 | 結果 | 證據 |
|------|------|------|
| C-0 repo identity | ⚠️ WARN | frontmatter 無 `repo` 欄位（`absent`）；實測 `basename(REPO_ROOT)` = `better-agent-terminal`。欄位缺失不構成 STOP，回退到 C-3 + C-1 判定。 |
| C-1 工單路徑 | ✅ PASS | `_ct-workorders/T0362-shell-aware-prompt-argv-quoting.md` 在 `REPO_ROOT` 底下 |
| C-3 `affects_files` | ✅ PASS | 4 筆皆 testable 且 present：`src/utils/shell-quote.ts`、`src/utils/__tests__/shell-quote.test.ts`、`electron/main.ts`、`CHANGELOG.md` |
| C-2 branch | ℹ️ n/a | 工單未帶 `branch` 欄位；實際 HEAD = `main` |

- `REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`
- `BAT_WORKSPACE_ID` = `2eda2f34-9f69-4704-895e-494d9ec0054b`（證據用，不參與判定）

### 產出摘要

Content commit：**`a8ee6a10e42e09e50b5697c4ca80e5fe5cfe7286`**

| 檔案 | 變更 |
|------|------|
| `src/utils/shell-quote.ts` | 新增 `quoteArgForShell(arg, shell)` 導出函式 + 私有 `quoteArgForCmd(arg)`；`detectShellFamily` / `quoteCommandPath` 零變更 |
| `src/utils/__tests__/shell-quote.test.ts` | 新增 `describe('quoteArgForShell')`（4 個 sub-describe、+39 cases）；import 行加 `quoteArgForShell`；既有 33 cases 零刪減 |
| `electron/main.ts` | 刪除 `shellQuoteForTerminalCommand`（原 `:523-526`）；`import type` 改為 value import（`:91`）；call site 改為 `quoteArgForShell(normalized.prompt, opts.shellFamily ?? 'posix')`（現 `:619`） |
| `CHANGELOG.md` | `[Unreleased] / Fixed` 新增一條，註明源自社群 PR #19 及我方 cmd 分支重實作 |

Part C 實際行號與工單標示略有位移（工單寫 `:624`，實際刪函式後為 `:619`），修改點一致。

### `cmd` 逃逸演算法說明

實作 CommandLineToArgvW 標準規則（"Everyone quotes command line arguments the wrong way"）。
以 `backslashes` 計數器累積連續反斜線串，只在遇到三種時機才落盤：

| 時機 | 輸出 | 理由 |
|------|------|------|
| 遇到 `"` | `\` × (n×2 + 1) 再接 `"` | 反斜線串加倍（使其自身字面化），再補一個逃逸這個引號 |
| 遇到其他字元 | `\` × n 再接該字元 | 非引號前的反斜線不具逃逸意義，原樣輸出 |
| 字串結尾 | `\` × (n×2) 再接閉合引號 | 否則尾部反斜線會逃逸掉閉合引號 |

`%` **完全不動**（B-1），並在 `quoteArgForShell` doc comment 記載：互動式 cmd.exe
無法逃逸 `%VAR%` 展開，`%%` 折疊僅發生於批次檔解析，這是 cmd 本身限制。

對應測試 case（`describe('cmd')`）：

| 輸入（實際字元） | 輸出（實際字元） | 涵蓋規則 |
|------|------|------|
| `say "hi"` | `"say \"hi\""` | B-2：`\"` 而非 `""` |
| `a\"b` | `"a\\\"b"` | 1 個反斜線 → 加倍為 2 再補 1 = 3 |
| `a\\"b` | `"a\\\\\"b"` | 2 個反斜線 → 加倍為 4 再補 1 = 5 |
| `C:\path\` | `"C:\path\\"` | 結尾反斜線串加倍 |
| `C:\path\\` | `"C:\path\\\\"` | 結尾 2 個 → 4 個 |
| `C:\path\file.txt` | `"C:\path\file.txt"` | 中段反斜線不動 |
| `100% done` | `"100% done"` | B-1：`%` 不替換 |
| `%USERPROFILE% is set` | `"%USERPROFILE% is set"` | B-1 |
| `it's me` | `"it's me"` | 撇號在雙引號內無需處理 |
| `a b` | `"a b"` | 含空白 |
| `a & b \| c ^ d` | `"a & b \| c ^ d"` | cmd metacharacter 由雙引號保護 |
| `a<b>c` | `"a<b>c"` | 同上 |

另有一條獨立斷言 `never doubles a percent sign`：`50% + 50% = 100%` 輸出不含 `%%`。

### 測試結果

- `npm run test:unit`：✅ **PASS** —— 41 files / **550 tests 全綠**
  - 基線實測確認：將三個改動檔 `git stash push` 後重跑得 **511 passed**，與工單記載一致；stash 已 pop 回復。⇒ 511 → 550，**+39**。
- `npx vite build`：✅ **PASS** —— vite 7.3.2，main / preload / terminal-server 三個 environment 皆 built。
- （額外、非 AC）`npx tsc --noEmit`：本工單所觸檔案 **零錯誤**。專案全域有 42 條既存錯誤（集中於 `src/components/CodexAgentPanel.tsx` 等），與本變更無關，未處理。

### 驗收條件逐項

| AC | 結果 | 證據 |
|----|------|------|
| AC-1 | ✅ | 550 passed，基線 511；Part B 列舉字串全數覆蓋（見上表） |
| AC-2 | ✅ | `npx vite build` 成功 |
| AC-3 | ✅ | `grep -rn shellQuoteForTerminalCommand electron/` → **零命中**。僅 `src/utils/shell-quote.ts` 與其測試檔的**註解**內提及舊名稱作為歷史指標（非程式碼殘留） |
| AC-4 | ✅ | 直通 regex `/^[a-zA-Z0-9._\-\/=:@]+$/` 與原 helper **逐字元相同**（直接搬過來，未增減）；已加 fast-path 測試保護 |
| AC-5 | ✅ | `grep -n "replace(/%" src/utils/shell-quote.ts` → 零命中；限制已寫入 `quoteArgForShell` doc comment |
| AC-6 | ✅ | commit `a8ee6a1` 含 `Co-authored-by: RicoChen727 <ren.asus@gmail.com>` |
| AC-7 | ✅ | `git show --stat a8ee6a1` → 僅 4 檔，正是 `affects_files`。`AGENTS.md` 全程未碰也未 commit（仍停在原 dirty 狀態） |

### 與 PR #19 的差異

| 項目 | PR #19 | 本工單 | 理由 |
|------|--------|--------|------|
| 介面 `quoteArgForShell(arg, shell)` | — | **沿用** | 塔台複核為正確 |
| 安全字元直通 | — | **沿用** | 與原 helper 字元集相同，回歸保護 |
| `posix` 分支 | `'\''` | **沿用** | 與 `quoteCommandPath` posix 分支一致 |
| `pwsh` 分支 | 撇號 double-up | **沿用** | PowerShell 單引號唯一逃逸方式 |
| `cmd` 對 `%` | `.replace(/%/g, '%%')` | **移除，`%` 原樣保留** | `%%` 折疊僅發生於批次檔；互動式 / PTY 下不折疊，會把 `100% done` 變成 `100%% done` —— 為防罕見情況而在常見情況製造回歸。未嘗試發明替代逃逸（依 `memory_overrides` 第 2 條），而是將限制寫成 doc comment |
| `cmd` 對 `"` | `.replace(/"/g, '""')` | **改為 `CommandLineToArgvW` 完整演算法** | Windows 認的是 `\"`；且天真的 `\"` 替換仍錯，反斜線串需在引號前加倍、字串結尾也需加倍 |
| `agentCustomArgs` | 不重新 quote | **沿用** | 使用者自撰設定文字，可能已自帶引號；已在 commit message 記明 |

未 merge、未 checkout `fix/prompt-argv-shell-quote`、未在 PR #19 留言。出處以
`Co-authored-by: RicoChen727 <ren.asus@gmail.com>` trailer 與 CHANGELOG 文字保留。

### 遭遇問題

1. **寫檔時反斜線遭摺疊（已解）**—— 首次以 bash heredoc 附加程式碼時，部分 `\\`
   被摺疊成 `\`，造成 esbuild `Unterminated string literal`（`shell-quote.ts:84`）並連帶
   `electron/__tests__/resolve-claude-base-command.test.ts` 8 個 case transform 失敗。
   改用 Write 工具重寫兩個檔後解決。**給後人的教訓：寫入含大量反斜線的檔案一律用
   Write，不要走 shell heredoc。**
2. **行尾碼警告**—— git 對三個檔報 `LF will be replaced by CRLF`。實測檔案皆為 LF，
   與 repo 既有行為一致（`AGENTS.md` / `CHANGELOG.md` 也跑同樣警告），非本變更引入，未處理。

無 BLOCKED 事項。未 push（工單未授權）。

### 後續建議（交給塔台決定，本工單不做）

- `quoteArgForShell` 目前只有 `buildAgentPromptCommand` 一個呼叫端。若日後有其他地方
  需要把使用者文字拼進 shell 命令列，應直接複用此函式，不要再寫私有 helper。
- 對外回覆 PR #19（塔台負責）可引用 commit `a8ee6a1` 作為「骨架已採用、cmd 分支已修」的證據。

### 回報時間

2026-09-02T15:17:15+08:00
