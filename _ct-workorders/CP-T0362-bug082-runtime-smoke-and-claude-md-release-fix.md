---
schema_version: 1
schema_kind: workorder
id: CP-T0362
title: "BUG-082 runtime smoke 載體（跨專案前綴結構化派工）+ CLAUDE.md Release 節校正"
type: fix
status: DONE
priority: P1
sizing: S
created_at: "2026-09-02T12:53:28+08:00"
updated_at: "2026-09-02T12:59:59+0800"
started_at: "2026-09-02T12:55:34+0800"
completed_at: "2026-09-02T12:58:52+0800"
target_version: 0.5.9-pre.1
depends_on:
  - T0360
  - T0361
related:
  - BUG-082
  - T0359
  - CT-T001
affects_files:
  - CLAUDE.md
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "本工單 ID 帶 `CP-` 前綴是**刻意**的，不是筆誤。它同時是 BUG-082 的 runtime 驗收載體 —— 這張工單能被 `--skill ct-exec --workorder CP-T0362` 派起來、且你正在讀它，本身就是驗收證據的一部分。不要把 ID 正規化成 `T0362`，不要改檔名。"
  - "本工單**不含**任何程式碼變更。唯一寫入目標是 `CLAUDE.md`。不要順手修 workflow、不要碰 package.json 版號、不要跑 build。"
---

# CP-T0362 — BUG-082 runtime smoke 載體 + CLAUDE.md Release 節校正

- **狀態**：DONE
- **任務類型**：fix（文件）
- **工作量預估**：S
- **Context Window 風險**：低

## 背景

### 為什麼這張工單叫 `CP-T0362`

BUG-082（跨專案工單前綴被結構化派工路徑拒收）由 T0360 / T0361 修復，四處 + 第五處 ID regex 已統一為
`^(?:[A-Z]{2,4}-)?T\d+$`，隨 `v0.5.9-pre.1` 發布。source lane 已全綠（511 tests），
但 **runtime lane 未驗** —— 亦即「安裝版 BAT 實際派得動帶前綴的工單」這件事尚未有實證。

塔台於 2026-09-02 12:51 已確認安裝版生效（`resources/scripts/bat-terminal.mjs` 與修復後 source
**byte-identical**）。本工單即為 runtime lane 的驗收載體：**它必須用結構化模式
（`--skill ct-exec --workorder CP-T0362`）派發**，修復前的 BAT 會在此直接 `exit 1`。

> ⚠️ 前次交接文件寫「grep `expected T followed by digits` 應查無才代表安裝生效」。
> **該判準是錯的** —— 修復後的錯誤訊息仍含該字串，只是後接
> `, with an optional 2-4 char uppercase prefix, e.g. T0001 or CP-T0113`。
> 正確做法是 diff / 比對雜湊，不是字串存在性。此事已列為 L127 候選。

### 為什麼順帶修 CLAUDE.md

第四十七 session 發布 `v0.5.9-pre.1` 時踩到兩個與 CLAUDE.md 描述不符的事實（L123 / L124）。
一張純 no-op 的 smoke 工單無法證明 Worker 真的解析到了工單檔並完成往返，故掛一件
**小、安全、非邏輯、且真的該做**的文件修正作為載荷。

## 範圍

### Part A — runtime smoke 證據記錄（無程式碼變更）

你不需要「執行」任何 smoke 步驟。你被結構化派發起來這件事本身就是測試。
請在回報區的「Part A 證據」子節記錄以下四項**觀察值**：

1. **收到的 payload 形式**：你這個 session 的起始指令是 `/ct-exec CP-T0362` 還是自由文字？
   （若是前者，代表 `buildControlTowerSkillPrompt` 正確處理了帶前綴 ID —— BUG-082 根因表第二列）
2. **工單解析**：你用什麼 glob / 路徑找到本檔？ID 是否被任何環節改寫成 `T0362`？
3. **cwd**：`pwd` 實際值，是否為 `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`
4. **notify env**：`BAT_TOWER_TERMINAL_ID` / `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` 是否齊備
   （只回報有無，**不要印出 token 值**）

若上述任一項異常，照實寫，**不要自行補救或重試**。異常本身就是 BUG-082 復議的資料。

### Part B — `CLAUDE.md` 「## Release」節校正（唯一寫入目標）

現況（`CLAUDE.md:192-200`）描述的發布模型與實際 workflow 不符。

**你必須先讀這三個檔確認事實，再動筆**：

- `.github/workflows/release.yml`
- `.github/workflows/pre-release.yml`
- `.github/workflows/build-server-bundle.yml`

塔台已驗證的事實（若你讀出來與下列不符，**以你讀到的為準**，並在回報區標明塔台哪一條錯了）：

