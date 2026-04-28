---
schema_version: 1
schema_kind: workorder
id: T0350
title: PLAN-033 Sprint 2 上游 SKILL.md 全量同步（含三段規則）
type: chore
status: DONE
created_at: "2026-04-27T21:48:00+08:00"
started_at: "2026-04-27T21:51:27+08:00"
completed_at: "2026-04-27T21:54:29+08:00"
renew_count: 0
---
# T0350 — PLAN-033 Sprint 2 上游 SKILL.md 全量同步（含三段規則）

## 元資料

| 欄位 | 值 |
|------|-----|
| **類型** | chore（上游 skill 同步 + 規則 promote） |
| **規模** | 中 |
| **狀態** | DONE |
| **建立時間** | 2026-04-27 21:48 (UTC+8) |
| **派發時間** | 2026-04-27 21:48 (UTC+8) |
| **開始時間** | 2026-04-27 21:51:27 (UTC+8) |
| **完成時間** | 2026-04-27 21:54:29 (UTC+8) |
| **PLAN 連結** | PLAN-033 Sprint 2 真正收尾（上游 PR 階段） |
| **前置工單** | T0346（spec）/ T0347（archive 落地）/ T0348（local-rules 三段）/ T0349（hygiene refactor dogfood） |
| **affects_files** | `D:/ForgejoGit/BMad-Guide/BMad-Control-Tower/BMad-Control-Tower-v4.4.1/control-tower/SKILL.md`、`D:/ForgejoGit/BMad-Guide/BMad-Control-Tower/BMad-Control-Tower-v4.4.1/control-tower/references/*.md` |
| **Renew 次數** | 0 |

---

## 背景

PLAN-033 Sprint 2 的三段新規則（Tower State Archive / Size 檢查 / Quick Recovery Hygiene）已落地在本專案 `_ct-workorders/_local-rules.md`（line 327-418），完成本地 dogfood 驗證（T0349 起手式 232→28 行，state 48KB→24KB 軟警告綠燈）。

依 GP120「skill 本地先行 + 上游 PR」分流模式，本工單為**上游 PR 階段**：將三段規則 promote 到 monorepo 內的 control-tower skill 主檔。

塔台預掃 (T0350a) 發現上游 dev-main 已有 2 個 uncommitted M：
- `BMad-Control-Tower-v4.4.1/control-tower/SKILL.md`（22 行 ±）
- `BMad-Control-Tower-v4.4.1/control-tower/references/auto-session.md`（12 行 ±）

且使用者反饋：本專案 SKILL.md frontmatter 寫 v4.4.0 是**同步比對錯誤**，正確應為 v4.4.1（與上游目錄名一致）。為避免再度合併錯誤，本工單採「全量比對 → 決策表 → 以 v4.4.1 為基準合併」方式進行。

---

## 任務目標

