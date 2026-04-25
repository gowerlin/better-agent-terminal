# T0252-research-upstream-sync-v2.2.26

## 元資料
- **工單編號**：T0252
- **任務名稱**：研究：評估 upstream `tony1223/better-agent-terminal` v2.1.46 → v2.2.26-pre.7 同步可行性
- **狀態**：IN_PROGRESS
- **類型**：research
- **互動模式**：enabled（research_interaction: true，最多 3 個釐清問題）
- **Renew 次數**：0
- **建立時間**：2026-04-25 16:30 (UTC+8)
- **開始時間**：2026-04-25 16:33 (UTC+08:00)
- **預估 context cost**：高（~30-50% window，114 commits 詳細分析；Worker 應主動分批讀避免 context 爆）
- **預估 wall time**：30-60 min（仿 T0164 規格但規模 ~9 倍）
- **關聯**：
  - 延續 T0164（已歸檔）— 上輪 13 commits 分析
  - 延續 T0165（已歸檔）— 上輪 Phase 1 cherry-pick 執行
  - 延續 PLAN-018（已歸檔）— 上輪 Phase 2 remote 資安加固
  - lastSyncCommit 來源：`version.json` 紀錄 `5d9f486` (v2.1.46-pre.1, 2026-04-18)
- **affects_files**：
  - `_ct-workorders/_report-upstream-sync-v2.2.26.md`（**新建**，主要產出）
  - `_ct-workorders/T0252-research-upstream-sync-v2.2.26.md`（自身工單回報區）
  - 不修改任何 source code（純研究 + 報告）

---

## 研究目標

評估 upstream `tony1223/better-agent-terminal` 自 `lastSyncCommit = 5d9f486` (v2.1.46-pre.1, 2026-04-18) 之後的 **114 個非 merge commit**（範圍 `5d9f486..upstream/main = f364e38`），沿用 T0164/PLAN-010 的分類方法（**cherry-pick / 移植 / skip**），產出研究報告供使用者決策後續 Phase 1/2/3 規劃。

**特別要求**（使用者 2026-04-25 對齊結果）：
1. **Q1.A**：完整逐 commit 分析（仿 T0164 規格，不省略）
2. **Q2.C**：研究 + 自動草擬 Phase 1 工單草稿（**寫於本工單回報區「拆單建議」區段，不獨立派發**），等使用者看完報告再決策
3. **Q3.A**：交叉檢查 BAT 客製檔案的衝突風險（必檢項）

---

## 已知資訊

| 項目 | 值 |
|------|---|
| Upstream repo | `https://github.com/tony1223/better-agent-terminal` (TonyQ) |
| Fork repo | `https://github.com/gowerlin/better-agent-terminal` |
| Last sync commit | `5d9f486` (v2.1.46-pre.1, 2026-04-18) |
| Last sync note (T0165) | C1.1 Opus 4.7 + SDK/CLI 2.1.111 + EFFORT_LEVELS + xhigh / C1.2 remote workspace:load fix + profile:list-local / Phase 2 PLAN-018 remote 資安加固完成 |
| Current upstream HEAD | `f364e38` "Preserve active workspace on remote reloads"（2026-04-25 fetch） |
| Upstream 新 commit 數 | **114**（non-merge）/ 132（含 merge），跨 7 天 |
| Upstream 新 tags | v2.1.46 → v2.2.26-pre.7（含 v2.2.0 / 2.2.1-25 + 多個 pre.X，~30+ tags） |
| Commit type 粗估 | fix:41 / feat:22 / chore:10 / refactor:3 / 其他 ~38 |

### Fork 專屬偏離（同步時必避開，避免誤判衝突）

