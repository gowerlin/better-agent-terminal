# T0343 — Fix BUG-075 prefix mismatch：Tower skill + BAT app 雙修

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0343 |
| 類型 | bugfix（Q1.C 雙修路線） |
| 所屬 | BUG-075（Tower skill 派發協定缺陷 + BAT app normalize fallback） |
| 狀態 | 🔄 IN_PROGRESS |
| 建立時間 | 2026-04-27 14:08 (UTC+8) |
| Sizing | M（estimate 45-90 min wall；跨 skill + app + Tower skill sync） |
| 依賴 | T0341（MSYS path 修好才能驗 prefix）/ T0329 補充鑑別段落 |
| 後續 | T0345（e2e 一起驗） |
| 互動旗標 | `--mode ask --interactive`（跨 skill / app 兩處設計選擇可能需澄清） |
| 工作目錄 | main repo + Tower skill 路徑（`C:/Users/Gower/.codex/skills/control-tower/` + `C:/Users/Gower/.claude/skills/control-tower/`） |
| `affects_files` | Tower skill `SKILL.md` + `references/auto-session.md`（兩個 home 都要同步）+ `electron/main.ts` `terminal:create-agent-command` handler |
| Release target | v0.4.2.1 hotfix（BAT app 端）+ Tower skill 跨專案 sync（v4.4.1 candidate） |
| 開始時間 | 2026-04-27 14:27:10 +08:00 |

## 背景

T0329 補充鑑別揭：Tower skill 把 `--agent default` 視為 agent-agnostic，但 prompt 硬編碼 `/ct-exec`。Codex agent 應收 `$ct-exec`（Codex skill prefix 慣例）。BAT UI ControlTowerPanel 對 codex-cli 已正確產生 `codex "$ct-exec T####"`，唯獨 Tower skill BAT auto-session 路徑硬編碼 slash。

塔台拍板（Q1.C）：**雙修**
1. Tower skill 端修派發契約（根因修法）
2. BAT app 端加 backward-compat normalize（保護未升級的 Tower skill）

## 任務範圍

### Part 1：Tower skill 端（根因修法）

**修改範圍**：
- `C:/Users/Gower/.codex/skills/control-tower/SKILL.md`（Bash 白名單 + Agent CLI 解析規則段落）
- `C:/Users/Gower/.codex/skills/control-tower/references/auto-session.md`
- `C:/Users/Gower/.claude/skills/control-tower/SKILL.md`（同步）
- `C:/Users/Gower/.claude/skills/control-tower/references/auto-session.md`（同步）

**契約調整**：
- BAT 內部終端 prompt 字串不再硬編碼 `/ct-exec`
- 規格改為：「prompt prefix 由 BAT default agent runtime 決定（`/` for Claude、`$` for Codex），塔台派發前必先 resolve agent runtime」
- 或：「prompt 仍寫 `/ct-exec`，但接收端（BAT app）依 resolved agent normalize」（搭配 Part 2）

**互動點**：兩種規格寫法（塔台主動 resolve vs BAT app normalize）哪個寫進 skill 規格？建議走後者（BAT app 端為唯一 normalize point，Tower skill 規格保持簡潔），但 Worker 應提問確認。

### Part 2：BAT app 端（backward-compat normalize）

**修改範圍**：
- `electron/main.ts` `terminal:create-agent-command` handler

**邏輯**：
- Resolve `agent` 參數（`default` → 讀 settings `defaultAgent`，目前為 `codex-cli`）
- 若 resolved agent 為 Codex 系列（`codex-cli` / `codex-agent`）且 prompt 開頭為 `/ct-`，自動 normalize 為 `$ct-`
- 若已是 `$` 開頭則 pass through
- Log `prefix-normalized` 事件供觀察

## 驗收條件

- ✅ Tower skill 兩個 home（codex + claude）SKILL.md / auto-session.md 規格更新一致
- ✅ `electron/main.ts` `terminal:create-agent-command` 加 normalize 邏輯
- ✅ 手動驗證：BAT default agent 設 codex-cli，跑一次 Tower auto-session 派發，確認 codex 收到 `$ct-exec T####`（不是 `/ct-exec`）
- ✅ Existing tests 全綠
- ✅ Tower skill 改動需告知使用者要在 BMad-Control-Tower 跨 repo 同步（DELEGATE 工單，下一張或本張收尾時提示）

## OOS（不在範圍內）

- regression test（unit + integration）→ T0345 e2e 一起涵蓋
- 不動 BAT UI ControlTowerPanel（已正確）
- 不動其他 agent runtime（Gemini / 其他）

## 參考資料

- T0329 補充鑑別段落
- BUG-075 後續處理段落
- `src/utils/control-tower-launch.ts`（BAT UI 既有 prefix resolution 範本）

---

## 回報區（Worker 填）

### 完成摘要
FIXED — 修復已完成，等待驗收。

