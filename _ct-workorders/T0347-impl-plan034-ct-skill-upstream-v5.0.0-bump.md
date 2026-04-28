---
schema_version: 1
schema_kind: workorder
id: T0347
title: Impl PLAN-034 CT skill upstream v5.0.0 升版（clone + apply 5 drafts + version bump）
type: impl
status: DONE
sizing: M
created_at: "2026-04-28T20:25:00+08:00"
started_at: "2026-04-28T22:42:29+08:00"
completed_at: "2026-04-29T00:05:15+08:00"
project: PLAN-034
depends_on:
  - T0342
  - T0343
  - T0344
  - T0345
  - T0346
affects_files:
  - "D:/ForgejoGit/BMad-Guide/BMad-Control-Tower/BMad-Control-Tower-v5.0.0/**"
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: "D:/ForgejoGit/BMad-Guide/BMad-Control-Tower/BMad-Control-Tower-v5.0.0/"
---

# T0347 — Impl PLAN-034 CT skill upstream v5.0.0 升版

## 背景

PLAN-034 已在 BAT 端落地（5 sprint，35 min worker wall，BUG-077 → CLOSED）。
T0343 產出 5 份 upstream CT skill PR draft，現需套用到 CT skill source repo 並 bump v4.4.1 → v5.0.0。

塔台已決策（使用者拍板）：
- 版號：v4.4.1 → **v5.0.0**（reflects architectural SoT shift，雖 legacy fallback 保留）
- Repo 策略：**clone 新 dir** `BMad-Control-Tower-v5.0.0/`，保留 v4.4.1 完整不動

## ⚠️ scope 邊界

**重要區分**：
- `~/.claude/skills/control-tower/**` = **Layer 1 readonly**（部署副本，禁寫）
- `D:/ForgejoGit/BMad-Guide/BMad-Control-Tower/BMad-Control-Tower-v4.4.1/` = **使用者 source repo**（可讀，**勿改**，本 sprint 保留作 reference）
- `D:/ForgejoGit/BMad-Guide/BMad-Control-Tower/BMad-Control-Tower-v5.0.0/` = **本工單目標**（新 clone，可寫）

✅ 可寫：`BMad-Control-Tower-v5.0.0/` 全部
✅ 可讀：`BMad-Control-Tower-v4.4.1/`、本 BAT repo 內 5 份 `_draft-*.md`、`_spec-yaml-frontmatter-schema.md`
❌ 禁寫：`~/.claude/skills/**`、`v4.4.1/` 既有檔、本 BAT repo 任何檔

## 任務目標

### Step 1：Clone repo

```
cp -r D:/ForgejoGit/BMad-Guide/BMad-Control-Tower/BMad-Control-Tower-v4.4.1/ \
      D:/ForgejoGit/BMad-Guide/BMad-Control-Tower/BMad-Control-Tower-v5.0.0/
```

或視 v4.4.1 是否為獨立 git repo 採對應策略：
- 若是獨立 git repo：clone 後在 v5.0.0/ 內 reset / new branch
- 若是 git subdir：cp -r 純檔案複製即可

完成後：`cd v5.0.0/` 開始操作。

### Step 2：套用 5 份 draft

來源（位於 BAT repo）：
- `_draft-ct-frontmatter-sprint2-work-order-template.md` → `references/work-order-template.md`
- `_draft-ct-frontmatter-sprint2-bug-plan-system.md` → `references/bug-plan-system.md`
- `_draft-ct-frontmatter-sprint2-archive-system.md` → `references/archive-system.md`
- `_draft-ct-frontmatter-sprint2-sync-logic.md` → `SKILL.md`（`*sync` 章節，依 draft 標明的位置）
- `_draft-ct-frontmatter-sprint2-helper-skills.md` → 5 個 helper skill SKILL.md（如 ct-exec / ct-done / ct-status，路徑視 v4.4.1 結構而定）

每份 draft 頂部含「套用步驟」說明，依該說明套用。
若 draft 中的 diff/patch 與目標檔有 conflict → 記入回報區，**不亂猜亂套**。

### Step 3：Bump 版號（依 `version-governance.md` 4 處統一）

修 `SKILL.md`（CT skill 主檔）：

1. **Frontmatter**：
   ```yaml
   version: 5.0.0   # 原 4.4.1
   ```

2. **Description**（檔頂 frontmatter `description` 欄）：
   ```
   description: BMad Control Tower v5.0.0 — AI-agnostic project orchestrator with YAML frontmatter metadata SoT
   ```

3. **Fast Path / Full Scan 面板 title**（內文）：
   ```
   🗼 BMad Control Tower v5.0.0 — 環境偵測
   🗼 BMad Control Tower v5.0.0 — 快速恢復
   ```

4. **內文 metadata 表「塔台版本」欄**：
   ```
   | **塔台版本** | Control Tower v5.0.0 |
   ```

