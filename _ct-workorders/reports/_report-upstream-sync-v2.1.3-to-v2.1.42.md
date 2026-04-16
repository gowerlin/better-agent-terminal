# 上游同步分析報告：v2.1.3 → v2.1.42-pre.2

> 產出時間：2026-04-16 13:55 (UTC+8)
> 工單：T0122
> 分析範圍：188 commits（`git log v2.1.3..upstream/main --oneline --no-merges`）

---

## 摘要

| 指標 | 數值 |
|------|------|
| 上游 commits 數 | 188 |
| 上游變更檔案數 | 70 |
| 我們 fork 變更檔案數 | 327 |
| 重疊檔案數 | 65 |
| 上游新增檔案（無衝突）| 4 |
| SDK 版本差異 | agent-sdk 一致 (^0.2.104)；CLI 差 2.1.97 → 2.1.104 |

---

## 一、移植優先級清單（建議順序）

### Batch 1：低風險高價值（建議立即移植）

| # | 功能群 | 代表 commits | 價值 | 衝突風險 | 依賴 | 難度 | 建議 |
|---|--------|-------------|------|---------|------|------|------|
| 1 | **Brand rename** "Claude Code"→"Claude Agent" | `af5f025`, `4ae0b85`, `14da627` | Medium | Low | 無 | Easy | Cherry-pick |
| 2 | **Default effort medium→high** | `60fbc2f` | Medium | Low | 無 | Easy | Cherry-pick |
| 3 | **Default thinking adaptive→enabled** | `347175b` | Medium | Low | 無 | Easy | Cherry-pick |
| 4 | **CPU idle 降低** (#84) | `54e675d` | High | Low | 無 | Easy | Cherry-pick |
| 5 | **Win11 terminal 文字重疊修復** (#86) | `74f3bbe` | High | Low | 無 | Easy | Cherry-pick |
| 6 | **Windows console 隱藏 / icon 修復** | `91ae9ff`, `77e1378`, `43aba52` | Medium | Low | 無 | Easy | Cherry-pick |
| 7 | **Keyboard shortcuts** (PageUp/Down/Home/End, tab cycling) | `66de764`, `50558c9` | Medium | Low-Med | 無 | Easy | Cherry-pick |
| 8 | **Message type filter 按鈕** | `5b3138a` | Medium | Low | 無 | Easy | Cherry-pick |
| 9 | **Collapse all tool outputs by default** | `c2452b3` | Medium | Low | 無 | Easy | Cherry-pick |
| 10 | **file:// URL 支援** (terminal + markdown) | `9c043aa`..`20c832e` (6 commits) | Medium | Low | 無 | Easy | Cherry-pick batch |
| 11 | **PDF preview** | `348a4fc` | Medium | Low | 無 | Easy | Cherry-pick |

### Batch 2：中度風險核心功能（需手動 port）

| # | 功能群 | 代表 commits | 價值 | 衝突風險 | 依賴 | 難度 | 建議 |
|---|--------|-------------|------|---------|------|------|------|
| 12 | **CLI 版本升級 2.1.97→2.1.104** | `25c9a16`, `4c7d495`, `79e98c7` | High | Medium | 無 | Medium | Manual port |
| 13 | **Usage rate_limit_event**（取代 OAuth polling）| `cc8d980`, `89afe29` | High | Medium | SDK 升級 | Medium | Manual port |
| 14 | **Sub-agent messages + system history + deferred tool use** | `dfe22f9` | High | High | SDK V2 | Medium | Manual port |
| 15 | **Cache history**（per-model breakdown, TTL countdown, per-call breakdown）| `98d915f`..`8d23e6e` (~20 commits) | High | Medium | 無 | Medium | Manual port batch |
| 16 | **Cache efficiency statusline** | `c67e605`, `98c2d87`, `0d467e2` | Medium | Medium | cache history | Medium | Manual port |
| 17 | **Image attachments in chat** | `011bd16`, `6541fdb` + sharp deps | High | Medium | SDK 0.2.94+ | Medium | Manual port |
| 18 | **Account switch** (/login /logout /whoami) | `d2ac146`, `851d2e7`, `0cb6585`, `48e59cd` | Medium | Medium | account-manager.ts (新檔) | Medium | Manual port |
| 19 | **/abort command + ESC fix** | `3948cda` | Medium | Medium | 無 | Easy | Cherry-pick |
| 20 | **Task Result modal markdown 渲染** | `dc5b49f`, `03babf7` | Medium | Low | 無 | Easy | Cherry-pick |

### Batch 3：高風險新功能（需評估後決定）

| # | 功能群 | 代表 commits | 價值 | 衝突風險 | 依賴 | 難度 | 建議 |
|---|--------|-------------|------|---------|------|------|------|
| 21 | **SDK V2 session support** | `4dba591`..`dde4d0f` (~15 commits) | High | High | SDK upgrade, main.ts 大改 | Hard | Manual port |
| 22 | **Git worktree isolation** (#83) | `9422bd7`..`411e749` (~15 commits) | Medium | High | worktree-manager.ts 大改 | Hard | Manual port |
| 23 | **GitHub Panel** (PR & Issues viewer) | `2bb94ef`, `8a0b817` | Medium | Medium | Sidebar 改動 | Medium | Manual port |
| 24 | **Snippet system** | `0fa56f5`, `cafee8f` + fixes | Medium | Medium | Sidebar 改動, snippet-db.ts | Medium | Manual port |
| 25 | **Worker Panel** (Procfile multi-process) | `6921648`, `4800a21`, `e5a8590` | Low | Medium | 新檔 procfile-parser.ts | Medium | Manual port |
| 26 | **Plan file bar** | `13f1cf8`..`3a9fc90` (~6 commits) | Low | Medium | PromptBox 區域改動 | Medium | Defer |

### Batch 4：大型架構重構（高風險，建議 Defer）

| # | 功能群 | 代表 commits | 價值 | 衝突風險 | 依賴 | 難度 | 建議 |
|---|--------|-------------|------|---------|------|------|------|
| 27 | **Multi-window 單進程架構** | `512c118`..`db82049` (~20 commits) | Medium | **Critical** | main.ts, window-registry.ts 全面重寫 | Very Hard | **Defer** |
| 28 | **Bundle size 優化** (devDependencies 搬移) | `11534df`, `c29d3e7`, `fa19c21` | Low | Medium | package.json | Medium | Defer |
| 29 | **Codex SDK integration** (debug-only) | `5d00c17` | Low | Medium | codex-agent-manager.ts (新檔) | Medium | Skip |

---

## 二、功能群詳細評估

### 2.1 SDK/CLI 升級鏈

```
現況：
  我們：agent-sdk ^0.2.104, claude-code ^2.1.97
  上游：agent-sdk ^0.2.104, claude-code ^2.1.104

升級路徑（建議）：
  Step 1: claude-code ^2.1.97 → ^2.1.104（Batch 2 #12）
  Step 2: 驗證 SDK V2 session 功能（Batch 3 #21）
```

**依賴影響**：
- `rate_limit_event`（#13）→ 需要 SDK 0.2.91+（已滿足）
- `sub-agent messages`（#14）→ 需要 SDK V2 session API
- `image attachments`（#17）→ 需要 SDK 0.2.94+（已滿足）+ `@img/sharp` 依賴

### 2.2 Multi-window vs Terminal Server 架構比較

| 面向 | 上游：Multi-window | 我們：Terminal Server |
|------|-------------------|---------------------|
| **核心理念** | 單進程多視窗，window registry 管理 | 獨立 Terminal Server 進程，PTY 存活跨 restart |
| **PTY 生命週期** | 跟隨 Electron 主進程 | **獨立於 Electron**，heartbeat watchdog 監控 |
| **重啟恢復** | 透過 snapshot 恢復視窗狀態 | PTY 存活 + ring buffer replay |
| **孤兒清理** | 視窗關閉時清理 | PID registry + 主動 orphan detection |
| **檔案影響** | main.ts, window-registry.ts 大改 | terminal-server/ 子目錄（6 檔案） |
| **衝突風險** | 與我們 main.ts 的 terminal-server 整合嚴重衝突 | 我們獨有，上游無此功能 |

**結論**：兩者解決不同問題。上游的 multi-window 是「多視窗管理」，我們的 terminal-server 是「PTY 持久化」。理論上可以共存，但 `electron/main.ts` 的改動量太大（雙方各 1300-2300 行 diff），直接 cherry-pick 必定大量衝突。

**建議**：Batch 4 Defer。未來若需要多視窗，從頭理解上游架構後手動整合。

### 2.3 高衝突區域警告

以下檔案雙方改動量都很大，cherry-pick 幾乎必定衝突：

| 檔案 | 我方改動行數 | 上游改動行數 | 衝突等級 |
|------|------------|------------|---------|
| `electron/main.ts` | 2,316 | 1,350 | 🔴 Critical |
| `electron/claude-agent-manager.ts` | 1,386 | 1,546 | 🔴 Critical |
| `src/components/ClaudeAgentPanel.tsx` | 903 | 1,268 | 🔴 Critical |
| `src/App.tsx` | 892 | 289 | 🟡 High |
| `src/components/SettingsPanel.tsx` | 342 | 266 | 🟡 High |
| `electron/preload.ts` | 272 | 136 | 🟡 Medium |
| `src/components/Sidebar.tsx` | 197 | 64 | 🟢 Low |
| `src/types/electron.d.ts` | 180 | 30 | 🟢 Low |

### 2.4 無衝突新檔案（可直接 cherry-pick）

| 檔案 | 功能 | 所屬 Batch |
|------|------|-----------|
| `electron/account-manager.ts` | Account switch 邏輯 | Batch 2 #18 |
| `electron/codex-agent-manager.ts` | Codex SDK integration | Batch 4 #29 (Skip) |
| `src/components/MarkdownPreviewPanel.tsx` | Markdown 預覽 | Batch 3 |
| `src/utils/procfile-parser.ts` | Worker Panel 的 Procfile 解析 | Batch 3 #25 |

---

## 三、建議 Cherry-pick 批次計畫

### Phase 1：Quick Wins（預估 1-2 小時）

```bash
# Batch 1 低風險項目 — 逐一 cherry-pick
git cherry-pick 60fbc2f    # default effort high
git cherry-pick 347175b    # default thinking enabled
git cherry-pick 54e675d    # CPU idle reduction
git cherry-pick 74f3bbe    # Win11 text overlap fix
git cherry-pick 91ae9ff    # Windows exe icon
git cherry-pick 77e1378    # Multi-size ICO
git cherry-pick 43aba52    # 512x512 icon
git cherry-pick 66de764    # PageUp/Down scroll
git cherry-pick c2452b3    # Collapse tool outputs
git cherry-pick 5b3138a    # Message type filter

# Brand rename（可能需手動解衝突）
git cherry-pick af5f025    # rename Claude Code → Claude Agent
git cherry-pick 4ae0b85    # rename presets
git cherry-pick 14da627    # remove third-party brand refs

# file:// URL 支援（6 commits batch）
git cherry-pick 9c043aa    # file:// in terminal
git cherry-pick 1710f2b    # file:// in markdown
git cherry-pick a2356c0    # prevent black screen on link click
git cherry-pick 7801cad    # regex fix
git cherry-pick 330eabd    # closure bug fix
git cherry-pick 20c832e    # skip code blocks

# PDF preview
git cherry-pick 348a4fc
```

### Phase 2：Core Upgrades（預估 3-5 小時）

需要手動 port，按順序：
1. CLI 版本升級 → package.json 手動修改
2. rate_limit_event → 涉及 claude-agent-manager.ts
3. Cache history → 涉及 ClaudeAgentPanel.tsx（高衝突區）
4. Image attachments → 涉及 preload.ts, claude-agent-manager.ts
5. Account switch → 新增 account-manager.ts + 修改 main.ts, preload.ts

### Phase 3：New Features（預估 5-8 小時，各自獨立工單）

每個功能群開獨立工單：
- T01xx: SDK V2 session support
- T01xx: Git worktree isolation
- T01xx: GitHub Panel
- T01xx: Snippet system

### Phase 4：Architecture（Defer，未來再評估）

- Multi-window 單進程架構
- Bundle size 優化

---

## 四、風險與注意事項

### 4.1 我們的獨有功能（cherry-pick 時需保護）

| 功能 | 涉及檔案 | 風險 |
|------|---------|------|
| 語音輸入 | voice-handler.ts, MicButton, VoicePreviewPopover | 上游無此功能，不會被覆蓋 |
| Control Tower UI | ControlTowerPanel.tsx, 10+ 相關元件 | 上游無此功能，不會被覆蓋 |
| Status Line 13 項配置 | ActivityIndicator.tsx, settings-store.ts | 上游的 statusline 改動可能衝突 |
| BMad Workflow/Epics | BmadWorkflowView, BmadEpicsView | 上游無此功能 |
| Sprint Dashboard | SprintDashboard.tsx, SprintProgress.tsx | 上游無此功能 |
| Terminal Server 架構 | terminal-server/ 子目錄 | 上游無此功能 |
| 右鍵選單智慧定位 | useMenuPosition.ts | 上游有類似但不同的實作 |

### 4.2 Status Line 衝突警告

上游新增了多個 statusline 項目：
- `cacheEff`（cache efficiency）
- `5h/7d usage %`
- `cache TTL countdown`

我們已有 13 項可配置的 status line。整合時需要：
1. 將上游新項目加入我們的可配置系統
2. 確保不破壞現有的三區對齊和模板式設定

### 4.3 package.json 衝突策略

上游 package.json 有大量變更（SDK 升級、新依賴）。建議：
- **不要 cherry-pick package.json commits**
- 手動修改 package.json 中需要的版本號
- 重新 `npm install` 產生 package-lock.json

---

## 五、決策建議

### 推薦方案

**分階段移植**：Phase 1 → Phase 2 → Phase 3（各自獨立工單）

| 階段 | 預估工時 | 風險 | 產出 |
|------|---------|------|------|
| Phase 1 Quick Wins | 1-2h | Low | Bug fixes + brand rename + UX 改善 |
| Phase 2 Core Upgrades | 3-5h | Medium | SDK 升級 + 核心功能對齊 |
| Phase 3 New Features | 5-8h/功能 | High | 新面板功能 |
| Phase 4 Architecture | TBD | Critical | Multi-window（Defer） |

### 建議下一步

1. 從 Phase 1 開始，建立 `T01xx-upstream-quick-wins` 工單執行
2. Phase 2 拆成 2-3 張工單（SDK 升級 / cache history / image+account）
3. Phase 3 各功能群獨立工單
4. Phase 4 等 Phase 1-3 穩定後再評估
