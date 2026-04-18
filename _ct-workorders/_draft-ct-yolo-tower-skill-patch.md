# Control-Tower-Skill Patch — yolo mode Tower autonomous decision (W3)

> **狀態**：DRAFT（本地草稿，待上游 COORDINATED 推 `Control-Tower-Skill`）
> **來源**：better-agent-terminal / PLAN-020 / T0167 / T0168 / T0169 / T0170
> **產出時間**：2026-04-18 (UTC+8)
> **先例**：PLAN-011（BAT routing 上游 PR，結構仿照之）
> **姊妹草稿**：`_draft-ct-yolo-worker-skill-patch.md`（T0169，Worker skill 端）

---

## 背景

### 根因（T0167 §A + §C）

`auto_session: on` 下，Worker→Tower 反向通道技術上已全通（T0167 §A / §B 確認），但塔台自身無「自主決策」邏輯——Worker 即使成功回報 `T#### 完成`，塔台仍被動等待使用者下一句指令。PLAN-020 目標是把塔台升級為「收到 Worker 通知 → 自動讀研究工單拆單表 → 自動派下一張」，形成閉環 yolo 流程。

三個設計議題：

1. **`auto-session` 四階擴充**：現有 `off / ask / on` 三態需新增 `yolo`（on 的超集），定義為「Worker 自動送出 + 塔台自主決策下一張」
2. **資訊來源**：塔台從哪裡知道「下一張是哪張」？D060 收斂為 Q2.A（研究工單 D 區段 parse）
3. **斷點機制**：yolo 不可無條件狂奔，需 3 道安全閘——A 非預期狀態 / B Renew≥3 或 3 FAILED / C 跨 PLAN 範圍

### 前置條件

- **T0168 ✅ DONE**（commit `c4b2a19`）：`bat-notify.mjs --submit` flag（PTY write 附 `\r` 使塔台自動送出）
- **T0169 ✅ DONE**（commit `488ad93`）：Worker skill 草稿（`_draft-ct-yolo-worker-skill-patch.md`），鎖定四種狀態字串
- **control-tower skill 現狀**：`~/.claude/skills/control-tower/SKILL.md` line 598、`references/tower-config.md` line 38、`references/auto-session.md` 全檔——皆為 `off / ask / on` 三態定義

### 決策依據

- **D059**：PLAN-020 yolo 模式插隊啟動（PLAN-018 冷凍作為驗證場景）
- **D060**：yolo 下一張工單資訊來源採 **Q2.A**（研究工單 D 區段結構化表格），收斂為單一分支。**本草稿只寫 Q2.A**，不納入 Q2.B（PLAN 檔案）或 Q2.C（專用 queue）分支

### Q2 收斂理由（為何只寫 A 分支）

依 D060 與 T0167 §F Q2 待決策選項比較：

| 分支 | 理由 |
|------|------|
| **A（研究工單 D 區段）** | ✅ 重用現有機制（所有 PLAN 本就產研究工單）；✅ 結構化資訊已成熟；✅ 無需新檔案格式 |
| B（PLAN 檔案） | ❌ PLAN 檔案設計為「想法追蹤」，非「執行清單」，強加結構會污染原語意 |
| C（專用 queue） | ❌ 新增檔案型別增加維護負擔；❌ 與現有研究工單 D 區段重工 |

---

## 目標

擴充 `control-tower` skill 新增 `auto-session: yolo` 四階模式，讓塔台具備**自主決策**能力：Worker 回報完成後自動讀取研究工單 D 區段，派發下一張工單，同時有 3 道安全閘門避免失控。

| 能力 | 現狀 | yolo 後 |
|------|------|---------|
| 派發下一張工單 | 使用者手動輸入「派 T####」 | 塔台自動從研究工單 D 區段決定 |
| 失敗偵測 | 無（依賴使用者觀察） | 斷點 A/B/C 自動觸發暫停 |
| 視覺警示 | 無特別標記 | 啟動面板 + 派發面板 + 每次派發 1-2s 緩衝 |
| 可觀察性 | 散落在 session 輸出 | `_tower-state.md` 新增 `## YOLO 歷程` 區段 |

---

## 變更檔案