- `CLAUDE.md`（fork 專屬規範，含 Embedded claude auto-update / Packaging / Release 章節）
- `_ct-workorders/`（Control Tower 工單庫，fork 專屬）
- `.github/workflows/pre-release.yml`（含 dual-arch dmug、x64ArchFiles 修補歷程）
- `package.json` 中 fork 專屬依賴與 `mac.target.arch = ["x64", "arm64"]` 設定
- `extraResources` filter 與 `scripts/_bat-*.mjs` helper bundle（BUG-058 修復後）
- `scripts/verify-native-modules.js` / `scripts/verify-helper-bundle.js`（fork 專屬 fail-fast）
- Electron 41 / builder 26 / vite 7（fork 已先於 upstream 升級）
- `BAT_*` 環境變數體系（`BAT_SESSION` / `BAT_TERMINAL_ID` / `BAT_WORKSPACE_ID` / `BAT_TOWER_TERMINAL_ID` / `BAT_HELPER_DIR` 等）
- `DISABLE_AUTOUPDATER=1` env 注入（BUG-055/059 修復，4 處）

### BAT 客製檔案清單（**Q3.A 必檢項**）

upstream 動到以下檔案的 commit **必須**標註「BAT 客製衝突風險」並評估：

**Electron 主程序**：
- `electron/main.ts`（IPC handler、PROXIED_CHANNELS、proxy 邏輯）
- `electron/pty-manager.ts`（DISABLE_AUTOUPDATER 三處 envWithUtf8、BAT helper 啟動）
- `electron/claude-agent-manager.ts`（BAT_BUILTIN_MODELS、EFFORT_LEVELS、constructor env 注入）
- `electron/preload.ts`（API 表面）
- `electron/terminal/*.ts`（PLAN-027 system claude runtime refactor）
- `electron/remote/*.ts`（PLAN-018 完整重寫：certificate.ts / secrets.ts / path-guard.ts / remote-server.ts / remote-client.ts / tunnel-manager.ts）
- `electron/claude-runtime-router.ts`（PLAN-027）
- `electron/auth-manager.ts`

**Renderer 元件**：
- `src/components/ClaudeAgentPanel.tsx`（MODEL_PRICING、effort 控制、render markdown）
- `src/components/WorkerPanel.tsx`（**架構分歧重大** — fork 是 supervisor 模式 110 行，upstream 是 Procfile 多進程 500+ 行）
- `src/components/SettingsPanel.tsx`（effort dropdown、Claude Runtime 設定）
- `src/components/ProfilePanel.tsx`（remoteFingerprint UI）
- `src/components/TerminalPanel.tsx`（IME / contextmenu listener）
- `src/App.tsx`（profile listLocal fallback）
- `src/stores/settings-store.ts`

**型別與工具**：
- `src/types/index.ts`（EFFORT_LEVELS / EffortLevel / Profile remoteFingerprint）
- `electron/snippet-db.ts`（debounce 改動 — Phase 3 skip 候選）

**Packaging**：
- `package.json`（依賴版本、build 設定、extraResources filter）
- `scripts/build-version.js`、`scripts/verify-*.js`

> 上述清單若 Worker 在分析過程發現遺漏的 BAT 客製檔案，應補上並回報。

---

## 調查範圍

### 主要輸入

1. `git log --oneline --no-merges 5d9f486..upstream/main` → 114 commits 列表
2. `git log --oneline --no-merges 5d9f486..upstream/main --stat` → 檔案變更規模
3. `git show <hash>` 對個別 commit 取詳細 diff（按需求，不要全 114 個都拉）
4. Upstream release notes / tag annotation（`git tag -l --format='%(contents)' v2.1.46..v2.2.26-pre.7`）
5. `version.json` lastSyncCommit 比較基準
6. Fork 端對應檔案（用 Read / Grep 對 BAT 客製檔做「現況快照」，比對衝突點）

### 排除範圍

- Fork 專屬檔案（見上方「Fork 專屬偏離」清單）— upstream 不會動，無需評估
- 已在 fork 側完成的升級（electron 41 / builder 26 / vite 7 / SDK 2.1.111 / Opus 4.7） — 若 upstream 有類似嘗試標註「fork 已搶先」
- 已在 T0164 / PLAN-018 分析或實施過的範圍 — 不重新分析

### Context 預算保護

114 commits 規模大，**禁止**一次 `git log --stat 5d9f486..upstream/main` 全拉 diff（會把 context 燒爆）。建議策略：