- 採用使用者確認的 C 契約：`bat-terminal.mjs` 新增 agent-neutral API `--skill ct-exec --workorder T####` / `--skill ct-done --workorder T####`。
- BAT app 端統一作為 prefix decider：`terminal:create-agent-command` 依 resolved agent 產生 Claude `/ct-*` 或 Codex `$ct-*` prompt。
- 舊 Tower skill 若仍送 `--prompt "/ct-exec T####"`，Codex runtime 會做 backward-compat normalize 為 `$ct-exec T####`，並記錄 `prefix-normalized` 事件。
- `codex-agent` / `codex-agent-worktree` 在 remote terminal agent-command 路徑會映射到 `codex-cli`，保持 terminal-driven 啟動語意。

### Tower skill 修改
- 已同步修改兩個 home：
  - `C:/Users/Gower/.codex/skills/control-tower/SKILL.md`
  - `C:/Users/Gower/.codex/skills/control-tower/references/auto-session.md`
  - `C:/Users/Gower/.claude/skills/control-tower/SKILL.md`
  - `C:/Users/Gower/.claude/skills/control-tower/references/auto-session.md`
- 規格更新為 BAT 內部終端白名單使用：
  - `node scripts/bat-terminal.mjs --notify-id $BAT_TERMINAL_ID --workspace "$BAT_WORKSPACE_ID" --mode <yolo|ask|off|on> [--interactive|--no-interactive] --agent default --skill ct-exec --workorder T####`
  - `node scripts/bat-terminal.mjs --notify-id $BAT_TERMINAL_ID --workspace "$BAT_WORKSPACE_ID" --mode <yolo|ask|off|on> [--interactive|--no-interactive] --agent default --skill ct-done --workorder T####`
- 新 API 規格已寫清楚供 T0345 e2e 引用：Tower skill 不寫 `/` 或 `$`，只傳 `--skill` + `--workorder`；BAT app `terminal:create-agent-command` 依 resolved agent 決定 prompt prefix。
- 兩個 home 不是 git repository，無獨立 commit hash；已用 `git diff --no-index` 驗證 codex/claude 版本一致。

### BAT app 修改
- `scripts/bat-terminal.mjs`
  - 新增 `--skill <ct-exec|ct-done>` 與 `--workorder <T####>` 解析、help、範例與 allowlist 驗證。
  - `--prompt`、`--skill/--workorder`、positional command 三種模式互斥；缺任一成對參數會在連 RemoteServer 前失敗。
  - agent-neutral payload 仍走既有 `terminal:create-agent-command` channel，並保留 `MSYS_NO_PATHCONV=1`。
- `electron/main.ts`
  - `terminal:create-agent-command` 接受 `prompt` 或 `skill+workorder` 二選一。
  - `buildControlTowerSkillPrompt()` 依 resolved terminal agent 組 `/ct-exec T####` 或 `$ct-exec T####`。
  - `normalizeControlTowerPromptForAgent()` 對 Codex 系列 legacy `/ct-` prompt 做 `$ct-` fallback normalize。
  - normalize 發生時寫入 app log 與 BAT script mirror event：`prefix-normalized`。

### 驗證紀錄
- `node scripts/bat-terminal.mjs --help`：通過，help 顯示 `--skill <name> --workorder <T####>` 與新範例。
- `node scripts/bat-terminal.mjs --skill ct-exec --workorder BAD`：通過，於連線前拒絕 invalid workorder。
- `node scripts/bat-terminal.mjs --skill ct-exec`：通過，於連線前拒絕缺少 `--workorder`。
- `node scripts/bat-terminal.mjs --skill ct-exec --workorder T0001`：通過，BAT RemoteServer 回應 terminal created；BAT script log 顯示 payload `skill:"ct-exec", workorder:"T0001"` 且 channel 為 `terminal:create-agent-command`。
- `npm run compile`：通過。
- `npm run test:unit`：通過，10 test files / 187 tests。
- `git diff --check -- scripts/bat-terminal.mjs electron/main.ts _ct-workorders/T0343-fix-bug075-prefix-mismatch-dual.md`：通過。
- `git diff --no-index` 驗證 `C:/Users/Gower/.codex/skills/control-tower/` 與 `C:/Users/Gower/.claude/skills/control-tower/` 的 `SKILL.md`、`references/auto-session.md` 一致。

### 互動紀錄
- [14:27] Q: Tower skill 規格採 A/B/C 哪種契約？ → A: C，新增 `--skill/--workorder` agent-neutral API，BAT app 作唯一 prefix decider 並保留 legacy normalize fallback → Action: 依 C 實作並更新回報規格供 T0345 引用。

### OOS but justified（如有）
- `sprint-status.yaml` 存在但內容停留在早期全專案摘要，檔頭標示「重要節點由 Tower 更新」；本工單未直接改寫，標記為不適用。
- Tower skill home 目錄不在 git repository 內，無法產生該目錄 commit；已直接同步兩份 skill 檔，並提醒需把同樣變更同步回 BMad-Control-Tower 跨 repo。
- 未修改 BAT UI `ControlTowerPanel`，符合 OOS；該路徑既有 `src/utils/control-tower-launch.ts` 已能產生 Codex `$ct-*`。

### Renew 歷程
無

### Commit
待 commit 後補填

---

**狀態**：🔄 IN_PROGRESS