| 檔案 | 改動範圍 |
|------|---------|
| `~/.claude/skills/control-tower/SKILL.md` | 內建命令 `*config` 選項表（line 598）新增 `yolo` 枚舉值與 `yolo_max_retries`；模式路由（line 1163）補 yolo 行為說明；核心迴圈（line 1227）第 5 步加入 yolo 自主決策分支 |
| `~/.claude/skills/control-tower/references/tower-config.md` | line 38 `auto-session` 行擴充為四階；新增 `yolo_max_retries` 選項行；持久化 YAML 範例（line 123 附近）補上 yolo 相關欄位 |
| `~/.claude/skills/control-tower/references/auto-session.md` | 新增 `### auto-session = yolo` 章節；「派發後行為」段補 yolo 分支 |
| `~/.claude/skills/control-tower/references/yolo-mode.md`（新增） | yolo 完整規格：啟動識別、工單判定邏輯、3 斷點機制、`_tower-state.md` 歷程格式 |

**不動**：
- `ct-exec` / `ct-done` skill（由 T0169 草稿負責）
- 其他 references/（work-order-system / decision-log-system 等）
- BAT code（由 T0168 負責）

---

## Before / After 對照

### 1. `control-tower/SKILL.md` 內建命令 `*config` 可用選項表

**Before**（現狀 line 598）：

```markdown
| `auto-session` | `on/ask/off` | `ask` | 工單派發後自動開新 session 行為 |
```

**After**：

```markdown
| `auto-session` | `on/ask/off/yolo` | `ask` | 工單派發後自動開新 session 行為。`yolo` = `on` 的超集，Worker 自動送出完成訊息且塔台自主決策下一張工單（見 [yolo-mode.md](references/yolo-mode.md)） |
| `yolo_max_retries` | `0-10` | `3` | YOLO 模式斷點 B 閾值（Renew ≥N 或連續 N FAILED 觸發暫停）。`0` = 停用斷點 B |
```

---

### 2. `control-tower/references/tower-config.md` `*config` 可用選項表

**Before**（現狀 line 38）：

```markdown
| `auto-session` | `on` / `ask` / `off` | `ask` | 工單派發後自動開新 session 行為。`on` = 靜默開新分頁；`ask` = 詢問使用者；`off` = 僅文字提示 |
```

**After**：

```markdown
| `auto-session` | `on` / `ask` / `off` / `yolo` | `ask` | 工單派發後自動開新 session 行為。`on` = 靜默開新分頁；`ask` = 詢問使用者；`off` = 僅文字提示；`yolo` = `on` 的超集，Worker 自動送出 + 塔台自主決策下一張工單（詳見 [yolo-mode.md](yolo-mode.md)） |
| `yolo_max_retries` | `0` - `10` | `3` | YOLO 模式斷點 B 閾值（Renew ≥N 次或連續 N 張 FAILED 觸發暫停）。`0` = 停用斷點 B |
```

**持久化 YAML 範例**（line 123 附近 `worker_commit: required` 下方新增）：

**Before**：

```yaml
  # v4 Worker 安全護欄
  worker_max_retries: 3
  worker_strikeout_action: block
  worker_commit: required
```

**After**：

```yaml
  # v4 Worker 安全護欄
  worker_max_retries: 3
  worker_strikeout_action: block
  worker_commit: required
  # v4+ YOLO 模式
  yolo_max_retries: 3
```

---

### 3. `control-tower/references/auto-session.md` — 新增 yolo 章節

**Before**（line 43-73 現有三階行為）：

```markdown
## 派發後行為（依 `auto-session` 設定）

### `auto-session = on`
... (現狀)

### `auto-session = ask`
... (現狀)

### `auto-session = off`
... (現狀)
```

**After**（在 `off` 之後追加）：

