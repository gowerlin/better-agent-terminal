---
schema_version: 1
schema_kind: workorder
id: T0362
title: "prompt argv 依 shell family quoting（採 PR #19 骨架 + 修正其 cmd 分支兩處缺陷）"
type: fix
status: PENDING
priority: P2
sizing: S
created_at: "2026-09-02T15:09:29+08:00"
updated_at: "2026-09-02T15:09:29+08:00"
started_at: ""
completed_at: ""
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

- **狀態**：PENDING
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

- [ ] AC-1 `npm run test:unit` 全綠，基線由 **511** 提升；新增 cases 覆蓋 Part B 列出的全部字串
- [ ] AC-2 `npx vite build` 成功（CLAUDE.md「No Regressions Policy」）
- [ ] AC-3 `electron/main.ts` 已無 `shellQuoteForTerminalCommand` 殘留（grep 零命中）
- [ ] AC-4 安全字元直通 regex 字元集與原 helper **完全相同**（回歸保護：現行派工 prompt 行為零改變）
- [ ] AC-5 `cmd` 分支不含任何 `%` 替換；doc comment 已記載該限制
- [ ] AC-6 commit 含 `Co-authored-by: RicoChen727 <ren.asus@gmail.com>`
- [ ] AC-7 `git diff --stat` 僅動 `affects_files` 四檔（`AGENTS.md` 既有 dirty 不計、不得 commit）

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

（DONE / FAILED / BLOCKED / PARTIAL）

### 產出摘要

### `cmd` 逃逸演算法說明

（說明你實作的反斜線串處理規則，並列出對應測試 case）

### 測試結果

- `npm run test:unit`：
- `npx vite build`：

### 與 PR #19 的差異

（逐條列出你改了它哪些地方、為什麼）

### 遭遇問題

### 回報時間
