---
schema_version: 1
schema_kind: workorder
id: T0912
title: "PLAN-068 W7（在 `v0.8.x`）：文件整理 —— `docs/agent-guide/tower-inbox.md` 過去式與交叉引用收斂、CLAUDE.md 各新節精簡、網站說明頁（待辦分頁、塔台分頁建議設定、`bat-hooks`）、README 協作章節與版本對照表、CHANGELOG `[Unreleased]`"
type: documentation
status: DONE
repo: better-agent-terminal
project: PLAN-068
priority: P2
sizing: M
created_at: "2026-11-25T06:40:09+08:00"
started_at: "2026-11-25T06:41:19+08:00"
updated_at: "2026-11-25T06:51:15+08:00"
completed_at: "2026-11-25T06:51:15+08:00"
session_ids:
  - "c279c113-cd77-47d3-a480-55ebc0270c65"
target_version: "0.8.x（與 CT 6.1.0 同日發佈）"
depends_on: [T0911]
related:
  - "PLAN-068；T0902（§2.5 文件提示、§3.5 / §7.6 README 版本對照表、§7.5 安裝步驟）；T0903–T0911 回報區（各自的文件段落）；T0911〈沒有處理的舊文字〉；D332–D335"
affects_files:
  - _ct-workorders/T0912-w7-tower-inbox-docs.md
  - CLAUDE.md
  - docs/agent-guide/
  - README.md
  - CHANGELOG.md
  - site/
renew_count: 0
isolation: worktree
workdir: "worktree ct/T0912（塔台已預先從 `v0.8.x` `17c84662` 建立分支 `ct/T0912`）"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支與 worktree：只在 worktree 分支 `ct/T0912` 寫檔。開工時確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `17c84662b6e7721c3201cc2964aacc7a920db5eb`，不符就停下問塔台。不 merge / rebase、不切分支、不 push、不動 `main` 與 `v0.8.x`。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 只改文件（`affects_files`）；🔴 不改任何程式、測試、設定（含 `site/.vitepress/config*` 以外的網站設定；網站元件 `.vue` 也不改，只改 `.md` 內容與 VitePress 導覽 / 側欄設定中新增頁面的那幾行）。與平行的 T0913（W8 整合驗收）不重疊（T0913 不改文件）。"
  - "🔴 範圍：① `docs/agent-guide/tower-inbox.md`：把 W4 節等處「W5 再加 / 之後 / 接線在 W6」這類開發過程的過去式改成現況描述，交叉引用一致、不重複（T0911〈沒有處理的舊文字〉）；保留各節的唯一實作位置與 🔴 不變式。② CLAUDE.md：PLAN-068 各新節（W0 在「塔台分頁標題」節內、W1＋W2 在 T0788 節內、W3「塔台回合訊息卡」、W4「右側欄「待辦」分頁」、W5「待辦分頁的契約 v2 清單與回答」、W6「塔台回合訊息卡 UI」、W9「BAT hooks 狀態與 `bat-hooks` plugin」）照 CLAUDE.md 撰寫規則（T0595）精簡：每節 3–12 行、只留用途、🔴 必守規則、唯一實作位置、不變式、一行連 docs；細節確保都在 docs；🔴 `##` 標題不改名（既有標題被工單引用）；可把 W3 與 W6 兩節合併成一節但要保留兩個標題中較早出現的那個名稱，並在回報區列出所有標題的前後對照。以 **Unicode 字元**量 CLAUDE.md（目前 94,967）並回報，目標 ≤ 100k。③ 網站（`site/`，VitePress）：在使用者看得到的說明頁加「右側欄待辦分頁」（各區塊、怎麼回答、版本需求：BAT 契約 v2 版本＋ CT 6.1.0，不符時的提示）、「塔台分頁建議設定」（claude `/tui fullscreen`、`/config` 關 Auto-scroll、`/focus`；BAT 不替使用者改 claude 設定）、「`bat-hooks` plugin（選用）」（何時需要、安裝 / 升級 / 移除，與 README 一致）；放在既有的 `site/control-tower.md` 或新頁（新頁要加進導覽）；三語系若網站有多語版本照既有慣例。④ README「與 BMad Control Tower 協作」：整合 W9 已加的 `bat-hooks` 小節與待辦分頁說明；版本對照表新增「待辦分頁（契約 v2）」一列（BAT 版號寫「待定」，CT `6.1.0`），`bat-hooks` 列維持「待定」——塔台定版時填。⑤ `CHANGELOG.md` `[Unreleased]`：PLAN-068 全部（W0–W6、W9）的 Added / Changed / Fixed（#23 草稿保護、#24），附工單 / BUG / PLAN 編號，寫給使用者看。"
  - "🔴 驗證：文件無壞連結（`site/` 的 VitePress `npm run docs:build` 或等效指令能成功建置，若專案有；CLAUDE.md 與 docs 的相對連結逐一檢查）；`npm run test:unit` 中檢查 CLAUDE.md / docs 的 source guard 測試全綠（完整跑一次，第一次即綠）。不需要啟動 BAT。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。"
  - "🔴 公開 repo（D176）：不寫真名、客戶名、家目錄路徑。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