```markdown
### `auto-session = yolo`

> `on` 的超集：Worker 自動送出完成訊息（依 T0169 草稿 `--submit` 機制）+ 塔台自主決策下一張工單 + 3 斷點安全閘。

1. 顯示工單摘要（同 `on`）
2. 靜默執行：開新分頁 + 預載指令（同 `on`）
3. 預載指令改用 `bat-terminal.mjs --notify-id $BAT_TERMINAL_ID --yolo`（`--yolo` flag 告知 Worker skill 以 yolo 模式收尾，觸發 `bat-notify.mjs --submit`）
4. Worker 完成後自動回報塔台 → 塔台執行「yolo 自主決策」流程（見 [yolo-mode.md](yolo-mode.md) § 判定邏輯）
5. 塔台主面板頂端顯示 `⚠️ YOLO ACTIVE` 警語（直到使用者改 config）

**差異點對比**：

| 行為 | `on` | `yolo` |
|------|------|--------|
| 開新分頁 | ✅ | ✅ |
| Worker 回報 | 預填（使用者按 Enter） | 自動送出（`\r`） |
| 下一張工單派發 | 使用者手動 | 塔台自主決策 |
| 啟動面板警語 | 無 | ⚠️ YOLO ACTIVE |
| 斷點機制 | 無 | 3 道（A/B/C） |
| `_tower-state.md` 區段 | 不影響 | 新增 `## YOLO 歷程` |

詳細規格見 [yolo-mode.md](yolo-mode.md)。
```

---

### 4. `control-tower/references/yolo-mode.md`（新增整份檔案）

**新增**：

```markdown
# YOLO 模式規格

> `auto-session: yolo` 的完整行為規格。
>
> **核心概念**：`on` 超集 = Worker 自動送出 + 塔台自主決策下一張 + 3 斷點安全閘。
>
> **前置**：需 BAT ≥ T0168（`bat-notify.mjs --submit` 支援）、Worker skill ≥ T0169。

## 啟動識別

塔台啟動時（Step 0 環境偵測完成後），讀取 `auto-session` 設定：

- 值為 `yolo` → 進入 yolo 模式
- 其他值 → 走現有 on/ask/off 流程

### 啟動面板警語

yolo 模式開啟時，塔台主面板**下方必須**顯示：

\`\`\`
╠═══════════════════════════════════════════════════════╣
║ ⚠️  YOLO MODE ACTIVE — 塔台將自主決策                  ║
║  斷點條件：A 非預期狀態 / B Renew≥N 或 N 連續 FAILED / C 跨 PLAN  ║
║  關閉：*config auto-session on                        ║
╠═══════════════════════════════════════════════════════╣
\`\`\`

其中 `N` 為 `yolo_max_retries` config 值（預設 3）。

### 派發下一張時的回報面板

塔台自動派發下一張工單前，顯示：

\`\`\`
🤖 YOLO: T0xxx DONE → 自動派發下一張 T0xxy
   依據：<研究工單 T0xxx-R 的 D 區段第 N 列>
   斷點計數：Renew 0 / FAILED 0 / N
   [Ctrl+C 中斷 / *pause 手動介入]
\`\`\`

**1-2 秒視覺緩衝**：塔台顯示上述面板後，強制等待 1-2 秒再執行實際派發動作，給使用者中斷時機（Ctrl+C 或 `*pause`）。

---

## 下一張工單判定邏輯（Q2.A 分支）

### 資訊來源

1. **當前活躍 PLAN**：從 `_tower-state.md` 讀取「本 Session 焦點」或「進度快照」段落
2. **該 PLAN 對應的研究工單**：工單元資料 `關聯 PLAN: PLAN-0XX` + `關聯研究: T0XXX`，或從 PLAN 檔案反查
3. **研究工單回報區 D 區段**：結構化 markdown 表格（拆單建議）
4. **現有熱區工單狀態**：Glob `_ct-workorders/T*.md` + parse 元資料的「狀態」欄位

### D 區段 parse 規則

塔台從研究工單回報區尋找以下 section heading 之一（優先序）：

1. `### 拆單建議摘要` 或 `### 拆單總表`
2. `### D. 拆單建議` 或 `### D 區段` 等 D 前綴章節
3. `## D. 實作工單拆單建議` 等 H2 D 前綴章節

在該 section 下，尋找**第一個符合格式的 markdown 表格**，預期格式：

\`\`\`markdown
| # | 標題 | 專案 | 依賴 | 工時 | 🚦 |
|---|------|------|------|------|-----|
| 1 | BAT code: xxx | 本專案 | — | 1h | 🟢 |
| 2 | 本地草稿: yyy | 本專案 | 工單 1 | 1.5h | 🟢 |
| ... |
\`\`\`

**關鍵欄位必須存在**（缺任一即視為格式不符）：
- `#`（編號欄，接受 `工單` 前綴，如「工單 1」）
- `標題`
- `依賴`（`—` / `-` / 空字串表示無依賴）

