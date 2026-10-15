---
schema_version: 1
schema_kind: workorder
id: CT-T011
title: "【受派】CT 下一版：`*config` 新增 `worker_auto_close` / `worker_close_delay`，收單確認後以 BAT `--close-worker` 回收 Worker 分頁"
type: implementation
status: PENDING
repo: BMad-Guide
project: PLAN-041
priority: P3
sizing: S
created_at: "2026-10-15T15:44:39+0800"
updated_at: "2026-10-15T15:44:39+0800"
depends_on: [T0535]
related:
  - PLAN-041（「介面契約」節為權威規格）
  - T0534（研究回報 §2：CT 收單流程與掛點）
  - D144
  - CT-T001（前例：BAT 路由的 CT skill 修改委派）
interaction:
  mode_hint: ask
  interactive: true
  intervention_type: delegate
renew_count: 0
---

# CT-T011 — CT `*config` 回收 Worker 分頁

## 跨專案協調

- **協調類型**：DELEGATE（取代 PLAN-041 原 B'-3 local_rule；使用者 2026-10-15 決定「不做 local_rule，加在下一版 CT」）
- **來源專案**：better-agent-terminal（PLAN-041）
- **目標專案**：BMad-Control-Tower（`D:\ForgejoGit\@Gower_Labs\BMad-Guide\BMad-Control-Tower\`，現行 v5.0.9；由 **BMad-Guide 塔台**派發執行，本檔為需求規格）
- **發佈條件**：撰寫可與 T0535 並行；CT 新版**發佈**需等含 T0535 的 BAT 版本（預計 `0.6.1-pre.3`）發出。舊 BAT 呼叫只會 exit 1（見下方 exit code），不會誤建分頁，所以 CT 先發也不會造成損害，只是功能無效。

## 修改清單

### 1. `*config` 新增兩個選項

`control-tower/SKILL.md` 的可用選項表與 `references/tower-config.md`（「可用選項」表、持久化檔案範例、「擴展新選項」定義）同步新增：

| 選項 | 有效值 | 預設 | 說明 |
|---|---|---|---|
| `worker_auto_close` | `off` / `done` | `off` | `done` = 工單 `DONE` 且不 Renew、輸出收單確認後，呼叫 BAT 回收該工單的 Worker 分頁。`PARTIAL` / `FAILED` / `BLOCKED` 與需要 Renew 的單一律不回收。僅在 BAT 環境（`BAT_SESSION=1`）且該工單是由本塔台以 `bat-terminal.mjs` 派出時生效 |
| `worker_close_delay` | `0` – `300`（秒） | `10` | 回收前的延遲，以 `--delay-ms` 傳給 BAT。延遲期間 Worker 分頁有新輸出或使用者輸入，BAT 會取消回收 |

### 2. 收單流程掛點

`references/work-order-system.md` 的回報處理流程（以及 `SKILL.md` 摘要）在「輸出 `✅ T#### 已確認完成`」之後新增一步：

- 條件：`worker_auto_close == done`、`status == DONE`、本次不 Renew、`BAT_SESSION=1`
- 動作：

  ```bash
  node "$BAT_HELPER_DIR/bat-terminal.mjs" --close-worker T#### --notify-id "$BAT_TERMINAL_ID" --delay-ms <worker_close_delay × 1000>
  ```

  `BAT_HELPER_DIR` 未設定時沿用 `auto-session.md` 既有的安裝目錄 fallback。

### 3. exit code 處理（依 PLAN-041 契約，只看 exit code，不解析 stdout）

| exit | 處理 |
|---|---|
| `0` | 靜默（可在確認區塊加一行「Worker 分頁將於 N 秒後回收」） |
| `3`（NOT_FOUND） | 靜默；必要時提示一次「找不到 Worker 分頁，請手動關閉」 |
| `4`（NOT_OWNER）/ `5`（AMBIGUOUS）/ `6`（BUSY） | 一行回報使用者，不重試 |
| `1` 或其他 | 一行警告「BAT 不支援 `--close-worker` 或連線失敗」，同一 session 不再重試 |

回收失敗**不影響**收單結果與工單狀態。

### 4. Bash 白名單

`references/auto-session.md` 的塔台 Bash 白名單加入上述 `--close-worker` 指令形式（只允許工單編號格式的參數與數字 delay）。

### 5. yolo 模式

`references/yolo-mode.md`：yolo 自主收單同樣適用；斷點判斷不受回收結果影響。

### 6. 雙端同步與版號

- Claude 版（`~/.claude/skills/`）與 Codex 版（`~/.codex/skills/`）內容一致（T0534 確認兩者目前 IDENTICAL，設定檔路徑同為 `~/.claude/control-tower-data/config.yaml`）
- 版號依 `version-governance.md` 決定（新增選項，建議 minor）；`docs/CHANGELOG.md` 記錄；安裝後兩端 `diff -r` 與新版目錄 IDENTICAL

## 驗收條件

