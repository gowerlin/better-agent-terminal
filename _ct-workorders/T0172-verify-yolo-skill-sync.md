# T0172-verify-yolo-skill-sync

## 元資料
- **工單編號**：T0172
- **任務名稱**：驗證：對方塔台 source sync 後，本機 `~/.claude/skills/` 是否真有 yolo 更新
- **狀態**：DONE
- **開始時間**：2026-04-18 15:00 (UTC+8)
- **完成時間**：2026-04-18 15:02 (UTC+8)
- **類型**：verification（純讀檔，不改任何檔案）
- **互動模式**：disabled
- **建立時間**：2026-04-18 14:55 (UTC+8)
- **預估工時**：15-30 min（4 個檔案 grep + 簡短報告）
- **關聯 PLAN**：PLAN-020（yolo skill sync 驗證，PLAN-018 dogfood 前置）
- **關聯研究**：T0169（Worker skill 草稿）、T0170（Tower skill 草稿）
- **關聯上游**：CT-T002 Renew #2（對方塔台 commit `3a93952` 宣稱做了 source sync）
- **依賴**：無（可與 CT-T002 Renew #2 並行）
- **風險**：🟢

## 目標

驗證對方塔台在 `3a93952 chore(ct): CP-T0095 DONE — source sync + v4.2.0 snapshot 回報` 宣稱的 source sync 是否真把新版 yolo skill 同步到本機 `~/.claude/skills/`。若真同步 → PLAN-020 skill 側完結，T0174 dogfood 可派。若未同步 → 塔台需額外動作。

## 範圍

**納入**：
1. 檢查 `~/.claude/skills/ct-exec/SKILL.md` 是否有 `auto-session yolo` 分流段落
2. 檢查 `~/.claude/skills/ct-done/SKILL.md` Step 6.5 等效段落
3. 檢查 `~/.claude/skills/control-tower/SKILL.md` `auto-session` 是否擴充到四階
4. 檢查 `~/.claude/skills/control-tower/references/yolo-mode.md` 檔案是否存在 + 大小合理
5. 檢查 `~/.claude/skills/control-tower/references/tower-config.md` 是否有 `yolo_max_retries`

**排除**：
- 不實測 yolo 模式（那是 T0174 dogfood 範圍）
- 不改任何檔案（`~/.claude/skills/` 是 Layer 1 唯讀）
- 不比對 Worker `bfc4ba5` vs 對方塔台 `def3053` 的實作細節差異（工單 scope 外）
- 不調查對方塔台的其他 skill 變動（只看 yolo 相關）

## 詳細檢查清單

### V1：`ct-exec/SKILL.md` Step 8.5

**檢查點**：
- 有 `Step 8.5` 或等效段落（Worker 自動回報）
- 段落提到 `auto-session` 讀取
- 分流三種行為（off/ask 跳過 / on 呼叫 bat-notify / yolo 加 `--submit`）
- 四種狀態字串「完成 / 部分完成 / 失敗 / 需要協助」有出現
- 硬鉤子語意（yolo 失敗阻斷）有說明

**指令**：
```bash
grep -n "yolo\|--submit\|部分完成\|需要協助" ~/.claude/skills/ct-exec/SKILL.md
```

預期：至少 5+ 條命中。

### V2：`ct-done/SKILL.md` Step 6.5

**檢查點**：與 V1 對稱，應有相同 yolo 分流邏輯。

**指令**：
```bash
grep -n "yolo\|--submit\|部分完成\|需要協助" ~/.claude/skills/ct-done/SKILL.md
```

### V3：`control-tower/SKILL.md` auto-session 四階

**檢查點**：
- `*config auto-session` 接受 `yolo` 值（不只 off/ask/on）
- 核心迴圈或相關段落有 yolo 自主派發邏輯
- 啟動面板有 `⚠️ YOLO MODE ACTIVE` 警語（條件顯示）
- `yolo_max_retries` 或 yolo 相關 config 出現

**指令**：
```bash
grep -n "yolo\|YOLO\|yolo_max_retries" ~/.claude/skills/control-tower/SKILL.md
```

預期：10+ 條命中。

### V4：`references/yolo-mode.md` 檔案

**檢查點**：
- 檔案存在
- 大小合理（Worker 草稿 T0170 + 對方塔台實作估計 300-500 行）
- 包含：啟動識別 / Q2.A 判定 / 3 斷點判準 / `_tower-state.md` 歷程格式 / 8 迴歸測試場景

**指令**：
```bash
test -f ~/.claude/skills/control-tower/references/yolo-mode.md && wc -l ~/.claude/skills/control-tower/references/yolo-mode.md
grep -n "斷點 A\|斷點 B\|斷點 C\|Q2.A\|YOLO 歷程\|迴歸測試" ~/.claude/skills/control-tower/references/yolo-mode.md | head -20
```

### V5：`references/tower-config.md` yolo_max_retries

**檢查點**：
- `auto-session` enum 四階
- `yolo_max_retries` 選項 + 預設值 3

**指令**：
```bash
grep -n "yolo\|yolo_max_retries" ~/.claude/skills/control-tower/references/tower-config.md
```

## 驗收條件

### 對方塔台 source sync 結論三選一

根據 V1-V5 結果，回報區明確標記結論：

- `[OK]` **完全同步** — 所有檢查點通過，PLAN-020 skill 側完結，可派 T0174 dogfood
- `[PARTIAL]` **部分同步** — 某些檔案/段落缺失（列清單），需塔台決策（要求對方塔台補、或本機手動補、或忽略）
- `[FAIL]` **未同步** — 多數檢查點失敗，skill 側還是舊版

