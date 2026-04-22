# T0174-dogfood-yolo-mode-observation

## 元資料
- **工單編號**：T0174
- **任務名稱**：Dogfood：用 T0173 當首張場景，觀察 yolo 模式核心機制
- **狀態**：DONE
- **建立時間**：2026-04-18 (UTC+8)
- **完成時間**：2026-04-18 16:05 (UTC+8)
- **閉環摘要**：6 phases 全綠（Phase 0-1 上 session、Phase 2-6 本 session）。dogfood 主要發現:(1) Session-to-session yolo 持久化驗證成功 (2) Worker bat-notify --submit 自動回報運作 (3) 塔台正確 PAUSE 跨 PLAN 建議（不越權） (4) 「停」abort 路徑正常 (5) L064 候選:「斷點 C」概念在 SKILL.md vs yolo-mode.md 規格 drift（待 CT-T003 上游修正）。詳見 `_tower-state.md` § YOLO 歷程。
- **類型**：verification / observation（塔台 self-driven，**不派給 sub-session**）
- **互動模式**：N/A（塔台觀察工單）
- **預估工時**：30-45 分鐘
- **關聯 PLAN**：PLAN-020（yolo autonomous mode）dogfood 驗收環節
- **關聯 BUG**：BUG-040（T0173 是其研究單，本 T0174 借用為 dogfood 場景）
- **關聯研究**：T0167-T0172
- **依賴**：
  - ✅ PLAN-020 前置工單（T0168-T0172）全 DONE
  - ✅ CT-T002 DONE + skill sync 已驗（T0172 DONE）
  - 📋 T0173 已建單（本輪 dogfood 首張場景）
- **風險**：🟢（首張純讀碼 / 斷點觸發即停，零碼變動）

---

## 方案設計（塔台建議「三步漸進」收斂版）

三步原方案：
- **Step 1**：乾跑啟用 + 派 T0173（純讀碼）+ 觀察 Phase 1-3、6
- **Step 2**：斷點 C 測試 + 觀察 Phase 4-5
- **Step 3**（移出本工單）：真實碼 dogfood → 由 `*resume` PLAN-018 時在 worktree 自然進行

本 T0174 只負責 Step 1-2。Step 3 落回 PLAN-018 執行流程。

---

## 目標觀察項目

1. **啟動警語**：`*config auto-session yolo` + `yolo_max_retries: 1` 生效後，塔台下次派工時顯示 YOLO 警告面板
2. **Worker 自動回報**：T0173 完成後自動送出「T0173 完成」四類字串
3. **派發面板**：派 T0173 前顯示完整派發意圖 + 1-2s 緩衝
4. **BAT 整合**：`wt -w 0 nt` 新分頁 + `bat-notify.mjs --submit` 送 Enter
5. **下一張判定**（修飾觀察）：T0173 DONE 後塔台進入下一張判定流程（沒有真實下一張，但可看判定邏輯）
6. **斷點 C**：塔台進入判定流程時使用者打字 → 立即停下
7. **`_tower-state.md` YOLO 歷程區段**：區段有建立、記錄派發 T0173 事件與斷點 C 觸發

---

## 執行腳本

### Phase 0：前置自檢（5min）

- [ ] `~/.claude/skills/control-tower/SKILL.md` 有 `auto-session yolo` 四階分流
- [ ] `~/.claude/skills/ct-exec/SKILL.md` Step 8.5 yolo 段落
- [ ] `~/.claude/skills/control-tower/references/yolo-mode.md` 存在
- [ ] `scripts/bat-notify.mjs --submit` 可用
- [ ] BAT 環境變數：`BAT_TOWER_TERMINAL_ID` 非空

### Phase 1：啟用 yolo（5min）

```
*config auto-session yolo
*config yolo_max_retries 1
```

觀察：
- [ ] YOLO 啟動警語面板完整（斷點 A/B/C 說明）
- [ ] 退路指引明確（`*config auto-session ask` 退回）

### Phase 2：派 T0173（5-10min）

