---
schema_version: 1
schema_kind: workorder
id: CT-T020
title: "【受派】CT 接 BAT codex 分頁的 OSC 7501 信號：斷點 D 接受 `blockedDetection: osc` / `blockedReason: input`；`--wait-started` 對 codex 生效（PLAN-047 M1b-2 / D158）"
type: implementation
status: DONE
repo: BMad-Guide
project: PLAN-047
priority: P2
sizing: S
created_at: "2026-10-18T12:21:54+0800"
depends_on:
  - "T0621（`15559f8b`，契約 C-1–C-8 定稿）"
  - "BAT 含 T0621 的版本（下一個預覽版，尚未發佈；發佈後告知確切版號）"
related:
  - PLAN-047
  - D158
  - T0619
  - CT-T017
  - CT-T018
interaction:
  mode_hint: ask
  interactive: true
  intervention_type: delegate
renew_count: 0
---

# CT-T020 — codex 分頁的 `blocked` 與啟動信號

## 跨專案協調

- **協調類型**：DELEGATE
- **來源專案**：better-agent-terminal（PLAN-047 M1b-2，D158）
- **目標專案**：BMad-Control-Tower（由 **BMad-Guide 塔台**派發執行，本檔為需求規格）
- **BAT 介面權威**：BAT repo `_ct-workorders/T0621-codex-osc7501-blocked-and-start.md`「介面契約」C-1–C-8、`docs/agent-guide/blocked-state.md`（codex 節）、`docs/agent-guide/worker-launch-confirmation.md`（codex 節）、`CLAUDE.md`「blocked 狀態偵測」「Worker 啟動確認」兩節（@ `15559f8b`）。本檔與權威不一致時以權威為準，差異請在完成回覆列出。
- **BAT 最低版本**：含 T0621 的版本（下一個預覽版，發佈後告知確切版號）。舊 BAT 的 codex 分頁維持 `blockedDetection: none` / `agentStarted: null`，CT 現行行為就是正確的降級。

## 背景

codex `>= 0.163.0` 會在 PTY 送 `ESC ] 7501 ; state=idle|working|blocked`（結束 `clear`），BAT 據此（只讀、不改輸出）回報 codex 分頁的狀態與啟動（T0619 研究、T0621 實作）。CT 現行文件寫「codex Worker 一律 `blockedDetection: none`」「codex `--wait-started` 一律 `started: unknown`」，在新 BAT 上不再成立。

## BAT 新契約（摘要；完整見權威）

| 項目 | 新行為 |
|---|---|
| `blockedDetection` | 值域 `hook` / **`osc`** / `none`。`osc` = 該 PTY 出現過 OSC 7501（BAT 派工時若確認 codex `>= 0.163.0`，啟動即記 `osc`）。`hook` 分頁不會變 `osc` |
| `blockedReason` | 新增 **`input`**（`source: 'osc'`）：codex 等使用者（核准提示、Plan mode 提問等，7501 不分種類）。codex 自己送轉換時清除；**使用者輸入不清除**。優先序 `exited` > hook reason / `input` > `tower` > `working` / `idle` |
| `agentStarted` | `osc` 分頁：第一個 7501 → `true` + `agentStartedAt`；之前 `false`。`none` → `null`（不變） |
| helper `--wait-started` | 對 codex 生效：`started: <ISO>` exit 0 / `started: unconfirmed` exit **8**（實測：cwd 是未信任的 git repo，codex 卡在「Trust this folder?」畫面）/ `started: unknown` exit 0（codex 低於 0.163.0、版本確認不到、PATH 第一個是 npm shim 等）。輸出格式與 exit code 語意與 T0600 / CT-T018 相同 |
| 派工命令 | BAT 對派出的 codex Worker 另加 `-c check_for_update_on_startup=false`（避免更新提示擋住 Worker）；CT 派工指令不變 |

## 需要 CT 改的地方（建議，範圍由 BMad-Guide 決定）

1. **斷點 D**（`yolo-mode.md` § 斷點 D）：目前只認 `blockedDetection: hook` 與三種 hook reason。加上 `blockedDetection: osc` / `blockedReason: input`：codex Worker `blocked` / `input` = 在等使用者（核准或提問），比照 hook reason 只告知使用者（以分頁標題）、不代答、不送按鍵。`tower` 仍不是斷點 D。
2. **`--wait-started` / `agentStarted` 說明**（`auto-session.md` § Worker 啟動確認）：「codex 一律 `started: unknown`」改為「codex `>= 0.163.0` 時與 claude 相同；低於 0.163.0 或 BAT 確認不到版本時 `unknown`」。exit 8 的處理不變（不重派，看 `bat_read_output` 或請使用者看分頁）；可補一句 codex 最常見的 exit 8 原因是「Trust this folder?」或「Hooks need review」啟動畫面。
3. **其他引用 `blockedDetection` 值域的地方**（例如 `none` 的說明、MCP tool 欄位表）：把 `osc` 加進值域。

## 驗收建議