### 判定邏輯（機械化，偽碼）

\`\`\`
on_worker_report_done(T_done):
  1. workorder = read_file(T_done)
  2. plan = parse_metadata(workorder, "關聯 PLAN")
  3. research = parse_metadata(workorder, "關聯研究")
  4. if plan is None or research is None:
        → 斷點 A（無 PLAN/research 綁定，無法自主決策）
  5. d_section = extract_d_section(read_file(research))
  6. if d_section is None:
        → 斷點 A（研究工單無 D 區段）
  7. table = parse_markdown_table(d_section)
  8. if table is None or not has_required_columns(table):
        → 斷點 A（表格格式不符）
  9. for row in table:
       if dependencies_all_done(row.依賴) and not dispatched(row.標題):
         if has_concrete_T_number(row.標題):
           → 派發該工單
         else:
           → 斷點 A（占位符，需使用者補 T####）
  10. 若所有列都完成或已派發 → 顯示「PLAN 完成」+ 結束 yolo
\`\`\`

### Fallback 路徑（觸發斷點 A）

| 情境 | 訊息 |
|------|------|
| 找不到研究工單 | `⏸ YOLO PAUSED — 工單 T#### 無關聯研究工單` |
| 研究工單無 D 區段 | `⏸ YOLO PAUSED — T####-R 無 D 區段` |
| D 區段無表格或格式不符 | `⏸ YOLO PAUSED — D 區段表格格式不符` |
| 列中無具體 T#### | `⏸ YOLO PAUSED — 下一列為占位符，需補 T####` |
| 所有列都完成 | `✅ PLAN-0XX 所有工單完成 → yolo 流程結束` |

---

## 3 斷點判準

### 斷點 A：Worker 回報非預期狀態

**判準（機械化 regex）**：

Worker 收尾訊息必須**精準匹配**以下 regex：

\`\`\`regex
^T\d{4}\s+(完成|部分完成|失敗|需要協助)\s*$
\`\`\`

對應四種合法字串（與 T0169 Worker skill 草稿 §「四種狀態字串」鎖定一致）：

| Worker 狀態 | 通知字串 |
|------------|---------|
| `DONE` / `FIXED` | `T#### 完成` |
| `PARTIAL` | `T#### 部分完成` |
| `FAILED` | `T#### 需要協助` |
| `BLOCKED` | `T#### 需要協助` |

**注意**：`失敗` 也列入合法字串以容錯，但實際 T0169 鎖定四種組合為「完成/部分完成/需要協助」三個映射（`失敗` 與 `需要協助` 語意皆為需介入）。

不匹配 → 斷點 A 觸發。

**觸發後塔台動作**：

\`\`\`
⏸ YOLO PAUSED — 斷點 A 觸發
  Worker 回報：<原文（保留引號）>
  可能原因：Worker skill 版本舊 / 字串未遵循規格 / 非預期語氣
  選項：
    [A] 接受為 DONE（語意清楚，續派下一張）
    [B] 接受為 FAILED（計入斷點 B 計數）
    [C] 退回 yolo → ask 模式，手動接手
  請輸入 A/B/C：
\`\`\`

---

### 斷點 B：Renew ≥N 或連續 N FAILED

N = `yolo_max_retries` config 值（預設 3）。

#### B-1：Renew 過多

**判準**：讀取被回報工單元資料的 `Renew 次數` 欄位，若 ≥N → 斷點 B-1。

**觸發訊息**：

\`\`\`
⏸ YOLO PAUSED — 斷點 B-1
  工單 T#### Renew 次數：N 次（超過閾值 N）
  建議：拆成新工單，避免同工單反覆迭代
  選項：
    [A] 接受此工單為 DONE 並繼續 yolo
    [B] 塔台協助拆新工單（暫停 yolo，進入對齊）
    [C] 退回 yolo → ask 模式
  請輸入 A/B/C：
\`\`\`

#### B-2：連續 N FAILED

**判準**：塔台 session 級計數器（記在 `_tower-state.md` `## YOLO 計數器` 段），規則：

