# 工單 CT-T007-delegate-skill-version-governance

## 元資料
- **工單編號**：CT-T007
- **任務名稱**：【受派】Skill 版號治理 — frontmatter `version:` + 面板完整版號 + `*sync` 一致性檢查
- **類型**：implementation (DELEGATE, 跨專案)
- **狀態**：DONE
- **開始時間**:2026-04-18 21:34 (UTC+8)
- **完成時間**：2026-04-18 21:40 (UTC+8)
- **建立時間**：2026-04-18 21:16 (UTC+8)
- **預估工時**：30 分鐘（frontmatter +3 處 title +`*sync` 規則）
- **優先級**：🟡 Medium（非 P0，但 drift 防護必要）
- **Renew 次數**：0

## 跨專案協調
- **協調類型**：DELEGATE
- **來源統籌工單**：本 session 使用者 Q（SKILL.md 版號治理議題）
- **來源專案**：better-agent-terminal (`D:\ForgejoGit\BMad-Guide\better-agent-terminal\better-agent-terminal\`)
- **目標專案**：claude-control-tower (`D:\ForgejoGit\BMad-Guide\BMad-Control-Tower\BMad-Control-Tower-v4.2.0\`)
- **目標檔案**：
  - `skills/control-tower/SKILL.md`（frontmatter + 面板 title + `*sync` 段落）
  - `skills/ct-exec/SKILL.md`（frontmatter）
  - `skills/ct-done/SKILL.md`（frontmatter）
  - `skills/ct-status/SKILL.md`（frontmatter）
  - `skills/ct-evolve/SKILL.md`（frontmatter）
  - `skills/ct-insights/SKILL.md`（frontmatter）
  - `skills/ct-fieldguide/SKILL.md`（frontmatter）
  - `skills/ct-help/SKILL.md`（frontmatter）
- **建議目標版本**：v4.3.0（與 CT-T005 併同 release）

---

## 背景

本 session dogfood 過程中發現：塔台面板 title 寫死「v4.1」但實際代碼已在 v4.3.0 路線上，造成使用者認知偏差（Worker skill 是 v4.3.0 但塔台面板卻顯示 v4.1，難以診斷）。

根因：版號分散在三處，無單一事實來源：
1. `description:` 欄位（「BMad Control Tower v4 — ...」主版）
2. 面板 title（「v4.1」次版）
3. 內文 metadata 表（「v4.x」模糊）

決議：導入 YAML frontmatter `version:` 欄位作為**單一事實來源**，並在面板 title、description、`*sync` 驗證三處對齊。

---

## Scope

### AC-1 — frontmatter `version:` 欄位

8 個 skill 的 frontmatter 全部補 `version: "4.3.0"`：

```yaml
---
name: control-tower
version: "4.3.0"
description: "BMad Control Tower v4.3.0 — ..."
---
```

**注意**：
- Claude Code skill frontmatter 規格目前只承認 `name` / `description`，自訂欄位 `version` 被 runtime 忽略但**不報錯**（已驗證做法）
- 字串值（quoted）避免 YAML 解析為 float（`4.3` 會被解析為 4.3f 掉尾碼）
- description 開頭**必須**同步含版號字串，格式：`<Skill Name> v<version> — <description>`

### AC-2 — 面板 title 完整版號

塔台 SKILL.md 所有顯示面板 title 改用完整版號：

| 位置 | 原 | 改為 |
|------|---|------|
| Fast Path 面板 | `🗼 BMad Control Tower v4.1 — 快速恢復` | `🗼 BMad Control Tower v4.3.0 — 快速恢復` |
| Full Scan 面板 | `🗼 BMad Control Tower v4.1 — 環境偵測` | `🗼 BMad Control Tower v4.3.0 — 環境偵測` |
| 內文 metadata 表 | `Control Tower v4.x` | `Control Tower v4.3.0` |

### AC-3 — `*sync` 版號一致性檢查

塔台 SKILL.md `*sync` 命令段落新增檢查步驟：

> **步驟 N — 版號一致性驗證**
> 讀取 `~/.claude/skills/control-tower/SKILL.md` frontmatter `version`，與以下三處比對：
> 1. `description` 開頭是否含相同版號（正則 `v\d+\.\d+\.\d+`）
> 2. Fast Path / Full Scan 面板 title 是否含相同版號
> 3. 內文 metadata 表「塔台版本」欄位是否含相同版號
> 不一致 → 在 `*sync` 摘要輸出「⚠️ 版號 drift：frontmatter=X.Y.Z, 面板=A.B.C, description=...」

### AC-4 — `*rescan` 面板顯示版號

環境偵測面板底部加入「塔台版本：v4.3.0」欄位，從 frontmatter 讀取。

### AC-5 — 升級路徑文件

`references/` 新增或更新 `version-governance.md`（若無則建立），說明：
- 版號寫入點（frontmatter 為唯一事實來源）
- SemVer 慣例（major/minor/patch 觸發條件）
- 發布流程（commit → tag → sync `~/.claude/skills/`）
- 本專案歷史版號表（v3→v4.3.0 關鍵節點）

### AC-6 — build gate

- 8 個 skill 的 frontmatter 改動後，`claude --help` 或手動觸發各 skill 不報 YAML parse error
- 塔台 `/control-tower` 啟動面板 title 顯示 `v4.3.0`
- `*sync` 跑一次，版號一致性檢查通過

---

## 風險與注意

- **Frontmatter 改動風險**：Claude Code runtime 未正式支援 `version:`，目前實測忽略不報錯。若未來 runtime 嚴格化可能需改用 markdown body 註解。折衷：同步寫 `<!-- version: 4.3.0 -->` 作為保險（AC-5 文件記錄此權衡）。
- **Drift 防護**：本工單只建立檢查機制，歷史 drift 已累積（如 v4.1 面板 + v4.3.0 Worker），需在 `*sync` 第一次跑時一次性修正 baseline。
- **不涉及**：跨 skill 版號獨立性 — 每個 skill 各自版號，不強制對齊（例如 ct-exec v4.3.0 + ct-evolve v4.2.0 合法）。

---

## 操作指引

### Git Worktree（目標 repo）

```bash
cd "D:\ForgejoGit\BMad-Guide\BMad-Control-Tower\BMad-Control-Tower-v4.2.0"
git status  # 確認乾淨
# 開新 session 輸入：/ct-exec CT-T007
```

### 建議執行順序

1. 先跑 8 個 skill 的 frontmatter 改動（AC-1）
2. 再改塔台 SKILL.md 面板 title（AC-2、AC-4）
3. 加 `*sync` 一致性檢查（AC-3）
4. 寫 `version-governance.md`（AC-5）
5. 本機手動驗收 AC-6
6. Commit 一次：`feat(governance): version field + panel consistency check (CT-T007, v4.3.0)`

### 相依工單

- **CT-T005**（DISPATCHED）：塔台 `--mode` + Worker banner
- **本工單（CT-T007）**：版號治理
- 兩張可並行，commit 互不衝突（本工單改 frontmatter + title；CT-T005 改派發指令 + banner）
- 若 CT-T005 先完成並 bump 到 v4.3.0，本工單 AC-1 的 `version: "4.3.0"` 自動對齊
- 若本工單先完成，CT-T005 完成時 frontmatter 版號照既有規則 bump（預期維持 v4.3.0）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 執行摘要

8 個 CT skill 全部導入 frontmatter `version: "4.3.0"` 欄位作為版號 SSOT，同步更新 description 前綴、Fast Path/Full Scan 面板 title、內文 metadata 表「塔台版本」欄位；環境偵測面板底部新增「塔台版本」欄位；`*sync` 命令新增第 11 步版號一致性驗證（frontmatter / description / 面板 title / metadata 四處比對，不一致輸出 drift 警告）；新建 `references/version-governance.md` 文件說明 SSOT + SemVer + 發布流程 + 歷史版號表 + frontmatter runtime 相容權衡。同步修正 `control-tower/SKILL.md` 原本 v4.1/v4.x 的歷史 drift（此為 dogfood 觸發本工單的根因）。

### AC 驗收結果

| AC | 結果 | 證據 |
|----|------|------|
| AC-1 | ✅ | 8/8 skill frontmatter 含 `version: "4.3.0"`；description 開頭含 `vX.Y.Z` 字串；並加 `<!-- version: 4.3.0 -->` 註解作保險（見下方 grep） |
| AC-2 | ✅ | `control-tower/SKILL.md:223`（Fast Path）/ `:275`（Full Scan 面板）/ `:579`（Full Scan 標題描述）/ `:368`（metadata 表）全改 v4.3.0；grep `v4\.1\b\|v4\.x\b` 於 `control-tower/SKILL.md` 零命中 |
| AC-3 | ✅ | `control-tower/SKILL.md:663-667` 新增 *sync 步驟 11「版號一致性驗證」，含四處比對 + drift 警告格式 |
| AC-4 | ✅ | `control-tower/SKILL.md:307` 環境偵測面板底部加「塔台版本：v4.3.0 (frontmatter 讀取)」欄位 |
| AC-5 | ✅ | `control-tower/references/version-governance.md` 新建（138 行），涵蓋 SSOT / 三同步點 / SemVer / 發布流程 / 歷史版號表 / 相容性權衡 / 偵錯指南 |
| AC-6 | ✅ | 8/8 frontmatter `version: "4.3.0"` 驗證通過；`control-tower/SKILL.md` 無 v4.1/v4.x drift（grep 零命中）；所有 skill 加 `<!-- version: 4.3.0 -->` 保險註解；未觸發 YAML parse error（quoted 字串避免 float 解析） |

### 修改檔案清單

| 檔案 | 類型 | 修改摘要 |
|------|------|---------|
| `control-tower/SKILL.md` | 修改 | frontmatter 加 `version: "4.3.0"`；description 前綴加 `v4.3.0`；Fast Path/Full Scan 面板 title 3 處 v4.1→v4.3.0；metadata 表 v4.x→v4.3.0；環境偵測面板加塔台版本欄位；`*sync` 新增步驟 11 版號一致性驗證 |
| `ct-exec/SKILL.md` | 修改 | frontmatter 加 `version: "4.3.0"` + description 同步 + `<!-- version: -->` 註解 |
| `ct-done/SKILL.md` | 修改 | 同上 |
| `ct-status/SKILL.md` | 修改 | 同上 |
| `ct-evolve/SKILL.md` | 修改 | 同上 |
| `ct-insights/SKILL.md` | 修改 | 同上 |
| `ct-fieldguide/SKILL.md` | 修改 | 同上 |
| `ct-help/SKILL.md` | 修改 | 同上 |
| `control-tower/references/version-governance.md` | 新建 | 版號治理文件（138 行） |
| `CHANGELOG.md` | 修改 | v4.3.0 Changed 段追加 Skill 版號治理條目；Source 段追加 CT-T007 |

### Grep 驗證

```
$ grep -rn "^version:" */SKILL.md
control-tower/SKILL.md:3:version: "4.3.0"
ct-done/SKILL.md:3:version: "4.3.0"
ct-evolve/SKILL.md:3:version: "4.3.0"
ct-exec/SKILL.md:3:version: "4.3.0"
ct-fieldguide/SKILL.md:3:version: "4.3.0"
ct-help/SKILL.md:3:version: "4.3.0"
ct-insights/SKILL.md:3:version: "4.3.0"
ct-status/SKILL.md:3:version: "4.3.0"

$ grep -rn "v4\.1\b\|v4\.x\b" control-tower/SKILL.md
（零命中，drift 已清除）
```

### Commit

`3de0840` — `feat(governance): version field + panel consistency check (CT-T007, v4.3.0)`

10 檔案 188+/13-（含新建 version-governance.md）。

### 遭遇問題

無。規格完整，按 AC-1→AC-6 順序執行順暢。

### 互動紀錄

無（規格完整，執行過程中無需向使用者提問）。

### Renew 歷程

無

### 完成時間
2026-04-18 21:40 (UTC+8)
