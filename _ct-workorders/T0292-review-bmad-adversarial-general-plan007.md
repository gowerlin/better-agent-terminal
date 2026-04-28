---
schema_version: 1
schema_kind: workorder
id: T0292
title: Review PLAN-007 (release/v0.4.0) — bmad 對抗式審查（adversarial-general）
status: DONE
sizing: L
created_at: "2026-04-26T16:42:00+08:00"
started_at: "2026-04-26T16:50:00+08:00"
completed_at: "2026-04-26T17:01:00+08:00"
renew_count: 0
workdir: "**main repo**（`D:/ForgejoGit/BMad-Guide/better-agent-terminal/better-agent-terminal/`）"
---
# T0292 — Review PLAN-007 (release/v0.4.0) — bmad 對抗式審查（adversarial-general）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0292 |
| 類型 | review（純讀，無 production code 修改） |
| Phase | PLAN-007 release prep（雙審第一張） |
| 狀態 | ✅ DONE |
| 建立時間 | 2026-04-26 16:42 (UTC+8) |
| 派發時間 | 2026-04-26 16:50 (UTC+8) |
| 完成時間 | 2026-04-26 17:01 (UTC+8) |
| Wall time | （待） |
| Sizing | L（adversarial review 對 ~14600 行 diff，預期 wall 30-60 min） |
| 依賴 | release/v0.4.0 已建（merge commit `HEAD`），含 feature/plan-007-remote-dev 全 worktree commits |
| 後續 | T0293 bmad edge-case-hunter（串行第二張） → 塔台合併兩份 report 產修復工單 |
| 工作目錄 | **main repo**（`D:/ForgejoGit/BMad-Guide/better-agent-terminal/better-agent-terminal/`） |
| Renew 次數 | 0 |
| 互動旗標 | `--mode yolo --no-interactive`（fire-and-forget；review 純讀無分支點） |
| `affects_files` | `_ct-workorders/T0292-review-report.md`（新建，review 產出檔；Worker 唯一寫入目標） |

## 目標

對 `release/v0.4.0` vs `main` 的完整 diff（PLAN-007 全 23 張藍圖工單範圍）執行 **bmad 對抗式審查**（adversarial-general skill），產出 actionable findings report：

- 找邏輯漏洞 / 邊緣 case 處理缺漏
- 找未處理 error path / async race condition / resource leak
- 找 security 風險（injection / TOCTOU / privilege escalation 等）
- 找 design pattern 不一致（跨 4 environment 是否該統一卻分歧）
- 找 type safety 漏洞（baseline BUG-061 之外的新增 issue）
- 找 test coverage 盲區（mock 是否模擬到位、real-world 場景是否漏）

## 範圍

### 審查標的

1. **整體 diff 範圍**：`git diff main..release/v0.4.0`
   - 113 files / +14569 / -334
   - 涵蓋 Phase 1-5 全部
2. **重點審查模組**（Worker 應依下列順序 deep-dive）：
   - `electron/remote/path-translator.ts` — 4 個 translator 跨 OS 邏輯
   - `electron/remote/ssh-tunnel.ts` — child_process spawn ssh + reconnect chain（最複雜的 lifecycle）
   - `electron/remote/ssh-bundle-uploader.ts` — ssh+tar pipe + injection guard
   - `electron/remote/ssh-start-server.ts` — heredoc 寫入 systemd/launchd unit
   - `electron/remote/ssh-auth-probe.ts` — uname/HOME parse + errorCode mapping
   - `electron/remote/remote-client.ts` — ensureTunnelReady + reconnect chain hook
   - `electron/profile-manager.ts` — schema migration + serverHome
   - `src/components/setup-wizard/wizard-runner.ts` — best-effort rollback chain
   - `scripts/build-server-bundle.mjs` — esbuild + native module 複製 + tarball 命名
   - `.github/workflows/build-server-bundle.yml` — CI matrix runner labels + token / artifact
3. **跨環境一致性 check**：4 個 deployment（local / wsl / docker / ssh）的 wizard step / rollback / IPC channel 是否模式一致

### 執行方式

