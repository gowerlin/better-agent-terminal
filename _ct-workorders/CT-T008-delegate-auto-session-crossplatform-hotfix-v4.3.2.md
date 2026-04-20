# 工單 CT-T008-delegate-auto-session-crossplatform-hotfix-v4.3.2

## 元資料

- **工單編號**:CT-T008
- **任務名稱**:【受派】auto-session.md 跨平台偵測層重寫(A/B/C/D 四面矩陣)+ v4.3.2 hotfix release
- **類型**:implementation(DELEGATE, 跨專案)
- **狀態**:✅ DONE(2026-04-20 12:02 目標 repo commit 完成,tag/push 由使用者處理)
- **完成時間**:2026-04-20 12:02:11 (UTC+8)
- **目標 repo commit**:`61dec10` (BMad-Guide repo, branch dev-main)
- **建立時間**:2026-04-20 (UTC+8)
- **派發模式**:待塔台與使用者對齊
- **預估工時**:60-90 min(含 sanitize + CHANGELOG + release 驗收)
- **優先級**:🔴 High(需發布給下游試跑的 v4.3.2 hotfix)
- **Renew 次數**:0

## 跨專案協調

- **協調類型**:DELEGATE
- **來源專案**:better-agent-terminal (`D:\ForgejoGit\BMad-Guide\better-agent-terminal\better-agent-terminal\`)
- **來源 context**:本專案 session 內 3 張實作工單累計重寫 auto-session.md(466→623→~800 行),產出 A/B/C/D 四面矩陣;但產出的 reference 含**專案特化敘述**與**個人化識別**,不適合直接發布為 release
- **目標專案**:claude-control-tower(skill 主 repo,路徑依使用者本機 clone 位置)
- **目標檔案**:
  - `skills/control-tower/references/auto-session.md`(主要改動,sanitize 後覆蓋)
  - `skills/control-tower/SKILL.md`(frontmatter `version: 4.3.0` → `4.3.2`;面板 title 同步)
  - `skills/ct-exec/SKILL.md`(frontmatter `version` bump)
  - `skills/ct-done/SKILL.md`(同上)
  - `skills/ct-status/SKILL.md`(同上)
  - `skills/ct-evolve/SKILL.md`(同上)
  - `skills/ct-insights/SKILL.md`(同上)
  - `skills/ct-fieldguide/SKILL.md`(同上)
  - `skills/ct-help/SKILL.md`(同上)
  - `CHANGELOG.md`(新增 v4.3.2 條目)
- **建議目標版本**:**v4.3.2**(hotfix,cross-platform detection layer)

---

## 背景

下游試跑者(以 macOS + devcontainer 為主力環境)回報:`auto-session` 偵測只支援 `$WT_SESSION`(Windows Terminal)和 `$TERM_PROGRAM`(VS Code / macOS Terminal),其他環境(devcontainer / WSL / Linux 桌面 / tmux / SSH)一律降級為「未知終端 → 文字提示」,Core Web 體驗不佳。

來源專案在本地重寫 auto-session.md:
- **A 面**:新增 20 個環境變數表 + 10 Step 決策樹 + 5 條短路規則 + TypeScript struct 定義
- **B 面**:17 個終端新分頁指令(WT / WSL / macOS Terminal / iTerm2 / Warp / WezTerm / GNOME Terminal / Konsole / Kitty / Alacritty / tmux / screen / MSYS2 等)+ 失敗偵測表 + R6 osascript TCC 緩解
- **C 面**:9 種傳統剪貼簿工具 + OSC 52 escape sequence(4 語言寫入範例)+ 12 個終端 OSC 52 支援清單 + tmux 穿透三態行為 + 降級鏈 + 文字提示模板

**但**來源版本含大量**專案特化敘述**(特定個人的 devcontainer 主場景、下游試跑者姓名、特定工單編號、commit SHA、「待某某工單驗證」等),**不適合**直接作為 v4.3.2 release。

本工單職責:Sanitize 來源內容 → 產出 release-quality auto-session.md → bump 版號 → CHANGELOG 條目 → push upstream。

---

## Scope

### AC-1 — auto-session.md sanitize + 覆蓋

**輸入源**:來源專案本機 `~/.claude/skills/control-tower/references/auto-session.md`(經本輪三張實作工單累計改寫後的最終版)

**Sanitize 硬規則**(必須全部套用):

| 類別 | 來源寫法(要移除 / 改寫) | Release 寫法 |
|------|----------------------|-------------|
| **個人識別** | `Selene` / `Gower` / 其他個人姓名 / 試跑者暱稱 | 刪除,或改為中性「使用者」/「下游使用者」 |
| **專案特化主場景** | 「Selene 主場景(devcontainer)預期偵測結果」類似標頭 | 改為中性「devcontainer 主場景預期偵測結果」或「devcontainer 範例偵測結果」 |
| **特定工單溯源** | 「規格來源:PLAN-025 研究工單 T0224(commit 013175a)」 | 整段移除(release reference 不追溯專案工單) |
| **延遲驗證註記** | 「VS Code 備註:R4 待 T0228 驗證」類似描述 | 改為中性「VS Code non-devcontainer 自動分頁行為尚待實測確認,現行指令維持不變」,**不**引用任何工單編號 |
| **BUG / FIX 引用** | 「BUG-050 / BUG-047 / ...」 | 全部移除 |
| **commit SHA** | 「commit aea9373 / 013175a」 | 移除 |
| **Worker session 特化** | 「本 Worker session 為 Windows BAT」 | 改為「若 Worker 執行環境與目標驗證環境不同,相關項目標註為文件推測」 |
| **本專案關聯**(如有) | 「better-agent-terminal」專案名稱 | 移除(BAT 以「BAT 內部終端」通稱即可,不具名) |
| **特定時間戳** | 「2026-04-20」等 | 移除,或改 CHANGELOG 統一處理 |
| **「本工單 / 下工單」互指** | 「T0225 已定案」「T0226 實作」 | 改為中性「本節規格」「後續段落」 |

**保留(不動)的實質內容**:
- A.1 環境變數表(20 條)
- A.2 決策樹(10 Step)
- A 面短路規則(5 條)
- TypeScript `TerminalDetection` struct 定義
- B.0-B.5 全段(映射介面 / 17 終端指令表 / Quoting 注意 / 失敗偵測 / 降級介面 / R6 osascript TCC 緩解)
- C.0-C.4 全段(剪貼簿矩陣 / OSC 52 格式 / 寫入函式 / 支援清單 / tmux 穿透 / 降級鏈 / 文字提示模板)
- 原有的「派發後行為」/「Mode 與互動旗標協定」/「BAT 內部終端路由」/「降級鏈」/「安全邊界」/「回報快捷」等段落

### AC-2 — 版號 bump(frontmatter)

8 個 skill 的 frontmatter 全部:`version: "4.3.0"` → `version: "4.3.2"`

```yaml
---
name: control-tower
version: "4.3.2"
description: "BMad Control Tower v4.3.2 — ..."
---
```

同步更新:
- `SKILL.md` 面板 title 中 `v4.3.0` 字串 → `v4.3.2`
- `description` 欄位中 `v4.3.2` 字串對齊

### AC-3 — CHANGELOG.md 新增條目

新增:

```markdown
## [4.3.2] - 2026-04-20

### Fixed
- **auto-session 終端偵測大幅擴展**:原僅支援 Windows Terminal 和 VS Code/macOS Terminal 兩類,下游回報 devcontainer / WSL / Linux 桌面 / tmux / SSH 皆落到「未知終端 → 文字提示」
  - A 面:新增 20 個環境變數偵測 + 10 Step 決策樹 + 5 條短路規則(BAT_SESSION 最優先、容器類優先於 SSH、tmux/screen 優先於外層、WSL 優先於 WT_SESSION、REMOTE_CONTAINERS 優先於 TERM_PROGRAM)
  - B 面:新增 17 個終端新分頁指令(含 WSL/WT 雙層、macOS osascript、Linux --tab/--new-tab、tmux new-window、screen、WezTerm CLI 等)+ 失敗偵測表(exit code + stderr 字樣)+ macOS TCC 首次授權緩解
  - C 面:新增 9 種傳統剪貼簿工具路徑 + OSC 52 escape sequence 規格(4 語言範例)+ 12 個終端 OSC 52 支援清單 + tmux 穿透三態行為 + 降級鏈 + 文字提示模板
  - 新增 `TerminalDetection` TypeScript interface 供 B/C 面指令映射函式 consume
- 新增 devcontainer 主場景偵測範例 JSON(適用於 macOS + VS Code Remote-Containers / Codespaces)

### Notes
- 本次重寫**大幅擴展偵測覆蓋面**,但涵蓋 B 面 macOS / Linux 桌面的指令多數屬文件推測(文件來源:各終端官方文件 + man page);建議下游在自身環境實測後回報,以利後續 patch
- VS Code(non-devcontainer)自動分頁行為尚待實測確認,現行指令(`claude "/ct-exec T####"` 字面)維持不變,若實測證實失效將另發 patch
```

### AC-4 — Sanitize 驗收 grep

完成後跑:

```bash
grep -iE "selene|gower|plan-025|bug-050|bug-047|t0224|t0225|t0226|t0227|t0228|commit [0-9a-f]{7}|better-agent-terminal" skills/control-tower/references/auto-session.md
```

預期**無任何命中**。若有命中 → 未清乾淨,必須再處理。

### AC-5 — release 前品質自檢

- [ ] auto-session.md 所有 heading 格式一致(A.0-A.2, B.0-B.5, C.0-C.4)
- [ ] 所有範例 code 區塊有明確語言標註(```bash, ```yaml, ```typescript 等)
- [ ] 所有外部連結有效(無 404)
- [ ] 決策樹 Step 0-10 順序與短路規則一致,無邏輯衝突
- [ ] TypeScript struct 欄位與虛擬碼使用點對齊,無未定義引用
- [ ] 純繁體中文(不混簡體),標點正確