- Worker 回報 `FAILED` / `BLOCKED` → 計數器 +1
- Worker 回報 `DONE` / `FIXED` / `PARTIAL` → 計數器歸零
- 計數器達 N → 斷點 B-2

**`_tower-state.md` `## YOLO 計數器` 格式**：

\`\`\`markdown
## YOLO 計數器

- 連續 FAILED: 2 / 3
- 最近 FAILED 工單: T####, T####
- 最後更新：2026-04-18 14:23
\`\`\`

**觸發訊息**：

\`\`\`
⏸ YOLO PAUSED — 斷點 B-2
  連續 FAILED 計數：N / N（達上限）
  最近失敗工單：T####, T####, T####
  建議：yolo 自動暫停，檢查是否需調整 PLAN 或研究結論
  選項：
    [A] 重置計數器並續跑（risky）
    [B] 暫停 yolo，手動診斷
    [C] 退回 yolo → ask 模式
  請輸入 A/B/C：
\`\`\`

---

### 斷點 C：Worker 建議跨出 PLAN 範圍

**判準**：Worker 回報區（「Worker 筆記」或「下一步建議」段落）若出現**跨出當前 PLAN 拆單表**的建議。

**偵測 regex**（二擇一觸發）：

\`\`\`regex
(?:另開|新開|建議.*派|建議.*開)\s*(?:工單|研究|PLAN|BUG)
\`\`\`

\`\`\`regex
\b(T\d{4}|PLAN-\d{3}|BUG-\d{3}|EXP-[A-Z]+-\d{3})\b
\`\`\`

（第二條用於偵測 Worker 提到新編號；塔台比對是否為當前 PLAN 拆單表中的工單）

**觸發後塔台動作**：

\`\`\`
⏸ YOLO PAUSED — 斷點 C 觸發
  Worker 建議（引用原文）：
  > <引用 Worker 筆記中匹配 regex 的段落>

  這個建議在當前 PLAN-0XX 拆單表外。
  選項：
    [A] 擴大當前 PLAN（將新發現納入 D 區段表格）
    [B] 開新 PLAN 處理此發現
    [C] 忽略此建議，繼續 yolo 流程（依原 D 區段派下一張）
  請輸入 A/B/C：
\`\`\`

---

## `_tower-state.md` 新增 `## YOLO 歷程` 區段

yolo 模式啟動時，塔台在 `_tower-state.md` **必要區段清單**之外追加此區段（位置：`## 🔍 環境快照` 之後、檔尾之前）。

### 格式規格

\`\`\`markdown
## YOLO 歷程

### 當前 Session（2026-04-18 13:00）

- [啟動] 2026-04-18 13:00 — PLAN-020 啟動 yolo，資訊來源：T0167 研究工單 D 區段
- [派發] 2026-04-18 13:02 — T0168 → T0169（依拆單表第 2 列）
- [完成] 2026-04-18 13:45 — T0168 DONE（正常）
- [派發] 2026-04-18 13:46 — T0169 → T0170（依拆單表第 3 列）
- [完成] 2026-04-18 14:30 — T0169 DONE（正常）
- [派發] 2026-04-18 14:31 — T0170 → T0171（依拆單表第 4 列）
- [斷點 A] 2026-04-18 15:00 — T0170 回報「執行時遇到問題」，不匹配四字串 → 暫停
- [恢復] 2026-04-18 15:02 — 使用者選 [C] 退回 ask 模式

### 計數器

- 連續 FAILED: 0 / 3
- 本 session yolo 派發工單數: 3
- 本 session 斷點觸發: A×1, B×0, C×0

### 歷史 Session（摘要）

- 2026-04-15 yolo session：派發 4 張，全 DONE，無斷點
- 2026-04-16 yolo session：派發 2 張，斷點 B-2 觸發後暫停
\`\`\`

### 寫入時機

| 事件 | 寫入欄位 |
|------|---------|
| yolo 模式首次啟動（本 session） | 新增 `### 當前 Session` 標題 + `[啟動]` 條目 |
| 塔台派發下一張工單 | 追加 `[派發]` 條目 |
| Worker 回報完成 | 追加 `[完成]` 條目 |
| 斷點 A/B/C 觸發 | 追加 `[斷點 X]` 條目 + 更新計數器 |
| 使用者恢復流程 | 追加 `[恢復]` 條目 |
| yolo 模式關閉 | `### 當前 Session` 移至 `### 歷史 Session` 摘要 |