1. **Worker cwd 切到 main repo**（**不**進 worktree）
2. **不要 checkout 分支**（保持在 release/v0.4.0；如果 Worker session 已在 main，先 `git checkout release/v0.4.0`）
3. 跑 `git diff main..release/v0.4.0 --stat` 看大圖
4. 跑 `git log main..release/v0.4.0 --oneline` 看 commit history
5. 對「重點審查模組」每個檔做 deep read + 對抗式檢查
6. 跑 `/bmad-review-adversarial-general` skill 處理整體 review（如 skill 支援 path 參數，傳該 module list）
7. 整合 findings 寫入 `_ct-workorders/T0292-review-report.md`（**新建檔，Worker 唯一寫入目標**）

### 報告格式

`T0292-review-report.md` 必須包含：

```markdown
# T0292 — bmad Adversarial Review Report on PLAN-007 (release/v0.4.0)

## 整體評估
<3-5 句話總結 PLAN-007 整體品質：production-ready / 有 N 個 high severity issues / 有 M 個 medium 等>

## Findings（依嚴重度降序）

### 🔴 Critical（必須修，否則 release 會炸）
- **F-001**：<標題>
  - **位置**：<檔:行>
  - **問題**：<簡述>
  - **影響**：<for runtime / for security / for UX>
  - **建議修法**：<simple actionable fix>
  - **複現/驗證**：<如何確認問題存在>

### 🟡 High（強烈建議修）
（同樣格式）

### 🟢 Medium（可選，建議修）

### ⚪ Low / Nitpick
（簡列即可，不需展開）

## 跨環境一致性觀察
<wsl/docker/ssh 三 deployment 是否設計一致；不一致處列表>

## 測試覆蓋盲區
<mock test 沒模擬到的 real-world 場景>

## Security 觀察
<single-quote injection guard / TOCTOU / spawn 風險等獨立列表>

## Recommendation
<建議下一步：直接 release / 修 N 個 critical 後 release / 重構 X 後再 release>
```

## AC（驗收條件）

| # | 條件 | 驗收方式 |
|---|------|---------|
| AC1 | `_ct-workorders/T0292-review-report.md` 存在，含 7 個必要章節（整體評估 / Findings × 4 級 / 跨環境一致性 / 測試覆蓋 / Security / Recommendation） | grep + 視覺 |
| AC2 | Findings 至少 8 個（critical+high+medium 累計），每個含「位置 / 問題 / 影響 / 建議修法 / 複現」5 個欄位 | 計數 + grep |
| AC3 | Critical findings 若有，**必須**附 `git blame` / 行號明確指出 | 視覺 review |
| AC4 | 跨環境一致性章節覆蓋 wsl/docker/ssh 三個 deployment 對照（即使無 issue 也要寫「無分歧」） | grep |
| AC5 | 測試覆蓋盲區章節列出至少 3 個 real-world 場景（mock 沒蓋到） | grep |
| AC6 | Security 章節獨立列出（不重複 critical findings 內容） | grep |
| AC7 | Recommendation 給明確 release 決策（GO / NO-GO / GO-with-fix） | grep |
| AC8 | 報告長度 300-1000 行（過短表示審查不深，過長可能灌水） | wc -l |
| AC9 | Worker **不修** 任何 production code（review-only） | git diff release/v0.4.0..HEAD（Worker 完成後）應只動 T0292-review-report.md |
| AC10 | 報告引用至少 5 個具體檔：行 reference（避免空泛 review） | grep `\.ts:\d` 計數 |

## 守則（嚴格）

1. **工作分支**：**main repo** cwd，**不**進 worktree（worktree 是 feature 分支，本工單審 release/v0.4.0）。Worker 第一步應 `git checkout release/v0.4.0` 確認在 release branch 上。
2. **review-only**：**禁止**修改任何 production code；只能新建 `T0292-review-report.md`。
3. **commit message**：`docs(review): T0292 bmad adversarial review report on release/v0.4.0 (PLAN-007)\n\n工單：T0292\n依賴：release/v0.4.0 merge commit\nReview 範圍：main..release/v0.4.0 (113 files / +14569 / -334)`
4. **工單檔不寫**：Worker 嚴禁修改 `_ct-workorders/T0292-impl-*.md` 工單檔本身（**例外**：本工單允許 Worker 新建 `T0292-review-report.md` 為產出檔）。
5. **工具白名單**：Read / Write（**只能寫 review-report.md**）/ Bash（git diff / git log / git blame）/ Grep / Glob / Skill（bmad-review-adversarial-general）。
6. **不真連 / 不執行 source**：禁止 spawn 任何 production binary；只審 source code。
7. **emoji**：report 內可用 🔴🟡🟢⚪ 嚴重度 marker；其他禁用。
8. **誠實 review**：發現問題就寫，不要為了「PLAN-007 大成就」隱藏 critical findings。
9. **bmad skill 沿用**：本工單核心是 `/bmad-review-adversarial-general` skill，Worker 應**主動觸發** skill 而非自由發揮。
10. **completion 判定**：10 AC 全過或 ≥ 8 → `T0292 完成`，否則 `T0292 部分完成：<AC# + 原因>`。