- [ ] 派發面板完整（工單摘要 + 派發理由 + 1-2s 緩衝）
- [ ] BAT 自動開新分頁
- [ ] `bat-notify.mjs --submit` 送 Enter 預填（Worker 不用手按）
- [ ] 塔台記錄此次派發到 `_tower-state.md` YOLO 歷程區段

### Phase 3：Worker 執行 T0173（15-25min，純讀碼 research）

Worker 讀碼 + 寫 `_report-bug-040-workspace-misroute.md`。

觀察：
- [ ] Worker 完成後自動呼叫 `bat-notify.mjs --submit` 送「T0173 完成」
- [ ] 回報字串符合正則 `^T\d{4}\s+(完成|部分完成|失敗|需要協助)\s*$`
- [ ] 塔台立即讀取、更新進度

### Phase 4：下一張判定（觀察即可，不真派）

T0173 DONE → 塔台進入下一張判定流程。實際上沒有明確的「下一張」（PLAN-020 已到收斂），所以塔台會：
- 讀 PLAN-020 剩餘候選 → 發現沒有 pending → 報告「yolo 工作隊列清空」
- 或讀 BUG-040 衍生拆單 → 但 T0173 本身是研究單，拆單要人工審後才派

**觀察點**：塔台如何處理「沒有明確下一張」的情況？是否進入等待狀態、是否自動停 yolo？

### Phase 5：斷點 C 測試（5min）

塔台進入 Phase 4 判定流程時，使用者立即打字「停」。

觀察：
- [ ] 塔台是否立即中止 yolo 流程？
- [ ] 停下後是否清楚說明「當前 yolo 歷程摘要 + 恢復指引」？

（斷點 A/B 本輪不強制測，留在日後 Step 3 或真實 PLAN-018 yolo 派發時觀察）

### Phase 6：檢查 `_tower-state.md` YOLO 歷程區段（5min）

- [ ] 新增 `## 🤖 YOLO 模式歷程` 區段
- [ ] 紀錄派發 T0173 事件（時間 / 選擇理由 / 派發面板摘要）
- [ ] 紀錄斷點 C 觸發事件（觸發時間 / 當時狀態）
- [ ] 紀錄 yolo 啟用/停用時間戳

---

## 成功判定

**全綠**：Phase 0-6 全部打勾 → PLAN-020 DONE，yolo 模式進入日常可用狀態
**部分綠**：核心機制運作但細節需調整 → 記 BUG/PLAN 再決定優先級
**紅**：核心機制失效 → 回 PLAN-020 補工單

---

## 失敗處理

| 失敗類型 | 處理 |
|---------|------|
| Worker 不自動回報 | 檢查 `BAT_TOWER_TERMINAL_ID` 環境傳遞 → 開 BUG 單 |
| 塔台不讀取 auto-session config | 檢查塔台啟動時 config 載入順序 → 回 PLAN-020 renew |
| 斷點 C 失效 | 檢查 yolo-mode.md 判定邏輯 → 開 BUG 單 |
| T0173 執行過程踩 BUG-040 | Worker 用絕對路徑 workaround 繼續，T0174 記錄事件 |

---

## 範圍（納入 / 排除）

**納入**：
1. 啟用 yolo + `yolo_max_retries: 1` 完整流程
2. 派 T0173 觀察首張 dogfood
3. 斷點 C 實測
4. `_tower-state.md` YOLO 歷程區段驗證
5. T0174 完整回報

**排除**：
1. 斷點 A/B 強制測試（留給日後真實 PLAN-018 yolo 派發觀察）
2. 真實碼 dogfood（Step 3 移到 PLAN-018 `*resume`）
3. 多工單派發場景（本輪只派一張 T0173）
4. 修改任何 skill 檔案

---

## 後續

1. T0174 完成 → PLAN-020 整體 DONE
2. `*evolve` 萃取 PLAN-020 Learning（L057-L062 + dogfood 觀察）
3. BUG-040 研究報告（T0173 產出）→ 塔台審 → 派修復工單
4. `*resume` PLAN-018 → 視情況採 yolo 或 ask 模式派 3 張實作工單（Step 3 場景）

