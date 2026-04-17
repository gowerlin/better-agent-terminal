# 工單 T0123-upstream-phase1-quick-wins

## 元資料
- **工單編號**：T0123
- **任務名稱**：上游同步 Phase 1 — Quick Wins cherry-pick
- **狀態**：DONE
- **建立時間**：2026-04-16 14:15 (UTC+8)
- **開始時間**：2026-04-16 14:47 (UTC+8)
- **完成時間**：2026-04-16 15:13 (UTC+8)
- **關聯 PLAN**：PLAN-010

## 工作量預估
- **預估規模**：中
- **Context Window 風險**：低（cherry-pick 逐一操作）
- **降級策略**：若衝突過多，跳過該 commit 並記錄，回塔台決策

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：git cherry-pick 需要乾淨的工作目錄

## 任務指令

### 前置條件
需載入的文件清單：
- `_ct-workorders/reports/_report-upstream-sync-v2.1.3-to-v2.1.42.md`（分析報告，Phase 1 Batch 1 章節）
- `.gitignore`（確認報告文件可追蹤）

### 輸入上下文

**專案**：better-agent-terminal（Electron + React + TypeScript）
**背景**：Fork 自 tony1223/better-agent-terminal，上次同步 v2.1.3（2026-04-09）。上游已推進到 v2.1.42-pre.2（188 commits）。
**本工單**：執行 Phase 1 低風險 cherry-pick，共 ~18 個 commits。

**upstream remote 已設定**：`upstream` → `https://github.com/tony1223/better-agent-terminal.git`（已 fetch）

### 執行步驟

**重要**：在 `main` 分支上直接操作（使用者決策）。每個 cherry-pick 後確認 build 通過。

#### Group 1：Default 設定修正（2 commits）
```bash
git cherry-pick 60fbc2f    # fix: change default effort from medium to high
git cherry-pick 347175b    # fix: change default thinking mode from adaptive to enabled
```

#### Group 2：Windows / 效能修復（4 commits）
```bash
git cherry-pick 54e675d    # perf: reduce renderer idle CPU usage (#84)
git cherry-pick 74f3bbe    # fix: resolve terminal text overlap and alignment errors on Win11 (#86)
git cherry-pick 91ae9ff    # fix: remove signAndEditExecutable:false so Windows exe gets custom icon
git cherry-pick 43aba52    # fix: use 512x512 icon for macOS/Linux builds
```
> 注意：`77e1378`（regenerate icons）可能與 `43aba52` 重疊，若衝突則 skip。

#### Group 3：UX 改善（4 commits）
```bash
git cherry-pick 66de764    # feat: add Cmd/Ctrl+PageUp/PageDown/Home/End for message scrolling
git cherry-pick c2452b3    # feat: collapse all tool outputs by default (#75)
git cherry-pick 5b3138a    # feat: 新增訊息類型 filter 切換按鈕
git cherry-pick 50558c9    # feat: add keyboard shortcuts for terminal toggle, tab cycling, and workspace switching (#68)
```
> 注意：`50558c9` 涉及快捷鍵綁定，若與我們的自訂衝突則 skip 並記錄。

#### Group 4：file:// URL 支援（6 commits，按順序）
```bash
git cherry-pick 9c043aa    # feat: add file:// URL detection and click support in terminal
git cherry-pick 1710f2b    # feat: support file:// URLs in assistant markdown messages
git cherry-pick a2356c0    # fix: prevent black screen when clicking links in assistant messages
git cherry-pick 7801cad    # fix: replace variable-length lookbehind with offset check for file:// regex
git cherry-pick 330eabd    # fix: terminal file:// link click not working due to closure bug
git cherry-pick 20c832e    # fix: skip code blocks in file:// pre-processing
```

#### Group 5：Brand rename（3 commits）
```bash
git cherry-pick af5f025    # fix: rename "Claude Code" to "Claude Agent" for brand compliance
git cherry-pick 4ae0b85    # refactor: rename presets — Claude Agent V1/V2, add suggested badge
git cherry-pick 14da627    # docs: remove third-party brand references from documentation
```
> 注意：Brand rename 涉及多處 UI 文字，可能有小衝突。手動解衝突時保留我們的功能邏輯，只改名稱。

#### Group 6：PDF preview + misc（2 commits）
```bash
git cherry-pick 348a4fc    # feat: add PDF preview in file browser using Chromium's built-in viewer
git cherry-pick 03babf7    # fix: task result modal displays raw JSON by removing 2000-char truncation
```

### 衝突處理原則

1. **保護我們的功能**：語音、Control Tower、Status Line、Terminal Server 相關代碼不動
2. **小衝突手動解**：若只是 context 行不同，手動合併
3. **大衝突 skip**：若涉及我們大幅重寫的檔案（main.ts / claude-agent-manager.ts / ClaudeAgentPanel.tsx），skip 並記錄
4. **Build 驗證**：每個 Group 完成後跑 `npx vite build` 確認編譯通過
5. **每個 Group commit 一次**：若 cherry-pick 成功，保留原 commit；若手動解衝突，產生新 commit

