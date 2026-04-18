# BUG-041-yolo-mode-worker-side-not-detected

## 元資料
- **編號**：BUG-041
- **標題**：yolo mode Worker 側未偵測，自動化鏈路斷半
- **狀態**：OPEN
- **嚴重度**：🟡 Medium
- **建立時間**：2026-04-18 17:20 (UTC+8)
- **回報者**：使用者（T0175 dogfood 後觀察 Worker 回報訊息）
- **影響版本**：當前 main（PLAN-020 yolo mode 首次 dogfood）

## 現象

**可重現**：100%（T0175 首次派發即觀察到）

**對照表**：

| 側 | 設定/行為 | 實際 |
|----|---------|------|
| 塔台 | `auto-session: yolo`（project config） | ✅ 載入 |
| 塔台 | 派發 T0175 帶 `--notify-id` | ✅ 執行 |
| Worker | 完成 T0175 | ✅ 完成 + commit |
| Worker | **判斷「auto-session 未設 → 預設 ask」** | ❌ 讀不到 yolo |
| Worker | 走 Step 11 剪貼簿（而非 Step 8.5 `--submit`） | ❌ 降級 |

**結果**：Worker 完成後只寫剪貼簿，使用者需手動貼到塔台 session 才能觸發塔台下一步決策。yolo「自動化 + 自主決策」只有塔台半邊能跑，Worker 半邊斷鏈。

## 推測根因（需 T0179 研究確認）

| 可能性 | 說明 |
|-------|------|
| 1 | `/ct-exec` Worker skill 未讀 project `_tower-config.yaml` |
| 2 | Worker 讀 global `~/.claude/control-tower-config.yaml`（通常沒改過） |
| 3 | Worker 依賴環境變數（例：`CT_AUTO_SESSION`）但塔台派發未注入 |
| 4 | Worker 讀 config 但欄位名解析錯誤（`auto_session` underscore vs `auto-session` dash） |

## 實測根因（T0179 結論）

**時序性規格落差** — Worker skill v4.2.0（2026-04-18 tag）設計時寫「Config 讀取順序：`_tower-config.yaml` → `~/.claude/control-tower-data/config.yaml` → 預設 `ask`」（`ct-exec/SKILL.md` 行 287 + 行 371）作為 mode 判斷機制。同日釋出的 D062 決策改為「Worker 無狀態」原則，skill 尚未同步更新，Worker 依現行規格忠實讀 config，但該行為本身違反 D062。

**四項推測驗證**：

| 推測 | 結論 |
|------|------|
| 1. 未讀 project config | ❌ 錯誤 — skill 明寫要讀，且本專案 `_tower-config.yaml` 存在（`auto-session: yolo`） |
| 2. 讀 global fallback | ⚠️ 部分正確 — global 為 fallback 但 project 應先讀到 |
| 3. 依賴 env 但塔台未注入 | ❌ 錯誤 — 現行 skill **沒要求讀 env**，這是**應然方向**而非**實然 bug** |
| 4. 欄位名解析錯誤 | ❌ 錯誤 — project config 與 skill 規格命名一致（`auto-session` dash） |

**修復方向**：不是「讓 Worker 讀對檔」而是「改 skill 規格：不讀 config，改讀塔台注入的 `CT_MODE` env」。

**採納協定**（依 T0179 Q1.A + Q2.C + Q3.C 決策）：
- Flag：`--mode <yolo|ask|off|on>` + `--interactive` / `--no-interactive`
- Env：`CT_MODE` + `CT_INTERACTIVE`（獨立）
- Fallback：Worker 讀不到 env → `ask` 模式 + 升級提示

**完整規格**：見 `_report-t0179-worker-yolo-flag-protocol.md` § B-E。

**Phase 2 下游工單**（依報告 § E）：
- **T0180** — BAT 端 `--mode` / `--interactive` flag 接收 + customEnv 注入（改 `scripts/bat-terminal.mjs` 單檔，~30 min）
- **CT-T005** DELEGATE — 塔台 skill 派發指令加 `--mode` + 啟動詢問 G3 互動旗標（~20 min）
- **CT-T006** DELEGATE — Worker skill（`ct-exec` / `ct-done`）移除 config 讀取、改讀 env（~30 min）