> 額外：若 v4.4.1 SKILL.md 有 changelog / 版本歷史段落，新增 v5.0.0 entry 摘要 PLAN-034 變更（YAML frontmatter SoT、5 draft apply、BAT 雙端整合）。

### Step 4：CT 版本一致性 self-check

依 `*sync` Step 11 邏輯（`version-governance.md`），手動驗證：
- frontmatter `version: 5.0.0`
- description 含 `v5.0.0`
- Fast Path / Full Scan 面板含 `v5.0.0`
- metadata 表含 `Control Tower v5.0.0`

4 處全一致 → ✅ pass。

### Step 5：Git commit（v5.0.0 repo 內）

若 v5.0.0/ 是獨立 git repo（clone 自 v4.4.1）：

```
cd D:/ForgejoGit/BMad-Guide/BMad-Control-Tower/BMad-Control-Tower-v5.0.0/
git add .
git commit -m "feat: bump to v5.0.0 — YAML frontmatter metadata SoT (PLAN-034)"
```

若是 cp -r 純檔案複製（無 git 歷史）：跳過 commit，回報「需使用者手動 init git repo」。

## 拍板原則（YOLO non-interactive）

1. **clone 完整性**：v5.0.0/ 必須是 v4.4.1/ 完整副本 + 5 draft apply + 版號 bump，不漏檔
2. **draft 衝突處理**：若 draft 跟 v4.4.1 既有檔 conflict，記回報區，不亂套
3. **不動 v4.4.1/**：source 保留作 reference，零改動
4. **不動 ~/.claude/skills/**：Layer 1 readonly 硬限制
5. **不動 BAT repo**：本工單只動 CT 上游，不要回頭改 BAT
6. **版號 4 處一致**：依 version-governance Step 11 強制
7. **git history 保留**：若 v4.4.1 是 git repo，clone 時保留 commit history（git clone vs cp -r 抉擇）

## 自檢清單

- [ ] `BMad-Control-Tower-v5.0.0/` 建立 + 完整副本（含 references/ 目錄全部檔案）
- [ ] 5 份 draft 全套用（5 個目標檔已修改）
- [ ] SKILL.md frontmatter `version: 5.0.0`
- [ ] SKILL.md description 含 `v5.0.0`
- [ ] Fast Path / Full Scan 面板 title 含 `v5.0.0`
- [ ] metadata 表「塔台版本」欄含 `Control Tower v5.0.0`
- [ ] 4 處版號一致（手動 self-check pass）
- [ ] Changelog / 版本歷史 entry（若 v4.4.1 有此段）
- [ ] git commit（若是 git repo）/ 回報需 init git（若非）
- [ ] **v4.4.1/ 零改動**（git status 在 v4.4.1/ 內應為 clean）
- [ ] 未動 `~/.claude/skills/**`
- [ ] 未動 BAT repo

## 重要約束

1. **v4.4.1/ 絕對唯讀**：source 保留供降級 / reference
2. **`~/.claude/skills/` 禁寫**：Layer 1 hard limit
3. **不修 BAT repo 任何檔**：spec/draft/source 都不動
4. **conflict 不亂套**：draft 與 v4.4.1 衝突時必須記回報區，等使用者決策
5. **5 個 draft 必須全套**：缺一即工單未完成

---

## 回報區（Worker 完成後填寫）

### Clone 策略

- v4.4.1/ 結構：?（獨立 git repo / git subdir / 純目錄）
- v5.0.0/ 建立方式：?（git clone / cp -r / 其他）
- v4.4.1/ git status：?（必須 clean）

### Draft 套用結果

| Draft | 目標檔 | 套用結果 | conflict |
|-------|--------|---------|---------|
| work-order-template | references/work-order-template.md | ? | ? |
| bug-plan-system | references/bug-plan-system.md | ? | ? |
| archive-system | references/archive-system.md | ? | ? |
| sync-logic | SKILL.md (*sync 章節) | ? | ? |
| helper-skills | ct-exec/ct-done/ct-status SKILL.md | ? | ? |

### 版號 bump 結果

| 位置 | 內容 |
|------|------|
| frontmatter version | ? |
| description | ? |
| Fast Path title | ? |
| Full Scan title | ? |
| metadata 表 塔台版本 | ? |
| Changelog entry（如有） | ? |

### 4 處版號 self-check

- [ ] frontmatter == 5.0.0
- [ ] description 含 v5.0.0
- [ ] panel titles 含 v5.0.0
- [ ] metadata 表含 v5.0.0

### Git status（v4.4.1/ 必須 clean）

```
（cd v4.4.1/; git status 輸出）
```

### Git commit（v5.0.0/）

- commit hash：?
- commit msg：?
- 或：需使用者手動 init git（如 cp -r 模式）

### 偏離塔台原則

### 後續動作建議

### 遭遇問題 / 互動紀錄 / Renew

### 回報時間 / commit

**塔台驗收備註**（2026-04-29 00:05）：使用者自驗收通過，工單直接 mark DONE，回報區明細未補填（fire-and-forget worker 模式 + 使用者已逐項目視驗收）。
