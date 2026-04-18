# 工單 CT-T003-delegate-yolo-spec-drift-fix

## 元資料
- **工單編號**：CT-T003
- **任務名稱**：【受派】CT skill 修正 — yolo 「斷點 C」概念 SKILL.md vs yolo-mode.md 規格 drift（含使用者中斷事件正式化）
- **狀態**：TODO
- **建立時間**：2026-04-18 16:05 (UTC+8)
- **預估工時**：30-45 分鐘（純文檔 + 規格梳理）
- **優先級**：🟡 Medium（不阻塞功能，但會混淆塔台事件分類）

## 跨專案協調
- **協調類型**：DELEGATE
- **來源統籌工單**：PLAN-020-yolo-autonomous-mode（dogfood 衍生）
- **來源專案**：better-agent-terminal
- **來源 learning**：L064（`_ct-workorders/_learnings.md`）
- **目標專案**：claude-control-tower (`D:\ForgejoGit\BMad-Guide\BMad-Control-Tower\BMad-Control-Tower-v4.x.x\`)
- **目標檔案**：
  - `skills/control-tower/SKILL.md`（YOLO MODE ACTIVE 警語段落）
  - `skills/control-tower/references/yolo-mode.md`（斷點章節 + YOLO 歷程事件類型）
- **Renew 次數**：0
- **建議目標版本**：v4.2.1 (patch)

---

## 背景（L064 摘錄）

T0174 Phase 5 dogfood 過程發現「斷點 C」概念在兩處規格 drift：

| 文件 | 「斷點 C」定義 |
|------|---------------|
| `references/yolo-mode.md:212-241` | Worker 回報區建議跨出當前 PLAN 範圍（regex 偵測 `(?:另開\|新開\|建議.*派\|建議.*開)`） |
| `SKILL.md` 啟動警語段落（YOLO MODE ACTIVE） | 「隨時輸入『停』可觸發斷點 C 暫停」（暗示使用者主動暫停） |

**實戰結果**：同一 session 兩次「斷點 C」實際是兩個不同事件（Worker 跨 PLAN 建議 vs 使用者手動暫停），導致 `_tower-state.md` § YOLO 歷程紀錄混淆。

---

## 修正方案（建議三步）

### Step 1: 保留 yolo-mode.md 斷點 C 定義不變

`references/yolo-mode.md:212-241`「斷點 C」維持狹義定義（Worker 跨 PLAN 建議），技術判準明確、regex 偵測可靠。

### Step 2: SKILL.md 啟動警語改稱「使用者中斷」

定位 `SKILL.md` 中 YOLO MODE ACTIVE 警語段落（搜：`隨時輸入「停」可觸發斷點 C`），改為：

```markdown
🚨🚨🚨 YOLO MODE ACTIVE 🚨🚨🚨
─────────────────────────────────────
 ...（其他內容不變）...
 隨時輸入「停」/「stop」/「abort」可觸發**使用者中斷**(獨立於斷點 A/B/C)
```

**關鍵字替換清單**（如有其他段落引用「斷點 C ←→ 使用者輸入停」聯動描述也一併修正）：
- `斷點 C 暫停` → `使用者中斷`（限指使用者輸入「停」的場景）

### Step 3: yolo-mode.md 新增「使用者中斷」事件類型

於 `references/yolo-mode.md` § 「`_tower-state.md` 新增 `## YOLO 歷程` 區段」 / 寫入時機表格新增一行：

```markdown
| 使用者輸入「停」/「stop」/「abort」 | 追加 `[使用者中斷]` 條目 + 不更新 A/B/C 計數器 |
```

並在「計數器」格式範例中追加一個欄位：

```markdown
- 本 session 斷點觸發: A×0, B×0, C×0, 使用者中斷×0
```

新增獨立小節（位置：「斷點 C」之後、「`_tower-state.md` 新增...」之前）：

```markdown
### 使用者中斷（非斷點）

**判準**：使用者在塔台 session 直接輸入 `停` / `stop` / `abort`（regex `^(停|stop|abort)$`，case-insensitive）。

**觸發後塔台動作**：

```
🛑 YOLO PAUSED — 使用者中斷
  偵測字串：「<原文>」
  擱置動作：<下一張派發 / 當前派發中 buffer>
  Bash 執行：❌ 未送出
  yolo 狀態：PAUSED (等使用者指令)
```

**和 A/B/C 的差異**：
- A/B/C 為塔台/Worker 自動觸發，計數器累計
- 使用者中斷為使用者主動觸發，獨立計數，不影響 yolo health 判定
```

---

## 收尾步驟（沿用 CT-T001/T002 先例）

### Step A: push 分支到 Forgejo origin

```bash
cd D:\ForgejoGit\BMad-Guide\BMad-Control-Tower\BMad-Control-Tower-v4.x.x\
git checkout -b fix/yolo-spec-drift-user-interrupt
# (作上述三步修改 + commit)
git push -u origin fix/yolo-spec-drift-user-interrupt
```

### Step B: 建立 CHANGELOG 條目

```markdown
## [v4.2.1] - 2026-04-XX

### Fixed
- yolo「斷點 C」概念 drift：SKILL.md 警語改稱「使用者中斷」，避免與 yolo-mode.md
  正式定義（Worker 跨 PLAN 建議）混淆
- yolo-mode.md 正式新增「使用者中斷」事件類型（獨立於 A/B/C 計數器）

### Source
- 衍生自 better-agent-terminal T0174 dogfood L064（2026-04-18）
```

### Step C: 通知對方塔台

跨專案 PR / 上游同步流程沿用 CT-T002 先例。

### Step D: 打 tag

```bash
git tag -a v4.2.1 -m "fix: yolo spec drift — user-interrupt event"
git push origin v4.2.1
```

---

## 驗收條件

1. `SKILL.md` YOLO MODE ACTIVE 警語不再使用「斷點 C」描述使用者輸入「停」
2. `yolo-mode.md` 新增「使用者中斷」小節，且寫入時機表格 / 計數器格式同步更新
3. 兩處規格內部一致（grep `斷點 C` 應只出現在 Worker 跨 PLAN 建議的脈絡）
4. CHANGELOG / tag 完成
5. 對方塔台已吸收（用 `~/.claude/skills/control-tower/SKILL.md` 驗證 sync）

---

## 互動規則

若遇以下情況，可回塔台發問（上限 3 題）：
- 發現本工單 Step 2/3 的措辭與既有 SKILL.md 上下文衝突
- 「使用者中斷」是否該歸入 A/B/C 命名（如「斷點 U」User）— 命名決策回塔台對齊
- 三步以外發現其他 drift（如 `_tower-state.md` YOLO 歷程在其他 reference 中也被提到）

---

## 回報區

> 由 Worker 在收尾時填寫。

### 完成狀態
（待填）

### 修改檔案
- (待填)

### 驗收結果
- (待填)

### Renew 歷程
無

### 回報時間
（待填）

### commit
（commit hash 待填）

---