## 設計原則決策（D062）

使用者決定：**Worker 應為無狀態，所有 runtime context 由塔台派單當下 explicit 傳遞**。

此 BUG 的修復方向因此**不是「讓 Worker 讀 config」**，而是：
- 塔台派發時傳 `--yolo` flag（或類似）
- BAT 端接收 flag → 注入 env（例：`CT_YOLO=1`）
- Worker 讀 env 判斷是否走 Step 8.5

詳見 `_decision-log.md` D062。

## 風險分析

| 風險 | 影響 |
|------|------|
| yolo 核心價值受損 | 「自主決策」只有單向（塔台→Worker），Worker→塔台需人工介入 |
| dogfood 數據失真 | Phase 2 前所有 yolo 派發都走降級路徑，學習資料含 bias |
| Step 11 剪貼簿依賴 | 若剪貼簿機制失效（例：Remote session）會完全卡住 |
| 與 BUG-040 糾纏 | 同屬「Worker 依賴共享狀態」類問題，需一起解決但修復要分開（避免除錯混淆） |

## Workaround

使用者於 Worker 完成後手動把剪貼簿內容貼到塔台 session，觸發塔台下一步。

## 建議處理

**阻塞 PLAN-020 閉環？**：否（塔台側自主決策已運作，Step 11 可用）
**阻塞當前任務？**：否（BUG-040 修復不依賴此 BUG 修好，Phase 1 可獨立完成）

**處理時機**：BUG-040 CLOSED 後啟動 Phase 2（避免雙 BUG 糾纏難除錯）。

**Phase 2 規劃**：
1. **T0179** — 研究 Worker `/ct-exec` skill 當前 yolo 判斷路徑 + 設計 flag 傳遞機制
2. **更新本 BUG**（附 T0179 結論）
3. **T0180** — BAT 端 `--yolo` flag 接收 + env 注入
4. **CT-T005** DELEGATE — 塔台 skill 派發指令加 `--yolo`
5. **CT-T006** DELEGATE — Worker skill 改讀 env、移除 config 讀取（落實 D062）
6. FIXED → VERIFY → CLOSED

## 相關檔案

- `scripts/bat-terminal.mjs`（BAT 端 flag 接收點）
- `~/.claude/skills/control-tower/SKILL.md`（塔台派發指令模板）
- `~/.claude/skills/control-tower/references/auto-session.md`（派發規範）
- `~/.claude/skills/ct-exec/SKILL.md`（Worker 判斷邏輯）
- `_ct-workorders/_tower-config.yaml`（項目 yolo 設定，Worker 目前讀不到）

## 相關單據

- **D062** — Worker 無狀態原則（本 BUG 修復的設計依據）
- **BUG-040** OPEN — 同類型設計缺失（workspace 錯派），Phase 1 修復中
- **T0175** DONE — BUG-040 Phase 1 研究，過程中發現本 BUG 現象
- **T0179**（待派）— 本 BUG 研究工單
- **PLAN-020** — yolo mode 母案，本 BUG 是 dogfood 發現的實作 gap

## 備註

- **與 BUG-040 的關聯**：兩者都是 D062「Worker 依賴共享狀態」的實例，但修復**分開**進行，符合「容易釐清問題」原則
- **dogfood 觀察**：Phase 1 期間本 BUG 保持現狀（Worker 走剪貼簿降級），使用者手動接力
- **Learning 候選 L067**：yolo mode 啟用必須同時驗證**雙側**（塔台派發 + Worker 回報），單改 config 會有盲點

---

## 回報區

> 以下由 sub-session 填寫（Phase 2 修復時），請勿在指揮塔 session 中編輯

### 修復 commit

### 修復範圍

### 驗證方式

### VERIFY / CLOSED 時間