1. **先拉 oneline 列表**（114 行，~3KB）
2. **按 commit message 粗分桶**（fix / feat / chore / refactor 等）
3. **同主題 commit 集中分析**（如 remote 相關集中讀，UI 相關集中讀）
4. **單個 commit 詳細 diff 只在必要時**（重大 feat、可疑 conflict、需要決策的）
5. 若中途 context 接近 50%，**主動回報**並請求是否分兩段研究

---

## 研究指引

### 分類標準（延續 T0164 / PLAN-010）

| 類別 | 判準 |
|------|------|
| **cherry-pick** | Bug fix / 小功能 / 通用改善，fork 未有、無架構衝突、可獨立 commit |
| **移植（port）** | 功能值得但 upstream 實作與 fork 衝突，需要重寫或適配，預估 >2h |
| **skip** | fork 已有 / fork 搶先 / 方向不合 / 架構衝突無法調和 |

### 衝突風險分級

| 等級 | 判準 |
|------|------|
| **低** | 純新檔 / 純插入既有檔末尾 / 不觸 BAT 客製區 |
| **中** | 觸 BAT 客製檔但區塊獨立（如 type 增補、新 IPC handler 不衝突既有） |
| **高** | 觸 BAT 大幅客製區（pty-manager / claude-agent-manager / WorkerPanel）需手動 reconcile |
| **極高** | 架構級衝突（如 Procfile vs supervisor）需重新設計 |

### 預估工時規格

每個 cherry-pick / port commit 給出 **單獨工時**（h），最後 Phase 總計。基準：T0164 平均 0.3-1h/commit (cherry-pick), PLAN-018 整體 6-10h (1 大型移植包)。

### 分組策略建議

114 commits 太多，建議在報告中**先按主題分組**（如「remote 相關 N 個」「UI/UX 相關 M 個」「packaging K 個」），再在每組內逐 commit 分析。

---

## 預期產出

### 交付物 1：研究報告 `_ct-workorders/_report-upstream-sync-v2.2.26.md`

**結構**（仿 T0164 報告格式 `_report-upstream-sync-v2.1.42-plus.md`）：

1. **總覽**（commit 數、tag 跨度、檔案變更規模、總體建議一句話）
2. **Tag 時序表**（v2.1.46 → v2.2.26-pre.7 各 tag 的 commit + 主題）
3. **分類摘要表**（cherry-pick N / port M / skip K）
4. **逐 commit 分析**
   - 按主題分組（如 remote / UI / packaging / runtime / 其他）
   - 每組內按時序逐 commit
   - 每 commit 含：類別、判準、衝突風險、預估工時、檔案動向表、Diff 預覽（關鍵段）、Fork 相容性說明
   - **BAT 客製檔案受影響者必標註 ⚠️ BAT-CUSTOM**
5. **建議 Phase 規劃**
   - Phase 1（cherry-pick 包，<= 5h 為宜）
   - Phase 2（port 包，獨立開 PLAN-### 處理）
   - Phase 3（skip 理由留存）
6. **下一步選項**（A/B/C/D 選項給使用者決策）

### 交付物 2：Phase 1 工單草稿（**寫於本工單回報區「拆單建議」區段，不獨立派發**）

**格式**（為塔台後續派發提供結構化資訊）：

```markdown
## 拆單建議（Phase 1 草稿）

### T-NEXT-1（建議編號 T0253）
- **任務名稱**：upstream sync Phase 1 cherry-pick C1.1 - <主題>
- **類型**：implementation
- **預估**：~Xh
- **affects_files**：<列出>
- **Cherry-pick 內容**：
  - <commit hash 1> <subject>
  - <commit hash 2> <subject>
- **執行順序**（若有相依）：
- **驗證指令**：
  - npx vite build
  - 手動 smoke test ...
- **Fork 衝突點預警**：

### T-NEXT-2（建議編號 T0254）
... 同上 ...
```

> Worker 草擬時依研究結果合理切包（每包 1-3h 為宜），不需要使用者再決策切包。

### 交付物 3：本工單回報區

**含**：
1. 研究結論摘要（3-5 句）
2. 報告路徑指引
3. 拆單建議（Phase 1 草稿，見上）
4. PLAN-### 建議（Phase 2 移植，若有）
5. Phase 3 skip 清單
6. 學習候選（L#### 候選，研究過程的觀察）

---

## 互動規則（research_interaction: true）

