---
schema_version: 1
schema_kind: workorder
id: T0631
title: "安裝 Claude Code plugin `frontend-design`（Anthropic 官方目錄），供網站 v2 設計與實作使用"
type: maintenance
status: DONE
started_at: "2026-10-18T13:11:21+0800"
updated_at: "2026-10-18T13:13:05+0800"
completed_at: "2026-10-18T13:13:05+0800"
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

### 結果摘要

**DONE**。`frontend-design@anthropic-plugin-directory` 已以 `claude plugin install` 裝在 user scope、enabled；來源（名稱 / 作者 Anthropic / `anthropics/claude-plugins-official` `plugins/frontend-design` / commit `ea10b213686c90bb1984b2016937310e05336cf3`）與授權範圍相符。安裝後的 `SKILL.md` 與來源 commit 的檔案內容一致（差異只有換行符，見下）。新 session 啟動後才會載入。

### Landing check

- **PASS**。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）。C-1 PASS。C-3 不適用（`affects_files` 只有本工單）。C-2 無 `branch` 欄位（目前 `main`）。
- `CT_HOME` 未設定（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 1. 來源確認

- Claude Code `2.1.302`。`claude plugin marketplace list`：`anthropic-plugin-directory`，Source: `Built in (Anthropic Directory)`。
- `claude plugin list --available --json` 的條目：
  - `pluginId`: `frontend-design@anthropic-plugin-directory`，`description`: `Frontend design skill for UI/UX implementation`
  - `source`: `git-subdir`，`url` `https://github.com/anthropics/claude-plugins-official`，`path` `plugins/frontend-design`，`sha` `ea10b213686c90bb1984b2016937310e05336cf3`
- 作者：CLI 的 directory 條目不含 author 欄位，改以 CLI 自己的快取（唯讀）確認：`~/.claude/plugins/plugin-directory-cache-v2.json` 的 listing `checks.review` = `state: done`、`by.type: anthropic`，`reviewed_commit` 同上；`plugin-catalog-cache.json` 的 marketplace entry `author.name` = `Anthropic`（`support@anthropic.com`）。安裝後的 `.claude-plugin/plugin.json` 也是 `author.name: Anthropic`。
- 三項條件（名稱、作者、repository）皆符合；安裝未要求確認 marketplace 宣告的 command（JSON 結果沒有 `shownCommand`），未使用 `-y` / `--accept-command`。

### 2. 安裝

- 指令：`claude plugin install frontend-design@anthropic-plugin-directory --json`（stdin 接 `/dev/null`，與工單寫法相同，未調整）
- exit code：`0`
- JSON：`{"command":"install","outcome":"ok","plugin":"frontend-design@anthropic-plugin-directory","pluginId":"frontend-design@anthropic-plugin-directory","scope":"user","message":"Successfully installed plugin: frontend-design@anthropic-plugin-directory (scope: user)"}`

### 3. 複驗

`claude plugin list`：

```
  ❯ frontend-design@anthropic-plugin-directory
    Version: ea10b213686c-65ba16f3
    Scope: user
    Status: ✔ enabled
```

`--json`：`version` `ea10b213686c-65ba16f3`、`scope` `user`、`enabled: true`、`projectEnabled: false`、`installedAt` `2026-10-18T05:11:55.882Z`、`installPath` `C:\Users\Gower\.claude\plugins\cache\anthropic-plugin-directory\frontend-design\ea10b213686c-65ba16f3`。

安裝內容：`.claude-plugin/plugin.json`、`LICENSE`、`README.md`、`skills/frontend-design/LICENSE.txt`、`skills/frontend-design/SKILL.md`。

`SKILL.md`：

- 路徑：`C:\Users\Gower\.claude\plugins\cache\anthropic-plugin-directory\frontend-design\ea10b213686c-65ba16f3\skills\frontend-design\SKILL.md`
- `name`: `frontend-design`
- description 第一句：「Guidance for distinctive, intentional visual design when building new UI or reshaping an existing one.」
- SHA-256（磁碟原樣，CRLF，9461 bytes）：`b8009ae690dfa69edc7f08bb8715f32db8817112cfa4388741dbaf876c237df8`
- SHA-256（去 CR 後）：`d91970639e9f5c37682ac7ab60094d35f1c7c1f38d731bd56396563aee10c1d3`
- 來源：`gh api -H "Accept: application/vnd.github.raw" "repos/anthropics/claude-plugins-official/contents/plugins/frontend-design/skills/frontend-design/SKILL.md?ref=ea10b213686c90bb1984b2016937310e05336cf3"`（exit 0，LF，9390 bytes）SHA-256 `d91970639e9f5c37682ac7ab60094d35f1c7c1f38d731bd56396563aee10c1d3`
- **比對結果：去 CR 後與來源逐位元組相同**（`cmp` 一致；兩邊都是 71 行，差 71 bytes = 每行一個 CR）。原樣 hash 不同是因為本機 `git config --system core.autocrlf` = `true`，CLI 以 git checkout 取得 subdir 時轉成 CRLF，不是內容差異。

### 4. 備份

全新安裝：安裝前 `installed` 只有 `codex@openai-codex`，沒有舊版，不需備份。

### 5. 回退方式（未執行）

```
claude plugin uninstall frontend-design@anthropic-plugin-directory
```

### 範圍遵守

- 沒有手動寫入 `~/.claude/skills/`、`~/.claude/plugins/`、`~/.codex/skills/`；`~/.claude/plugins/` 下只讀取 CLI 快取檔與安裝結果。沒有新增 / 移除 marketplace，沒有改 Claude Code 設定檔（user scope 的 enable 狀態由 `claude plugin install` 自己寫入）。
- 附帶發現：`~/.codex/skills/frontend-design/` 早已存在（目錄時間 2026-05-26 20:35 +0800），不是本單建立，也未變動（Codex 端不在本單範圍）。`~/.claude/skills/` 下沒有 `frontend-design`。
- repo 內只改本工單；`src/styles/settings.css` 的 M 不是本單變更，未動。
- 回報區沒有任何權杖值。

### Commit

- 無產品變更（安裝在 repo 外）。工單 commit 以 `git commit --only _ct-workorders/T0631-install-frontend-design-plugin.md`，hash 見 git log（commit 後才產生，不回填）。不 push。

### 互動紀錄

無（未向塔台提問）。