1. **基準版本**：v4.4.1（上游 `BMad-Control-Tower-v4.4.1/` 目錄，frontmatter 應為 `version: "4.4.1"`）
2. **撤銷上游 working tree 的 v4.4.1→v4.4.0 降版**（5 處：frontmatter description、Fast Path 面板、Full Scan 面板、metadata 表「塔台版本」、`*rescan` 面板）
3. **保留上游 working tree 的 BAT args 重構**（4 處：Bash 白名單表 ×2、Agent CLI 解析規則第 1 條、第 4 條補述、安全邊界第 2 條）
4. **新增 PLAN-033 三段規則** — 從本專案 `_ct-workorders/_local-rules.md` line 327-418 移植到上游 SKILL.md（位置依語意決定，建議插在「Reference routing」章節之前或核心迴圈之後，與其他規則性章節同層級）
5. **全量比對 drift**：
   - 對象：`~/.claude/skills/control-tower/` 全套（SKILL.md + references/*.md）vs 上游 `BMad-Control-Tower-v4.4.1/control-tower/` 全套
   - 工具：`diff -ru` 或逐檔 `git diff --no-index`
   - 產出：drift 決策表（每筆 drift 列「左側內容 / 右側內容 / 採用版本 / 理由」）
   - 處理：以 v4.4.1 為基準合併，雙向 drift 都要評估（不只本專案有的要 promote，上游有的也可能是更新版本）
6. **Commit**：在 monorepo `D:/ForgejoGit/BMad-Guide/BMad-Control-Tower` 的 **dev-main** 上直接 commit（不開 feature branch，working tree 已有合法 M），分**兩個 commit**：
   - Commit 1：撤銷版號降版 + 保留 BAT args 重構 + 全量 drift 同步（基底對齊）
   - Commit 2：新增 PLAN-033 三段規則（獨立可追溯）
7. **不 push**：交使用者驗收後手動 push（塔台「Never Auto-Push」規則）

---

## 執行步驟

### Phase 1 — 全量比對

```bash
# 對比本專案 skill vs 上游 skill
LOCAL=~/.claude/skills/control-tower
UPSTREAM=D:/ForgejoGit/BMad-Guide/BMad-Control-Tower/BMad-Control-Tower-v4.4.1/control-tower

diff -ru "$LOCAL" "$UPSTREAM" > /tmp/ct-drift.diff
```

逐筆檢視 `/tmp/ct-drift.diff`，依以下規則分類：

| Drift 類型 | 採用版本 | 理由 |
|-----------|---------|------|
| 版號 v4.4.0 vs v4.4.1 | **v4.4.1** | 使用者確認本專案 v4.4.0 是同步錯誤 |
| 上游 frontmatter 移除 dual-agent worker 文案 | **以 dual-agent worker 文案保留為準**（v4.4.1 原始） | 使用者反饋「應該是 v4.4.1」=  保留 v4.4.1 完整功能 |
| BAT args `--prompt` vs `--skill ... --workorder` | **`--skill ... --workorder`**（agent-neutral） | 上游 working tree 重構正確 |
| 本專案 SKILL.md 有、上游沒有 | **promote 到上游** | PLAN-033 三段 + 其他可能漏掉的 |
| 上游有、本專案沒有 | **case-by-case 評估** | 可能是上游後續更新；列入決策表交塔台/使用者裁示 |

> ⚠️ 若遇到「不確定誰是新版」的 drift，**列入決策表 + 暫不合併**，於回報區詢問塔台。

### Phase 2 — 產出 drift 決策表

格式（寫入回報區）：

```markdown
| # | 檔案 | 段落 | 本專案版本（簡述） | 上游版本（簡述） | 採用 | 理由 |
|---|------|------|-------------------|----------------|------|------|
| 1 | SKILL.md | frontmatter version | "4.4.0" | "4.4.1" (uncommitted M 改回 4.4.0) | v4.4.1 | 使用者確認 |
| 2 | SKILL.md | Bash 白名單 BAT 終端 | --prompt "/ct-exec ..." | --skill ct-exec --workorder ... | 上游 | agent-neutral 正確 |
| ... | ... | ... | ... | ... | ... | ... |
```

### Phase 3 — 執行合併

依決策表逐項合併，分兩個 commit：

```bash
cd D:/ForgejoGit/BMad-Guide/BMad-Control-Tower

# Commit 1：基底對齊（撤銷版號降版 + 保留 BAT args + 全量 drift 同步）
git add BMad-Control-Tower-v4.4.1/control-tower/SKILL.md \
        BMad-Control-Tower-v4.4.1/control-tower/references/auto-session.md \
        # ... 其他 drift 涉及檔案
git commit -m "$(cat <<'EOF'
chore(skill): align upstream control-tower v4.4.1 with downstream drift

- Revert v4.4.1→v4.4.0 demotion (frontmatter, panels, metadata) — sync error
- Keep BAT args refactor (--skill/--workorder agent-neutral)
- Sync N drift items between ~/.claude/skills/control-tower and upstream
- Drift decision table in T0350 work order
EOF
)"

# Commit 2：PLAN-033 三段規則
git add BMad-Control-Tower-v4.4.1/control-tower/SKILL.md
git commit -m "$(cat <<'EOF'
feat(skill): add PLAN-033 Sprint 2 three rules to control-tower v4.4.1

- Tower State Archive 規則（自動觸發 + *archive --state --rebuild-index）
- Tower State Size 檢查（30/60/256 KB 三層警告）
- Quick Recovery Hygiene（起手式行數檢查 + 違規偵測）

Source: better-agent-terminal _ct-workorders/_local-rules.md (T0348)
Validated: T0349 dogfood (state 48KB→24KB, soft warning green)
EOF
)"
```

### Phase 4 — 驗收前自檢

- [ ] `git log --oneline -3` 顯示兩個新 commit
- [ ] `git status` 顯示 clean working tree（除非有未列入 T0350 範圍的其他變動）
- [ ] `git diff HEAD~2 HEAD -- .../SKILL.md` 內容符合 drift 決策表
- [ ] frontmatter version 為 `"4.4.1"`
- [ ] PLAN-033 三段內容與 `_local-rules.md` line 327-418 對齊（允許小幅編輯讓上下文順暢）
- [ ] **不要 push**（必須等使用者驗收）

---

## 完成標準

1. ✅ 兩個 commit 在 monorepo dev-main 上落地（commit hash 寫入回報區）
2. ✅ Drift 決策表完整列出（含「不確定」項目供塔台決策）
3. ✅ Phase 4 自檢全部通過
4. ✅ 工單回報區填寫完整（commit hashes + drift 表 + 任何 OOS 觀察）
5. ✅ Worker 在最後執行 `git status` 並貼結果到回報區

## 不在範圍

- ❌ 上游目錄 rename（v4.4.1 → v4.4.2 之類）— 屬下次工單
- ❌ 推送到 origin / 開 PR — 由使用者手動執行
- ❌ 本專案 `~/.claude/skills/control-tower/` 同步更新 — 由 brain-sync 機制處理
- ❌ 處理 monorepo 其他 untracked 檔案（`spec/工作流程討論-20260427/` 等）

---

## 回報區

### Commit hashes
- Commit 1（基底對齊）：`e92bb01`
- Commit 2（PLAN-033 三段）：`794f0ea`

### Drift 決策表

| # | 檔案 | 段落 | 本專案版本（簡述） | 上游版本（簡述） | 採用 | 理由 |
|---|------|------|-------------------|----------------|------|------|
| 1 | `SKILL.md` | frontmatter version/comment | `4.4.0` | `4.4.1` | 上游 v4.4.1 | 使用者確認本專案 v4.4.0 是同步比對錯誤；上游目錄與 release 基準為 v4.4.1 |
| 2 | `SKILL.md` | description | 無 dual-agent worker 文案 | HEAD 原始含 dual-agent worker support | v4.4.1 原始文案 | 保留 v4.4.1 完整功能描述；撤銷 working tree 的文案縮短 |
| 3 | `SKILL.md` | Fast Path / Full Scan / metadata / `*rescan` 面板 | `v4.4.0` | 應為 `v4.4.1` | v4.4.1 | 撤銷 5 處 v4.4.1→v4.4.0 降版 |
| 4 | `SKILL.md` | Bash 白名單、Agent CLI 解析、安全邊界 | `--skill ct-exec|ct-done --workorder T####` | working tree 已重構為 `--skill/--workorder` | 保留重構 | agent-neutral payload 正確，讓 BAT app 決定 Claude `/` 或 Codex `$` prefix |
| 5 | `references/auto-session.md` | BAT 內部路由與降級鏈 | `--skill/--workorder` + 舊 `--prompt` normalize 說明 | working tree 已重構 | 保留重構 | 與 BAT app `terminal:create-agent-command` 行為一致，保護舊版 Tower skill |
| 6 | `references/*.md` | 全量 references drift | 無實質內容差異 | 無實質內容差異 | 不變更 | `git diff --no-index --ignore-space-at-eol` 僅回報 `SKILL.md` metadata drift；其餘 warning 為 line ending |
| 7 | `SKILL.md` | PLAN-033 三段規則 | `_local-rules.md` line 327-418 已落地 | 上游缺少 | promote 到上游 | 依 GP120 skill 本地先行 + 上游 PR 分流，獨立 Commit 2 追溯 |

### Phase 4 自檢

- [x] `git log --oneline -3` 顯示兩個新 commit：`794f0ea`、`e92bb01`
- [x] `git status`：上游 `dev-main...origin/dev-main [ahead 2]`，tracked working tree clean；僅有工單範圍外既有 untracked 目錄
- [x] `git diff HEAD~2 HEAD -- .../SKILL.md .../auto-session.md`：2 files changed, 98 insertions(+), 10 deletions(-)
- [x] frontmatter version 為 `"4.4.1"`，HTML comment 為 `<!-- version: 4.4.1 -->`
- [x] `BMad Control Tower v4.4.0` / `塔台版本.*v4.4.0` / `version: "4.4.0"` / `<!-- version: 4.4.0 -->` 搜尋無結果
- [x] PLAN-033 三段內容已插入 `SKILL.md` line 1222 起，含 Tower State Archive / Tower State Size / Quick Recovery Hygiene
- [x] 未 push（依 Never Auto-Push 規則）

### OOS 觀察 / 補充

- 完成狀態：DONE
- 回報時間：2026-04-27 21:54:29 (UTC+8)
- 產出摘要：上游 `BMad-Control-Tower` dev-main 已新增兩個 commit；本專案工單檔已更新回報區。
- 遭遇問題：無。僅觀察到上游 repo 有工單範圍外既有 untracked 目錄，未修改、未 stage。
- 互動紀錄：無。
- Renew 歷程：無。
- 測試/驗證：文件型工單，未跑自動測試；依工單要求完成 git/diff/content 自檢。

### git status 結果

上游 `D:/ForgejoGit/BMad-Guide/BMad-Control-Tower`：

```text
## dev-main...origin/dev-main [ahead 2]
?? ../.lean-ctx/
?? ../better-agent-terminal/bat-plan-007/
?? ../better-agent-terminal/better-agent-terminal/
?? ../better-agent-terminal/tony1223-better-agent-terminal/
?? ../spec/工作流程討論-20260427/
```

本專案 `D:/ForgejoGit/BMad-Guide/better-agent-terminal/better-agent-terminal`：

```text
## main...origin/main [ahead 20]
?? _ct-workorders/T0350-plan033-sprint2-upstream-skill-pr.md
```

---