Worker 在研究過程允許向使用者提問，但**遵循以下限制**：
1. 一次最多 1 個問題（避免淹沒）
2. 全研究最多 3 個提問（research_max_questions: 3）
3. 每個提問附 AI 預判選項（A/B/C 選項式）
4. 提問前先嘗試自行判斷，無法判斷再問
5. 提問場景：
   - 同主題多 commit 是否合併分析
   - 某 commit 衝突風險判定不確定
   - Phase 1 切包粒度（可選 1 大包 vs 3 小包）
6. **不需要提問**的場景：
   - 已在 BAT 客製檔案清單上的 → 直接標 ⚠️ BAT-CUSTOM
   - skip 理由明確的 → 直接 skip
   - cherry-pick 純插入無衝突的 → 直接 cherry-pick

---

## Acceptance Criteria

- [ ] **AC1**：產出 `_ct-workorders/_report-upstream-sync-v2.2.26.md`，含完整 6 段結構
- [ ] **AC2**：114 個 non-merge commit 全部出現在報告中（不漏，可分組但每個 hash 都要被歸類）
- [ ] **AC3**：BAT 客製檔案受影響的 commit 全部標註 ⚠️ BAT-CUSTOM 並評估衝突風險
- [ ] **AC4**：Phase 1 拆單建議以結構化格式寫於本工單回報區「拆單建議」段，含預估工時、affects_files、cherry-pick hash 清單
- [ ] **AC5**：Phase 2 移植包（若有）給出 PLAN-### 規劃骨架（仿 PLAN-018 P.1-P.7 拆法）
- [ ] **AC6**：Phase 3 skip 清單含理由
- [ ] **AC7**：學習候選 L#### 紀錄於回報區（至少 1 條，如 upstream 飆速期的同步策略觀察）
- [ ] **AC8**：報告中所有 commit hash 可用 `git show <hash>` 驗證真實存在於 upstream/main 歷史

---

## 工單回報區

> Worker 在此填寫研究結論、拆單建議、學習候選等。

<!-- ↓ Worker 填寫區 ↓ -->

## 研究結論摘要

1. 已完成 `5d9f486..f364e38` 全部 **114 個 non-merge commits** 盤點，分類結果為：**cherry-pick 33 / port 26 / skip 55**。
2. 本輪最值得先做的是 **Phase 1 三包低風險 cherry-pick**（remote/profile polish、Codex robustness、Claude/Codex UX polish），總估時約 **4.5h**。
3. `OpenAI Direct`、`headless bat-server / server-core`、`Codex/Claude deep reconciliation` 三條線都值得跟，但都已超出 cherry-pick 範圍，應各自開 `PLAN`。
4. `f364e38` / `e142f1b` / `89505e8` 等多個看似重要 commit，實際上已被 fork 本地提交部分或完全超前，因此本報告明確標為 skip-superseded，避免重複施工。
5. BAT 客製檔案受影響 commits 共 **73 / 114**；凡碰 `WorkerPanel`、`SettingsPanel`、`claude-agent-manager`、`electron/main.ts`、remote stack、packaging 的項目，都不建議機械套用。

## 報告路徑

- `_ct-workorders/_report-upstream-sync-v2.2.26.md`

## 拆單建議（Phase 1 草稿）

### T-NEXT-1（建議編號 T0253）
- **任務名稱**：upstream sync Phase 1 cherry-pick C1 - remote/profile polish
- **類型**：implementation
- **預估**：~1.8h
- **affects_files**：
  - `electron/main.ts`
  - `electron/remote/protocol.ts`
  - `electron/server-core/register-handlers.ts`
  - `electron/remote/remote-client.ts`
  - `src/components/ProfilePanel.tsx`
- **Cherry-pick 內容**：
  - `77ad1c0` `fix(remote): proxy image:read-as-data-url so previews resolve remotely`
  - `32aa1b5` `fix(remote): scope IPC + event broadcasts per-window profile`
  - `2a3c4d5` `Scope remote client status to profile windows`
  - `2867f77` `fix(remote-profile): show unreachable dialog with 6s timeout and local fallback`
  - `e9ecced` `fix(profile): show correct running state per profile when remote is connected`
  - `c189dbf` `fix(profile): prevent silent data loss when index.json read fails`