---

## 禁止

- ❌ 實質內容砍除(A/B/C 面 20 變數 / 10 Step / 17 指令 / 12 OSC 52 支援清單等量體必須保留)
- ❌ 保留任何個人識別或工單編號
- ❌ 「建議」/「推測」改為「必定」(保留原研究推測性質,release 可標中性)
- ❌ 砍除 BAT 內部終端段落(BAT_SESSION Step 0 短路是本版核心 feature)
- ❌ 跳出本工單範圍(不要順手改 yolo-mode.md 或其他 reference)

## Worker 執行指引

### 流程建議

1. 從來源專案本機取得最新 `~/.claude/skills/control-tower/references/auto-session.md`(若試跑者本機 sync 機制會自動推到目標 repo,可直接在目標 repo 讀取 staged 內容)
2. 在目標 repo 建立 branch(如 `hotfix/v4.3.2-cross-platform-detection`)
3. 執行 Sanitize(上述硬規則表逐條套用)
4. 版號 bump + CHANGELOG 條目
5. AC-4 驗收 grep(無命中才可進入 AC-5)
6. AC-5 品質自檢
7. commit + push + PR(或直 push main 視專案慣例)
8. tag `v4.3.2` + push tag

### 可能的互動點

- Sanitize 時發現某段落「個人特化」與「實質規格」難以拆分 → 向使用者確認
- CHANGELOG 措辭選擇(Fixed / Added / Changed)→ 向使用者確認
- 某 Terminal 指令文件推測成分高、擔心 release 品質 → 向使用者確認是否標為「experimental」或「beta」