### 預期產出
- main 分支上新增 ~15-18 個 cherry-pick commits
- 回報：成功/失敗/skip 的 commit 清單
- Build 驗證通過

### 驗收條件
- [ ] `npx vite build` 通過
- [ ] 既有功能未被破壞（語音、CT 面板、Status Line、Dashboard）
- [ ] Cherry-pick 成功/失敗清單完整記錄
- [ ] 每個 skip 的 commit 附帶衝突原因

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀取本工單全部內容
2. 更新「開始時間」欄位
3. 讀取分析報告 `_ct-workorders/reports/_report-upstream-sync-v2.1.3-to-v2.1.42.md`
4. 確認 `git remote -v` upstream 指向 tony1223
5. 確認 `git status` 工作目錄乾淨
6. 按 Group 1~6 順序執行 cherry-pick
7. 每個 Group 完成後 `npx vite build` 驗證
8. 全部完成後填寫回報區
9. 更新「狀態」（DONE / PARTIAL / BLOCKED）
10. 更新「完成時間」

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要
修改檔案：
- `electron/claude-agent-manager.ts` — task result modal 2000-char truncation 移除
- `package.json` — 移除 signAndEditExecutable:false（Windows icon 修復）
- `src/components/TerminalPanel.tsx` — Win11 文字重疊修復（nested RAF + clearTextureAtlas）
- `src/stores/workspace-store.ts` — suggested badge CSS（auto-merged）
- `src/styles/resize.css` — suggested badge 樣式（auto-merged）
- `src/types/agent-presets.ts` — preset rename（auto-merged）

新增 cherry-pick commits 5 個，其中 3 個為上游原始 commit，2 個為我們的修正 commit。

### Cherry-pick 結果清單

| Group | Commit | 描述 | 結果 | 備註 |
|-------|--------|------|------|------|
| 1 | `60fbc2f` | default effort high | ⏭️ SKIP | 已存在（cherry-pick empty） |
| 1 | `347175b` | default thinking enabled | ⏭️ SKIP | 已存在（cherry-pick empty） |
| 2 | `54e675d` | CPU idle reduction | ⏭️ SKIP | 核心優化已存在；衝突在我們的 i18n/batched 增強功能 |
| 2 | `74f3bbe` | Win11 text overlap | ✅ 成功 | 手動解衝突：取上游 nested RAF + clearTextureAtlas，保留我們的 agent command 邏輯 |
| 2 | `91ae9ff` | Windows exe icon | ✅ 成功 | 自動合併 |
| 2 | `43aba52` | 512x512 icon | ⏭️ SKIP | 已存在（cherry-pick empty） |
| 3 | `66de764` | PageUp/Down scroll | ⏭️ SKIP | 已存在（cherry-pick empty） |
| 3 | `c2452b3` | Collapse tool outputs | ⏭️ SKIP | 已存在；衝突僅在我們額外的設定欄位 |
| 3 | `5b3138a` | Message type filter | ⏭️ SKIP | 已存在；衝突僅在 voice/restart 功能 |
| 3 | `50558c9` | Keyboard shortcuts | ⏭️ SKIP | 已存在（cherry-pick empty） |
| 4 | `9c043aa` | file:// in terminal | ⏭️ SKIP | 已存在；衝突在 addon 加載順序 |
| 4 | `1710f2b` | file:// in markdown | ⏭️ SKIP | 衝突（ClaudeAgentPanel.tsx 大改） |
| 4 | `a2356c0` | prevent black screen | ⏭️ SKIP | 已存在（cherry-pick empty） |
| 4 | `7801cad` | regex fix | ⏭️ SKIP | 衝突（ClaudeAgentPanel.tsx 大改） |
| 4 | `330eabd` | closure bug fix | ⏭️ SKIP | 已存在（cherry-pick empty） |
| 4 | `20c832e` | skip code blocks | ⏭️ SKIP | 已存在（cherry-pick empty） |
| 5 | `af5f025` | Claude Code→Agent | ⏭️ SKIP | 已存在；衝突在 About 對話框文字 |
| 5 | `4ae0b85` | rename presets | ✅ 成功 | 手動解衝突：保留我們的 dynamic registry，取 suggested badge + resize CSS |
| 5 | `14da627` | remove brand refs | ⏭️ SKIP | 已存在；衝突在 README 中英文差異 |
| 6 | `348a4fc` | PDF preview | ⏭️ SKIP | 已存在；衝突僅在 CSS comment |
| 6 | `03babf7` | task result modal | ✅ 成功 | 自動合併 |

**統計**：21 commits 中 4 個成功 cherry-pick，17 個 skip（絕大多數功能已在我們的 fork 中存在）

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題
1. 我們的 fork 已大幅領先上游，大部分 Phase 1 的 "Quick Wins" 功能已經存在於我們的代碼中
2. `74f3bbe` Win11 修復需手動解衝突，初次遺漏括號導致 build 失敗，二次修正後通過
3. `4ae0b85` preset rename 的 ThumbnailBar.tsx 衝突解決後殘留 conflict marker，額外 commit 清理

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-16 15:13 (UTC+8)