- **執行順序**：
  - `77ad1c0` → `32aa1b5` → `2a3c4d5` → `2867f77` → `e9ecced` / `c189dbf`
- **驗證指令**：
  - `npx vite build`
  - remote profile connect / disconnect smoke test
  - remote image preview smoke test
  - remote-unreachable fallback smoke test
- **Fork 衝突點預警**：
  - `electron/main.ts` 與 remote routing 已有 BAT 客製；注意與 `PLAN-018` 的 certificate/token/path sandbox 改動對齊

### T-NEXT-2（建議編號 T0254）
- **任務名稱**：upstream sync Phase 1 cherry-pick C2 - Codex robustness
- **類型**：implementation
- **預估**：~1.4h
- **affects_files**：
  - `electron/codex-agent-manager.ts`
  - `src/components/CodexAgentPanel.tsx`
- **Cherry-pick 內容**：
  - `d455e23` `Handle image-only Codex prompts`
  - `8b43e3d` `fix(codex): start new turn immediately on interrupt instead of queuing`
  - `d0312e3` `fix(codex-ui): always show model selector button for codex sessions`
  - `97aa275` `fix(codex): render tool calls that only emit item.completed`
  - `1f6fe0d` `fix(codex): forward pasted images to Codex SDK as local_image inputs`
  - `56671cb` `fix(codex): make /abort and double-Esc force-unstick stalled sessions`
  - `0330e94` `fix(codex): increase idle timeout from 120s to 300s`
- **執行順序**：
  - 先 manager 層（`d455e23` / `8b43e3d` / `97aa275` / `56671cb` / `0330e94`），再 UI 層（`d0312e3` / `1f6fe0d`）
- **驗證指令**：
  - `npx vite build`
  - image-only prompt smoke test
  - pasted image input smoke test
  - interrupt / abort / double-Esc smoke test
- **Fork 衝突點預警**：
  - fork 本地已在 `5aeeb42` 之後演進 Codex worktree；不要混入 worktree refactor 類 upstream commits

### T-NEXT-3（建議編號 T0255）
- **任務名稱**：upstream sync Phase 1 cherry-pick C3 - Claude/Codex UX polish
- **類型**：implementation
- **預估**：~1.3h
- **affects_files**：
  - `src/components/ClaudeAgentPanel.tsx`
  - `electron/claude-agent-manager.ts`
  - `electron/main.ts`
- **Cherry-pick 內容**：
  - `84c46ee` `fix(agent-panel): restore native middle-click autoscroll in messages`
  - `282eb81` `fix: route chat file links through FilePreviewModal`
  - `ab0a867` `fix(claude): resolve relative markdown links against session cwd`
  - `15fe760` `fix(claude): preserve worktree banner across /new session reset`
  - `220b093` `fix: open external links in system browser`
  - `18e1abf` `fix(agent): preserve whitespace inside code blocks (#90)`
  - `b918f20` `fix(claude): update contextWindow label immediately on model switch`
  - `b872049` `fix(fork-session): wait for result before aborting so transcript persists`
- **執行順序**：
  - 先 rendering / link handling，再 session state 類 (`b918f20` / `b872049`)
- **驗證指令**：
  - `npx vite build`
  - markdown link / file preview smoke test
  - model switch label smoke test
  - abort/fork transcript persistence smoke test
- **Fork 衝突點預警**：
  - `ClaudeAgentPanel.tsx` 為 BAT 重度客製檔；每個 patch 都要逐段手併，不可盲目 cherry-pick

## PLAN-### 建議（Phase 2 移植）

### PLAN-030：OpenAI Direct agent port
- **目標**：把 upstream OpenAI Direct 子系統移植到 BAT fork，支援 API key / Codex OAuth / direct tool execution
- **建議範圍**：
  - `e765507`
  - `8b7189a`
  - `2679621`
  - `bfd2b22`
  - `58e7cc9`
  - `b61ef63`
  - `b50e9ac`