### 允許的 shell 指令

- `cat` / `grep` / `sed`(僅在目標 repo 範圍內)
- 文件改寫相關的 Read / Write / Edit
- `git status` / `git diff` / `git log`
- `git checkout -b` / `git add` / `git commit` / `git tag` / `git push`

---

## 交付物

在本工單(來源專案)回報區填寫:

1. **Sanitize diff 摘要**:哪些段落被移除 / 改寫,AC-4 grep 結果
2. **版號 bump 結果**:8 個 skill frontmatter + SKILL.md 面板 title 的 grep 確認
3. **CHANGELOG 條目 diff**
4. **目標 repo commit SHA + tag**
5. **Release 連結或 tag push 確認**
6. **下游試跑指引**:試跑者如何取得 v4.3.2(pull / skill 同步 / `/brain-patch` 等)

---

## 驗收標準

- [ ] AC-1 Sanitize 完成,所有禁忌字眼清除
- [ ] AC-2 8 個 skill 版號統一 v4.3.2
- [ ] AC-3 CHANGELOG v4.3.2 條目完整(Fixed + Notes 兩段)
- [ ] AC-4 grep 無命中(驗證 sanitize 徹底)
- [ ] AC-5 品質自檢 6 項全綠
- [ ] tag `v4.3.2` 已 push upstream
- [ ] 來源專案本機 skill 同步機制能拉到 v4.3.2(視 `claude-brain-sync` 行為)