---

## 回報區

> 由塔台在 dogfood 過程中分段填寫。

### Phase 0 前置自檢（2026-04-18，約 5min）

| # | 項目 | 結果 | 佐證 |
|---|------|------|------|
| 1 | ct-exec Step 8.5 yolo | ✅ | `~/.claude/skills/ct-exec/SKILL.md:272-346` v4.2.0 升級、四類狀態字串齊全、硬鉤子語意、舊版 BAT 降級 |
| 2 | ct-done Step 6.5 對稱 | ✅ | `~/.claude/skills/ct-done/SKILL.md:48-88` 與 ct-exec 對稱的 yolo 分流段 |
| 3 | control-tower `auto-session` 四階 + `yolo_max_retries` | ✅ | `SKILL.md:598-599` 四階 config 表 + `yolo_max_retries` 0-10 行 |
| 4 | `yolo-mode.md` 存在 | ✅ | 15908 bytes，包含「啟動面板警語」「下一張工單判定」「3 斷點」「YOLO 歷程區段」「使用者可見訊息規格化」「失敗硬鉤子」「相容性」完整章節 |
| 5 | `bat-notify.mjs --submit` 可用 | ✅ | `scripts/bat-notify.mjs` 13 處 `submit` 命中，`--submit` flag + 互斥檢查 + `\r` 附加邏輯完整（c4b2a19） |
| 6 | BAT 環境變數 | ✅（修正判定） | `BAT_SESSION=1` + `BAT_TERMINAL_ID=c8a43b60...`；`BAT_TOWER_TERMINAL_ID` 空字串是**正常的** — 塔台用自己的 `BAT_TERMINAL_ID` 透過 `--notify-id` 注入給 Worker |

**Phase 0 判定**：✅ 全綠

**Phase 0 學習候選**：
- 初判誤以為 `BAT_TOWER_TERMINAL_ID` 空是問題，讀 `auto-session.md:113-123` 後修正 — 應加入 Phase 0 文件註解避免日後誤判

---

### Phase 1 啟用觀察（2026-04-18，約 5min）

**執行**：
- `*config auto-session yolo`（session）
- `*config yolo_max_retries 1`（session）
- 隨後使用者選 [C] 持久化 → 改寫 `_ct-workorders/_tower-config.yaml` 並 commit `4ec9056`

**啟動警語面板（已顯示）**：

```
║ ⚠️  YOLO MODE ACTIVE — 塔台將自主決策                 ║
║  斷點條件：                                           ║
║   A 非預期狀態字串                                    ║
║   B Renew≥1 或 1 連續 FAILED（yolo_max_retries=1）    ║
║   C 跨 PLAN 範圍                                      ║
║  關閉：*config auto-session on                        ║
```

**觀察結果**：

| 項目 | 結果 |
|------|------|
| YOLO 啟動警語面板完整 | ✅ 斷點 A/B/C 三行齊全 |
| N 值正確帶入（yolo_max_retries=1） | ✅ B 行「Renew≥1 或 1 連續 FAILED」正確 |
| 退路指引 | ✅ `*config auto-session on` |
| session-only 提示 | ✅ 但警語範本**未明文要求**（由塔台自行加註）|

**Phase 1 學習候選**：
- **L063 候選**：`yolo-mode.md` 啟動面板規格未涵蓋 session-only vs persisted 差異提示 → 建議 renew yolo-mode.md 補充（重啟會迷失的使用者體驗缺口）

---

### Phase 2 派 T0173 觀察

（待下 session 執行）

- ...

### Phase 3 Worker 執行 + 回報
- ...

### Phase 4 下一張判定觀察
- ...

### Phase 5 斷點 C 實測
- ...

### Phase 6 YOLO 歷程區段驗證
- ...

### 成功判定
- [ ] 全綠 / [ ] 部分綠 / [ ] 紅

### 衍生 BUG / PLAN / Learning
- ...

---