---

# T0912 — PLAN-068 W7：文件整理

## 背景

PLAN-068（GitHub #24 / #23）的 W0–W6、W9 已合併進 `v0.8.x`（`17c84662`）。每張工單各自寫了 CLAUDE.md 小節與 `docs/agent-guide/tower-inbox.md` 的段落，合併後留有開發過程的過去式描述；使用者看得到的說明（網站、README、CHANGELOG）還沒寫。本單收斂文件，W8（T0913）同時做整合驗收。

## 驗收

- [x] `tower-inbox.md` 現況描述、交叉引用一致
- [x] CLAUDE.md PLAN-068 各節精簡（標題前後對照、字元數）
- [x] 網站說明頁（待辦分頁、塔台分頁建議設定、`bat-hooks`）＋導覽
- [x] README 協作章節與版本對照表（版號「待定」）
- [x] CHANGELOG `[Unreleased]`
- [x] 網站建置 / 連結檢查、source guard 測試、隔離分支證據

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **狀態**：DONE（驗收 6 項全部完成）
- **session_id**：c279c113-cd77-47d3-a480-55ebc0270c65
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`、`basename "$CT_HOME"` = `better-agent-terminal`；C-1 工單在 `$CT_HOME/_ct-workorders/` 下；C-3 `affects_files` 全部存在（`site/tower-inbox.md` 為新檔，上層 `site/` 存在）；C-2 無 `branch` 欄位。`CT_HOME` / `CT_WORKTREE_BRANCH` = `ct/T0912`；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`merge-base HEAD v0.8.x` = `17c84662b6e7721c3201cc2964aacc7a920db5eb`（符合）。
- **模式**：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；沒有向塔台提問。

### 產出摘要

Product commit：`fa658599`（`ct/T0912`，9 檔，+260 / −75）。只改文件與網站導覽 / 側欄兩行，沒有改任何程式、測試、設定或 `.vue`。

**① `docs/agent-guide/tower-inbox.md`**
- 開發過程的過去式改成現況：W4 節開頭（「W5 / W6 再做」→ 本節範圍與其他節的指向）、區塊表（「W4 內容 / 之後」→「內容 / 細節」，各區塊寫現況）、標題數字（「W5 再加 CT 清單」→ `inboxActionCount` 的完整組成）、遠端「📨 待送」（「T0908 起」→ 指向唯一說明處〈「📨 待送」在遠端視窗〉，該節補一句 T0908 起與 bat-server 版本需求）、`enqueueAnswer`（「W5 的介面 / UI 在 W5」→ 指向〈回答路徑〉）、W3 節的「W6 起 / W6 接線 / W6 顯示」、移除已不成立的已知限制「面板塔台：呼叫端在 W6」、W6 節的「W5 的 frontmatter / W3 的規則」、W9 節的「從 W9 起」、實機驗收改為「W8 整合驗收（T0913）」。
- 交叉引用：標題數字只在 W4 節定義一次（W5 節改為指向）；面板塔台定義只在「版本判定」節（W5 目標選擇改為指向）；遠端「📨 待送」只在 W5 節說明一次（W4、W1＋W2 節改為指向）。
- 檔頭對照表：W3 與 W6 合為一列對應 CLAUDE.md 合併後的節；加一段說明 CLAUDE.md 只留摘要、細節以本檔為準；加使用者說明位置（網站新頁、README 兩節）與 🔴 README「BAT hooks 與 `bat-hooks` plugin（選用）」標題是 `HOOKS_HELP_URL`（`src/lib/hooks-status.ts`）錨點、不得改名（hook 註冊節的提示也補同一句）。
- 各節唯一實作位置與 🔴 不變式全部保留（沒有刪除任何 🔴 行）。
- `docs/agent-guide/README.md` 索引列的 CLAUDE.md 小節欄同步改為合併後的標題。

**② CLAUDE.md**：94,967 → **93,427** Unicode 字元（`len(str)`，`python -X utf8`；目標 ≤ 100k）。

| 修改前標題 | 修改後 | 內容變化 |
|---|---|---|
| `## 塔台分頁標題（T0562，D147）` | 不變 | W0 那一點精簡（細節在 `tower-tab-title.md`「BAT ↔ CT 契約 v2 版本閘門」，補一行連結） |
| `## 塔台等使用者回答時保留 Worker 通知（T0788 / BUG-196，D227）` | 不變 | W1＋W2 那一點精簡，連到 `tower-inbox.md`「通知保護」 |
| `## 塔台回合訊息卡（PLAN-068 W3 / T0905）` | 不變（保留較早出現的名稱） | 併入 W6 的內容：用途、🔴 只收契約 2 / 遮罩 / 記憶體、🔴 純文字顯示 / 未讀不算標題數字、🔴 hook 規則與 helper 拒絕、面板塔台、唯一實作、連結，共 7 點 |
| `## 塔台回合訊息卡 UI（PLAN-068 W6 / T0909）` | **刪除，併入上一節** | 標題只被已結案的 T0909 / T0911 工單引用；`docs/agent-guide/README.md` 與 `tower-inbox.md` 檔頭已同步 |
| `## BAT hooks 狀態與 `bat-hooks` plugin（PLAN-068 W9 / T0910）` | 不變 | 代號清單、`hooksStatus` 形狀細節移到 docs（本來就在）；保留 `hooks:` 行文法原文；補 🔴 README 錨點不得改名 |
| `## 右側欄「待辦」分頁（PLAN-068 W4 / T0906）` | 不變 | 用途改成現況（區塊順序），拿掉「W5 / W6 再做」 |
| `## 待辦分頁的契約 v2 清單與回答（PLAN-068 W5 / T0908）` | 不變 | 目標選擇細節移到 docs；拿掉「W4 `inboxVerdict`」「T0909 …」等工單脈絡 |