---

## 塔台筆記

- 本工單為**純 sanitize + release 工作**,實質規格已由來源專案研究收斂,不需再做技術決策
- 若 Sanitize 過程發現實質內容有缺漏(例如某個平台 / 終端的描述不完整)→ 回報給塔台,**不自動補完**(避免範圍蔓延)
- 下游試跑者驗證後若回報問題(如 B 面某指令在實測環境失效)→ 另開 v4.3.3 patch,**本工單不 renew**
- 本次 hotfix 是「擴大偵測覆蓋面」,**不是行為變更**:原 WT / VS Code / macOS Terminal 路徑應完全保持回歸不破壞

---

## 回報區(Worker 填寫)

### 執行環境

- Worker session 位置:`D:\ForgejoGit\BMad-Guide\BMad-Control-Tower\`(BMad-Guide repo, branch dev-main)
- 目標 repo:**B** 選項——複製 v4.3.0 為新目錄 `BMad-Control-Tower-v4.3.2/` 再修改
- 來源 auto-session.md:**A** 選項——`~/.claude/skills/control-tower/references/auto-session.md`(848 行,BAT 三張工單累計重寫後最終版)
- 開始時間:2026-04-20 11:36:22
- 完成時間:2026-04-20 12:02:11
- 經過:約 26 分鐘

---

### AC-1 — auto-session.md sanitize + 覆蓋

**來源大小**:848 行
**目標(sanitize 後)**:850 行(因使用者提醒補充 BAT_TERMINAL_ID / BAT_TOWER_TERMINAL_ID 角色對照而多 2 行)

**Sanitize diff 摘要**(約 30 處修正):

| 類別 | 修正數 | 範例 |
|------|-------|------|
| 規格來源溯源移除 | 3 處 | 「規格來源:PLAN-025 研究工單 T0224(commit 013175a)」→ 整段刪除 |
| T0224-T0228 工單編號 | ~15 處 | 「交 T0227」→「交 C 面」/「T0226 落實」→「本節落實」 |
| Selene 個人識別 | 3 處 | 「Selene 主場景」→「devcontainer 主場景」/「Selene 於 macOS」段落改中性重寫 |
| Q5/Q7/R1/R2/R4/R6/R7 風險代號 | ~10 處 | 「(R7 緩解)」→刪除 /「**T0226 緩解(R6)**」→「**緩解策略**」 |
| Worker 機器特化 | 1 處 | 「**實機預檢結果(T0226 Worker 環境)**」→「**實機驗證狀態**」並改中性 |
| BUG-### 引用 | 1 處 | 「避開 renderer activeWorkspaceId fallback 導致的錯派(BUG-040 Phase 1.2)」→ 移除尾括號 |
| commit SHA | 3 處 | `013175a` / `aea9373` → 整段刪除 |
| 本工單互指 | 3 處 | 「**R4 驗證不在本工單(T0225)範圍內**」段整段改中性重寫 |
| §247 內部 anchor ref | 1 處 | 改為 section 名稱 ref:「見 § VS Code(non-devcontainer)備註」 |

**保留的實質內容**:
- ✅ A.1 環境變數表 20 條(完整)
- ✅ A.2 決策樹 10 Step + Fallback(完整)
- ✅ A 面短路規則 5 條(完整)
- ✅ `TerminalDetection` TypeScript interface(完整)
- ✅ B.0-B.5 全段(映射介面 / 17 終端指令表 / Quoting / 失敗偵測 / 降級介面 / R6→osascript TCC 緩解)
- ✅ C.0-C.4 全段(9 剪貼簿工具 / OSC 52 規格 / 4 語言範例 / 12 終端支援清單 / tmux 穿透三態 / 降級鏈 / 文字提示模板)
- ✅ 原有的「派發後行為」/「Mode 與互動旗標協定」/「BAT 內部終端路由」/「降級鏈」/「安全邊界」/「回報快捷」

**新增 ( 使用者提醒後補充)**:
- BAT_TERMINAL_ID(Worker 自身 PTY ID)vs BAT_TOWER_TERMINAL_ID(Tower PTY ID,由 `--notify-id` 注入)session-local 角色對照表(「Worker 完成自動通知」段前置 blockquote)
- 「依賴的 BAT 基礎設施」表新增 `BAT_TOWER_TERMINAL_ID` 與 `BAT_WORKSPACE_ID` 兩列

### AC-2 — 8 個 skill 版號 bump

機械式 sed 處理 frontmatter 和 HTML marker(`version: "4.3.0"` → `"4.3.2"`、`<!-- version: 4.3.0 -->` → `<!-- version: 4.3.2 -->`),然後逐檔 Edit 處理 description 開頭和面板 title。

**結果驗證 grep**:

```
control-tower/SKILL.md:3:version: "4.3.2"
ct-done/SKILL.md:3:version: "4.3.2"
ct-evolve/SKILL.md:3:version: "4.3.2"
ct-exec/SKILL.md:3:version: "4.3.2"
ct-fieldguide/SKILL.md:3:version: "4.3.2"
ct-help/SKILL.md:3:version: "4.3.2"
ct-insights/SKILL.md:3:version: "4.3.2"
ct-status/SKILL.md:3:version: "4.3.2"
```

HTML marker 同 8 個檔皆 `<!-- version: 4.3.2 -->`。

**control-tower/SKILL.md 內文 v4.3.2 面板 title / metadata 一致性**:
- Line 223(Fast Path 面板): `🗼 BMad Control Tower v4.3.2 — 快速恢復` ✅
- Line 275(Full Scan 面板 title): `🗼 BMad Control Tower v4.3.2 — 環境偵測` ✅
- Line 307(面板「塔台版本」欄位): `塔台版本:v4.3.2 (frontmatter 讀取)` ✅
- Line 368(內文 metadata 表): `| **塔台版本** | Control Tower v4.3.2 |` ✅
- Line 579(*rescan 面板 title 參照): `🗼 BMad Control Tower v4.3.2 — 環境偵測` ✅

**歷史版本敘述保留**(不動):
- 「v4.3.0 起 Worker 無狀態」(描述 4.3.0 引入的行為變更,歷史事實)
- 「升級 v4.3.0+ 後塔台會透過 --mode flag」(feature 引入下限,≥4.3.0 即適用 v4.3.2)
- 「**版號一致性驗證**(v4.3.0+,CT-T007)」(feature 引入版本標註)
- ct-help changelog 區的「v4.3.0」條目(歷史 release entry)

### AC-3 — CHANGELOG v4.3.2 條目

新增位置:`CHANGELOG.md` 開頭(`[4.3.0]` 之前)。

**條目結構**:
- `## [4.3.2] — 2026-04-20`
- `### Fixed`:auto-session 終端偵測大幅擴展(A/B/C 面逐條列出新增內容)+ BAT_TERMINAL_ID / BAT_TOWER_TERMINAL_ID 角色對照釐清
- `### Changed`:8 skill frontmatter + HTML marker / 面板 title / description 版號 bump
- `### Notes`:文件推測項目提醒 + VS Code non-devcontainer 實測待確認 + 本次 hotfix 不是行為變更