- **建議拆法**：
  - P.1 manager / persistence / api-key 基礎線
  - P.2 tool registry + bash/read/write/edit/grep/glob/skill
  - P.3 OAuth / Chat Completions / model catalog
  - P.4 OpenAIAgentPanel + SettingsPanel BAT 適配
  - P.5 worker cleanup / ask-user / planning tools
  - P.6 packaged / Windows / resume-abort smoke

### PLAN-031：headless bat-server / server-core refactor
- **目標**：讓 desktop / headless 共用 handler registration 與 provider abstractions
- **建議範圍**：
  - `48afd39`
  - `742c7e3`
  - `fb2283e`
  - `6aa31d6`
  - `561734b`
  - `ceeb5c1`
  - `c3c582c`
- **建議拆法**：
  - P.1 provider injection（safeStorage/notifier/data-dir）
  - P.2 register-handlers 抽離
  - P.3 server-cli 入口
  - P.4 bin wrappers / packaged path
  - P.5 remote boundary hardening 對齊 BAT helper / verify scripts
  - P.6 desktop + headless 雙路 smoke

### PLAN-032：Codex / Claude BAT reconciliation
- **目標**：吸收 upstream 新一輪 Codex/Claude 對話流改進，但保留 BAT 本地 worktree / workspace / UI custom
- **建議範圍**：
  - `999de5c`
  - `aff737f`
  - `9366b01`
  - `47f6238`
  - `76b7e91`
  - `5a7dcf8`
  - `542f704`
  - `0d8da13`
  - `ac40ecf`
- **建議拆法**：
  - P.1 message/history flow reconcile
  - P.2 response item/tool-call rendering
  - P.3 plan badge / turn-end / live settings propagation
  - P.4 rewind-to-prompt / banner / transcript 行為驗證

## Phase 3 skip 清單

- `f364e38` / `e142f1b`：fork `bce1987` 已本地超前 workspace reload 線
- `89505e8` / `561c047` / `45f9165` / `7ecd817`：fork 本地 Codex/worktree/preset/model 線已超前或同功能存在
- `c50587c` / `f7493ca` / `2174fa0` / `92c4dec`：upstream WorkerPanel = Procfile 多進程，BAT WorkerPanel = supervisor 模式，架構衝突
- `4906e9c` / `7898b6c` / `47a0f7f` / `256ceea` / `71879d1`：packaging/release 歷史已在 fork 自行處理
- `a1ee90d` / `ac9ac06` / `0d6d8a7` / `8d93986` / `22146cf` / `815a59a`：純依賴版本 bump，不獨立同步
- `458d14e`：perf 整包碰 BAT custom 熱區太多，建議未來拆題重審
- `b3032ce`：fork 無 `account-manager.ts`

## 學習候選

- **L0101 候選**：高速 upstream 飆升期（7 天 114 commits）時，先依 fork 現況做 `superseded / cherry-pick / port` 三層過濾，比按 tag 順序追更準，能大幅降低「其實 fork 已先做」的誤判率。

## 收尾紀錄

- **完成狀態**：DONE
- **產出摘要**：
  - 新建 `_ct-workorders/_report-upstream-sync-v2.2.26.md`
  - 更新 `_ct-workorders/T0252-research-upstream-sync-v2.2.26.md`
  - 完成 114 個 non-merge commits 全覆蓋盤點與 Phase 1/2/3 決策草案
- **遭遇問題**：無
- **互動紀錄**：無
- **調查結論**：
  - 建議先做 Phase 1 三包 cherry-pick（約 4.5h）
  - OpenAI Direct / headless bat-server / Codex-Claude reconciliation 三條線改走獨立 port 計畫
  - 多個 upstream commits 已被 fork 本地超前，不應重複同步
- **建議方向**：
  - 優先選項 A：派發 T0253/T0254/T0255
  - 若要追大功能，先開 `PLAN-030`
- **Renew 歷程**：無
- **回報時間**：2026-04-25 16:42 (UTC+08:00)
- **commit hash**：待填
- **yaml**：待檢查

---

## 塔台補充

> 派發時間：2026-04-25 16:30 (UTC+8)
> YOLO mode active，但研究完成後塔台**暫停**自動派發，等使用者決策 Phase 1 是否啟動（依使用者 Q2.C 對齊結果）。
