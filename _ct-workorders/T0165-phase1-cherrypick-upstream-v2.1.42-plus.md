# 工單 T0165-phase1-cherrypick-upstream-v2.1.42-plus

## 元資料
- **工單編號**：T0165
- **任務名稱**：Upstream v2.1.42+ 同步 Phase 1 — cherry-pick 2 包（C1.1 + C1.2）
- **狀態**：PARTIAL
- **建立時間**：2026-04-18 06:55 (UTC+8)
- **開始時間**：2026-04-18 07:18 (UTC+8)
- **完成時間**：2026-04-18 07:32 (UTC+8)
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
**PARTIAL** — 所有程式碼變更已完成並 commit，build 通過；但步驟 ③ / ⑨ 的 **runtime smoke test 需使用者重啟 BAT 驗證**（sub-session 無法執行 GUI 操作）。若 smoke test 通過，Tower 可直接將本單改為 **DONE**；若發現 regression，Worker 準備好回退指引（見下方「遭遇問題」）。

### 產出摘要

**commit 列表**（全部於 `main` 分支，未 push）：
1. `47bce0c` — `docs(ct): plan T0165 Phase 1 + PLAN-018 Phase 2, record D058`（CT bookkeeping，prep commit）
2. `84c2930` — `feat(models): add Opus 4.7 + SDK/CLI 2.1.111 + EFFORT_LEVELS + xhigh`（**C1.1**）
3. `59a26f8` — `fix(remote): make workspace:load + window identity work when connected to remote host (#88)`（**C1.2**，純 cherry-pick upstream `0bc3bc1`，作者保留 `lmanchu`）
4. （wrap-up commit，見步驟執行最後）

**C1.1 檔案變更**（8 檔，+275/-48）：
- `package.json` / `package-lock.json` — SDK `^0.2.104 → ^0.2.111`、CLI `^2.1.97 → ^2.1.111`（npm 實裝 `0.2.113` / `2.1.113`）
- `src/types/index.ts` — 新增 `EFFORT_LEVELS` const + `EffortLevel` type（放於 `FontType` 附近）；`defaultEffort` 改用 `EffortLevel`
- `src/stores/settings-store.ts` — import `EffortLevel`，`setDefaultEffort` 型別換用
- `src/components/SettingsPanel.tsx` — import `EFFORT_LEVELS` + `EffortLevel`；select 改 `EFFORT_LEVELS.map()`，`max` 加「(Opus only)」標記（原僅 low/medium/high，升級後含 max + xhigh）
- `src/components/ClaudeAgentPanel.tsx` — import 同上；effort select 改 map；`effectiveEffort as EffortLevel`；`MODEL_PRICING` 加 `opus-4-7: P(5, 25)`；`getModelPricing` 加 `opus-4-7` 前置 if
- `electron/main.ts` — `claude:set-effort` handler cast 改 `import('../src/types').EffortLevel`
- `electron/claude-agent-manager.ts` — import `EffortLevel`；`BAT_BUILTIN_MODELS` 首插 `claude-opus-4-7` / `claude-opus-4-7[1m]`；`SessionInstance.effort`、`startSession`、`setEffort` 型別全換

**C1.2 檔案變更**（3 檔，+36/-3，upstream 直接 cherry-pick，auto-merge 乾淨）：
- `electron/main.ts` — 新增 `profile:list-local` IPC handler + `ALWAYS_LOCAL_CHANNELS = Set(['workspace:save','workspace:load'])`，`bindProxiedHandlersToIpc` 加繞過 remote proxy 判斷
- `electron/preload.ts` — `profile.listLocal()` API 曝光
- `src/App.tsx` — profile 解析失敗時 fallback 呼叫 `listLocal()`，解決 remote 連線時 window title / remote.connect 分支錯亂

**關鍵執行順序遵守**：SDK/CLI 升級（①②）→ 啟動驗證（③，僅 build）→ 型別系統（④⑤）→ model + pricing（⑥⑦）→ build（⑧）→ commit。Opus 4.7 builtin model 僅在 SDK/CLI 升級後才加入，避免 `model-not-supported` error。