### 必要區段清單更新（F-22 影響）

`_tower-state.md` 原必要區段清單（SKILL.md line 427-434）為 7 項。yolo 啟用時**條件追加**第 8 項：

> 8. YOLO 歷程（僅當 `auto-session: yolo` 曾啟用）

非 yolo 模式下此區段不存在，**不視為區段缺失**。

---

## 核心迴圈整合（SKILL.md line 1227）

**Before**（現狀）：

\`\`\`markdown
## 核心迴圈

1. 塔台產生工單 (.md 檔案)
2. 使用者開新 sub-session → 輸入 /ct-exec T0001
3. Sub-session 讀取工單、執行任務、自動收尾
4. 使用者回塔台說「T0001 完成」
5. 塔台讀取工單回報區 → 更新進度 → 同步 yaml → 記錄學習 → 派發下一張
\`\`\`

**After**（第 5 步擴充）：

\`\`\`markdown
## 核心迴圈

1. 塔台產生工單 (.md 檔案)
2. 使用者開新 sub-session → 輸入 /ct-exec T0001（yolo 模式下塔台自動開）
3. Sub-session 讀取工單、執行任務、自動收尾
4. Worker 回報完成（yolo 模式下自動送出，其他模式使用者手動送出）
5. 塔台讀取工單回報區 → 更新進度 → 同步 yaml → 記錄學習 → 派發下一張
   - **yolo 模式**：自動執行「下一張判定邏輯」（見 [yolo-mode.md](references/yolo-mode.md)）
     1. Worker 回報字串經斷點 A regex 驗證
     2. 通過 → 讀取當前 PLAN 研究工單 D 區段
     3. 判定下一張工單 → 檢查斷點 B/C → 顯示派發面板 → 1-2s 緩衝 → 派發
     4. 未通過 → 觸發對應斷點 → 暫停並等使用者選擇 A/B/C
\`\`\`
```

---

## 使用者可見訊息（規格化彙整）

### 啟動階段

| 情境 | 訊息 |
|------|------|
| yolo 模式首次啟動 | 主面板下方顯示 `⚠️ YOLO MODE ACTIVE` 警語（見上方格式） |
| `yolo_max_retries = 0` | 啟動面板警語中斷點 B 行改為「B 已停用」 |

### 派發階段

| 情境 | 訊息 |
|------|------|
| 下一張派發前 | `🤖 YOLO: T0xxx DONE → 自動派發下一張 T0xxy`（含依據、計數器、中斷提示） |
| 1-2s 緩衝期 | 同上面板保持顯示（不額外訊息） |
| 派發完成 | 沿用現有 `on` 模式派發訊息，但頭部加 `🤖 YOLO` 前綴 |

### 斷點觸發

| 斷點 | 訊息（見上方各斷點小節） |
|------|------------------------|
| A | `⏸ YOLO PAUSED — 斷點 A 觸發` |
| B-1 | `⏸ YOLO PAUSED — 斷點 B-1` |
| B-2 | `⏸ YOLO PAUSED — 斷點 B-2` |
| C | `⏸ YOLO PAUSED — 斷點 C 觸發` |

### PLAN 完成

| 情境 | 訊息 |
|------|------|
| D 區段所有列完成 | `✅ PLAN-0XX 所有工單完成 → yolo 流程結束。是否結案 PLAN？[A] 是，*plan close / [B] 否，保留` |

---

## 四種狀態字串（與 T0169 一致性驗證）

塔台斷點 A 的 regex 必須**精準匹配** T0169 Worker skill 草稿鎖定的四種字串：

| Worker 完成狀態 | T0169 規格通知字串 | 塔台斷點 A regex 群組匹配 |
|---------------|-------------------|--------------------------|
| `DONE` / `FIXED` | `T#### 完成` | `完成` |
| `PARTIAL` | `T#### 部分完成` | `部分完成` |
| `FAILED` | `T#### 需要協助` | `需要協助` |
| `BLOCKED` | `T#### 需要協助` | `需要協助` |

