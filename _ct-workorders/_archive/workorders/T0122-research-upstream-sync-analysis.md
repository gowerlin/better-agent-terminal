# 工單 T0122-research-upstream-sync-analysis

## 元資料
- **工單編號**：T0122
- **任務名稱**：研究：上游 v2.1.3→v2.1.42-pre.2 變更分析 + cherry-pick 建議
- **狀態**：DONE
- **類型**：research
- **互動模式**：enabled
- **Renew 次數**：0
- **建立時間**：2026-04-16 13:35 (UTC+8)
- **開始時間**：2026-04-16 13:45 (UTC+8)
- **完成時間**：2026-04-16 14:01 (UTC+8)

## 研究目標

分析上游 tony1223/better-agent-terminal 自 v2.1.3（commit 0798100）到 upstream/main（v2.1.42-pre.2）共 188 個 commits 的變更，評估哪些功能/修復值得 cherry-pick 到我們的 fork，並產出具體的移植建議清單。

## 已知資訊

### 上游資訊
- **Upstream remote**：https://github.com/tony1223/better-agent-terminal.git（已 fetch 到 upstream/main）
- **Last sync**：v2.1.3, commit `079810025713772cb6302387cae105388e319f34`, 日期 2026-04-09
- **目前最新**：v2.1.42-pre.2（upstream/main HEAD = `8d23e6e`）
- **Commits 數量**：188（`git log v2.1.3..upstream/main --oneline --no-merges`）

### 我們的 Fork 特色（cherry-pick 時需注意衝突）
- **語音輸入系統**：Whisper CPU + macOS Metal GPU（T0001~T0060）
- **Control Tower 面板**：塔台管理 UI 整合在右側 panel
- **自訂 Status Line**：13 項可配置、三區對齊、模板式設定
- **BMad Workflow / Epics 頁籤**
- **右鍵選單智慧定位**
- **VS Code 開啟工作區功能**
- **Dashboard Sprint 面板**：跨專案切換支援

### 上游初步分類（從 commit messages）

**🔴 高價值**：
1. SDK V2 session support（V1/V2 切換）
2. SDK/CLI 升級 2.1.91→2.1.104、sdk 0.2.91→0.2.104
3. Sub-agent messages + system history + deferred tool use
4. Image attachments in chat
5. Usage rate_limit_event 取代 OAuth polling
6. Cache history（cost tracking、per-model breakdown、TTL countdown）
7. Account switch（/login /logout /whoami）

**🟡 中等價值**：
1. Git worktree 隔離
2. GitHub Panel（PR & Issues）
3. Snippet system
4. Worker Panel（Supervisor mode）
5. Plan file bar
6. Multi-window 單進程架構
7. File:// URL 支援
8. PDF preview
9. Keyboard shortcuts

**🟢 Bug Fixes**：
1. Windows console 隱藏
2. Win11 terminal 文字重疊（#86）
3. CPU idle 降低（#84）
4. Default effort medium→high
5. Default thinking adaptive→enabled
6. Brand rename "Claude Code"→"Claude Agent"

## 調查範圍

### 必須分析的面向

1. **衝突風險評估**：每個功能群涉及哪些檔案，與我們的 fork 改動有多少重疊
   - 使用 `git diff v2.1.3..upstream/main -- <path>` 查看各模組變更
   - 與我們的 `git diff v2.1.3..HEAD -- <path>` 交叉比對

2. **依賴關係分析**：功能之間的相依性（如 SDK 升級是否為其他功能的前提）

3. **移植策略**：每個功能群建議 cherry-pick 或 manual port 或 skip

4. **SDK 升級影響**：claude-agent-sdk 版本升級對我們既有功能的影響

### 建議調查方法

```bash
# 1. 查看各功能群涉及的檔案
git log v2.1.3..upstream/main --oneline --no-merges -- src/renderer/
git log v2.1.3..upstream/main --oneline --no-merges -- src/main/
git log v2.1.3..upstream/main --oneline --no-merges -- package.json

# 2. 查看我們 fork 的自訂改動範圍
git diff v2.1.3..HEAD --stat

# 3. 比較特定功能的 diff
git log v2.1.3..upstream/main --oneline --no-merges --grep="worktree"
git log v2.1.3..upstream/main --oneline --no-merges --grep="SDK"

# 4. 查看 upstream CHANGELOG / release notes
git show upstream/main:CHANGELOG.md
```

