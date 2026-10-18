---
schema_version: 1
schema_kind: workorder
id: T0631
title: "安裝 Claude Code plugin `frontend-design`（Anthropic 官方目錄），供網站 v2 設計與實作使用"
type: maintenance
status: PENDING
repo: better-agent-terminal
project: PLAN-049
priority: P2
sizing: XS
created_at: "2026-10-18T13:08:27+0800"
depends_on: []
related:
  - "D162（網站 v2 加入 frontend-design / theme-factory / Design 畫布定方向）；後續 T0632（視覺方向）、T0630（實作）都要在本單完成後開新 session 才載入得到"
  - "CT `references/data-layer-architecture.md` § 寫入規則 Q3（安裝須工單明文授權）、`references/version-governance.md` § 安裝／升級流程"
affects_files:
  - _ct-workorders/T0631-install-frontend-design-plugin.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 **明文授權（CT 寫入規則 Q3）**：使用者 2026-10-18 約 13:06 於塔台分頁要求「幫我安裝 SKILL」（`frontend-design`）。授權範圍只限：① 對象 = Claude Code plugin **`frontend-design`**，作者 Anthropic，來源為 Claude Code 內建的 Anthropic 官方 plugin 目錄（marketplace `anthropic-plugin-directory`；repository `anthropics/claude-plugins-official`、路徑 `plugins/frontend-design`；目錄審查 commit `ea10b213686c90bb1984b2016937310e05336cf3`）；② 版本 = 該 marketplace 安裝當下提供的版本（安裝後記錄實際 version / commit）；③ 目標 = Claude Code **user scope**（由 CLI 管理的 `~/.claude/plugins/`），**只能**用 `claude plugin install` 指令安裝。"
  - "🔴 授權不及於：手動複製 / 編輯 `~/.claude/skills/` 或 `~/.claude/plugins/` 下任何檔案；`~/.codex/skills/`（Codex 端不安裝）；其他 plugin；新增或移除 marketplace；改 Claude Code 設定檔。"
  - "🔴 安裝前查到的 marketplace 條目若作者不是 Anthropic、名稱不是 `frontend-design`、來源 repository 不是 `anthropics/claude-plugins-official`，或安裝指令要求確認 marketplace 宣告的 command（`--json` 回報 `shownCommand`）→ **不安裝**，向塔台提問。"
  - "🔴 不改 repo 內任何其他檔案；`src/styles/settings.css` 的 M 不是你的變更。不 push。commit 只含本工單（`git commit --only <本檔>`）。回報區不得出現任何權杖值。"
---

# T0631 — 安裝 `frontend-design` plugin

## 目標

網站 v2（PLAN-049）要用 Anthropic 官方的 `frontend-design` skill 決定視覺方向與實作。依 CT 寫入規則，塔台不能自己裝，改由本單在使用者明文授權下安裝（授權範圍見 frontmatter `memory_overrides`）。

## 步驟

1. **確認來源**：`claude plugin marketplace list` 確認內建 Anthropic 目錄存在；查 `frontend-design` 條目（名稱、作者、來源 repository、版本 / commit），不符授權範圍就停下提問。
2. **安裝**：`claude plugin install frontend-design@anthropic-plugin-directory --json`（marketplace 名稱以第 1 步實際看到的為準；若 CLI 只接受其他寫法，照 `claude plugin install --help` 調整，並在回報區說明）。記下 exit code 與 JSON 結果。
3. **複驗**：
   - `claude plugin list` 顯示 `frontend-design`、scope `user`、enabled
   - 找到安裝後的 `SKILL.md`（唯讀），記錄路徑、`name` 與 description 第一句、SHA-256
   - （可取得時）以 `gh api repos/anthropics/claude-plugins-official/contents/plugins/frontend-design/skills/frontend-design/SKILL.md?ref=<安裝的 commit>`（唯讀）取來源檔，比對 SHA-256；取不到就記錄原因，不算失敗
   - 不另開 claude session 測試（新 session 啟動後才會載入，T0632 會實際用到）
4. **備份**：全新安裝、沒有舊版，不需備份（在回報區註明）。
5. **回退方式**：寫出 `claude plugin uninstall frontend-design@<marketplace>`（不執行）。

## 驗收

- `frontend-design` 已安裝且 enabled（user scope），來源與授權範圍相符
- 回報區附：marketplace 條目資訊、安裝指令與結果、`plugin list` 輸出、`SKILL.md` 路徑與 SHA-256（與來源比對結果）、回退指令
- 沒有手動寫入 `~/.claude/skills/`、`~/.claude/plugins/`、`~/.codex/skills/`

---

## 回報區

（Worker 填寫）