regex：`^T\d{4}\s+(完成|部分完成|失敗|需要協助)\s*$`

**注意**：regex 中保留 `失敗` 為容錯項（若 Worker skill 未來擴充），但目前 T0169 不使用該字串。

### 失敗硬鉤子語意對齊（T0169 §失敗處理策略）

T0169 草稿明文「yolo 下 Worker 失敗會阻斷，塔台看不到 DONE」：

- Worker bat-notify 硬鉤子失敗 → 工單狀態保持 `IN_PROGRESS`（不寫 `DONE`）
- 塔台 session 在 yolo 下**不會收到**該工單的完成訊息
- 塔台無訊息可 parse → **不觸發**斷點 A/B/C（因為沒有 Worker 回報）
- 使用者須手動回塔台 → 塔台依回報內容（可能是剪貼簿 fallback 訊息）判定

此設計避免塔台誤判「Worker 失敗」為「Worker 無回應」觸發錯誤斷點。

---

## 相容性

### auto-session 向下相容

| 現有設定 | 升級後行為 |
|---------|-----------|
| `auto-session: off` | 完全不變，yolo 新機制不影響 |
| `auto-session: ask` | 完全不變 |
| `auto-session: on` | 完全不變 |
| 未設定（預設 `ask`） | 完全不變 |

yolo 為**新增**第四階，啟用前需使用者明確下 `*config auto-session yolo`，**無自動升級**。

### 舊工單相容

| 情境 | 行為 |
|------|------|
| 工單無 `關聯 PLAN` / `關聯研究` 元資料 | yolo 下該工單完成後 → 斷點 A（無法決策下一張），退回使用者手動 |
| 研究工單無 D 區段 | 同上，斷點 A |
| D 區段表格欄位不全 | 同上，斷點 A |
| `_tower-state.md` 無 `## YOLO 歷程` 區段 | yolo 啟用時自動建立；非 yolo 模式下此區段不存在不視為缺失 |

### BAT / Worker 版本相容

| 組件 | 最低版本 | yolo 行為 |
|------|---------|-----------|
| BAT `bat-notify.mjs` | T0168（commit `c4b2a19`）含 `--submit` | Worker 自動送出可生效 |
| Worker skill（ct-exec/ct-done） | T0169 上游 merge 後 | 硬鉤子邏輯 + 四字串規格生效 |
| control-tower skill（本 patch） | T0170 上游 merge 後 | 塔台自主決策 + 3 斷點生效 |

**漸進式啟用**：上游 merge 順序為 W1（BAT）→ W2 + W3 合併 PR，任一組件版本不足時：
- BAT 舊版本 → Worker yolo 降級為 on（T0169 已規格化）
- Worker skill 舊版 + BAT 新版 → 塔台讀到舊版字串 → 斷點 A 觸發（安全）

---

## 迴歸測試場景

### T1：`auto-session: off` 行為不變

- 觸發：`*config auto-session off` → 派發工單
- 預期：
  - 無 `⚠️ YOLO ACTIVE` 警語
  - Worker 收尾後塔台不自動派發下一張
  - 無 `## YOLO 歷程` 區段寫入
  - `yolo_max_retries` config 存在但無影響

### T2：`auto-session: ask` 行為不變

- 同 T1，預期行為完全一致。

### T3：`auto-session: on` 行為不變

- 同 T1，但開新分頁 + 預載指令正常運作；Worker 回報需使用者按 Enter。

### T4：`auto-session: yolo` 正常路徑

- 觸發：`*config auto-session yolo` → 派發 T0001（有 `關聯 PLAN`、研究工單 D 區段完整）
- 預期：
  - 主面板顯示 `⚠️ YOLO MODE ACTIVE`
  - Worker 完成後自動回報 `T0001 完成`
  - 塔台 regex 驗證通過 → 讀取 D 區段 → 派發 T0002
  - 顯示派發面板 + 1-2s 緩衝
  - `_tower-state.md` 追加 `[派發]` / `[完成]` 條目

### T5：斷點 A 觸發（Worker 回報異字串）