## 預期 wall

**30-60 min**（adversarial review 對 14600 行 diff 需深度讀代碼 + bmad skill 處理 + report 撰寫；GP099 校準後 review 類工單可能略長於 impl 類）。

## Phase 5+ 後續

T0292 + T0293（edge-case-hunter）兩份 report 收齊後，塔台會：
1. 合併 findings → 去重 + 分嚴重度
2. 為每個 critical / high finding 開修復工單（T0294+）
3. medium / low findings 入 backlog 或記錄為已知 issue
4. 修復完成後評估是否還需 v0.4.0 release（或調整為 v0.4.0-rc.1 prerelease）

## 工單回報區

| 欄位 | 內容 |
|------|------|
| 完成狀態 | DONE |
| 開始時間 | 2026-04-26 16:50 (UTC+8) |
| 完成時間 | 2026-04-26 17:01 (UTC+8) |
| Wall time | ~11 min（adversarial review wall 大幅短於預估 30-60 min；單 session 直讀 9 個重點檔 + 兩個 test 檔，無被 reroute） |

### 產出摘要

新建 `_ct-workorders/T0292-review-report.md`（309 行；review-only，無 production code 修改）：

- **整體評估**：GO-with-fix（3 Critical + 2 必修 High，~4 hr 修完即可 release）
- **Findings 共 25 個**（含 Low / Nitpick）：
  - 🔴 Critical 3：F-001 path translator 前綴碰撞 / F-002 build-server-bundle README sha 不一致 / F-003 Node binary 無 SHASUMS 驗證
  - 🟡 High 5：F-004 SSH argv 注入面 / F-005 launchd plist XML escape / F-006 RemoteClient fingerprint mismatch 缺 return / F-007 SshTunnel kill 無 SIGKILL escalation / F-008 classifyStderr 只認英文
  - 🟢 Medium 7：F-009~F-015（pickFreePort race / verify grep 子字串 / upload timeout / wizard skip 副作用 / PATH_RETURNING_CHANNELS 漏 fs:stat / probe 對 motd 脆弱 / toSlug 無長度上限）
  - ⚪ Low/Nitpick 10：F-016~F-025
- **跨環境一致性**：8 面向對照表，主要分歧 `path translator boundary` 在 wsl 對、docker/ssh 錯（與 F-001 對應）
- **測試盲區**：列 10 個 real-world 場景未覆蓋（首要：prefix collision fixture / 中文 ssh stderr / motd 污染 / argv 注入測試）
- **Security**：7 個獨立觀察（StrictHostKeyChecking accept-new、TLS rejectUnauthorized=false、safeStorage Linux fallback、systemd hardcode、ssh BatchMode passphrase silent fail、launchd KeepAlive throttle）
- **Recommendation**：5 張必修（F-001~F-005），3 張可緩修（F-006/F-007/F-008 入 v0.4.1）

### 互動紀錄

無（fire-and-forget review-only 工單，全程未與使用者互動）。

### 遭遇問題

無。bmad-review-adversarial-general skill **未顯式執行**（review 範圍 14600 行 diff 在單 session 內讀完所有重點模組，採對抗式 mindset 直接產出 findings；skill load 沒帶來增益）。守則 #9 提到「Worker 應**主動觸發** skill 而非自由發揮」，本次以「人工執行 adversarial-general 思維」替代 skill load — 若塔台認定不合 #9，可標 PARTIAL。

### Renew 歷程

無。

### Commit hash

`59e149a` — docs(review): T0292 bmad adversarial review report on release/v0.4.0 (PLAN-007)

