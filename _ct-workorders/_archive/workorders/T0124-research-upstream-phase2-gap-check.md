# 工單 T0124-research-upstream-phase2-gap-check

## 元資料
- **工單編號**：T0124
- **任務名稱**：研究：Phase 2-3 上游功能差異快速盤點
- **狀態**：DONE
- **類型**：research
- **互動模式**：enabled
- **Renew 次數**：0
- **建立時間**：2026-04-16 15:22 (UTC+8)
- **開始時間**：2026-04-16 15:25 (UTC+8)
- **完成時間**：2026-04-16 15:29 (UTC+8)
- **關聯 PLAN**：PLAN-010

## 研究目標

T0123 Phase 1 結果顯示 21 個 commits 中 17 個 skip（功能已存在）。因此需重新盤點 Phase 2-3 的功能群，確認哪些是我們**真正缺少的**、哪些已有同等或更好的實作。

**不需要做 diff 分析**——只需比對功能是否存在即可。輕量快速完成。

## 已知資訊

- 分析報告：`_ct-workorders/reports/_report-upstream-sync-v2.1.3-to-v2.1.42.md`
- T0123 回報：Phase 1 的 21 個 commits 中 17 個 skip（功能已存在）

### Phase 2 待確認功能群（報告 Batch 2）

| # | 功能群 | 上游代表 commits | 我們是否已有？ |
|---|--------|-----------------|--------------|
| 12 | CLI 版本升級 2.1.97→2.1.104 | `25c9a16`, `4c7d495`, `79e98c7` | ❓ 查 package.json |
| 13 | Usage rate_limit_event | `cc8d980`, `89afe29` | ❓ 查 claude-agent-manager.ts |
| 14 | Sub-agent messages + deferred tool use | `dfe22f9` | ❓ 查 message 處理邏輯 |
| 15 | Cache history（per-model, TTL, per-call） | 多個 commits | ❓ 查 CacheHistoryModal 或類似元件 |
| 16 | Cache efficiency statusline | `c67e605`, `98c2d87` | ❓ 查 statusline 設定 |
| 17 | Image attachments in chat | `011bd16`, `6541fdb` | ❓ 查 image 相關 IPC |
| 18 | Account switch（/login /logout /whoami） | `d2ac146`, `851d2e7` | ❓ 查 account-manager 或類似邏輯 |
| 19 | /abort command + ESC fix | `3948cda` | ❓ 查 abort 相關處理 |
| 20 | Task Result modal markdown | `dc5b49f`, `03babf7` | ✅ `03babf7` 已 cherry-pick |

### Phase 3 待確認功能群（報告 Batch 3）