- [ ] `*config` 列出兩個新選項，預設 `off` / `10`；`--save project` / `--save global` 可寫入
- [ ] `worker_auto_close=off` 時收單流程與現行完全相同
- [ ] 實機（BAT 含 T0535 的版本）：Claude 塔台與 Codex 塔台各派一張單 → DONE 收單 → 分頁在延遲後消失；PARTIAL 單不回收；延遲期間在 Worker 分頁打字 → 不回收
- [ ] 舊版 BAT：收單時出現一行「不支援」警告，收單正常完成
- [ ] Claude / Codex 兩端與新版目錄 IDENTICAL

## 回報區

（BMad-Guide 塔台 / Worker 填寫）

**BMad-Guide 塔台回報（2026-10-15 17:14 UTC+8）**

- **結果**：source／install ✅ **DONE**；runtime ⏳ **待 BAT 含 `--close-worker` 的版本**
- **CT 新版號**：**v5.1.0**（MINOR：新增設定選項；與 CT-T011／CT-T012 同版發佈）
- **commit**：BMad-Guide repo `cb2aa09`（branch `dev-main`，**未 push**）
- **執行工單**：BMad-Guide `T0134`（決策 D015）；runtime 驗收另開 `T0136`（BLOCKED）
- **安裝**：`~/.claude/skills/`、`~/.codex/skills/` 兩端 8 skill 與 `BMad-Control-Tower/BMad-Control-Tower-v5.1.0/skills/` 逐檔一致（16/16，BMad-Guide 塔台獨立複驗）；
  回退備份 `~/{.claude,.codex}/skill-backups/_backup-ct-v5.0.9-20261015-165743/`；下一個 session 生效
- **本 repo（better-agent-terminal）**：BMad-Guide 端只讀，未做任何 commit（僅填寫本回報區）

**驗收條件對照**

| 驗收條件 | 結果 |
|---|---|
| `*config` 列出兩個新選項，預設 `off`／`10`；`--save project`／`--save global` 可寫入 | ✅ `tower-config.md` § 可用選項 + 持久化範例；寫入行為為通用合併流程，新列加入表即涵蓋 |
| `worker_auto_close=off` 時收單流程與現行完全相同 | ✅ `work-order-system.md` 原回報處理流程逐字未動；新增獨立子節，首條件即 `worker_auto_close == done` |
| 實機：Claude／Codex 塔台各派一單 → DONE 收單 → 延遲後分頁消失；PARTIAL 不回收；延遲期間打字不回收 | ⏳ **未驗**。本機 BAT helper `grep -c -- --close-worker` = 0（舊版）。BMad-Guide `T0136` 待 BAT `0.6.1-pre.3` 安裝後由塔台主持 |
| 舊版 BAT：一行「不支援」警告，收單正常 | ✅ 2026-10-15T16:58 實測 `--close-worker T0000 --delay-ms 0` → `Unknown option '--close-worker'`、exit 1、**未建立分頁**（`bat-scripts.log` 無 `terminal-created`） |
| Claude／Codex 兩端與新版目錄 IDENTICAL | ✅ 16/16 |

**實作位置**（v5.1.0）：收單掛點 `control-tower/references/work-order-system.md` § 收單後回收 Worker 分頁（指令與 PLAN-041 § 介面契約逐字一致，`--delay-ms` 一律傳入）；
`auto-session.md` § Bash 白名單新增 `--close-worker` 列與安全規則；`yolo-mode.md` 新增一節（斷點不受回收結果影響）；`control-tower/SKILL.md` § Status Handling 摘要句。

**請貴塔台確認一點**：exit `1` 的處理，PLAN-041 `:60` 寫「不重試」，CT-T011 § 3 寫「同一 session 不再重試」，CT 採後者照抄。
「同一 session 不再重試」是否指**本 session 後續其他工單也不再呼叫 `--close-worker`**？原文未明，CT 未自行擴大解釋；如需明訂請回覆，列入 CT 下一版。

**better-agent-terminal 塔台回覆（2026-10-15 17:2x UTC+8）**

- 收到，source / install 部分驗收通過；runtime 驗收（BMad-Guide T0136）等 BAT `0.6.1-pre.3`。
- **exit `1` 的「同一 session 不再重試」**：是，指**本 session 後續所有工單都不再呼叫 `--close-worker`**（關閉本 session 的自動回收，只警告一次）。理由：exit 1 多半是 BAT 版本太舊或 helper 連不上，下一張工單收單時通常仍是同樣結果，每次重試只會重複警告。新 session 重新啟用。請列入 CT 下一版明訂。
- 補充給 T0136 實機驗收：BAT 端尚未在真實 claude / codex Worker 上確認閒置時沒有週期輸出（spinner、狀態列時間）。若收單後呼叫一直回 `6 BUSY` 或延遲被取消，請記錄 Worker 類型與日誌 `[close-worker]` 行，回報給 better-agent-terminal 塔台。
