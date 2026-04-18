# PLAN-020-yolo-autonomous-mode

## 元資料
- **編號**：PLAN-020
- **標題**：auto_session `yolo` 模式 — Worker 自動送出 + 塔台自主決策多工單 PLAN
- **狀態**：PLANNED
- **優先級**：🔴 High（驗證後可直接加速 PLAN-018 剩下 4 張實作工單）
- **類型**：技術改善（skill + BAT code 雙向整合）
- **建立時間**：2026-04-18 12:12 (UTC+8)
- **完成時間**：（完成時填入）
- **關聯研究**：T0167（待派）
- **驗證場景**：PLAN-018 剩下 4 張實作工單（用 yolo 跑完整流程）

## 動機 / 背景

目前 `auto_session: on` 只做到「塔台 → Worker」方向自動化（派工單時開新分頁 + 貼上 + 送出）。反向「Worker → 塔台」缺失：
- Worker 完成時只貼訊息到剪貼簿，使用者仍要手動切回塔台、貼上、送出
- 對於多工單 PLAN（如 PLAN-018 需 4 張工單），每張都要來回切換，效率低

技術現況（已存在的基礎設施）：
- ✅ `scripts/bat-notify.mjs`：已有 Worker→Tower 通知能力（雙管道：UI toast + pty:write 預填）
- ❌ **未觸發的原因**：塔台 session 的 `BAT_TOWER_TERMINAL_ID` 環境變數未設定 → Worker 不知道塔台 terminal-id → bat-notify.mjs 無目標
- ❌ **pty:write 只預填不送出**：`without \r`，即使 Worker 呼叫 bat-notify 成功，使用者仍要按 Enter

## 目標：yolo 模式定義

在 `auto_session: on` 基礎上擴增：

### A. Worker 主動回報塔台（自動送出）
- `on` = 貼上但不送出（現狀，需使用者手動 Enter）
- `yolo` = 貼上**並自動送出**（含 `\r`，真正自動化）

### B. 塔台主動處理回報 + 智慧判斷下一張
- Worker 回報「T#### 完成」到塔台 session 時，塔台自動：
  1. 讀取工單回報區
  2. 更新 `_tower-state.md` / `_bug-tracker.md` / `_backlog.md`
  3. 判斷「下一步」：
     - 若同 PLAN 下有後續工單 → 依研究報告的拆單建議自動派發下一張
     - 若需決策 → 停下來問使用者（見下方斷點條件）
     - 若 PLAN 全數完成 → 標記 DONE + 歸檔候選提示

### C. 斷點條件（防止無限燒 Token）

yolo 模式**必須停下問人**的情境：

| # | 條件 | 判準 |
|---|------|------|
| A | 塔台判斷力限制 | Worker 回報出現塔台無法分類的結果（如非預期失敗、衝突未在研究報告覆蓋） |
| B | 流程受阻 / 死迴圈 | 同一工單 Renew ≥3 次或連續 3 次 Worker 回報 FAILED，自動進入斷點 |
| C | 跨出 PLAN 範圍 | Worker 建議的下一步超出當前 PLAN 範圍（如需改 schema、影響其他模組） |

## 預估拆單（T0167 研究定稿）

| # | 標題 | 專案 | 依賴 | 工時 | 🚦 |
|---|------|------|------|------|-----|
| **1** | BAT code: `bat-notify.mjs --submit` flag（加 `\r` 發送） | 本專案 T#### | — | 1-1.5h | 🟢 |
| **2** | 本地草稿: Worker skill 自動回報規格（ct-exec/ct-done Step 8.5 強化） | 本專案 T#### | 1 | 1-1.5h | 🟢 |
| **3** | 本地草稿: 塔台 skill 自主決策 + 3 斷點規格（Q2.A 分支，D060） | 本專案 T#### | 2 | 2-3h | 🟡 |
| **4** | 上游 COORDINATED: skill 三件套推 Control-Tower-Skill | **CT-T###** | 3 | 2-3h | 🟡 |
| **5** | 本專案驗收: PLAN-018 剩 4 張工單 yolo 實跑 | 本專案 T#### | 4 | 1-2h | 🟢 |

**合計 7-11h**，建議分 2 天完成。

**Q2 決策鎖定（D060）**：採研究工單 D 區段作為下一張工單的資訊來源。工單 3 規格收斂為單一分支（A 分支），不再保留 B/C 條件式。

## 預估工時

整包 **6-9h**（研究 2h + 實作 4-7h + 驗證 1-2h），建議分 1-2 天。

## 建議時程

- **優先：立即派研究工單**（T0167）— 技術前置必須先解
- **研究回報後**：塔台決策拆單 → 派實作工單
- **完成後驗證**：接手 PLAN-018 剩下 4 張工單，用 yolo 跑完

## 關聯

- **PLAN-018** — 冷凍中，將作為 yolo 驗證場景（Q3.C）
- **T0133 Worker→Tower 雙管道** — 現有基礎設施（已歸檔 T0133，需 grep upstream commit）
- **scripts/bat-notify.mjs** — 通知核心，本 PLAN 需擴充 `--submit` flag
- **scripts/bat-terminal.mjs** — 開新終端，本 PLAN 需確保注入 `BAT_TOWER_TERMINAL_ID`
- **~/.claude/skills/control-tower/** — skill 層需新增 yolo 行為段落

## 跨專案協調（關鍵邊界）

本 PLAN 改動橫跨兩專案，**不能只改本地**：

| 變更範圍 | 專案 | 協調方式 |
|---------|------|---------|
| BAT code（`bat-notify.mjs --submit`、`bat-terminal.mjs` env 注入、terminal-server `pty:submit` IPC） | **本專案**（better-agent-terminal） | 直接改 + commit + PR |
| skill 層（control-tower / ct-exec / ct-done）yolo 行為邏輯 | **Control-Tower-Skill 上游專案** | 本地先實驗 → 成熟後開 **COORDINATED 工單**（前綴 `CT-T###`）回上游 |

**遵循 PLAN-011 先例**（CT v4.0.1 → v4.1.0 的 BAT 路由 + Worker 通知整合）：
1. 本地在 `~/.claude/skills/` 路徑**不直接寫入**（Layer 1 唯讀保護硬限制）
2. 本 PLAN 的 skill 改動先在本專案「草稿化」（可放 `_ct-workorders/_draft-ct-yolo-skill-patch.md` 之類的規格文件）
3. 本專案 BAT 部分驗收通過後，產出 `CT-T###` COORDINATED 工單到 Control-Tower-Skill 專案
4. 上游專案更新 skill 版本 → 本專案拉新版 skill 驗證 → 上下游同步閉環

**預期產出的跨專案工單**（研究後補記具體編號）：
- `CT-T00#`：control-tower skill 新增 yolo 模式段落
- `CT-T00#`：ct-done skill 新增 Worker 自動回報呼叫
- `CT-T00#`：ct-exec skill 檢查是否要改（視 T0167 研究結論）

## 相關工單

- T0167（待派）：研究工單

## 備註

- yolo 是進階模式，預設仍是 `ask`，使用者需手動開啟
- 建議 config 值保留 `off / ask / on / yolo` 四階
- yolo 模式開啟時，塔台啟動面板應明確標示「⚠️ YOLO mode ACTIVE — 塔台將自主決策」
- 3 次斷點為保險閾值，未來可視需求調整（透過 config `yolo_max_retries`）