每節 4–7 點（3–12 行內）；刪掉的細節逐項確認 docs 已有（代號表、`hooksStatus` 判定順序、`bat-contract:` 各種輸出、`towerContract` 生命週期、卡片上限 / 去重、面板塔台同步、回答目標選擇）。

**③ 網站（`site/`，VitePress，單一繁中語系）**
- 新頁 `site/tower-inbox.md`「待辦分頁與塔台設定」：待辦分頁（需要的版本與不符時的四種提示及處理、各區塊、怎麼回答、塔台訊息、通知保護）、塔台分頁建議設定（`/tui fullscreen`、`/config` 關 Auto-scroll、`/focus`；BAT 不替使用者改 claude 設定）、`bat-hooks` plugin（何時需要、做什麼、安裝 / 升級 / 移除指令與 README 相同、`hooks:` 行對照）。用詞取自 App 的 zh-TW 字串；版本寫「Control Tower 6.1.0＋見版本對照」（BAT 版號不寫死）。
- `site/.vitepress/config.mts`：nav「Control Tower」選單與側欄「與 Control Tower 協作」各加一行 `{ text: '待辦分頁與塔台設定', link: '/tower-inbox' }`（只有這兩行）。
- `site/control-tower.md` 整合點表加一列並連到新頁；`site/features.md`「和 Control Tower 一起用時」加一點。
- 版本對照頁（`site/compatibility.md`）以 `<!--@include: ../README.md#compatibility-->` 取用 README 的表，自動帶入新列。

**④ README「與 BMad Control Tower 協作」**
- 協作流程圖：`--set-role` 加 `[--bat-contract 2]` 與說明。
- 「BAT 提供的整合點」表新增「待辦分頁（契約 v2）」一列；agent-guide 清單加「塔台待辦與訊息」。
- 新增小節〈待辦分頁（BAT ↔ CT 契約 v2）〉：區塊表、回答方式、通知保護、`⏸N` / `💬N`、兩邊版本需求與不符時行為、codex / 面板塔台、塔台分頁建議設定（連到網站新頁），放在 W9 已有的〈BAT hooks 與 `bat-hooks` plugin（選用）〉之前；後者標題**未改**（`HOOKS_HELP_URL` 錨點）。
- 版本對照表：新增「待辦分頁（契約 v2）」列，BAT「待定」、CT `>= v6.1.0`，並寫明任一邊太舊時顯示需要的版本並停用；`bat-hooks` 列維持「待定」；T0788 列的「遠端 profile 視窗不顯示『待送 N』」改為「遠端 profile 視窗的『待送 N』：待定，同待辦分頁」（T0908 已 proxied）。