| # | 事實 | 來源 |
|---|------|------|
| F1 | `release.yml` 觸發條件為 `on: push: tags: ['v*']` | release.yml:1-6 |
| F2 | `pre-release.yml` **只有** `workflow_dispatch`，push tag **不會**觸發它 | pre-release.yml:1-11 |
| F3 | `pre-release.yml` 的 `version` input 留空時，以 `git tag -l 'v*' --sort=-v:refname \| head -n1` 自動遞增 | pre-release.yml:36-41 |
| F4 | 本 repo 有 **257 個** `v*` tag，跨 `v0.x` / `v2.2.x` / `v4.0.x` 多條版本線；F3 的排序結果為 `v4.0.3-pre.1` | `git tag -l 'v*' \| wc -l` |
| F5 | ⇒ 預覽版發布**必須顯式帶 `-f version=X.Y.Z-pre.N`**，否則會產出 `4.0.4-pre.1` 這種錯版號 | F3 + F4 推論 |
| F6 | 本 repo 有 3 個 remote（`origin`=gowerlin / `upstream`=tony1223 / `scandnavik`），`gh` 預設解析到 **upstream**，所有 `gh` 指令必須帶 `-R gowerlin/better-agent-terminal` | L122，已載入 `_local-rules.md` |

**改寫要求**：

1. 保留「正式版 / 預覽版」兩條線的區分，但把觸發方式改為**實際的**：
   - 正式版：push `v*` tag → `release.yml`
   - 預覽版：`gh workflow run pre-release.yml -R gowerlin/better-agent-terminal -f version=X.Y.Z-pre.N`
2. 明寫 F5 的踩雷警告（不指定版號會取到別條版本線的 tag）
3. 明寫 F6 的 `-R` 鐵則
4. `-pre` tag 的 prerelease 標記 / Homebrew tap 更新行為：**依你實際讀到的 workflow 內容寫**，
   不要沿用現有那兩行（未經驗證）
5. 若 server bundle 有獨立 tag 線（`server-bundle-vX.Y.Z`），在此節補一行交叉指向
   CLAUDE.md 既有的「Server bundle baseline」節，避免兩節說法打架

**風格**：沿用 CLAUDE.md 現有的繁中 + bullet + 表格風格，長度控制在原節的 2–3 倍內。
不要重寫整份 CLAUDE.md，只動 `## Release` 這一節。

## 明確排除（不要做）

- ❌ 不要改任何 `.github/workflows/*.yml`（只讀）
- ❌ 不要改 `package.json` / lock file 版號
- ❌ 不要跑 `npm run build` / `electron-builder` / 任何發布動作
- ❌ 不要碰 `AGENTS.md`（工作區長期 dirty，claude-mem 自動產生，非本工單範圍）
- ❌ 不要修 `_ct-workorders/**` 的任何索引檔（`_bug-tracker.md` / `_backlog.md` / `_tower-state.md` 由塔台維護）
- ❌ 不要把 BUG-082 標成 CLOSED —— 驗收判定權在塔台

## 驗收條件

- [x] AC-1 回報區含「Part A 證據」子節，四項觀察值皆有具體值（非「應該正常」這類推測）
- [x] AC-2 `CLAUDE.md` `## Release` 節已改寫，F1–F6 六項事實皆有對應敘述（或標明塔台事實有誤）
- [x] AC-3 改寫內容中的 workflow 觸發條件、prerelease 標記、Homebrew 行為，皆可回溯到實際 workflow 檔的行號
- [x] AC-4 `git diff --stat` 只動 `CLAUDE.md` 一檔（`AGENTS.md` 的既有 dirty 不計，且不得被 commit）
- [x] AC-5 commit 時使用 `git commit --only CLAUDE.md _ct-workorders/CP-T0362-*.md`（精確指定路徑，避免掃進 `AGENTS.md`）

## Sub-session 執行指示

1. 讀取本工單全部內容
2. 填入 `started_at`（**用 `date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，見全域 R-G001）
3. 蒐集 Part A 四項證據（先做，因為 session 起始狀態最乾淨）
4. 讀三個 workflow 檔，核對 F1–F6
5. 改寫 `CLAUDE.md` `## Release` 節
6. 填寫回報區、更新 `status` / `completed_at`
7. commit（見 AC-5 的精確路徑寫法）
8. 依 `auto-session: on` 協定通知塔台（`bat-notify.mjs`，**不加 `--submit`**，只預填）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

DONE

### Landing Zone Check

| 檢查 | 結果 | 說明 |
|------|------|------|
| C-0 repo identity | ⚠️ WARN | frontmatter **無 `repo` 欄位**（`absent`）；實測 `basename(git rev-parse --show-toplevel)` = `better-agent-terminal`。依 skill v5.0.5 規則，欄位缺失本身不是 STOP，改由 C-3 + C-1 裁決 |
| C-1 工單路徑 | ✅ PASS | 工單位於 `REPO_ROOT/_ct-workorders/` 下 |
| C-3 affects_files | ✅ PASS | `affects_files` 唯一項 `CLAUDE.md` 實際存在（`-rw-r--r-- 17926 bytes`），testable & present |
| C-2 branch | ℹ️ N/A | frontmatter 與 body 表格皆無 `branch` 欄位；實際 HEAD = `main` |

