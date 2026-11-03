---
schema_version: 1
schema_kind: workorder
id: T0813
title: "研究（PLAN-058）：Claude 面板常駐串流輸入的設計與可行性驗證——生命週期、影響表、最小原型量測、分階段實作草案"
type: research
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: L
created_at: "2026-11-03T21:11:52+0800"
started_at: ""
updated_at: "2026-11-03T21:11:52+0800"
completed_at: ""
session_ids: []
depends_on: []
related:
  - "PLAN-058；D214 / D258；T0768（方案 B 原始研究）；T0769 / BUG-192（背景子代理執行中注入、排隊、`perTaskStopAffordance`）；T0759 / BUG-190（背景子代理）；T0725（工作清單工具）；T0744（Cache History R 列）；CLAUDE.md「Sub-agent / Active Tasks Tracking」「Claude Agent SDK / CLI」節；`docs/agent-guide/claude-agent-sdk-cli.md`；`electron/claude-agent-manager.ts`、`src/components/ClaudeAgentPanel.tsx`"
affects_files:
  - _ct-workorders/T0813-research-claude-panel-persistent-streaming-design.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 研究型：只設計與驗證、不實作。repo 內唯一可改的是本工單（回報區）。原型一律寫在 repo 外的暫存目錄（引用 repo 的 `node_modules/@anthropic-ai/claude-agent-sdk` 即可），收尾刪除；不得 commit 產品程式、測試、文件。"
  - "🔴 原型呼叫真實模型時：只用 Haiku 5.5（`claude-haiku-5-5`）、極短 prompt、總共不超過 20 次 query 輪次；使用本機已登入的 claude（不得登入 / 登出、不得改 `~/.claude` 設定與 credentials）；不在使用者正在用的 BAT 分頁或面板裡測。原型的 cwd 用暫存目錄，不得讓原型的工具改 repo 檔案（權限模式不放寬到可寫 repo）。費用與 token 數記入回報。"
  - "🔴 不記任何權杖、credentials、session 內容；回報不寫家目錄真實路徑或帳號名（D176）。實測不到的部分標「推論」。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。不發版、不 push。Git：只 commit 本工單（`git commit --only` 或明列路徑）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。本單與 T0811 / T0812 並行，不得改它們的檔。"
---

# T0813 — 研究：Claude 面板常駐串流輸入的設計與可行性（PLAN-058）

## 元資料

- **工單編號**：T0813
- **類型**：research（設計＋原型量測，不實作）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P3
- **建立時間**：2026-11-03T21:11:52+0800
- **預估規模**：L

## 背景

T0768 查證：SDK 0.3.316 的 AsyncIterable prompt 可在同一個 CLI 程序內持續送訊息；主回合進行中送第 2 則時 CLI 自己排隊（`command_lifecycle`），不必「中斷＋重送」。BUG-192 先以方案 C 修（T0769：只在主回合結束後、背景子代理執行中注入，輸入已關則排隊）。要讓主回合進行中送出也不中斷，需改成「每個面板一個常駐 query＋inbox」（方案 B）：規模 L、回歸面大、每個面板多一個常駐 claude 程序。使用者 2026-11-03 指示先做設計與可行性驗證（D258）。

## 範圍

1. **現況盤點**：`electron/claude-agent-manager.ts` 與面板目前的 query 生命週期（每則訊息一個 query？何時 resume、abort、重開）、`isStreaming` / `messageQueue` / retry / resume、`setModel` / effort、`setPermissionMode`、休眠（`isResting`）、worktree、headless、背景子代理注入（T0769）、Cache History（T0744）、工作清單（T0725）、權限卡 / AskUserQuestion（T0762）各自依賴的假設。
2. **原型量測**（repo 外）：常駐 query＋AsyncIterable inbox 的最小原型，量測：
   - 主回合進行中送第 2 則：CLI 是否排隊、回應順序、`result` 訊息形狀（每則一個 result？）、usage / `total_cost_usd` 的累計方式（影響 T0744 的 R 列換算）；
   - 中斷（`interrupt()`）只停當前回合、query 不結束；權限請求在常駐模式下的流程；
   - 中途改 model / effort / permission mode 的方式（`setModel`、`applyFlagSettings`、`setPermissionMode`）是否生效於下一回合；
   - 閒置時程序數、RSS、CPU；閒置多久可以收掉、如何以 resume 重開；
   - 程序意外結束（kill CLI）時的偵測與恢復。
3. **設計**：常駐 query 的生命週期（建立、閒置回收、休眠、切 worktree、關面板、BAT 關閉、Terminal Server / headless 下的行為）；inbox 與「待送」UI（沿用 T0769 的排隊提示 / 取消 / 上限原則）；每個既有功能的影響表（不變 / 需改 / 風險）；是否加 Settings 開關、預設值建議；資源上限（同時常駐的面板數）。
4. **分階段實作草案**：拆成可獨立驗收的工單（每張的 affects_files、必守規則、驗收、不回歸測試），標出需要真實模型驗收的項目。

## 不做

- 不改產品程式、測試、文件；不升 SDK / CLI 版本；不開 BUG。

## 驗收

- [ ] 現況盤點（含依賴的假設清單）
- [ ] 原型量測結果（每項實測／推論標明；token 與費用）
- [ ] 生命週期設計與影響表
- [ ] Settings 開關與資源上限建議
- [ ] 分階段實作工單草案
- [ ] 若結論是不值得做或應延後，寫明理由與觸發條件

---

## 回報區

<!-- Worker 由此往下寫 -->