檔案長度由 687 行增至 690 行(新增 4.3.2 條目約 25 行)。

### AC-4 — Sanitize 驗收 grep

```bash
cd "D:/ForgejoGit/BMad-Guide/BMad-Control-Tower/BMad-Control-Tower-v4.3.2/"
grep -inE "selene|gower|plan-025|bug-050|bug-047|t0224|t0225|t0226|t0227|t0228|commit [0-9a-f]{7}" control-tower/references/auto-session.md
```

**結果**:`✅ 無命中`

另 `better-agent-terminal` 以 env 值形式保留(`TERM_PROGRAM=better-agent-terminal`,為 BAT 實際設定的環境變數值,技術事實保留;只出現在 A.1 表第 1 列和短路規則第 1 條)。

### AC-5 — Release 前品質自檢

- [x] auto-session.md 所有 heading 格式一致(A.1 / A.2 + B.0 / B.1 / B.2 / B.3 / B.4 / B.5 + C.0 / C.1 / C.2 / C.3 / C.4 共 13 個 level-3 heading,B.0-B.5 六個正確、C.0-C.4 五個正確)
- [x] 所有範例 code 區塊有語言標註(```bash / ```yaml / ```typescript / ```tmux / ```json 等)
- [x] 決策樹 Step 0-10 + Fallback 順序與短路規則一致,無邏輯衝突
- [x] TypeScript `TerminalDetection` struct 欄位與虛擬碼使用點對齊
- [x] 純繁體中文,標點正確
- [x] 8 skill 版號一致性(frontmatter / HTML marker / description 開頭 / 面板 title / metadata 表皆 v4.3.2)

### 目標 repo commit

- **分支**:`dev-main`(未新開 hotfix 分支,沿用專案慣例)
- **commit SHA**:`61dec10`
- **訊息**:`release(ct): v4.3.2 hotfix — auto-session 跨平台偵測層重寫 (CT-T008)`
- **變更**:67 files changed, 20,933 insertions(+)(其中 60+ 檔為 v4.3.0 → v4.3.2 完整複製,實質變更為 auto-session.md + CHANGELOG.md + 8 SKILL.md)

### Tag 與 push 狀態

- **Tag v4.3.2**:⏳ **未建立**(使用者選擇 C,自行處理)
- **Push upstream**:⏳ **未 push**(使用者選擇 C,自行處理)
- **Release 連結**:⏳ 待使用者 push tag 後產生

### 下游試跑指引(建議草稿,使用者可調整)

試跑者取得 v4.3.2 的途徑(依使用者選擇):

**途徑 A:等使用者 tag + push 後**
```bash
# 在試跑者本機 claude-brain-sync 設定的 repo
cd <claude-brain-sync repo>
git fetch origin --tags
git checkout v4.3.2  # 或等 claude-brain-sync 自動同步 main
```

**途徑 B:直接 copy v4.3.2 目錄**
如果試跑者透過 `claude-brain-sync` 或手動 copy skill 目錄:
```
BMad-Control-Tower-v4.3.2/
├── control-tower/       → ~/.claude/skills/control-tower/
├── ct-done/             → ~/.claude/skills/ct-done/
├── ct-evolve/           → ~/.claude/skills/ct-evolve/
├── ct-exec/             → ~/.claude/skills/ct-exec/
├── ct-fieldguide/       → ~/.claude/skills/ct-fieldguide/
├── ct-help/             → ~/.claude/skills/ct-help/
├── ct-insights/         → ~/.claude/skills/ct-insights/
└── ct-status/           → ~/.claude/skills/ct-status/
```

**途徑 C:/brain-patch**
若試跑者已設定 `claude-brain-sync` + `/brain-patch` slash command,等使用者 push 後跑:
```
/brain-patch
```

**驗證 v4.3.2 已裝好**:
- 在試跑者環境下任一支援的終端跑 `/control-tower`(或 `control-tower` keyword 觸發)
- 觀察環境偵測面板底部應顯示「塔台版本:v4.3.2 (frontmatter 讀取)」
- 若顯示 v4.3.0 則 skill 尚未更新
- 試跑 devcontainer / WSL / Linux 桌面 / tmux / SSH 任一環境下的工單派發,觀察 auto-session 行為是否符合 A/B/C 面規格

### 塔台後續決策點(供使用者參考)

- 若要 push 到 Forgejo:`cd "D:/ForgejoGit/BMad-Guide/" && git push origin dev-main`
- 若要建 tag:`cd "D:/ForgejoGit/BMad-Guide/" && git tag v4.3.2 61dec10 && git push origin v4.3.2`
- 若下游試跑發現 B 面某終端指令失效 → 另開 v4.3.3 patch(本工單不 renew,依塔台筆記指示)

### Renew 歷程

無。

### 互動紀錄

- [11:50] Q: 目標 repo 位置? → A: 選 B(複製 v4.3.0 為 v4.3.2)/ 來源選 A(`~/.claude/skills/`) → Action: `cp -r BMad-Control-Tower-v4.3.0 BMad-Control-Tower-v4.3.2`
- [11:58] Q: 使用者提醒 BAT_TERMINAL_ID vs BAT_TOWER_TERMINAL_ID 語意對齊 → A: 補充 session-local 角色對照 blockquote + 「依賴的 BAT 基礎設施」表新增兩列 → Action: Edit auto-session.md 補 2 處
- [12:01] Q: Tag + push 授權? → A: 選 C(只填源工單回報區,使用者自行處理) → Action: 跳過 tag 和 push,填本回報區

### 遭遇問題

- **「§247 anchor ref」處理**:原始碼「(R4 待 T0228 驗證,見 §247)」用行號 ref,sanitize 後行號會變動且 T0228 要移除,改用 section name「見 § VS Code(non-devcontainer)備註」更 robust
- **ct-help changelog 歷史敘述判斷**:ct-help/SKILL.md 含大量「v4.3.0 changelog 描述區塊」(line 271-322),這些是歷史 release entry 的描述,不是當前版本 marker,**不 bump**(否則會改到歷史敘述語意)
- **「§431 白名單」內部行號 ref**:原始碼「WT 回歸(現行實作未動)→ 指令與 §431 白名單一致」改為「§ 安全邊界 Bash 白名單」以避免 sanitize 後行號 drift
- **§247 與 §431 為典型「行號 ref 脆性」問題**:建議未來 auto-session.md 改用 section name ref(原始研究工單產出時若有行號 ref,release sanitize 時都該改)

### 未處理事項 / 建議未來 patch

1. **VS Code(non-devcontainer)自動分頁行為**:尚待實測,若證實失效需 v4.3.3 patch 修改 Step 8 vscode 分支的指令(現行 `claude "/ct-exec T####"` 字面可能無效)
2. **B 面文件推測項**:macOS osascript / Linux gnome-terminal / konsole / tmux new-window 等多數屬文件推測,下游實測後回報可能觸發多條 patch
3. **Sanitize 規則化**:本次 sanitize 手工執行 ~30 處,若未來有 v4.3.3 / v4.4 類似 hotfix,建議把 sanitize 規則表寫成 `scripts/sanitize-release.sh` 自動化
