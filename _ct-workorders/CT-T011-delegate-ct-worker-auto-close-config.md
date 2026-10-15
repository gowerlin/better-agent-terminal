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