**⑤ `CHANGELOG.md` `[Unreleased]`**：Added 7 條（待辦分頁、契約 v2 清單與回答、回合訊息卡、契約版本閘門、hooks 狀態、`bat-hooks` plugin、文件）、Changed 4 條（B0、閱讀延後與立即送出、遠端「📨 待送」、總覽 `todo`）、Fixed 1 條（GitHub #23 草稿保護），各附 T#### / W#、GitHub #23 / #24；PLAN-068 沒有 BUG 單。

**驗證**
- 網站：`site/` 內 `npm ci` 後 `npx vitepress build` → `build complete in 2.83s`（VitePress 預設遇到壞的內部連結會失敗，未失敗）。
- 相對連結：自寫檢查（略過 code fence 與外部 / 錨點連結）掃 CLAUDE.md、README.md、CHANGELOG.md、`docs/agent-guide/*.md` 共 195 個相對連結，0 個壞連結；唯一被標出的是 `docs/agent-guide/terminal-links.md:11` 行內範例文字 `[text](file:///...)`，本單沒有改這個檔，不是連結。
- `npm run test:unit`（完整一次，第一次即綠）：`Test Files 490 passed | 3 skipped (493)`、`Tests 8938 passed | 47 skipped (8985)`，exit 0。repo 內沒有直接讀 CLAUDE.md / docs 內容的 source guard 測試（grep 確認；只有註解引用），README 錨點由 `HOOKS_HELP_URL` 常數指向，標題未改。
- `git diff --check` 無空白問題；所有改動檔 `i/lf w/lf`；新增內容沒有真名、客戶名、家目錄路徑。
- 不需要啟動 BAT。

### 互動紀錄
- [06:41] 開工，落點檢查 PASS，merge-base 符合。
- [06:44] Worktree 沒有 `node_modules`：依 CLAUDE.md 以 `npm ci` 安裝根目錄與 `site/`（exit 0）。
- 未向塔台或使用者提問。

### Renew 歷程
無

### 遭遇問題
- 無阻擋問題。
- 判讀紀錄（自行決定、未提問）：① W3 與 W6 兩節依工單允許合併，保留較早出現的標題；② `/focus` 的效果依 T0901 查證（只在 fullscreen、只顯示輸入 / 摘要 / 回應）撰寫；③ T0902 提到的「塔台分頁第一次宣告時待辦分頁頂端顯示一次建議」BAT 目前沒有實作（grep `src/` 沒有），所以網站與 README 只寫成文件建議，沒有描述成 App 內提示；④ README T0788 版本列「遠端不顯示待送 N」已過時，改成「待定，同待辦分頁」，塔台定版時一併填。
- 建議後續（交塔台定版時處理）：README 版本對照表「待辦分頁」「`bat-hooks`」與 T0788 列括號內的「待定」三處填 BAT 版號。

### 隔離分支證據
- branch：`ct/T0912`
- base_sha：`06c3b8843caf4f34bbec6117b0de443b7a3fdbf9`（`CT_WORKTREE_BASE`；分支實際從 `17c84662b6e7721c3201cc2964aacc7a920db5eb` 起，`merge-base HEAD v0.8.x` = `17c84662…`，符合工單）
- validated_sha：`fa658599f0a39e93c5038167062625cfb1bd5c44`
- head_sha：`fa658599f0a39e93c5038167062625cfb1bd5c44`
- validated_sha ≠ head_sha 的說明：相同。驗證（網站建置、連結檢查、`test:unit`）在 `17c84662` 加上未提交的工作樹上執行，之後把同一份工作樹原樣提交為 `fa658599`，提交後 `git status --porcelain` 為空，期間沒有再改任何檔案，所以驗證的內容就是 `fa658599`。
- `git -C "$CT_WORKTREE" status --porcelain`：空。

### 回報時間
2026-11-25T06:50:22+08:00