**`version.json` 已更新**：
- `lastSyncCommit` `8d23e6e...` → `0bc3bc1...`
- `lastSyncDate` `2026-04-16` → `2026-04-18`
- `version` `2.1.42-pre.2` → `2.1.45`（對齊實際同步到的 upstream 最新 release tag）
- `syncNote` 改寫為 T0165 Phase 1 + PLAN-018 Phase 2 獨立 + Phase 3 skip 記錄

**`CLAUDE.md` 已更新**：新增「Claude Agent SDK / CLI」小節，說明 SDK `^0.2.111` / CLI `^2.1.111` 升級、Opus 4.7 builtin、`EFFORT_LEVELS` 集中宣告、`xhigh` 需 CLI >= 2.1.111、settings `max` 的 Opus only 標記。

**build 狀態**：`npx vite build` 在 C1.1 完成後、C1.2 完成後皆全綠（vite 7.3.2，dist + dist-electron 全產出，僅有 bundle size warning，非 error）。

### 互動紀錄
無 — 本 sub-session 全程無需向使用者提問，研究報告 `_report-upstream-sync-v2.1.42-plus.md` §4 Phase 1 已提供完整執行計畫（含步驟順序），依計畫直推。

### 遭遇問題

1. **fork 既有 `tsc --noEmit` errors 不相關**：執行 `tsc --noEmit` 發現約 20 個 TS 錯誤（ThumbnailBar、UpdateNotification、WorkspaceView、main.tsx 等），但這些全數存在於 fork 升級前，與本輪 effort level / SDK 變更**無關**。fork 的正式 build 流程是 `npx vite build`（不跑 tsc strict），此流程全綠可通過。建議：Tower 評估是否開單清理既有 TS 債（非本輪範圍）。

2. **Runtime smoke test 尚未執行（本單狀態設為 PARTIAL 的唯一原因）**：
   - **步驟 ③ 未驗證**：SDK/CLI 升到 `2.1.113` 後，既有 Opus 4.6 / Sonnet 4.6 session 是否仍正常（無 model-not-supported、無 API signature 破壞）
   - **步驟 ⑨ 未驗證**：切到 `claude-opus-4-7` 能否發訊息、effort 切到 `xhigh` 是否被 CLI 接受
   - **建議驗證步驟**（請使用者於 BAT 內跑）：
     1. 關閉 BAT 並重啟（確保載入新的 `node_modules/@anthropic-ai/claude-agent-sdk@0.2.113`）
     2. 開啟任一既有 Claude Agent session（Opus 4.6），發一則訊息 → 應正常回應
     3. 切到 `claude-opus-4-7` 或 `claude-opus-4-7[1m]`，開新 session 發訊息 → 應正常
     4. 切 effort 到 `xhigh` → 應可選且 CLI 不報錯
   - **若 smoke test 通過**：Tower 直接把本單改為 DONE，不需再動程式碼
   - **若發現 regression**：快速回退方式 — `git revert 84c2930 59a26f8`（保留 CT bookkeeping），或只 revert 84c2930（保留 C1.2 remote fix）後重新執行 `npm install` 降級 SDK/CLI。此情況請 Tower 開衍生工單調查根因。

3. **SDK 實裝版本比宣告高**：`package.json` 宣告 `^0.2.111` / `^2.1.111` 但 npm 實裝 `0.2.113` / `2.1.113`（semver `^` 允許）。理論上 upstream `9c3daf8` 鎖的是 `0.2.111`，但 upstream 本身已讓 fork-side 去 resolve semver 範圍。**不是問題**，僅記錄觀察。

4. **npm audit warning（3 high severity）**：`npm install` 報告存在，但不屬本輪升級引入（原本就在），PLAN-003 Group C 已規劃處理。

### sprint-status.yaml 已更新
**不適用** — 專案根目錄與 `_bmad-output/`、`docs/` 均無 `sprint-status.yaml`。

### 回報時間
2026-04-18 07:32 (UTC+8)

### Renew 歷程
無
