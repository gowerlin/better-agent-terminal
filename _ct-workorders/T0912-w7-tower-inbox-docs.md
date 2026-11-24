---
schema_version: 1
schema_kind: workorder
id: T0912
title: "PLAN-068 W7（在 `v0.8.x`）：文件整理 —— `docs/agent-guide/tower-inbox.md` 過去式與交叉引用收斂、CLAUDE.md 各新節精簡、網站說明頁（待辦分頁、塔台分頁建議設定、`bat-hooks`）、README 協作章節與版本對照表、CHANGELOG `[Unreleased]`"
type: documentation
status: PENDING
repo: better-agent-terminal
project: PLAN-068
priority: P2
sizing: M
created_at: "2026-11-25T06:40:09+08:00"
updated_at: "2026-11-25T06:40:09+08:00"
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

- [ ] `tower-inbox.md` 現況描述、交叉引用一致
- [ ] CLAUDE.md PLAN-068 各節精簡（標題前後對照、字元數）
- [ ] 網站說明頁（待辦分頁、塔台分頁建議設定、`bat-hooks`）＋導覽
- [ ] README 協作章節與版本對照表（版號「待定」）
- [ ] CHANGELOG `[Unreleased]`
- [ ] 網站建置 / 連結檢查、source guard 測試、隔離分支證據

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **session_id**：

### 產出摘要

### 互動紀錄

### Renew 歷程
無

### 遭遇問題

### 隔離分支證據
- branch：`ct/T0912`
- base_sha：
- validated_sha：
- head_sha：
- validated_sha ≠ head_sha 的說明：

### 回報時間
