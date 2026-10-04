---
schema_version: 1
schema_kind: workorder
id: T0445
title: "安全 review：T0432 每 PTY 範圍權杖（helper-capability.ts / remote-server.ts auth 與 invoke 路徑 / pty-manager exit hook / headless-entry 接線）——對抗式審查，只出 findings"
type: research
status: PENDING
repo: better-agent-terminal
project: PLAN-036
priority: P1
sizing: M
created_at: "2026-10-05T06:22:20+08:00"
started_at: null
updated_at: "2026-10-05T06:22:20+08:00"
completed_at: null
target_version: next
depends_on: []
related:
  - "T0432（`aec20c0`）回報區全文，尤其「殘餘風險」3；T0420 §2 安全分析（🟡 要求 review）"
  - "T0433（平行：權杖注入 PTY env + helper 出貨）"
  - "D134 追加（塔台 06:22 依授權直接決定）"
affects_files:
  - _ct-workorders/T0445-security-review-helper-capability.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **review 單不改產品程式碼**，只寫本工單回報區。可在 scratchpad 寫 PoC 測試驗證疑點，但不得留在 repo。"
  - "🔴 審查對象以 `git show aec20c0` 為準（+ 相關既有程式）。T0433 平行改 `headless-entry.ts` / `pty-manager.ts` / bundle 腳本：若讀到工作樹未提交改動，在 finding 註明「工作樹版本」。"
  - "🔴 只回報**有具體觸發情境**的 finding（輸入 / 狀態 → 越權結果），每條標嚴重度（critical / high / medium / low）與 CONFIRMED（有 PoC 或確定的程式碼路徑）/ PLAUSIBLE。不列風格建議。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；只 commit 本工單；不 push。"
---

# T0445 — 安全 review：每 PTY 範圍權杖

## 審查重點

1. **認證**：權杖 / server token 比對（`safeTokenEqual`、digest 查表）、暴力破解節流是否涵蓋權杖路徑、client ↔ helper 角色轉換（T0432 註明兩條防禦分支無測試）、rotate 寬限期
2. **授權**：`authorizeHelperInvoke` 白名單與 target 綁定能否繞過——args 形狀異常（陣列 / 物件 / 原型污染 / 非字串 id）、`customEnv` 夾帶、`create-agent-command` 的 `cwd` / `agent` / `prompt` / `agentCustomArgs` 能否被用來執行任意指令到他人 PTY 或越出 PTY 擁有者權限
3. **TOCTOU**：T0432 殘餘風險 3-1（id 不存在檢查與 `ptyManager.create` 之間的 await）
4. **撤銷**：PTY exit / kill / restart / stale exit / server stop 的撤銷完整性；每 frame 重查
5. **資訊外洩**：log、auth-result metadata、錯誤訊息是否含權杖 / server token / 路徑
6. **廣播隔離**：helper 是否可能收到 `pty:output` 等其他 PTY 資料；`countBroadcastReceivers` 正確性
7. **DoS**：helper 連線數 / frame 頻率有無上限；大量 helper 連線是否影響 T0404 回收或 client

## 回報要求

- findings 表：`# / 嚴重度 / 判定 / 觸發情境 / 結果 / 位置（檔案:行）/ 建議修法`
- 結論：可否進入 T0433 / T0434 的實機階段（PASS / PASS with fixes / BLOCK）
- `### 拆單建議摘要`（若有需修的 finding）：表格欄位 `| # | 標題 | 專案 | 依賴 | 工時 | 🚦 |`

## Sub-session 執行指示
1. 讀本工單 + T0432 / T0420 回報區 + `git show aec20c0`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 審查 → 填回報區；完成寫 **`DONE`**
4. `git commit --only` 本工單；不 push
5. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### Findings

### 結論

### 拆單建議摘要

### 回報時間