| # | 功能群 | 我們是否已有？ |
|---|--------|--------------|
| 21 | SDK V2 session support | ❓ 查 apiVersion / V2 session 邏輯 |
| 22 | Git worktree isolation (#83) | ❓ 查 worktree-manager 或類似 |
| 23 | GitHub Panel（PR & Issues） | ❓ 查 GitHubPanel 元件 |
| 24 | Snippet system | ❓ 查 SnippetPanel / snippet-db |
| 25 | Worker Panel（Procfile） | ❓ 查 WorkerPanel / procfile |
| 26 | Plan file bar | ❓ 查 PlanBar 或類似 |

## 調查範圍

### 檢查方法（每個功能群）

快速確認法——用 Grep/Glob 搜尋關鍵字即可，不需要讀完整程式碼：

```bash
# Phase 2 檢查
grep -r "rate_limit" src/ electron/ --include="*.ts" --include="*.tsx" -l
grep -r "cacheHistory\|CacheHistory\|cache-history" src/ --include="*.ts" --include="*.tsx" -l
grep -r "imageAttach\|image.*attach\|drag.*image" src/ electron/ --include="*.ts" --include="*.tsx" -l
grep -r "account-manager\|accountSwitch\|/login\|/logout\|/whoami" src/ electron/ --include="*.ts" --include="*.tsx" -l
grep -r "/abort\|abortCommand\|handleAbort" src/ electron/ --include="*.ts" --include="*.tsx" -l

# Phase 3 檢查
grep -r "apiVersion\|V2.*session\|createSession.*v2" src/ electron/ --include="*.ts" --include="*.tsx" -l
grep -r "worktree\|WorktreeBar" src/ electron/ --include="*.ts" --include="*.tsx" -l
grep -r "GitHubPanel\|github.*panel" src/ --include="*.ts" --include="*.tsx" -l
grep -r "SnippetPanel\|snippet-db\|snippetManager" src/ electron/ --include="*.ts" --include="*.tsx" -l
grep -r "WorkerPanel\|procfile\|Procfile" src/ electron/ --include="*.ts" --include="*.tsx" -l
grep -r "PlanBar\|plan.*file.*bar\|planBanner" src/ --include="*.ts" --include="*.tsx" -l
```

### 產出格式

回報區填寫一張完整對照表：

| # | 功能群 | 我們的狀態 | 判定 | 備註 |
|---|--------|----------|------|------|
| 12 | CLI 升級 | ✅ 已有 / ⚠️ 部分 / ❌ 缺少 | SKIP / PORT / CHERRY-PICK | 具體說明 |

最後附「**真正需要移植的清單**」（僅列 ❌ 缺少的）。

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
無（全程無需使用者互動，Grep 搜尋即可判定）

### 調查結論

#### Phase 2 功能差異對照表

| # | 功能群 | 我們的狀態 | 判定 | 備註 |
|---|--------|----------|------|------|
| 12 | CLI 版本升級 2.1.97→2.1.104 | ✅ 已覆蓋 | SKIP | `package.json` 已有 `^2.1.97`（semver 相容），`npm update` 即可升到最新 2.1.x。目前安裝 2.1.98 |
| 13 | Usage rate_limit_event | ✅ 已有 | SKIP | `claude-agent-manager.ts:772` 處理 `rate_limit_event`，透過 `claude:rate-limit` IPC 轉發至 renderer |
| 14 | Sub-agent messages + deferred tool use | ✅ 已有 | SKIP | 完整實作：subagent message routing（ClaudeAgentPanel）、`deferred_tool_use` 處理（agent-manager:1090-1156）、`fetch-subagent-messages` IPC |
| 15 | Cache history（per-model, TTL, per-call） | ❌ 缺少 | PORT | 我們追蹤 cache tokens（cacheReadTokens/cacheCreationTokens）但**無 per-call 歷史 UI**、無 per-model 分項 modal |
| 16 | Cache efficiency statusline | ✅ 已有 | SKIP | `cacheEff` statusline item（`types/index.ts:297`），在 ClaudeAgentPanel:3617 渲染 |
| 17 | Image attachments in chat | ✅ 已有 | SKIP | 完整實作：attachedImages、multi-content SDKUserMessage 建構（agent-manager:647/1306）、paste/drag 支援 |
| 18 | Account switch（/login /logout /whoami） | ✅ 已有 | SKIP | `/login` 轉 CLI、`/logout` 攔截（:1167）、`/whoami` 攔截（:1179） |
| 19 | /abort command + ESC fix | ⚠️ 部分 | LOW | ESC 中斷已實作（pause + double-Esc stop，:1777-1785），但缺 `/abort` 打字指令。功能等價，僅 UX 便利性差異 |
| 20 | Task Result modal markdown | ✅ 已 cherry-pick | SKIP | T0123 確認 |

#### Phase 3 功能差異對照表

| # | 功能群 | 我們的狀態 | 判定 | 備註 |
|---|--------|----------|------|------|
| 21 | SDK V2 session support | ✅ 已有 | SKIP | apiVersion/V2 session 邏輯存在於 agent-manager、ClaudeAgentPanel、WorkspaceView |
| 22 | Git worktree isolation | ✅ 已有 | SKIP | **17 個檔案**引用，專屬 `worktree-manager.ts`、WorktreeBar UI、CloseConfirmDialog 整合 |
| 23 | GitHub Panel（PR & Issues） | ✅ 已有 | SKIP | 專屬 `GitHubPanel.tsx`，在 App.tsx 和 WorkspaceView.tsx 中引用 |
| 24 | Snippet system | ✅ 已有 | SKIP | 完整實作：`snippet-db.ts`（CRUD + favorites + search + categories + workspace scoping）、preload API、IPC handlers |
| 25 | Worker Panel（Procfile） | ✅ 已有 | SKIP | 專屬 `WorkerPanel.tsx`，在 WorkspaceView.tsx 中引用 |
| 26 | Plan file bar | ⚠️ 部分 | LOW | 我們有 `planLabel` statusline 顯示 + ExitPlanMode 時的 plan 內容 modal，但無獨立的 sticky plan bar UI 元件 |

#### 真正需要移植的清單

**❌ 確定缺少（建議移植）：**
- **#15 Cache History UI** — 需要新增 per-call cache 歷史查看介面（modal 或 panel），展示 per-model 分項、TTL、各次呼叫的 cache 命中率

**⚠️ 功能等價但 UX 可改善（低優先級）：**
- **#19 /abort command** — 加一行 slash command 攔截即可，改動極小
- **#26 Plan file bar** — 可考慮加一個 sticky bar 顯示當前 plan file 路徑與摘要

### 建議方向
- [A] **僅移植 #15 Cache History UI**：最有價值的缺失功能，其餘兩項功能等價可暫不處理。優點：聚焦、快速。缺點：#19/#26 留待日後
- [B] **移植 #15 + #19 /abort**：#19 改動極小（預估 <10 行），順便收掉。優點：一次清兩項。缺點：稍微多一點工作
- [C] **全部移植 #15 + #19 + #26**：完整對齊上游。優點：無遺留。缺點：#26 plan bar 設計需時間，可能與現有 statusline 衝突
- **推薦**：**方案 B** — #15 是唯一有實質功能價值的缺失，#19 改動小順便做，#26 功能已有等價實作不急

### 建議下一步
- [x] 開實作工單（建議方案：B — 移植 Cache History UI + /abort command）
- [ ] 繼續研究（Renew，新方向：...）
- [ ] 放棄（原因：...）

### Renew 歷程
無

### 遭遇問題
無

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-16 15:29 (UTC+8)
