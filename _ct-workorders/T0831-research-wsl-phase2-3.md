---
schema_version: 1
schema_kind: workorder
id: T0831
title: "研究：PLAN-043 Phase 2（已安裝 WSL 環境自動修正）與 Phase 3（從零安裝＋重開機接續）的現況核對、設計與拆單"
type: research
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-04T08:52:59+0800"
started_at: ""
updated_at: "2026-11-04T08:52:59+0800"
completed_at: ""
session_ids: []
depends_on: []
related:
  - "PLAN-043；D271；PLAN-035 / T0380（2026-10-04 研究，`_ct-workorders/_archive/`）；D127 / D128；T0381–T0384（Phase 1）；T0653（NAT 不需強制改）"
affects_files:
  - _ct-workorders/T0831-research-wsl-phase2-3.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 唯讀研究：只寫本工單檔。🔴 不得在本機執行任何會改變 WSL 狀態的指令（`wsl --install`、`--update`、`--shutdown`、`--set-version`、改 `.wslconfig` / `/etc/wsl.conf`、啟用 Windows 功能、提權、重開機）。只可跑唯讀查詢（`wsl --status`、`wsl -l -v`、`wslinfo`、讀檔）。"
  - "🔴 yolo：不得問使用者；問題問塔台（上限依 `research_max_questions`）。不 push。Git：只 commit 本工單檔（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0831 — 研究：WSL 自動化 Phase 2 / 3（PLAN-043）

## 元資料

- **工單編號**：T0831
- **任務名稱**：研究：PLAN-043 Phase 2 / 3 現況核對、設計與拆單
- **狀態**：PENDING
- **類型**：research
- **互動模式**：enabled（yolo：問塔台）
- **intervention_type**：context-dependent
- **Renew 次數**：0
- **建立時間**：2026-11-04 08:52 (UTC+8)

## 研究目標

使用者決定 PLAN-043 的 Phase 2（已安裝環境：偵測 → 列清單 → 一次同意 → 自動修正）與 Phase 3（從零安裝 WSL＋重開機後接續精靈）都要做（D271）。這兩段牽涉提權、Windows 功能、重開機，回頭成本高；先核對 2026-10-04 的研究（T0380 / PLAN-035）在目前程式上還成立多少，產出可直接拆成實作工單的設計。

## 已知資訊

- PLAN-035 範圍環節 1–8（1–3 = 從零安裝、4–8 = 已安裝環境修正）、D127「偵測 → 列清單 → 一次同意」、D128 Phase 1 修訂；Phase 1（T0381–T0384）已交付。
- 精靈：`src/components/setup-wizard/`（`wsl-flow.ts`、`wizard-runner.ts`、`steps/`、`preflight.ts`）；主行程：`electron/wsl-detect.ts`、`wsl-validate.ts`、`wsl-systemd.ts`、`wsl-keepalive.ts`。
- T0829（孤兒 wsl.exe）與 T0830（keep-alive 開關、精靈 step abort）同批另做，會改 `wsl-keepalive.ts` 與精靈 runner；設計請以「step abort 已存在」為前提並標註依賴。

## 調查範圍與要回答的問題

1. **現況核對**：T0380 列的每個偵測 / 修正項目，目前程式已做到哪（已做 / 部分 / 沒做），附 `檔案:行`。
2. **Phase 2 設計**：偵測項目清單（WSL 版本、distro 版本 1/2、systemd、預設使用者、網路模式只在連線測試失敗時…）、每項的自動修正動作、需不需要提權 / `wsl --shutdown`、會不會影響使用者其他正在跑的 WSL 工作；「一次同意」的清單 UI 與可逆性；失敗處理。
3. **Phase 3 設計**：`wsl --install`（含 `--no-distribution` / 指定 distro）的流程與版本差異、UAC 提權方式（不得 shell 字串拼接）、Windows 功能啟用、需要重開機的判斷；重開機接續（精靈進度持久化位置、開機後的恢復入口：BAT 啟動時偵測未完成的精靈、是否需要開機自動啟動）、取消與失敗回復。
4. **風險與不做的事**：哪些情況只提示不自動做（例如企業管控、已有使用者自訂 `.wslconfig`）。
5. **測試策略**：本機無法從零測時怎麼驗（VM、GitHub Windows runner 是否有 WSL、mock 層），每張實作單的驗收方式。

## 研究指引

- 先讀 `_ct-workorders/_archive/plans/PLAN-035-wsl-environment-full-automation.md`、`_ct-workorders/_archive/workorders/T0380-research-wsl-environment-automation.md`、`T0381`–`T0384` 回報區、`docs/wsl-deployment.md`。
- 外部資料（Microsoft WSL 文件、`wsl --install` 參數）可查，引用要附來源與查詢日期。

## 預期產出（寫在回報區）

- 〈調查結論〉逐題回答（含現況核對表）
- 〈建議方向〉方案比較與推薦
- 〈建議下一步〉拆成實作工單（每張：範圍、`affects_files` 預估、規模、依賴、能否並行、驗收方式），以及需要使用者裁決的問題清單

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

### 互動紀錄

### 調查結論

### 建議方向

### 建議下一步

### Renew 歷程

### 遭遇問題

### 回報時間
