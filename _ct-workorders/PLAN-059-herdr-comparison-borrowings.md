---
schema_version: 1
schema_kind: plan
id: PLAN-059
title: "Herdr 對照研究的借鏡項目（主 PLAN）：送文字前先看目標狀態、OSC 7501 不限 codex、等任一 Worker、holder 模型、SSH stdio 遠端"
status: PLANNED
priority: medium
created_at: "2026-11-02T13:23:24+0800"
links:
  source: "Herdr 對照 BAT 研究報告（Artifact https://claude.ai/artifact/Ybj66gYLkMHZE8xUyyDiEy，私人連結；2026-11-02 第一百零五 session）"
  related: [D219]
---

# PLAN-059 — Herdr 對照研究的借鏡項目（主 PLAN）

## 動機

Herdr 在 2026 年 10 月底推出原生桌面版（herdr-app）與獨立運作的 herdr-core 運行時期（`hc`），兩者 Rust、Apache-2.0。塔台以官方 repo 的 README 與 docs（2026-11-02 GitHub API 下載）對照 BAT，挑出值得借鏡的觀念並評估移植可行性。本 PLAN 是主 PLAN：收錄研究結論，後續拆子 PLAN 與工單。

研究報告：Artifact「Herdr 對照 BAT」（見 frontmatter `links.source`；私人連結，需由擁有者分享）。報告未進 repo；本檔收錄做決定需要的內容。

## 研究結論（摘要）

- Herdr 把「終端」做成可程式化的服務：core 持有終端、每個終端一個 holder 程序（core 可單獨重啟 / 更新）、OpenRPC API、遠端走 SSH stdin / stdout。
- BAT 的塔台 / Worker 協作（範圍權杖、問答通道、worktree 隔離派工、Claude 面板）更完整也更嚴；Herdr 的 API 對同帳號程式全開、沒有逐一授權。
- 結論：**先借兩件小事（A、B），程序架構不跟（D、E 只記錄）**。

## 子項

| # | 觀念（Herdr 的做法） | BAT 現況 | 價值 | 成本 | 建議 |
|---|---|---|---|---|---|
| A | 送文字前先看目標狀態（`hc send` 遇 blocked 預設不送，`--if idle`，等使用者停手才貼） | `pty:write` 不看目標是否 blocked（`electron/handlers/pty.ts:104`）；Worker `bat-notify --submit` 直接把文字＋Enter 寫進塔台 PTY | 高 | 低 | 先實測（Q1），成立就開 BUG |
| B | 狀態只由程式自己回報（OSC 7501，Herdr 稱 Program Status Protocol） | 解析器丟掉 `app≠codex`（`src/lib/codex-terminal-state.ts`），其他會送 7501 的程式 `blockedDetection: none` | 中 | 低 | 開工單，先定範圍（Q2、Q3） |
| C | 父終端一次等所有子終端（`hc wait --children any\|all`） | `terminal:wait` 一次等一個分頁（≤ 45 s） | 中 | 中 | 問 CT 塔台要不要（Q5） |
| D | 每個終端一個 holder，core 可單獨重啟 | Terminal Server 一個程序持有全部；判死時以同 id 開新 shell（T0704） | 中 | 高 | 先記錄，有需求再評估 |
| E | 遠端協定走 SSH stdio，遠端不開埠（`hc connect`、`--via`） | 遠端 bat-server 開 wss 埠＋TOFU 憑證 | 低 | 高 | 先記錄，有需求再評估 |
| F | 可機讀的 API 定義（`hc schema` 輸出 OpenRPC） | 契約寫在 Markdown | 低 | 中 | 暫不做 |

不建議跟進：不沙箱化的 JS mods、同帳號全信任的 API（與 D149 方向相反）、預設開啟的遙測、角色樣板（CT skill 與工作區啟動參數已涵蓋）。

BAT 已經有的（不需動作）：「做完了但還沒看」（✓ / 淡化 ⚠️，T0735）、工作區層級彙總（`waitingSummary`）、外部啟動的分頁出現在 UI、不開分頁看子 agent（縮圖 / `bat_read_output`）。

## 風險

| # | 風險 | 可能性 | 影響 | 緩解 |
|---|---|---|---|---|
| R1 | 現有缺口：Worker 通知替使用者回答塔台的權限對話框 / AskUserQuestion（不做 A 的風險；未確認） | 中 | 高 | 先以隔離實例實測（Q1）；成立就開 BUG |
| R2 | 放寬 OSC 7501 後，印到終端的任何內容都能改分頁狀態 | 中 | 低 | 只影響提示與回收時機、不影響權限；可先用白名單 |
| R3 | A、C 改了 helper 輸出或 exit code，CT 照舊判讀而誤判 | 中 | 中 | 不帶新參數時行為完全不變；契約先送 CT 塔台 |
| R4 | A 保留通知期間塔台不知道 Worker 已完成 | 中 | 低 | toast 與 Worker ✓ 照常；保留有上限 |
| R5 | Herdr 協定欄位（`done` / `error` / `kind`）還在變 | 中 | 低 | 解析維持寬鬆：只看 `state=`，不認得的值忽略 |

## 待釐清問題

| # | 問題 | 問誰 | 答案會影響 |
|---|---|---|---|
| Q1 | 塔台停在 claude 權限對話框或 AskUserQuestion 時，`bat-notify --submit` 打進去的文字與 Enter 會不會選到選項？ | BAT Worker（隔離實例＋假模型實測） | A 是 BUG 還是改善；R1 |
| Q2 | claude、gemini、opencode 等 CLI 現在有沒有自己送 OSC 7501？ | BAT Worker（逐一實測） | B 的效益與白名單 |
| Q3 | OSC 7501 有沒有正式規格（欄位、`app` 命名、`done` / `error` 語意）？ | herdr-core repo `schema/README.md`（Worker 查證） | B 的解析規則；R5 |
| Q4 | NSIS 覆蓋升級時，Terminal Server 與裡面的終端會不會被結束？ | BAT 塔台（查 T0740 驗收報告或實測） | D 的價值 |
| Q5 | CT 需不需要一次等多個 Worker 的拉取式等待？ | CT 塔台（`BMad-Guide · Tower`） | C 做不做；R3 |

## 拆分方向（待塔台與使用者確認）

1. 研究工單：Q1（主）＋ Q2、Q3（順便），隔離實例＋假模型，不改產品程式。
2. 依 Q1 結果：A 開 BUG（成立）或子 PLAN（改善）；契約草案先送 CT 塔台。
3. 子 PLAN：B（OSC 7501 通用化，依 Q2 / Q3 定全開或白名單）。
4. C 等 CT 回覆（Q5）再決定是否開子 PLAN。
5. D、E、F 留在本 PLAN 記錄，觸發條件：升級時終端被中斷的回報（D）、要支援暫時沙箱 / Docker 內使用（E）、第三方 client 需求（F）。

## 狀態

- PLANNED（D219：登記為主 PLAN，後續再拆子 PLAN 與工單）。
