# 工單 CT-T008-delegate-auto-session-crossplatform-hotfix-v4.3.2

## 元資料

- **工單編號**:CT-T008
- **任務名稱**:【受派】auto-session.md 跨平台偵測層重寫(A/B/C/D 四面矩陣)+ v4.3.2 hotfix release
- **類型**:implementation(DELEGATE, 跨專案)
- **狀態**:📋 TODO
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

<!-- Worker 完成後在此填寫 sanitize diff、AC-4 grep 結果、版號 bump、CHANGELOG、tag push 確認 -->
