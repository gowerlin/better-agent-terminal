---
schema_version: 1
schema_kind: workorder
id: T0819
title: "PLAN-058 交付版驗收：以 `BAT_E2E_EXECUTABLE` 對安裝版 `v0.7.4-pre.5` 跑 Claude 面板假 API e2e（主回合中送出排隊、Esc 取消待送、卡片等待提示）"
type: verification
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-04T00:49:06+0800"
depends_on: []
related:
  - "PLAN-058；T0814（`fc22e04a`）；T0815（`0b67db03`）；D259 / D262 / D263；T0510（`BAT_E2E_EXECUTABLE`）"
affects_files:
  - _ct-workorders/T0819-plan058-verify-installed-claude-panel-e2e.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只做驗收，不改任何產品程式、測試、文件、workflow；repo 內唯一可改的檔案是本工單（回報區）。Playwright 輸出（`--output`）與暫存一律放系統暫存目錄，收尾刪除。spec 對安裝版跑不起來時不得改 spec 讓它通過：回報 PARTIAL 並寫明原因。"
  - "🔴 不碰使用者正在用的 BAT：e2e 只用 `launchIsolated` 的隔離 runtime（`--runtime=<id>`），結束一律 `closeIsolated`；不得結束、重啟或關閉使用者的 BAT 主實例、它的 Terminal Server 或任何分頁；不碰 `%APPDATA%\\BetterAgentTerminal` 主資料夾（隔離 runtime 的資料夾以外）。"
  - "🔴 不跑真實模型（`BAT_E2E_REAL_MODEL` 不設），只用 spec 內建的假 API；不登入任何 agent（L185）。回報不寫權杖值、不寫家目錄真實路徑（D176，用 `<使用者資料夾>`）。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。不發版、不 push。Git：只 commit 本工單（`git commit --only` 或明列路徑）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0819 — PLAN-058 交付版驗收（安裝版 `v0.7.4-pre.5`，假 API e2e）

## 元資料

- **工單編號**：T0819
- **類型**：verification
- **互動模式**：yolo（問題問塔台）
- **優先級**：P3
- **建立時間**：2026-11-04T00:49:06+0800
- **預估規模**：S

## 背景

PLAN-058（T0814 W1 `fc22e04a`＋T0815 W0 `0b67db03`，已在 `v0.7.4-pre.5`）：Claude 面板在主回合進行中送出的訊息，改以 `streamInput`＋uuid 排進同一個 query（`command_lifecycle` 回執 2 s；無回執 / reject → query 結束後 resume、只送一次）；面板顯示「待送」＋取消；Esc 先取消待送再 interrupt；提問 / 權限卡等待時提示「請先回答上方問題」。T0815 以**開發版 build** 跑假 API e2e（`e2e/v072-pre6-claude-panel.spec.ts` ⑦d / ⑦e / ⑦f / ⑥b 與不回歸 ①–⑫、`e2e/v072-pre7-claude-panel-ui.spec.ts`）與真實模型，皆 PASS；交付版未驗。

`e2e/fixtures/electron-isolation.ts` 的 `launchIsolated` 支援 `BAT_E2E_EXECUTABLE=<安裝版 exe>`（T0510），以隔離 runtime 啟動安裝版。塔台決定先由 Worker 以此對安裝版跑一輪，再交使用者手動確認（D263）。

## 範圍

1. 確認安裝版：`C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe` FileVersion = `0.7.4-pre.5`（第一百一十四 session NSIS 驗收已重裝；不重裝）。
2. 以 `BAT_E2E_EXECUTABLE="C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe"` 跑：
   - `npx playwright test e2e/v072-pre6-claude-panel.spec.ts --output <暫存>`（含 ⑦d 主回合中送第 2 則、⑦e 取消待送、⑦f Esc 取消待送、⑥b 與 ①–⑫ 不回歸）
   - `npx playwright test e2e/v072-pre7-claude-panel-ui.spec.ts --output <暫存>`（BUG-177 / BUG-178 不回歸）
   - 以 log 中 `build under test` 類訊息或程序路徑證明跑的是安裝版，不是 `dist-electron`。
3. 失敗時：先判斷是安裝版行為問題、還是 spec 依賴 source build（例：讀 `dist-electron`、repo 內腳本路徑）；後者寫明哪一行依賴什麼，**不改 spec**，回報 PARTIAL 並列出仍可在安裝版通過的情境。
4. 依結果在回報區寫一份**給使用者的手動確認清單**（3–6 步，以面板上看得到的行為描述：回合中送出 → 出現「待送」→ 同一段對話接著回答；按取消 → 待送消失；Esc → 停回合且待送消失；權限 / 提問卡等待時送出 → 看到「請先回答上方問題」）。

## 不做

- 不改產品程式、測試、文件；不修 BUG；不跑真實模型；不驗 macOS / Linux；不重裝 BAT。

## 驗收

- [ ] 安裝版 FileVersion 與「跑的是安裝版」的證據
- [ ] pre6 spec 結果（逐情境列 ⑦d / ⑦e / ⑦f / ⑥b 與 ①–⑫）
- [ ] pre7 spec 結果
- [ ] 失敗項（若有）的歸因：安裝版行為 / spec 依賴 source build
- [ ] 使用者 BAT 主實例未受影響（e2e 前後主實例的程序仍在、沒被關閉）；暫存輸出已刪
- [ ] 給使用者的手動確認清單
- [ ] 結論：PASS（交使用者手動確認後塔台結 PLAN-058）/ FAIL / PARTIAL

---

## 回報區

（由 Worker 填寫）