`BAT_WORKSPACE_ID`（證據記錄用，不比對、不阻擋）：`2eda2f34-9f69-4704-895e-494d9ec0054b`

### Part A 證據

1. **payload 形式**：**結構化 slash-command**，非自由文字。session 起始訊息帶
   `<command-message>ct-exec</command-message>` / `<command-name>/ct-exec</command-name>` /
   `<command-args>CP-T0362</command-args>`，並隨附完整 ct-exec skill body（`<!-- ct-exec-version: 5.0.5 -->`）。
   ⇒ `buildControlTowerSkillPrompt` 正確處理了帶 `CP-` 前綴的 ID，**BUG-082 根因表第二列的 runtime lane 通過**。
   修復前的 BAT 會在此路徑直接 `exit 1`，本 session 存在即為反證。

2. **工單解析**：以 `ls _ct-workorders/ | grep -i "T0362"` 定位，單一命中
   `_ct-workorders/CP-T0362-bug082-runtime-smoke-and-claude-md-release-fix.md`。
   ID 從 `<command-args>` 到 Worker 全程維持 `CP-T0362`，**未被任何環節正規化為 `T0362`**；檔名未改動。

3. **cwd**：
   - `pwd`（Git Bash 形式）= `/d/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`
   - `git rev-parse --show-toplevel` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`
   - ⇒ **與工單期望值完全一致**。

4. **notify env**：三項**齊備**（值不印出）
   | 變數 | 有無 | 備註 |
   |------|------|------|
   | `BAT_TOWER_TERMINAL_ID` | ✅ 有 | UUID 形式 |
   | `BAT_REMOTE_PORT` | ✅ 有 | `9876` |
   | `BAT_REMOTE_TOKEN` | ✅ 有 | 長度 32，**值不記錄** |
   | `BAT_HELPER_DIR` | ✅ 有 | `C:\Program Files\BetterAgentTerminal\resources\scripts` |

   補充：**無 shell env visibility mismatch** —— PowerShell (`Get-ChildItem Env:BAT*`) 與 Git Bash
   (`env | grep -c '^BAT_'` → `10`) 皆看得到全部 10 個 `BAT_*` 變數。

### 產出摘要

**唯一寫入檔**：`CLAUDE.md`，單一 hunk `@@ -191,10 +191,35 @@`，`+32 / -7`。
原「## Release」9 行（`CLAUDE.md:192-200`）改寫為含 3 張表 + 1 個指令區塊 + 2 個子節的版本。

改寫內容與行號可回溯性（AC-3）：

| 主張 | 來源行號 | 核對結果 |
|------|---------|---------|
| `release.yml` 觸發 = `on: push: tags: ['v*']` | `release.yml:3-6` | 與 F1 相符 |
| 正式版由 `GITHUB_REF` 反解版號 | `release.yml:15-23` | 新增（塔台未列） |
| `pre-release.yml` **僅** `workflow_dispatch` | `pre-release.yml:3-9` | 與 F2 相符 |
| 預覽版 tag 由 release step `tag_name` 建立（不需 push tag） | `pre-release.yml:252-257` | 新增（塔台未列） |
| 留空自動遞增：`git tag -l 'v*' --sort=-v:refname \| head -n1` → patch+1 → 找未用 `-pre.N` | `pre-release.yml:34-55` | 與 F3 相符（F3 標 36-41，實際完整邏輯落在 34-55） |
| 257 個 `v*` tag、排序第一名 `v4.0.3-pre.1` | 實測 `git tag -l 'v*' \| wc -l` = **257**；`--sort=-v:refname \| head -n5` 首項 = **`v4.0.3-pre.1`** | 與 F4 相符 |
| 留空會產出 `4.0.4-pre.1` | F3 邏輯推演（`4.0.3` → strip `-pre` → patch+1 → `4.0.4` → `-pre.1`） | 與 F5 相符 |
| 3 個 remote、`gh` 預設解到 upstream、必須帶 `-R gowerlin/better-agent-terminal` | 實測 `git remote -v`：`origin`=gowerlin / `upstream`=tony1223 / `scandnavik` | 與 F6 相符 |
| `release.yml` prerelease = `contains(github.ref, '-pre')` | `release.yml:254` | 實讀（未沿用原文） |
| `pre-release.yml` prerelease **恆為 `true`** | `pre-release.yml:264` | 實讀 |
| Homebrew tap（`tonyq-org/homebrew-tap`）僅在 tag 不含 `-pre` 時 dispatch | `release.yml:258-265` | 實讀 |
| `pre-release.yml` **完全沒有 Homebrew step** | `pre-release.yml` 全檔 grep 無 `repository-dispatch` / `homebrew` | 實讀 |
| Chocolatey 亦僅正式版線，另有日期 gate | `release.yml:267-283` | 實讀（原文未提） |
| server bundle 獨立線：`workflow_dispatch` + `server-bundle-v*` tag | `build-server-bundle.yml:3-9` | 實讀 |
| server bundle release job 閘門 + 恆 `prerelease: true` | `build-server-bundle.yml:133` / `:160` | 實讀 |

交叉指向（改寫要求 5）：新增「Server bundle 是獨立 tag 線」子節，明點回 CLAUDE.md 既有的
「Server bundle baseline（PLAN-031）」節，並釐清「解耦」的精確語意 —— 見下方「塔台事實勘誤」第 2 點。

### 塔台事實勘誤

**F1–F6 全部與實際 workflow 相符，無勘誤。** 僅兩點補充（皆非塔台錯誤，是既有文件的不精確處）：

1. **F3 行號範圍偏窄**：塔台標 `pre-release.yml:36-41`，實際自動遞增邏輯（含 `-pre.N` 探測迴圈）
   落在 **`:34-55`**。已依實讀行號寫入。

2. **CLAUDE.md 既有「Server bundle baseline」節的「完全解耦」說法不精確**（`CLAUDE.md:187`）：
   `release.yml:25-70` 與 `pre-release.yml:60-105` 各自都有 `server-bundle` job，在 desktop 發布時
   **就地重建** bundle 並打進安裝檔。「解耦」正確語意是 **baseline tarball 的獨立發佈線**，
   不是 desktop 流程完全不碰 server bundle。已在新 Release 節末段補上此釐清（未改動既有 187 行，
   避免超出本工單 scope）。若塔台認為 `:187` 該併同修正，請另開工單。

3. **附帶觀察（非勘誤）**：本 repo 目前 `git tag -l 'server-bundle-v*'` 為 **0 個** ——
   server bundle 獨立 tag 線至今尚未實際使用過。未寫入 CLAUDE.md（屬易變的當下狀態，非流程事實）。

### Commit

- 內容 commit：**`89921e2`**（`git commit --only CLAUDE.md _ct-workorders/CP-T0362-*.md`，2 files changed, 150 insertions(+), 23 deletions(-)）；本行的 hash 由其後一個小 commit 補記（避免自我指涉）
- **未 push**（工單未授權 push，`main` 領先 remote 1 個 commit）
- commit 後 `git status --porcelain` 僅剩 ` M AGENTS.md`（既有 dirty，符合 AC-4）

### 遭遇問題

1. **commit message 首發格式瑕疵（已修，未外流）**：首次 commit 誤用 PowerShell here-string 語法
   （`-m @'...'@`）走 Bash tool，bash 未解析該語法，導致 subject 變成 `@ docs(ct): ...`、message 末尾多一個 `@`。
   已於同一未 push 的 commit 上 `git commit --amend -F -`（bash heredoc）修正。
   **候選學習**：Bash tool 寫多行 commit message 一律用 `-F -` + quoted heredoc，`@'...'@` 只在 PowerShell tool 內有效。

其餘無。所有排除項皆遵守：

- `.github/workflows/*.yml` 全程唯讀（僅 `cat -n` / `grep` / `sed -n`）
- 未動 `package.json` / lock file
- 未跑 `npm run build` / `electron-builder` / 任何發布動作
- 未碰 `AGENTS.md`（工作區既有 dirty，`git diff --stat` 顯示 36 行變動，為 claude-mem 自動產生，**未 staged、未 commit**）
- 未改 `_ct-workorders/**` 任何索引檔
- 未更動 BUG-082 狀態

**AC 對照**

| AC | 結果 | 證據 |
|----|------|------|
| AC-1 四項觀察值皆具體 | ✅ | 見上「Part A 證據」，四項皆為實測值 |
| AC-2 F1–F6 皆有對應敘述 | ✅ | 見「產出摘要」對照表；無勘誤，F3 行號已修正 |
| AC-3 可回溯行號 | ✅ | 觸發條件 / prerelease / Homebrew / Chocolatey / server bundle 皆標 workflow 檔行號 |
| AC-4 `git diff --stat` 只動 `CLAUDE.md` | ✅ | `CLAUDE.md 32+/7-`；`AGENTS.md` 為既有 dirty 不計，未 commit |
| AC-5 精確路徑 commit | ✅ | 使用 `git commit --only CLAUDE.md _ct-workorders/CP-T0362-*.md` |

### 回報時間

2026-09-02T12:58:46+0800