- 觸發：T4 場景下 Worker 回報 `T0001 執行時遇到問題`（不匹配 regex）
- 預期：
  - 塔台顯示 `⏸ YOLO PAUSED — 斷點 A 觸發` + A/B/C 選項
  - 不派發下一張，等使用者選擇
  - 選 [C] 後 → 退回 ask，`## YOLO 歷程` 追加 `[恢復]`

### T6：斷點 B-1 觸發（Renew ≥N）

- 觸發：T0002 工單 Renew 3 次（設 `yolo_max_retries: 3`），Worker 回報 `T0002 完成`
- 預期：
  - 塔台讀取元資料發現 Renew 次數 ≥3 → 觸發 B-1
  - 顯示 `⏸ YOLO PAUSED — 斷點 B-1` + A/B/C
  - `_tower-state.md` 追加 `[斷點 B-1]`

### T7：斷點 B-2 觸發（連續 N FAILED）

- 觸發：T0003、T0004、T0005 連續回報 `T#### 需要協助`（FAILED），`yolo_max_retries: 3`
- 預期：
  - 第 3 次回報後計數器達 3 → 觸發 B-2
  - `## YOLO 計數器` 區段顯示 `連續 FAILED: 3 / 3`
  - 顯示 `⏸ YOLO PAUSED — 斷點 B-2`

### T8：斷點 C 觸發（Worker 建議跨 PLAN）

- 觸發：T4 場景下 Worker 回報區「Worker 筆記」含 `建議另開 BUG 單處理 XXX 問題`
- 預期：
  - 塔台 regex 匹配 `建議.*開.*BUG` → 觸發 C
  - 顯示 `⏸ YOLO PAUSED — 斷點 C 觸發` + 引用原文
  - A/B/C 選項齊全

---

## 引用

- **T0167 研究報告**：`_ct-workorders/_report-plan-020-yolo-feasibility.md`
  - §A 根因分析（env 鏈路通但 skill 語意擋住）
  - §C1-C4 塔台自主決策邏輯設計（本草稿主幹）
  - §D 工單 3（本草稿對應工單）
  - §F Q2 待決策選項（本草稿取 A 分支）
- **T0168 commit**：`c4b2a19` — `feat(scripts): add --submit flag to bat-notify.mjs (PLAN-020 W1)`
- **T0169 commit**：`488ad93` — `docs(ct): draft Worker skill yolo patch (PLAN-020 W2)`
- **D059**：PLAN-020 yolo 模式插隊啟動
- **D060**：yolo 下一張工單資訊來源採 Q2.A（研究工單 D 區段）
- **PLAN-011 先例**：`_ct-workorders/_archive/plans/PLAN-011-ct-bat-routing-upstream-pr.md`（本地 draft → 上游 COORDINATED → CT v4.1.0 發布）

---

## 後續工單

| 工單 | 內容 | 依賴 |
|------|------|------|
| **工單 4** | 上游 COORDINATED：skill 三件套推 `Control-Tower-Skill`（合併 T0169 + T0170 草稿 + 可能的 references/ 增補） | 本草稿（T0170）+ T0169 DONE |
| **工單 5** | 本專案驗收：PLAN-018 剩餘工單以 yolo 實跑 | 工單 4 上游 merge 回本機 |

---

## Worker 筆記摘要（T0170 執行過程）

- 讀 control-tower skill 核心段落確認現狀：
  - line 598 `*config` 選項表 `auto-session: on/ask/off`（確認三階現狀）
  - `references/tower-config.md` line 38 同步存在 auto-session 行
  - `references/auto-session.md` 已有三階章節，yolo 為新增章節
  - 核心迴圈 line 1227 第 5 步為主要嵌入點
- 三個 references/ 檔案加一個新檔案的四檔改動範圍合理，不觸及 Layer 1 保護外的邊界
- D 區段 parse 規則遵循現有研究工單拆單總表格式（見 T0167 line 314-324）
- 3 斷點判準皆**機械化**可實現：A 用 regex、B 用計數器、C 用兩條 regex
- 字串與 T0169 完全對齊（DONE/PARTIAL/FAILED/BLOCKED → 完成/部分完成/需要協助）
- 失敗硬鉤子語意對齊：yolo 下 Worker 失敗會阻斷，塔台看不到 DONE，避免誤觸發斷點
