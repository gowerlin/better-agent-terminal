# 工單 T0165-phase1-cherrypick-upstream-v2.1.42-plus

## 元資料
- **工單編號**：T0165
- **任務名稱**：Upstream v2.1.42+ 同步 Phase 1 — cherry-pick 2 包（C1.1 + C1.2）
- **狀態**：IN_PROGRESS
- **建立時間**：2026-04-18 06:55 (UTC+8)
- **開始時間**：2026-04-18 07:18 (UTC+8)
- **完成時間**：（完成時填入）
- **相關**：T0164（研究報告）、PLAN-018（Phase 2 移植，另案）
- **決策依據**：D058（基於 T0164 結論採方案 [A]）

## 工作量預估
- **預估規模**：小 / 中（2 個獨立 cherry-pick commit）
- **Context Window 風險**：低（檔案變更集中，SDK/CLI 升級 + types + models 表）
- **預估工時**：~2h（C1.1 1h + C1.2 1h，含建置和手動驗證）
- **降級策略**：若 C1.1 步驟 ③ smoke test 有 Opus 4.6 / Sonnet regression，回退 SDK/CLI 並回報 PARTIAL；C1.2 獨立可延後

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：需要執行 `npm install`、`npx vite build` 和手動 BAT smoke test，context 應乾淨

## 任務指令

### 前置條件
需載入的文件清單：
- `_ct-workorders/_report-upstream-sync-v2.1.42-plus.md` — **完整研究報告（本工單所有細節來源）**
- `_ct-workorders/T0164-research-upstream-sync-v2.1.42-plus.md` — 研究工單回報區（互動紀錄）
- `version.json` — 需在本工單完成後更新 `lastSyncCommit` / `lastSyncDate` / `syncNote`
- `CLAUDE.md` — 若 Opus 4.7 / xhigh 有使用者可見的行為變更，需更新

### 輸入上下文

**背景**：fork `gowerlin/better-agent-terminal` 對 upstream `tony1223/better-agent-terminal` v2.1.42+ 的同步研究（T0164）已完成，採方案 [A]：Phase 1 cherry-pick（本工單）+ Phase 2 獨立 PLAN-018。

**本次同步範圍**（摘自報告 §4 Phase 1）：