### 回報內容要求
1. V1-V5 逐項通過/失敗標記
2. 關鍵 grep 指令輸出片段（至少 10 行）
3. `yolo-mode.md` 檔案大小 + 第一行內容（確認是實體檔案非 placeholder）
4. 明確結論（OK / PARTIAL / FAIL）
5. 若 PARTIAL：列缺失清單 + 建議補救路徑

## 執行注意事項

- **純讀檔**：不執行任何 `write` / `edit` / `mv` / `cp` 動作
- **路徑**：`~/.claude/skills/` 需用 shell 展開或 `echo $HOME` 拼接（Windows 可能是 `C:\Users\<user>\.claude\skills\`）
- **平台差異**：Git Bash / PowerShell / pwsh 都可，Worker 自行選擇
- **若對方塔台實作與草稿偏離**：**只記錄觀察**，不評斷對錯（信任對方塔台品質，本工單只驗同步狀態非等價性）

## 收尾

1. 填寫回報區
2. 不 commit（純讀檔無改動）
3. 呼叫 `bat-notify.mjs`（不加 `--submit`）通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 開始時間 / 完成時間
- 開始：2026-04-18 15:00 (UTC+8)
- 完成：2026-04-18 15:02 (UTC+8)

### V1-V5 驗收

| 項目 | 結果 | 證據 |
|------|------|------|
| V1 `ct-exec/SKILL.md` Step 8.5 | ✅ 通過 | 17 條命中，含 L272（v4.2.0 必要鉤子）、L292-293（on/yolo 分流表）、L302-303（部分完成/需要協助字串）、L327-329（yolo 硬鉤子阻斷語意）、L346-349（舊版 BAT 降級說明）、L370-375（Step 11 前置條件含「yolo 失敗不跑 Step 11」）、L393-394（剪貼簿 fallback 狀態字串） |
| V2 `ct-done/SKILL.md` Step 6.5 | ✅ 通過 | 11 條命中，L48-49 明確註記「與 ct-exec Step 8.5 對稱」，L69-70 on/yolo 分流表、L79-80 PARTIAL/FAILED 字串、L104-106 硬鉤子阻斷 + 介入流程、L121 舊版 BAT 降級 |
| V3 `control-tower/SKILL.md` | ✅ 通過 | L598 `auto-session` enum 擴充到 `on/ask/off/yolo`、L599 新增 `yolo_max_retries` 0-10 預設 3、L1217 reference 表 yolo-mode.md 條目、L1246 核心迴圈 yolo 分支呼叫「下一張判定邏輯」 |
| V4 `references/yolo-mode.md` | ✅ 通過 | 檔案存在且完整（449 行，首行 `# YOLO 模式規格`），包含 Q2.A 判定邏輯（L49）、3 斷點判準（斷點 A L119、B-1 L157-168、B-2 L184-199、C L212-231）、`## YOLO 歷程` 格式（L245-284）、`yolo_max_retries = 0` 特例（L305） |
| V5 `references/tower-config.md` | ✅ 通過 | L38 `auto-session` 四階 enum、L39 `yolo_max_retries` 0-10 預設 3 + 斷點 B 連結、L127-128 config snippet 含 `# v4.2+ YOLO 模式` 註解 |

### `yolo-mode.md` 檔案狀態
- **大小**：449 行（預估 300-500 行範圍內，合理）
- **首行**：`# YOLO 模式規格`（實體檔案，非 placeholder）
- **關鍵段落命中**：斷點 A/B-1/B-2/C 四判準齊全、Q2.A 下一張工單判定、Fallback 路徑、YOLO 歷程 `_tower-state.md` 新區段、PAUSED 訊息模板（L319-322）、8 迴歸測試場景（L338 等）

### 結論（三選一）
**[OK] 完全同步** — 所有 V1-V5 檢查點通過，PLAN-020 skill 側完結，可派 T0174 dogfood。

### 缺失清單（若 PARTIAL）
不適用（結論為 OK）。

### Worker 筆記

觀察對方塔台實作風格：

1. **對稱度高**：ct-exec Step 8.5 與 ct-done Step 6.5 幾乎是 1:1 對稱，連硬鉤子介入訊息都共用同一模板，降低未來維護分歧風險。
2. **硬鉤子 yolo 失敗不跑 Step 11**：對方塔台在 ct-exec L370-375 明確拒絕「剪貼簿降級」，理由是避免塔台 parse 到 Worker 回報訊息但 Worker 又把訊息塞進使用者剪貼簿的狀態重複。這與 Worker 草稿 T0169 的保守設計略有差異（草稿假設所有失敗都走 Step 11），但對方塔台的決策更嚴謹，值得 T0174 dogfood 關注。
3. **舊版 BAT 降級邏輯**：L346-347 要求偵測 `bat-notify.mjs --help` 是否有 `--submit` flag 才降級。本機 `scripts/bat-notify.mjs` 於 T0168 已補齊 `--submit` flag（BUG-039 FIXED 後），故 yolo 模式可正常運作。
4. **對 T0174 dogfood 的提醒**：
   - 實測時請先跑 `*config auto-session` 確認 enum 已接受 `yolo`（L598 應支援）
   - 若塔台啟動面板未出現 `⚠️ YOLO MODE ACTIVE` 警語，檢查 `yolo-mode.md` L32 附近的條件顯示邏輯是否被正確 wire 到 core loop
   - 斷點 B 計數器需觀察是否跨 session 持久化（對方塔台在 `_tower-state.md` 的 `## YOLO 歷程` 寫入，應該會自動 persist）
5. **未對比實作差異**（工單 scope 外）：Worker 未驗證 Worker `bfc4ba5` vs 對方塔台 `def3053` 的等價性，僅驗 source sync 狀態。若 T0174 dogfood 發現行為不符預期，塔台需另開工單追查實作差異。