## 研究指引

### 評估維度（每個功能群）

| 維度 | 說明 |
|------|------|
| **價值** | 對我們 fork 的實用性（High/Medium/Low） |
| **衝突風險** | 與我們自訂功能的檔案重疊程度（High/Medium/Low） |
| **依賴性** | 是否需要先移植其他功能（列出前置） |
| **移植難度** | 預估 cherry-pick 的工作量（Easy/Medium/Hard） |
| **建議** | Cherry-pick / Manual port / Skip / Defer |

### 產出格式

產出一份結構化報告：`_ct-workorders/_report-upstream-sync-v2.1.3-to-v2.1.42.md`，包含：
1. **移植優先級清單**（按建議順序排列）
2. **每個功能群的評估表格**
3. **建議的 cherry-pick 批次**（先後順序、每批包含哪些 commits）
4. **高衝突區域警告**

## 互動規則
- Worker 可主動向使用者提問以縮小範圍
- 每次提問不超過 3 個問題
- 每個問題提供選項 + 「其他：________」兜底
- 互動紀錄寫入回報區

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 互動紀錄
- [13:50] Q: 移植優先級方向？(A)核心體驗 (B)新面板 (C)穩定修復 (D)全部 → A: A（只要不衝突，保持上游對齊） → Action: 以核心體驗升級為主軸進行分析
- [13:50] Q: Multi-window 架構變更態度？ → A: C（需進一步評估，我們已有 Terminal Server） → Action: 深入比較兩架構差異，結論為可共存但 defer
- [13:50] Q: Brand rename 跟進？ → A: A（跟進） → Action: 列入 Batch 1 低風險項目
- [13:50] 使用者指示：建立上游對齊用分支，不動 main → Action: 建立 T0122-upstream-sync-analysis 分支

### 調查結論

188 個上游 commits 分析完成，產出結構化報告：`_ct-workorders/reports/_report-upstream-sync-v2.1.3-to-v2.1.42.md`

**關鍵發現**：
1. **SDK 版本差異小**：agent-sdk 已一致 (^0.2.104)，僅 CLI 差 2.1.97→2.1.104
2. **65 個重疊檔案**，其中 3 個 Critical 衝突區（main.ts / claude-agent-manager.ts / ClaudeAgentPanel.tsx）
3. **Multi-window vs Terminal Server**：解決不同問題（視窗管理 vs PTY 持久化），理論可共存但 main.ts 衝突量太大，建議 defer
4. **29 個可移植功能群**分 4 個 Batch，預估 Phase 1 約 1-2h，Phase 2 約 3-5h

### 建議方向
- [A] **分階段移植**（Phase 1→2→3→4）：低風險先行，每階段獨立工單，衝突可控
  - 優：風險可控、逐步驗證、不中斷現有功能
  - 缺：總工時較長（估 10-15h 全部完成）
- [B] **一次性 rebase**：直接 rebase 到 upstream/main
  - 優：一步到位、版本完全對齊
  - 缺：衝突量巨大（65 個重疊檔案）、風險極高、可能破壞我們獨有功能
- [C] **只移植 Batch 1**（Quick Wins）：只做低風險項目
  - 優：1-2h 完成、幾乎零風險
  - 缺：核心功能（cache history / image / V2 session）未對齊
- **推薦**：**方案 A**。從 Batch 1 Quick Wins 開始，驗證穩定後推進 Batch 2。Batch 3-4 視實際需求開單。

### 建議下一步
- [ ] 開實作工單：T01xx — Phase 1 Quick Wins cherry-pick（Batch 1：brand rename + bug fixes + UX）
- [ ] 開實作工單：T01xx — Phase 2 CLI 升級 + cache history + image attachments
- [ ] Phase 3 各功能群視需求獨立開單
- [ ] Phase 4 Multi-window defer 至 Phase 1-3 穩定後

### Renew 歷程
無

### 遭遇問題
- 報告檔 `_ct-workorders/reports/_report-upstream-sync-v2.1.3-to-v2.1.42.md` 被 .gitignore 排除，不會進入 git。若需版本控制可調整 .gitignore 規則。

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-16 14:00 (UTC+8)