| Cherry | 說明 | 來源 SHA | 工時 |
|--------|------|---------|------|
| **C1.1** | Opus 4.7 + SDK/CLI 2.1.111 + EFFORT_LEVELS + xhigh | `357b868` + `9c3daf8` 合併套 | 1.0h |
| **C1.2** | remote workspace:load fix + profile:list-local | `0bc3bc1` (PR #88) | 1.0h |

> **兩個 cherry-pick 必須分成獨立 commit**（方便單獨回退）。

### C1.1 執行順序（🔑 關鍵：不可顛倒）

詳見報告 §4 Phase 1「C1.1 關鍵執行順序」章節。摘要：

| 步驟 | 動作 | 驗證 |
|------|------|------|
| ① | 升 `@anthropic-ai/claude-agent-sdk` `^0.2.104` → `^0.2.111` | `npm ls` |
| ② | 升 `@anthropic-ai/claude-code` `^2.1.97` → `^2.1.111` | `npm ls` |
| ③ | `npm install` + 啟動 BAT 確認既有 session 仍正常（Opus 4.6 / Sonnet 等） | build + smoke |
| ④ | 新增 `EFFORT_LEVELS` const + `EffortLevel` type + `xhigh` 成員 | `tsc --noEmit` |
| ⑤ | 所有引用點替換型別（6 檔案，見報告 §3.1 #4-6） | 同上 |
| ⑥ | `BAT_BUILTIN_MODELS` 插入 `claude-opus-4-7` 兩項 | — |
| ⑦ | `MODEL_PRICING` 加 `opus-4-7: P(5, 25)` + `getModelPricing` if 檢查 | — |
| ⑧ | `npx vite build` 確認無 TS / build error | build pass |
| ⑨ | 手動測試：切到 Opus 4.7 發一則訊息、切 effort 為 `xhigh` | 訊息返回正常、無 API error |

**為什麼不可顛倒**：SDK/CLI 必須先升級才能支援 Opus 4.7 API；若 Opus 4.7 先進 builtin list 但 SDK 未升，會出現 `model-not-supported` 錯誤。

**關鍵對應**：upstream v2.1.46-pre.1（`5d9f486`）本身只修 selfsigned。**SDK/CLI 版本來自 v2.1.45（`9c3daf8`）的 `^0.2.111` / `^2.1.111`**，即 C1.1 目標版本。v2.1.46-pre.1 的 selfsigned fix 屬於 Phase 2 範圍，**不在 C1.1 範圍內**。

### C1.2 執行重點

來源 commit：`0bc3bc1`（PR #88）
修復兩項 remote 功能相關 bug：
- `workspace:load` 載入流程
- profile 身份辨識（`profile:list-local`）

詳見報告 §3.1 #3（`0bc3bc1` 條目）。

### 預期產出
- 2 個 cherry-pick commit（C1.1、C1.2 分開）
- `version.json` 更新：`lastSyncCommit` 推進到本次最後 SHA、`lastSyncDate` = 完成日期、`syncNote` 標註 T0165 Phase 1 完成
- 若需要，更新 `CLAUDE.md`（Opus 4.7 / xhigh 使用者可見變更）
- 收尾 commit：`chore(ct): T0165 DONE — upstream v2.1.42+ Phase 1 cherry-pick`

### 驗收條件
- [ ] C1.1 步驟 ①-⑨ 全數完成，順序未顛倒
- [ ] C1.1 步驟 ③ smoke test 通過（既有 Opus 4.6 / Sonnet session 無 regression）
- [ ] C1.1 步驟 ⑧ `npx vite build` 無 TS / build error
- [ ] C1.1 步驟 ⑨ 手動測試：Opus 4.7 可正常發訊息 + `xhigh` effort level 可選
- [ ] C1.2 remote workspace:load + profile:list-local 功能正常
- [ ] 兩個 cherry-pick 分成獨立 commit（可單獨 revert）
- [ ] `version.json` 已更新（`lastSyncCommit` / `lastSyncDate` / `syncNote`）
- [ ] 若 Opus 4.7 / xhigh 有使用者可見行為變化，`CLAUDE.md` 已更新
- [ ] 工單回報區「產出摘要」列出所有 commit SHA 和檔案變更清單

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀取本工單全部內容 + 前置條件中的研究報告（§3.1 #1/#3/#4-6 + §4 Phase 1）
2. 更新「開始時間」欄位
3. 執行 C1.1（按 ①-⑨ 順序）→ 單獨 commit
4. 執行 C1.2（cherry-pick `0bc3bc1` 或手動移植）→ 單獨 commit
5. 更新 `version.json`（lastSyncCommit / lastSyncDate / syncNote）
6. （若需要）更新 `CLAUDE.md`
7. 收尾 commit 記錄 T0165 完成
8. 填寫回報區（含所有 commit SHA + 檔案清單）
9. 更新「狀態」（DONE / FAILED / BLOCKED / PARTIAL）
10. 更新「完成時間」

### 執行注意事項
- **禁止合併 C1.1 和 C1.2 到同一 commit**（違反「分開 commit 方便回退」要求）
- **禁止顛倒 C1.1 步驟順序**（會導致 Opus 4.7 model-not-supported 錯誤）
- 步驟 ③ smoke test 若發現 Opus 4.6 / Sonnet 有 regression → 立即停止、回退 SDK/CLI、回報 PARTIAL
- 若 `0bc3bc1` 直接 cherry-pick 有衝突，改為手動移植（fork 專屬偏離可能影響遠端相關檔案）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
（DONE / FAILED / BLOCKED / PARTIAL）

### 產出摘要
（列出 commit SHA、修改的檔案、關鍵變更）

### 互動紀錄
（記錄執行過程中與使用者的重要互動）

### 遭遇問題
（若有問題或需要指揮塔介入的事項，在此描述）

### sprint-status.yaml 已更新
（是 / 否 / 不適用）

### 回報時間
（填入當前時間）