- CT 規則文件修改後，在含 T0621 的 BAT 預覽版上：派一張 codex Worker 工單帶 `--wait-started 30000` → `started: <ISO>`；（可選）手動 codex 分頁觸發核准提示 → 塔台 `bat_get_state` 看到 `blocked` / `input` / `osc`，依新斷點 D 告知使用者。
- BAT 端驗證已在 T0621 的 e2e 完成（真 codex 0.163.0 TUI、0 次模型呼叫）。

## 完成回覆

請以跨 session 訊息或 `_reply-*.md` 告知：修改的 CT 檔案與版本號、與 BAT 權威的差異（若有）、需要 BAT 補的東西（若有）。

### 收到的回覆（BAT 塔台記錄，2026-10-18T13:17:25+0800）

- **來源**：`D:\ForgejoGit\@Gower_Labs\BMad-Guide\_ct-workorders\_reply-2026-10-18-ct-t020-done.md`（BMad-Guide 塔台 12:54 撰寫，由使用者轉交）；BMad-Guide 本地工單 T0172。
- **CT 端結果**：CT **v5.8.0** ＋ control-tower-guide v5.8.0（BMad-Guide `1b4d400` 產品、`ad54f3e` 工單、`cfd0016` 收單；對方 dev-main 未 push）；本機兩端 16/16 安裝（BAT 塔台查證：`~/.claude/skills`、`~/.codex/skills` 的 `control-tower` / `ct-exec` 皆 `5.8.0`，備份 `_backup-ct-v5.7.2-20261018-124816` / `-124819`）。改 `yolo-mode.md` § 斷點 D（接受 `osc` / `input`，告知型、不代答、不送按鍵；`tower` 仍不是斷點 D）、`auto-session.md` § Worker 啟動確認（codex `>= 0.163.0` 生效、確認不到 → `unknown`、絕不 `unconfirmed`；exit 8 不重派）與 § BAT MCP 唯讀 tool 值域；派工命令逐字未改。
- **與 BAT 權威的差異**：無矛盾；對方依權威補寫 5 項（`input` 的其他清除時機、`none` → `osc`、C-7 replay、C-8 日誌 CT 不讀、PATH 判定誤差 → exit 8 也不重派）。版本標示一項 BAT 塔台查證屬實：`worker-launch-confirmation.md` 最後 commit `15559f8b`；`blocked-state.md`、`CLAUDE.md` 最後 commit `1481f65c`（T0623 縮圖 ⚠️，與 CT 無關）；`d8f019bb` 是 T0621 回報 commit。
- **BAT 最低版本**：CT 暫用占位字串「含 T0621 的 BAT 預覽版（版號待 BAT 發佈）」（32 處）。
- **BAT 待辦**（BAT 塔台追蹤）：① ✅ `v0.7.0-pre.9` 於 2026-10-18 07:16:08Z 發佈（target `c0f4dcae`，含 T0620 / T0621 / T0623），15:2x 傳訊 `bmad-guide-43` 告知版號（原收件 `bmad-guide-d8` 已不在）→ 待對方開 CT PATCH 換掉占位字串；② ⏳ 之後照本單 § 驗收建議代跑實機驗收（codex Worker `--wait-started 30000` → `started: <ISO>`；核准提示 → `blocked` / `input` / `osc`）——需先安裝 pre.9（重開 BAT），於下一個塔台 session 進行。
- **對進行中驗收的影響**：v5.8.0 於 12:48 安裝。T0625（12:40）、T0626（12:43）的 Worker 載入 v5.7.2；T0627（12:47:54 啟動）的 `ct-exec` 於 swap 前載入；T0628 / T0629 在 v5.8.0 上執行。BAT 塔台以 BMad-Guide 的 V72 / V80 比對：`ct-exec/SKILL.md` 只差版號註解，`yolo-mode.md` § Worker 向塔台提問 全文相同 → v5.7.1 / v5.7.2 提問規則的驗收結果不受影響（回函需註明）。

### BAT 代跑實機驗收（BAT 塔台記錄，2026-10-18T15:54:44+0800）

- 委託：BMad-Guide `_reply-2026-10-18-ct-v581-request-runtime.md`（CT **v5.8.1**，本機 15:26 安裝；占位字串已改 BAT `>= 0.7.0-pre.9`）。
- BAT 探針 T0637（安裝版 `0.7.0-pre.9`、codex `0.163.0` 原生 exe）：① codex Worker `--wait-started 30000` → exit `0`、`started: 2026-10-18T07:34:07.163Z`，`bat_get_state` `osc` / `agentStarted: true` — **PASS**；② 使用者手動 codex 分頁（`-a on-request -s read-only`，非 Worker 分頁）核准提示 → `blocked` / `input` / `osc`，塔台依斷點 D 只以分頁標題告知，拒絕後清除 — **PASS**；③ F-2 / ④ O-3 未自然發生（對方同意不另派）。
- 回函：`D:\ForgejoGit\@Gower_Labs\BMad-Guide\_ct-workorders\_reply-2026-10-18-ct-v581-runtime.md`；BAT 待辦 ② 完成。附帶 BAT BUG-155（T0639 修正，與 CT 無關）。
