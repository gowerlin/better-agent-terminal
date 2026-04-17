# 決策日誌 — better-agent-terminal

> 記錄所有影響專案方向的重要決策。
> 建立時間：2026-04-12 (UTC+8)（T0062 遷移產出，從 _tower-state.md 提取）
> 最後更新:2026-04-18 07:10 (UTC+8)（新增 D058 — upstream v2.1.42+ 同步採方案 [A]：Phase 1 cherry-pick + Phase 2 獨立 PLAN）

---

## 決策索引

| ID | 日期 | 標題 | 相關工單 |
|----|------|------|---------|
| D001-D012 | 2026-04-11 早期 | Phase 1 前置決策（詳見歸檔） | T0001-T0012 |
| D013 | 2026-04-11 | 技術債 Backlog + 派發 T0004/T0005 半平行 | T0004/T0005 |
| D014 | 2026-04-11 | T0005 PARTIAL 接受，runtime 驗證延後到 T0009 | T0005 |
| D015 | 2026-04-11 | Phase 1 驗收第一個 bug，派發 T0013 hotfix | T0013 |
| D016 | 2026-04-11 | T0013 PARTIAL 接受，runtime 驗證延後 | T0013 |
| D017 | 2026-04-11 | BAT agent orchestration 研究記入 Backlog | PLAN-007 |
| D018 | 2026-04-12 | 先修 Redraw 再調查 BUG-012（診斷工具優先） | T0035/T0036 |
| D019 | 2026-04-12 | T0035 v1 修復（禁用 viewport scroll）無效 | T0035 |
| D020 | 2026-04-12 | BUG-012 根因確認：上游 TUI 問題，workaround 策略 | T0041 |
| D021 | 2026-04-12 | T0041 附帶改進保留（canvas addon + CLAUDE_CODE_NO_FLICKER=1） | T0041 |
| D022 | 2026-04-12 | BUG-007 關閉：上游行為，Claude Code CLI 輸出 | — |
| D023 | 2026-04-12 | BUG-013 新增：Tab 切換畫面全黑，100% 重現，High | T0047 |
| D024 | 2026-04-12 | BUG-014/015 新增：xterm v6 副作用 | T0047 |
| D025 | 2026-04-12 | 修復策略：revert xterm v5 + ErrorBoundary 保護網 | T0047 |
| D026 | 2026-04-12 | 版號管理：fork 從 1.0.0 開始，package.json 管理 | T0055 |
| D027 | 2026-04-12 | 上游追蹤：upstream tony1223，fork gowerlin，lastSyncCommit 079810025 | T0055 |
| D028 | 2026-04-12 | 採用 T0061 文件拆分架構（BUG/PLAN/Decision 獨立單據） | T0061/T0062 |
| D029 | 2026-04-12 | BUG 狀態流新增 🧪 VERIFY 中間態（code fix 完成但 runtime 尚未驗收） | T0065 |
| D047 | 2026-04-18 | PLAN-001/005 升級可行性研究派發（統籌研究 + 禁互動） | T0159 |
| D048 | 2026-04-18 | T0159 結論採行：新開 PLAN-016 + EXP-ELECTRON41-001 立即試做 | PLAN-016/EXP-ELECTRON41-001 |
| D049 | 2026-04-18 | EXP-ELECTRON41-001 CONCLUDED → 派 T0160 合併 + BUG-038 + T0161 修復 + Phase 3 暫緩 | T0160/T0161/BUG-038 |
| D050 | 2026-04-18 | Electron 41 升級未生效到 runtime + VSCode self-lock 發現 | T0160/T0161/BUG-038 |
| D051 | 2026-04-18 | Electron 41 升級 + BUG-038 runtime 驗收全通過，閉環完成 | T0160/T0161/BUG-038 |
| D052 | 2026-04-18 | PLAN-003 混合分組策略：Group A 暫緩 + Group B 升 vite + Group C WONTFIX | T0162/PLAN-003/PLAN-005 |
| D053 | 2026-04-18 | T0162 Phase 2 結論採路徑 A（vite 7 stable），派 T0163 實作 | T0162/T0163/PLAN-003 |
| D054 | 2026-04-18 | T0163 DONE 閉環 + PLAN-005 啟動（EXP worktree 模式，承接 Group A） | T0163/EXP-BUILDER26-001/PLAN-005/PLAN-003 |
| D055 | 2026-04-18 | PLAN-005 / PLAN-003 全案閉環（electron-builder 26 升級 CONCLUDED + Group A 關閉） | EXP-BUILDER26-001/PLAN-005/PLAN-003 |
| D056 | 2026-04-18 | PLAN-016 全案閉環（Electron 28.3.3 → 41.2.1，三 Phase 全部完成） | PLAN-016/EXP-ELECTRON41-001/T0160/T0161/PLAN-005 |
| D057 | 2026-04-18 | mac 打包採雙 arch dmg，放棄 universal（CI Pre-Release 5 次 run 後修正） | EXP-BUILDER26-001 |
| D058 | 2026-04-18 | Upstream v2.1.42+ 同步採方案 [A]：T0165 Phase 1 cherry-pick + PLAN-018 Phase 2 獨立 | T0164/T0165/PLAN-018 |

---

## 決策紀錄（降序，最新在上）

---

### D058 2026-04-18 — Upstream v2.1.42+ 同步採方案 [A]：T0165 Phase 1 cherry-pick + PLAN-018 Phase 2 獨立

- **背景**：T0164 研究工單（2026-04-18 06:49-07:08）評估 upstream `tony1223/better-agent-terminal` 自 `8d23e6e` (lastSync 2026-04-16) 後的 13 個新 commit（v2.1.42 → v2.1.46-pre.1）。產出詳細報告 `_report-upstream-sync-v2.1.42-plus.md`。
- **分類結果**（扣除 2 個 merge 後實質 11 包）：
  - cherry-pick 2 包（Phase 1）：C1.1 = Opus 4.7 + SDK/CLI 2.1.111 + EFFORT_LEVELS + xhigh（`357b868` + `9c3daf8`）/ C1.2 = remote workspace:load + profile:list-local（`0bc3bc1`）
  - 移植 1 包（Phase 2）：P2.1 = remote TLS + fingerprint pinning + path sandbox + brute-force 防護（`3a0af80` + `5d9f486`，16 檔 +1288/-285）
  - skip 4 包：WorkerPanel TDZ（架構不同）/ account-manager keychain（fork 無此檔）/ perf 優化（BAT 客製化環境有 regression 風險，使用者明確指示）/ PowerShell launch（同 WorkerPanel 架構）
- **選項**：
  - [A] Phase 1 + Phase 2 獨立 PLAN（Worker 推薦）
  - [B] 只 C1.1（Opus 4.7）
  - [C] 全部延後
  - [D] 先 Phase 2 再 Phase 1
- **決定**：**[A]** — 立即派 T0165（Phase 1 ~2h）+ 開 PLAN-018 規劃 Phase 2（6-10h，排下週）
- **理由**：
  1. **T0165 當天可完成**：2h 範圍明確，Opus 4.7 可立即在 BAT 內使用
  2. **PLAN-018 獨立推進不阻塞**：remote 資安加固是 P0，但 6-10h 工時本週負荷已滿（PLAN-016/005/003 剛全閉環）
  3. **使用者關鍵補充已納入**：C1.1 必須按 ①-⑨ 順序執行（SDK/CLI 先於 Opus 4.7 builtin），否則 `model-not-supported`
  4. **Phase 3 skip 理由已留存報告**：日後 upstream 若再改動可回看，不重複分析
- **關鍵對應**：v2.1.46-pre.1（`5d9f486`）的 selfsigned fix 屬於 Phase 2 範圍，C1.1 的 SDK/CLI 目標版本（`^0.2.111` / `^2.1.111`）來自 v2.1.45（`9c3daf8`）
- **衍生工單**：T0165（Phase 1 cherry-pick）/ PLAN-018（Phase 2 remote 資安加固）
- **相關工單**：T0164/T0165/PLAN-018
- **相關報告**：`_report-upstream-sync-v2.1.42-plus.md`

---

### D057 2026-04-18 — mac 打包採雙 arch dmg，放棄 universal

- **觸發事件**：EXP-BUILDER26-001 CONCLUDED 後首次觸發 GitHub Actions Pre-Release workflow，CI 環境暴露本地 Windows dry-run 沒抓到的多層失敗（schema → universal merge 地獄）。共 5 次 run 修正，最後改雙 arch dmg 才全綠。

- **失敗序列**（run ID / 層次 / 關鍵錯誤）：
  1. `24588171923` — Linux schema：`configuration.mac.x64ArchFiles should be: null | string`
  2. `24588953832` — mac universal merge：`claude-agent-sdk/vendor/ripgrep/arm64-darwin/rg ... not covered`
  3. `24589124101` — mac universal merge：`claude-code/vendor/audio-capture/arm64-darwin/audio-capture.node`
  4. `24589233714` — mac universal merge：`@img/sharp-darwin-arm64/lib/sharp-darwin-arm64.node`
  5. `24589344537` — mac universal merge：`@lydell/node-pty-darwin-arm64/pty.node`
  6. `24589510949` — **全綠**（改雙 arch dmg 後），tag `v0.0.16-pre.1`

- **根因**：
  - electron-builder 26 在 Linux host 下 normalize `mac.target.arch: "universal"` 會填入 `x64ArchFiles` 預設值並觸發 schema 驗證（與 Windows host `--dir` 路徑行為不同，EXP 工單 Step 5.5 沒暴露）。
  - `@electron/universal` 合併 x64 / arm64 ASAR 時，對所有 `asarUnpack` 內 bit-identical 的檔案都要求 `x64ArchFiles` / `arm64ArchFiles` 規則覆蓋。
  - 本專案 `asarUnpack` 帶了 `@anthropic-ai/claude-code/**`、`@anthropic-ai/claude-agent-sdk/**`、`@img/**`，加上 `optionalDependencies` 的 `@lydell/node-pty-*`，每個 package 都 ship 全平台 binary（arm64-darwin / x64-darwin 各一份），x64 / arm64 build 都會帶入全部。每加一條 pattern 就跳下一個 package，典型 whack-a-mole。

- **決策**：`mac.target.arch` 從 `"universal"` 改為 `["x64", "arm64"]`，產出 `BetterAgentTerminal-*-x64.dmg` + `-arm64.dmg` 兩個 dmg，繞過整個 universal merge 檢查路徑。

- **Commit**：`28fc637`（此輪 CI 修復期間另含 `d0822b1`、`368e0ca`、`3aa3ac5` 過渡嘗試，保留於歷史作為教訓，不 squash）。

- **Side effect**：
  - ✅ 解除 universal merge 地獄 — 新增 optionalDependency 不會再 break mac 打包。
  - ✅ mac 打包時間略縮（2m14s vs universal 預估 3m+，實測沒到 universal 完成過）。
  - ⚠️ macOS 下載頁變成兩個檔案（x64 / arm64），使用者需自行選對 CPU（Apple Silicon 選 arm64）。
  - ⚠️ 檔案大小各自比原 universal 小（不含另一 arch 拷貝），總下載頻寬不變。

- **後續**：
  - CLAUDE.md「electron-builder 26 migration notes」已更新，明確標注不要改回 universal（本輪一併 commit）。
  - EXP-BUILDER26-001 工單補記「CI 實戰後續（2026-04-18）」完整記錄（本輪一併 commit）。
  - Homebrew tap（若有）未來需要同步支援雙 arch dmg，下個正式 tag 釋出時處理（backlog 候選）。

- **關聯**：EXP-BUILDER26-001 / PLAN-005（delivery）；不改動 D055（EXP 工單依然 CONCLUDED，只是多一層 CI 實戰補記）。

---

### D056 2026-04-18 — PLAN-016 全案閉環（Electron 28.3.3 → 41.2.1，三 Phase 全部完成）

- **觸發事件**：使用者主動詢問「PLAN-016 可以做了嗎」，塔台盤點後發現**三個 Phase 全部已達成 Success Criteria**，PLAN-016 狀態應直接升為 DONE
- **Phase 對照表**：

| Phase | 原定目標 | 實際執行 | 完成時間 | 關聯決策 |
|-------|---------|---------|---------|---------|
| Phase 1 | EXP worktree 試做 | EXP-ELECTRON41-001（27 分鐘 CONCLUDED，遠低於 4-8h 預估） | 2026-04-18 02:16 | D049 |
| Phase 2 | EXP 合併 main + runtime VERIFY | T0160 + T0161 + BUG-038 閉環（含 VSCode self-lock 繞道 D050） | 2026-04-18 03:01 | D050 / D051 |
| Phase 3 | 順便帶 PLAN-005 electron-builder 26 | EXP-BUILDER26-001 CONCLUDED + merge `75bb77f` | 2026-04-18 05:25 | D055 |

- **Success Criteria 6/6 全綠驗收**：
  1. ✅ `npm install` 無錯 — T0160 + EXP-BUILDER26-001 Step 3
  2. ✅ Native modules rebuild 成功 — ABI 145 better-sqlite3 + @lydell/node-pty 驗證
  3. ✅ `npm run dev` 啟動主視窗 — T0161 修復 ELECTRON_RUN_AS_NODE pollution 後通過
  4. ✅ `npm run build:dir` 可打包 — EXP-BUILDER26-001 Step 5.2
  5. ✅ BAT core flows smoke test — D051 runtime UAT + EXP-BUILDER26-001 Step 5.4（使用者實機驗收）
  6. ✅ 無 regression — 使用者 05:25 確認 CT panel / 終端 / Sidebar / IPC 全綠
- **塔台決策**：
  1. PLAN-016 🔄 IN_PROGRESS → ✅ DONE（不需派新工單，三 Phase 產出已滿足全部 Success Criteria）
  2. 執行期資料版本鎖定：**Electron 41.2.1** + **electron-builder 26.8.1** + **Node 24** + **Chromium M146**
  3. EoL 窗口紀錄：Electron 41 EoL 2026-08-25（約 4 個月保護期），下次主升級窗口在 Q3 2026 考慮 Electron 43+
  4. 備案方案 Electron 43 **不執行**（門檻已過，無迫切性；保守策略 N-2 已達成）
- **累積成果彙整**（本輪「安全升級日」）：
  - Electron 28.3.3 → 41.2.1（Chromium M120 → M146，兩年 CVE 一次清理）
  - electron-builder 24.13.3 → 26.8.1（Group A 9 CVE 清除）
  - Vite 5.4.21 → 7.3.2（Group B 2 CVE 清除）
  - **npm audit**：27 → 3（減少 88.9%；剩 Group C whisper-node-addon 鏈 WONTFIX）
  - **CLAUDE.md**：Electron Runtime 段（PLAN-016）+ Build Toolchain 段（T0163 + EXP-BUILDER26-001）完整記錄
  - **相關 commits（2026-04-18 單日）**：`ef3624f`、`e7eab33`、`ae6063c`、`9d734a8`、`ea10b8a`、`ead9166`、`edf913a`、`8be4e5a`、`51201d1`、`58ca621`、`83ae7cf`、`ca8057b`、`f79f735`、`d146c9a`、`f105eb9`、`75bb77f`、`31612d5`（+本輪 D056 meta commit）
- **重大發現 / 修正歷程**：
  - **D050 VSCode self-lock**：npm install 期間 VSCode 鎖定 node_modules，本次全 session 都在外部終端跑（新規範 L040）
  - **BUG-038 ELECTRON_RUN_AS_NODE**：BAT 環境變數 pollution 導致 renderer 起不來，T0161 修復後寫入 CLAUDE.md Electron Runtime 段（L039）
  - **D054 EXP worktree 策略實證**：相較 T0160 直接 merge，EXP 模式在不確定性高的 major 升級情境下風險對沖效果顯著，本次 Worker time 34 分鐘（vs 原估 4-6h）
- **learning 候選**（本輪總共累積 L039-L053 共 15 條，待 `*evolve` 系統性晉升）：
  - **L054**（🟢 global 候選）：「安全升級日」集中作業模式 — 單日連續 3 條 major 升級鏈（Electron + builder + vite）全綠，相較分散到多個 sprint 的優點：工具鏈記憶熱、測試驗收可疊加、CLAUDE.md 同時段寫入一致；風險：單日 context load 高，需嚴格用 EXP 隔離避免混淆
  - **L055**（🟢 global 候選）：Success Criteria 寫得具體（如 PLAN-016 的 6 條可驗收項目）時，PLAN 結案判定可在塔台 session 內 5 分鐘完成；相較模糊的「升級完成」更容易追蹤真實完結狀態
  - **L056**（🟡 本專案）：跨 PLAN 的依賴關係（PLAN-016 Phase 3 ← PLAN-005）要在 PLAN 元資料中明寫（如「Phase 3 綁定 PLAN-005」），否則結案時易漏判
- **副作用**：
  - 主線目前有 5 commits unpushed（本輪累積），Git 狀態乾淨
  - `_backlog.md` 需補 PLAN-016 到 Completed 區塊（首次加入，因原本優先級 High 跳過 backlog 直接走工單）
  - 下一輪候選更加明確：PLAN-004 / PLAN-009 / PLAN-014
- **相關 PLAN**：PLAN-016（DONE）、PLAN-005（DONE，作為 Phase 3 載體）、PLAN-003（DONE）
- **相關工單**：EXP-ELECTRON41-001（CONCLUDED）、T0159 / T0160 / T0161 / T0162 / T0163（全部 DONE）、EXP-BUILDER26-001（CONCLUDED）

---

### D055 2026-04-18 — PLAN-005 / PLAN-003 全案閉環（electron-builder 26 升級 CONCLUDED + Group A 關閉）

- **觸發事件**：EXP-BUILDER26-001 Step 5.4 使用者手動 installer 安裝 + app smoke test **驗收通過**（05:25），Worker 可控範圍（Step 1-8、5.5）於 04:59 已完成
- **實際執行耗時**：
  - Worker 實作 + 自測：34 分鐘（04:25 派發 → 04:59 完成）
  - 使用者驗收間隔：26 分鐘（04:59 → 05:25）
  - **總 wall-clock**：60 分鐘，遠低於 4-6h 預估（超過一個量級的偏差）
- **Worker 表現亮點**：
  - P1 自排：`mac.notarize` 物件 → boolean schema 衝突，自行定位 breaking change 並修復，將 migration notes 寫入 CLAUDE.md
  - P2 邊界守護：識別 `.github/workflows/pre-release.yml` 缺 `APPLE_*` secrets 的 soft warning，但**不越權修改 CI 工作流**，只在 CLAUDE.md 記錄（塔台授權範圍內）
  - Linux dry-run 意外完整打包成功（v26 允許 Windows → Linux cross-build），超出工單驗收範圍但無副作用
  - 工單互動紀錄、執行紀錄、遭遇問題三區完整填寫
- **閉環成果**：
  - **PLAN-005** 🔄 → ✅ DONE（主 commit `f79f735`，merge commit `75bb77f`）
  - **PLAN-003 Group A** 🔄 → ✅ 關閉（9 個 CVE 100% 清除）
  - **PLAN-003 整體** 🔄 → ✅ DONE（Group A 本 PLAN + Group B T0163 + Group C WONTFIX）
  - **EXP-BUILDER26-001** 🧪 → 📊 CONCLUDED
  - **CLAUDE.md**：新增「electron-builder 26 migration notes」段（`mac.notarize` 格式、環境變數、CI soft warning、Windows host-platform 限制）
  - **npm audit**：11 → 3（全部 Group C WONTFIX 鏈，符合 D052）
- **塔台決策**：
  1. `git merge --no-ff exp/builder26` → main（`75bb77f`），保留分支拓撲供日後追溯
  2. 本輪 meta commit 統一批次處理（EXP 工單 + PLAN-003 / PLAN-005 + tower-state + backlog + 本 D055）
  3. Worktree 清理：`git worktree remove ../better-agent-terminal-builder26 && git branch -d exp/builder26`
  4. **不 push**（依規範；Git 狀態乾淨後由使用者決定推送時機）
- **安全邊界觀察**：
  - 本次是 **D051 Electron 41 閉環後 2.5 小時內**的第二次主線依賴升級閉環
  - Electron 41 + builder 26 組合首次驗收通過（runtime 無 regression、installer 可用）
  - 工具鏈「趁熱打鐵」策略（D054 時機決策）實證有效
- **learning 候選**（累積給下次 `*evolve` 評估）：
  - **L049**（🟢 global 候選）：EXP worktree 模式的 Worker 完成率實證 — 當前置條件滿足（semVerMajor + config 不明 + 主線乾淨）時，EXP 實作成本 ≤ 研究工單成本；本次 Worker 34 分鐘結束，比研究工單通常 1-2h 更快，且直接產出可驗證成果
  - **L050**（🟢 global 候選）：`auto-session: on` + `auto_commit: ask` 組合在深度依賴升級鏈（vite 7 + builder 26）中的實戰 — 兩個 EXP/實作工單連續執行，使用者僅需決策不需手動操作終端
  - **L051**（🟡 本專案）：升級鏈估時應分開 Worker time 和 wall-clock time — Worker 可控 time 常大幅優於預估（P95 偏樂觀），真正變數是使用者驗收間隔
  - **L052**（🟢 global 候選）：Worker 遇 schema breaking 時應優先查 release notes 定位精確 migration path（如 `mac.notarize` v26 變更），而非盲目 rollback 或 bypass
  - **L053**（🟡 本專案）：Step 5.4 這類需使用者實機驗收的 checkpoint，工單應明確標示 **CONCLUDED-PENDING-X** 中間狀態的回報格式；本次使用者創「CONCLUDED-PENDING-5.4」精準表達，塔台應將此模式納入 EXP / 實作工單模板
- **副作用**：
  - Worktree `../better-agent-terminal-builder26` 需清理（塔台執行）
  - 分支 `exp/builder26` 需刪除（塔台執行，因為 merge 完已整合）
  - 主線多 4 commits unpushed（`83ae7cf`、`ca8057b`、`75bb77f` merge、本輪 meta commit）
- **相關工單**：EXP-BUILDER26-001（CONCLUDED）
- **相關 PLAN**：PLAN-003（DONE）、PLAN-005（DONE）
- **下一輪候選**（backlog 剩餘 Active）：
  - PLAN-004 📋 GPU Whisper 加速（Win/Linux）🟡 Medium
  - PLAN-009 📋 Sprint 儀表板 UI 🟡 Medium
  - PLAN-014 📋 BAT 內建 Git 圖形介面（方向 B）🟡 Medium
  - PLAN-016 🔄 Electron runtime 升級（Phase 3 暫緩）🔴 High

---

### D054 2026-04-18 — T0163 DONE 閉環 + PLAN-005 啟動（EXP worktree 模式，承接 Group A）

- **觸發事件**：
  1. T0163 Worker 回報完成（commit `83ae7cf`，04:18）— vite 5.4.21 → 7.3.2 + 3 plugin 連動 + CLAUDE.md Build Toolchain 段，10/10 smoke test checklist 全綠
  2. T0163 執行過程特殊狀況：前任 Worker 在 Step 5 驗收前中斷（「把自己 kill 了」，package.json + node_modules 已達目標版本），續接 Worker 從 Step 1 盤點驗證接手、Step 4（無需修改）→ Step 5-8 收尾，13 分鐘完成
  3. PLAN-003 Group B 實證結果：npm audit 13 → 11（esbuild SSRF + vite path traversal 2 moderate 清除），vite.config.ts 零 breaking changes 命中
  4. 使用者決定延續升級慣性，啟動 PLAN-005（Group A）
- **PLAN-005 執行方案**（使用者對齊 A/C/C/A）：
  - **Q1-A 時機**：立刻動（趁 vite 升級工具鏈熱度）。接受「Electron 41 穩定 0 輪」的風險，用 EXP worktree 隔離作為風險對沖
  - **Q2-C 形式**：EXP worktree 模式（`exp/builder26`），成功則 merge 回主線，失敗則 `git worktree remove` 主線零污染
  - **Q3-C 驗收範圍**：Windows 完整打包（`npm run compile` + NSIS installer + 手動重裝 smoke test）+ macOS/Linux YAML dry-run（`electron-builder --dir`）
  - **Q4-A 版本策略**：`electron-builder: ^24.0.0 → ^26.8.1`（npm audit 指向的精確 fix 版本）
- **塔台決策**：**採 EXP worktree 模式，派發 EXP-BUILDER26-001**
  - **為何用 EXP 而非 T#### 直接實作**：
    1. Electron 41 主線穩定 0 輪（剛 D051 閉環 1 小時前），失敗風險對沖需求高
    2. electron-builder 24→26 semVerMajor，config 格式不確定性（未研究即實作）
    3. 當前主線 commit `83ae7cf` 乾淨，不容污染
  - **為何不先派研究工單（B 選項）**：
    1. 升級範圍已收斂（npm audit 指向 26.8.1，不需研究找目標版本）
    2. 研究工單的成本（1-2h）可直接進 EXP worktree 的 Step 1 盤點內，邊做邊查
    3. EXP 模式本身就是「邊實作邊學」的保守結構
  - **為何驗收不含 macOS 打包**：本機為 Windows，無 macOS 機器；notarization / universal binary 即使成功也無法驗收，僅做 YAML config parse 確認格式合法
- **狀態轉移**：
  - **T0163** → ✅ DONE（commit `83ae7cf`）
  - **PLAN-003 Group B** → ✅ DONE
  - **PLAN-003** 維持 🔄 IN_PROGRESS（等 Group A EXP 完結）
  - **PLAN-005** 💡 IDEA → 🔄 IN_PROGRESS
  - **EXP-BUILDER26-001** 新建 → 🧪 EXPLORING（等使用者建 worktree）
- **PLAN-003 完結路徑**：EXP-BUILDER26-001 CONCLUDED → PLAN-005 DONE → PLAN-003 Group A 關閉 → PLAN-003 整體 ✅ DONE
- **learning 候選**（累積給下次 `*evolve` 評估）：
  - **L046**（🟢 global 候選）：Worker 中斷續接的成本極低前提 — 工單「執行紀錄」結構完整、Step 分界明確時，續接 Worker 可從中斷點無縫接棒（T0163 前任 Worker kill 後 13 分鐘即收尾）；反之若工單結構鬆散，續接成本會變高
  - **L047**（🟡 本專案）：npm audit 指向具體 fix 版本（如 `electron-builder@26.8.1`）時，可跳過研究工單直接進實作 EXP；研究工單適用於「目標版本不明」或「多路徑選擇」
  - **L048**（🟢 global 候選）：EXP worktree 模式適合「semVerMajor + config 格式不明 + 主線乾淨」三條件同時滿足時，作為風險對沖機制；若研究成本明確 < EXP 實作成本，才該派研究工單
- **副作用**：
  - 主線將出現未 commit 的 meta 檔（PLAN-005 / PLAN-003 / tower-state / decision-log / EXP-BUILDER26-001），塔台將批次 commit
  - 使用者需自行執行 `git worktree add ../better-agent-terminal-builder26 -b exp/builder26` 建立 worktree
- **相關工單**：T0163（DONE）→ EXP-BUILDER26-001（EXPLORING）
- **相關 PLAN**：PLAN-003（IN_PROGRESS，Group A 承接中）、PLAN-005（IN_PROGRESS）

---

### D053 2026-04-18 — T0162 Phase 2 結論採路徑 A（vite 7 stable），派 T0163 實作

- **觸發事件**：T0162 Phase 2（Renew #1）完成（commits `8be4e5a` + `51201d1`，實耗 7 分鐘 vs 預算 15-30 分鐘），三個 OQ 全部解決
- **Phase 2 關鍵結論**：
  - **OQ1**：`vite-plugin-electron@0.29.1` stable **明確支援 vite 7/8**（上游 README 宣告 "stable and production-ready"）；`vite-plugin-electron-renderer@0.14.6` **無 peerDependencies 限制**（透過 dynamic import 載入 vite）
  - **Phase 1 peer 判斷修正**：Phase 1 誤將 `vite-plugin-electron@0.28.8` 的上游 devDependencies 當 peerDependencies，實際兩個 plugin 皆無對 vite major 的硬限制 → D052 當初「升 vite 8 會破壞 3 個 plugin」的憂慮被證偽
  - **OQ2（electron-vite）** 跳過但紙上評估：遷移成本過高（`vite.config.ts` 完全改寫 + scripts 重配），**不建議切換**，僅保留為最壞情境備案
  - **OQ3（vite 6/7/8 breaking changes）**：
    - 5→7 改動小：僅 `splitVendorChunkPlugin`（移除）、`transformIndexHtml` hook API（若有）、`resolve.conditions`（若有 custom）
    - 5→8 改動重：Oxc 替換 esbuild、Rolldown 替換 Rollup、CJS interop 行為變更（**Electron main 重度依賴 CJS**，有 regression 風險）
- **兩條路徑摘要**：
  - **路徑 A（保守）**：vite 7 stable + 全 stable plugin channel，3-5h，清除 2 個 moderate CVE
  - **路徑 B（激進）**：vite 8 + `vite-plugin-electron@1.0.0-beta.3`，6-10h，相同漏洞清除但吃 plugin beta + Oxc/Rolldown migration + CJS 風險
- **塔台決策**：**採路徑 A（vite 7）**
  - **使用者選擇**：A（路徑 A，Worker 推薦同意）
  - **理由**：
    1. 兩路徑清除的漏洞完全相同（都是 esbuild SSRF + vite path traversal 2 個 moderate），路徑 B 無額外安全收益
    2. 路徑 B 需吃 `vite-plugin-electron` beta channel，production app 不適合
    3. 路徑 B 核心引擎剛換（Oxc/Rolldown），社群磨合期尚短，回歸風險未充分 battle-tested
    4. Electron main process 密集使用 CJS `require`，vite 8 CJS interop 變更若踩中需重度 debug，投資報酬低
  - **未來升級目標**：vite 8 等 `vite-plugin-electron@1.0.0` 脫離 beta（正式 GA），預估 6-12 個月後排新 PLAN 處理
- **T0163 工單範圍**（使用者對齊 1B / 2B / 3A）：
  - 1B：vite 5→7 + 3 plugin 連動 + smoke test + npm audit 驗證 + **CLAUDE.md 更新（新增 Build Toolchain 段）**
  - 2B：主要功能逐項 smoke test（CT panel / 終端機 / Sidebar / IPC 通道）+ 基本 smoke（dev/HMR/compile）
  - 3A：塔台先批次 commit 凍結的 meta 檔（T0162 結案 + PLAN-003 狀態 + D052 + D053 + T0163 派發），Worker T0163 實作後另外獨立 commit
- **狀態轉移**：
  - **T0162** → ✅ DONE（Worker 已自行 commit `51201d1`）
  - **PLAN-003** 📋 PLANNED → 🔄 IN_PROGRESS（Group B 實作中）
  - **T0163** 新建 → 📋 PENDING（等使用者派 sub-session）
- **learning 候選**（累積給下次 `*evolve` 評估）：
  - **L044**（🟡 本專案）：Phase 1 靜態查 `node_modules/vite-plugin-electron/package.json` 的 devDependencies 當 peerDependencies 判斷升級限制 → 不精確；應查 npm registry 官方宣告 peer + 讀上游 README；靜態 node_modules 只反映本地當時安裝決策，不代表上游對外相容性承諾
  - **L045**（🟡 本專案）：跨 major 升級研究需分階段（Phase 1 盤點 + Phase 2 解 OQ），Phase 1 的「保守擔憂」常在 Phase 2 被證偽，塔台應允許 Renew 機制而非直接派實作
- **副作用**：無（路徑 A 維持 plugin stable channel，無引入 beta 風險）
- **相關工單**：T0162（DONE）→ T0163（PENDING）
- **相關 PLAN**：PLAN-003（IN_PROGRESS）

---

### D052 2026-04-18 — PLAN-003 npm audit 殘餘漏洞：混合分組策略

- **觸發事件**：Electron 41 升級完成（D051）觸發 PLAN-003 重新盤點，T0162 研究完成（commit `edf913a`，11 分鐘，含 1 輪使用者互動釐清）
- **T0162 關鍵發現**：
  - `npm audit` 當前 **13 個**（0 critical / 7 high / 2 moderate / 4 low），比 T0060 時期 17 個減少 4 個
  - **13 個全部無 runtime 攻擊面**（dev-time / build-time / postinstall only，不進 bundle）
  - 殘餘漏洞集中在三群：electron-builder 鏈（9）+ vite/esbuild（2）+ whisper/tar（2）
- **使用者決策（Worker 互動中確認）**：
  - **Q1-A**（Group A 9 個 electron-builder 鏈漏洞）：**暫緩**，等 PLAN-005 一併處理。理由：electron-builder 24→26 升級需重測 NSIS / DMG / auto-update / ASAR 壓縮，風險成本遠高於 dev-only 漏洞的實質影響；D049 暫緩決策維持有效
  - **Q2-B**（Group B 2 個 vite/esbuild 漏洞）：**升 vite 5→8**（使用者主動指定，Worker 原推薦 Q2-A 保守）。理由：vite 5 線已無 patch（5.4.21 為最終版本），dev server SSRF + path traversal 需處理
  - **Q3-B**（Group C 2 個 whisper/tar 漏洞）：**WONTFIX**。理由：tar 僅 postinstall 階段下載 whisper 模型時使用，runtime 無暴露；whisper-node-addon 上游無乾淨升級路徑（audit 建議的 0.0.1 是降級，強拉 tar 7 破壞 cmake-js peer）
- **Group B 實作前置條件（T0162 Renew #1）**：
  - **關鍵風險識別**：vite-plugin-electron@0.28 + vite-plugin-electron-renderer@0.14 peer 僅宣告 vite 5 → 升 vite 8 會破壞 3 個 plugin
  - Renew 範圍：
    1. npm registry 查 vite-plugin-electron / vite-plugin-electron-renderer 最新版本 peer 支援
    2. 評估 `electron-vite`（替代方案）是否合理
    3. vite 6/7/8 各 major breaking changes 摘要
  - Renew 結論後再派實作工單（預估 4-8h，若改用 electron-vite 加 2-4h）
- **重新評估的副產品**：
  - **PLAN-003 優先級 🟡 Medium → 🟢 Low**（實際 runtime 風險為零，非帳面的 Medium）
  - **PLAN-003 狀態 💡 IDEA → 📐 PLANNED**（有明確 action plan 等待實作）
  - **PLAN-003 預估規模 大→中**（不再需要 Electron major bump，剩 vite stack 升級）
- **learning 候選**（下次 `*evolve` 評估）：
  - **L042**（🟡 本專案）：npm audit 漏洞數字 ≠ 實際風險；dev-only / build-only / postinstall-only 的漏洞 runtime 無攻擊面，應另列評估
  - **L043**（🟡 本專案）：大 framework stack 跨 major 升級前，先查所有依賴 plugin 的 peer 支援版本（本次識別 vite-plugin-electron peer 鎖 vite 5 為關鍵風險）
- **關聯工單**：T0162（研究）/ PLAN-003 / PLAN-005（Group A 寄存）
- **副作用**：**PLAN-001（Vite v5→v6）標記 🚫 DROPPED**（2026-04-18 03:44）— 被 PLAN-003 Group B 吸收，避免重複做兩次 plugin stack 升級。PLAN-001 檔案保留作為歷史紀錄

---

### D051 2026-04-18 — Electron 41 升級 + BUG-038 runtime 驗收全通過，閉環完成

- **觸發事件**：使用者關閉 VSCode 在 Windows Terminal 外部終端重跑 `npm install` + `npm run build` + 手動重裝成功
- **驗收結果**：
  - `node_modules/electron/package.json` version = **41.2.1**（D050 EBUSY 解除，rename 成功）
  - `npm run build` 產物 = Windows NSIS installer，封裝 electron 41.2.1
  - 使用者手動重裝測試通過，BAT 內 terminal 可正常啟動 Electron app（BUG-038 修復生效）
  - `postinstall` 的 `npm rebuild better-sqlite3`（T0160 新增）自動為 ABI 145 重 build，啟動無 NODE_MODULE_VERSION mismatch
- **狀態轉移**：
  - **T0160** DONE（repo 層） + runtime 驗收通過 → 閉環完成
  - **T0161** FIXED → **DONE**（runtime 驗收通過，回報區補執行期驗證結果）
  - **BUG-038** FIXED → **CLOSED**（元資料補關閉時間 + 驗收結果）
  - **PLAN-016 Phase 2** 正式完結，Phase 3（electron-builder 24→26）依 D049 暫緩
- **D050 教訓確認有效**：L040（Electron IDE self-lock）+ L041（repo+runtime 雙軌驗證）獲得實戰驗證，待 `*evolve` 寫入時 candidate 升 🟢 reliable
- **塔台 meta 批次 commit**：本輪同步修正 tower-state 上輪誤寫的 `npm run build:win`（正確為 `npm run build`，Windows NSIS 由 electron-builder 預設處理）
- **關聯工單**：T0160 / T0161 / BUG-038 / PLAN-016

---

### D050 2026-04-18 — Electron 41 升級未生效到 runtime + VSCode self-lock 發現

- **觸發事件**：使用者 `npm run build` 產物仍為 `electron=28.3.3`，與 T0160 宣告的 41.2.1 不符
- **診斷過程**：
  1. 排查 process → 無 `electron.exe` / `crashpad-handler.exe` / `BetterAgentTerminal.exe` 殘留
  2. `npm install` 顯示 `EBUSY: resource busy or locked, rename 'node_modules/electron/dist/icudtl.dat' -> '.electron-lcQ2wttq/...'`
  3. 確認鎖定源為 VSCode 本身（VSCode 是 Electron 應用，file watcher / language server / 檔案總管展開 node_modules 時會 touch `icudtl.dat`，Windows file locking 比 Unix 嚴格，read handle 就擋 rename）
- **結論**：
  - T0160 Worker 交付正確（repo 層 electron=41.2.1 已 merge 到 main）→ 維持 DONE
  - 但 runtime/build 層從未更新，因為 `npm install` 在 T0160 合併後**從未成功執行過**（本次 EBUSY 為實證）
  - BUG-038 的 FIXED 宣告雖屬實（code 層 `pty-manager.ts` + `terminal-server/server.ts` 修對了），但未經 runtime 驗證，需等 install 成功後再驗收
- **行動**：
  - 使用者關閉 VSCode，改用 Windows Terminal 重跑 `rm -rf node_modules/electron node_modules/.electron-*` + `npm install` + `npm run build`
  - 本次塔台 session 在使用者執行前先完成 meta 更新後退出
  - 下一輪 Fast Path 恢復，先驗證 `node_modules/electron/package.json` version 欄位，決定走 VERIFY 或重排查
- **learning 候選**：
  - **L040**（🟢 global 候選，跨專案通用）：開發 Electron 應用時，Electron-based IDE（VSCode / Cursor / Windsurf）會鎖住 `node_modules/electron/dist/icudtl.dat`，升級 Electron 必須關 IDE 在外部終端做。這是 self-bootstrap 陷阱 — IDE 用的是它自己安裝的 Electron（不是專案 node_modules 的），但 file watcher 仍會 read-lock node_modules 下的 Electron binary
  - **L041**（🟡 本專案 playbook 候選）：宣告 deps 升級 DONE 前應雙軌驗證 —「repo 層通過」（merge commit + package-lock 正確）+「runtime 層通過」（`cat node_modules/<pkg>/package.json | grep version` 確認 + build 產物版號確認）。單看 merge commit 不夠
- **未完成事項**：D049 定義的「升級與 BUG-038 修復生效」仍待 install 成功後完整驗收
- **關聯工單**：T0160 / T0161 / BUG-038

---

### D049 2026-04-18 — EXP-ELECTRON41-001 CONCLUDED → 合併派發 + BUG-038 同步處理

- **背景**：EXP-ELECTRON41-001 耗時 27 分鐘 CONCLUDED（遠低於 4-8h 預估），所有悲觀假設被證偽
- **實驗結果**：
  - Electron 28.3.3 → 41.2.1（ABI 119→145，Chromium M146，Node 24）
  - 4 個 native modules 全數相容（better-sqlite3 rebuild、@lydell/node-pty / whisper-node-addon / sharp 直接載入）
  - TypeScript error diff = 0
  - Build + dev + smoke test 全通過
  - 變動極簡：僅 `package.json` + `package-lock.json`
  - commit `ef3624f` on `exp/electron41`
- **發現衍生 BUG**：`ELECTRON_RUN_AS_NODE=1` 洩漏至 BAT 內 terminal 子 shell（既有問題，Electron 28 時代就存在），EXP 中顯現化
- **使用者選項 [A/A/A]**：立即派 T0160 合併 + 立即建 BUG-038+T0161 修復 + 收 L037/L038/L039
- **決定**：
  1. **T0160**（🔴 High）：merge `exp/electron41` → main + `npm rebuild better-sqlite3` postinstall + CLAUDE.md Electron Runtime 區塊 + worktree 清理
  2. **BUG-038**（🟡 Medium）+ **T0161** 修復：方案 A/B/C 由 Worker 評估後選，推薦 A（源頭不污染）或 C（雙管齊下）
  3. **PLAN-016 Phase 3（PLAN-005 builder 26）暫緩**：等 T0160 merged + 主線穩定 1-2 輪後再啟動 EXP-BUILDER26-001
  4. **Learning 候選收納**（L037/L038/L039）：下次 `*evolve` 寫入
- **T0160 / T0161 可並行**（不相依）

---

### D048 2026-04-18 — T0159 結論採行：PLAN-016 + EXP-ELECTRON41-001 即刻試做

- **背景**：T0159 研究（commit `4e5af2f`）完成，結論清晰
- **關鍵發現**：
  1. **Electron 28.3.3 已 EOL 2024-06-11**（近 2 年無安全更新），當前 latest 43，建議目標 41（N-2）
  2. **PLAN-001（Vite 5→6）延後**：`vite-plugin-electron` 生態無穩定 v6 路徑
  3. **PLAN-005（builder 24→26）綁 Electron**：本專案改動面窄（僅 Mac notarize 1 欄位），需 Node 22
  4. **鐵律**：git log `b5b3d1a` 一次性大批升級 → `d8ee82a` revert(+7557/-813)證明「三合一升級 = 失敗」，EXP 必須逐項獨立 worktree
- **使用者選項 [A]**：立即派 EXP worktree 試做（不阻擋 PLAN-014 主線）
- **決定**：
  1. 新開 **PLAN-016**（🔴 High）：Electron 28→41 runtime 升級
  2. Phase 1 = **EXP-ELECTRON41-001**（worktree `exp/electron41`，已建檔）
  3. PLAN-005 降級綁定 PLAN-016 Phase 3 尾聲（native module 重建後順便升 builder）
  4. PLAN-001 保持延後（🟢 Low，等 plugin 1.0 穩定）
- **Success criteria**（EXP→CONCLUDED）：npm install 無錯 / 所有 native modules rebuild 成功 / dev+build:dir 可跑 / 手動 smoke test 8 項通過
- **最大風險**：`whisper-node-addon@1.0.2` 對 Electron 41（Node 24）的 NODE_MODULE_VERSION 相容性未知，允許 Worker 遇此決策點主動問塔台

---

### D047 2026-04-18 — PLAN-001/005 升級可行性研究派發（T0159）

- **背景**：使用者提問「PLAN-001 + PLAN-005 若風險不高是否開分支試做」。塔台初評 PLAN-001 中低風險適合 EXP、PLAN-005 綁 PLAN-003 才有意義但 PLAN-003 實際是 npm audit（PLAN-005 內備註誤記），專案無獨立 Electron runtime 升級 PLAN
- **對齊結果**：Q1.C'（Vite + builder 聯動 + 評估新開 Electron PLAN）/ Q2.A（僅文件分析不試 build）/ Q3.A（一張統籌）/ Q4.B（禁用 Worker 互動）/ Q5.A（研究完塔台直接決策）/ Q6.A（需引用 source URL）
- **決定**：派發 T0159 統籌研究工單，5 個 Block 盤點（Vite v5→v6 / electron-builder 24→26 / Electron runtime 28→latest / 三者相依順序 / 風險總評），硬限制禁止執行 `npm install` 和試 build
- **當前版本鎖定**：electron@28.3.3 / electron-builder@24.0.0 / vite@5.0.0 / vite-plugin-electron@0.28.0
- **決策依據**：本專案目前處 PLAN-014 Phase 3 Git GUI 主線收官階段，技術債升級屬低優先級；透過研究工單先盤清面積再決策排入時機，比盲試 EXP 更保守

---

### D031 2026-04-13 — PLAN-008 Phase 2 可配置參數

- **背景**：Terminal Server 架構需要兩個關鍵參數，使用者要求可在 Settings UI 調整
- **決定**：
  - Scroll buffer：預設 1000 行，Settings UI 可調，安全上限 5000 行（~500KB/terminal）
  - Server idle timeout：預設 30 分鐘，Settings UI 可調，含「永不關閉」選項
  - 兩者均透過 Settings 面板操作，存入 settings.json
- **相關工單**：T0109（Config 實作 + Settings UI）

---

### D030 2026-04-13 — 索引架構改革

- **背景**：CT 工單系統維護多個 index（_workorder-index.md / _bug-tracker.md / _backlog.md），與源文件雙重維護導致持續偏差
- **診斷**：T0102 靜態分析確認各頁籤資料來源
- **決定**：(1) _workorder-index.md 直接移除（BAT UI 不讀）(2) _bug-tracker.md 改為 *sync 自動重建 (3) _backlog.md 改為 *sync 自動重建 (4) _decision-log.md 保留人工維護 (5) sprint-status.yaml 精簡保留
- **額外發現**：_bmad-output/ 未被 file watch 監聽 → BUG-026
- **相關工單**：T0102 / T0103

---

### D029 2026-04-12 — BUG 狀態流新增 🧪 VERIFY 中間態

- **背景**：BUG 報修流程原先缺少「code fix 完成但尚未真人驗收」的中間狀態，導致 FIXED 語義模糊（無法區分「code 修了」和「真人確認修好了」）
- **選項**：
  - 選項 A：讓 FIXED 本身帶備註（runtime 待驗）
  - 選項 B：在 FIXING 和 FIXED 之間新增 VERIFY 狀態（本決策採用）
- **決定**：選項 B，新增 🧪 VERIFY 為中間態
- **細節**：
  - FIXED 維持為最終態（語義不改：真人已確認修好）
  - 歸檔規則不需要修改（FIXED 仍是歸檔觸發狀態）
  - 已歸檔的 FIXED bugs 不受影響
  - 驗收失敗（原問題未解）→ 退回 🔧 FIXING
  - 驗收失敗（衍生問題）→ 原 BUG 升 FIXED，另開新 BUG 單
  - 驗收者：使用者/QA（真人）優先；AI sub-session 可判斷純邏輯場景；E2E/視覺化需真人複驗
- **影響**：`_local-rules.md` 更新狀態流，BUG-001/002 狀態同步為 🧪 VERIFY
- **相關工單**：T0065

---

### D028 2026-04-12 — 採用模組化文件結構

- **背景**：`_tower-state.md` 膨脹至 2514 行，維護困難，*sync 每次需讀大量無關內容
- **選項**：
  - 選項 A：繼續在單一檔案維護
  - 選項 B：拆分為獨立 BUG/PLAN/Decision 文件系統
- **決定**：選項 B
- **理由**：便於導航、更新局部狀態、未來可能在 UI 中顯示各類別列表
- **相關工單**：T0061（設計）、T0062（遷移）
- **影響**：新增 _local-rules.md 教塔台認識新單據類型

---

### D027 2026-04-12 — 上游追蹤策略

- **背景**：fork 後需管理與上游的同步關係
- **決定**：upstream = tony1223/better-agent-terminal，fork = gowerlin/better-agent-terminal，lastSyncCommit = 079810025，上游版號 2.1.3
- **理由**：明確 fork 關係，方便後續上游更新評估
- **相關工單**：T0055

---

### D026 2026-04-12 — Fork 版號管理

- **背景**：fork 後需獨立版號系統，與上游版號脫鉤
- **決定**：fork 獨立版號從 1.0.0 開始，package.json 管理我們版號，version.json 管理 upstream 元資料
- **理由**：避免與上游版號混淆，清楚表達「這是我們的 release」
- **相關工單**：T0055

---

### D025 2026-04-12 — BUG-013 修復策略

- **背景**：BUG-013（Tab 切換全黑）、BUG-014（Ctrl 滾輪縮放失效）、BUG-015（字體 CJK fallback）均為 xterm v6 副作用
- **選項**：
  - 選項 A：在 xterm v6 上個別修復
  - 選項 B：revert 回 xterm v5 + 加 ErrorBoundary 保護網
  - 選項 C：完全停留 v5，放棄 v6 升級計劃
- **決定**：選項 B+C（revert v5 + ErrorBoundary）
- **理由**：xterm v6 問題多，v5 穩定，ErrorBoundary 保護避免 dispose TypeError 擴散
- **相關工單**：T0047

---

### D024 2026-04-12 — BUG-014/015 新增

- **背景**：xterm v6 升級測試（T0043）後發現額外副作用
- **決定**：新增 BUG-014（Ctrl+滾輪縮放失效）和 BUG-015（字體從黑體變細明體），與 BUG-013 同批處理
- **相關工單**：T0047

---

### D023 2026-04-12 — BUG-013 新增

- **背景**：xterm v6 升級後發現 Tab 切換離開終端時畫面全黑，100% 重現
- **決定**：新增 BUG-013，High 嚴重度，立即派發修復工單
- **推翻假設**：先前排除 xterm v6 為根因，此 Bug 確認 xterm v6 為根因
- **相關工單**：T0047

---

### D022 2026-04-12 — BUG-007 關閉為上游行為

- **背景**：OSC 52 調試訊息（`sent X chars via OSC 52`）來自 Claude Code CLI 本身，所有終端都會顯示
- **決定**：關閉 BUG-007，標記為「上游行為 / by design」，不修復
- **理由**：非本 app 的 bug，修不了也不應該修
- **影響**：BUG-007 狀態更新為 🚫 CLOSED（上游行為）

---

### D021 2026-04-12 — T0041 附帶改進保留

- **背景**：T0041（BUG-012 深度調查）順帶發現可提升性能的附帶改進
- **決定**：保留附帶改進（canvas addon 提升渲染性能、CLAUDE_CODE_NO_FLICKER=1、清理 -51 行無效代碼）
- **理由**：改進有益無害，且已在工單內完成
- **相關工單**：T0041

---

### D020 2026-04-12 — BUG-012 根因確認

- **背景**：T0035 v1 修復失敗後，T0041 深入調查
- **決定**：
  - **根因**：ghost 文字在 xterm.js buffer 中，TUI 用 cursor positioning 跳過行首未清除，屬上游問題
  - **策略**：Redraw 按鈕作為 workaround，upstream issue 已提交（#46898）
- **相關工單**：T0041、T0042（upstream issue）

---

### D019 2026-04-12 — T0035 修復策略調整

- **背景**：T0035 v1 修復（禁用 viewport scroll）後 Alt buffer 殘影未改善
- **決定**：T0035 v1 不接受（驗收否決），需要更深層調查
- **相關工單**：T0035、T0041

---

### D018 2026-04-12 — 先修 Redraw 再調查 BUG-012

- **背景**：BUG-012（Alt buffer 捲動殘影）調查困難，缺乏可靠重現方式
- **決定**：先修好 Redraw 按鈕功能（使其真正觸發重繪），再用它輔助 BUG-012 調查
- **理由**：Redraw 是測試工具，工具完備才能有效調查
- **相關工單**：T0036

---

### D017 2026-04-11 — BAT agent orchestration 研究記入 Backlog

- **背景**：使用者要求 auto-session 能整合 BAT 做雙向自動化閉環，且支援所有 AI agent（不限 Claude Code）
- **成果**：產出完整技術文件 `reports/bat-agent-orchestration-research.md`，包含 13 章節 + 8 題決策矩陣 + 風險評估
- **核心架構**：OSC 下行（開新 tab + inject cmd）+ File Watch 上行（監聽工單回報區）
- **決定**：暫不產生工單，先記入 Backlog，等使用者 review 完技術文件再決定 D1-D8
- **相依驗證**：`supervisor:send-to-worker` 的實作必須在開工前驗證（Critical）
- **相關**：PLAN-007（待建立）

---

### D016 2026-04-11 — T0013 PARTIAL 接受

- **背景**：copilot 5 分鐘內完成 code 修復，根因比預期深（`registerVoiceHandlers` 在 module init 就被呼叫，但依賴 `session.defaultSession` 這個 app 還沒 ready 的資源）
- **修復**：新增 `src/types/voice-ipc.ts` 作為 `VOICE_IPC_CHANNELS` 單一常數來源，並把 `registerVoiceHandlers` 移到 `app.whenReady()` 後
- **決定**：接受 PARTIAL，使用者執行 runtime 驗證後再升 DONE
- **學習**：L012 — IPC handler 註冊的時序敏感性
- **相關工單**：T0013

---

### D015 2026-04-11 — 派發 T0013 hotfix（跨工單 IPC drift）

- **背景**：T0011 user testing 第一項，4 個模型一律報 `No handler registered for 'voice:downloadModel'`
- **選項**：
  - 選項 A：直接開 T0013 綜合工單（調研 + 修復 + 驗證）
  - 選項 B：先開 BUG-003 報修單再決定
- **決定**：選項 A
- **理由**：root cause space 很小，範圍集中在 IPC 層，hotfix 模式
- **相關工單**：T0013

---

### D014 2026-04-11 — T0005 PARTIAL 接受

- **背景**：T0005 sub-session 在 CLI 環境無法執行 GUI 麥克風測試
- **選項**：
  - 選項 A：等 runtime 驗證完成才派 T0004
  - 選項 B：直接派 T0004，T0009 聚合 runtime 測試
- **決定**：選項 B（路線 2）
- **理由**：T0005 程式碼層全通過，T0004 獨立不阻塞，T0009 一次測完整個鏈路比多次切換有效率
- **相關工單**：T0005

---

### D013 2026-04-11 — 技術債 Backlog + T0004/T0005 派發策略

- **決定**：技術債記入 Backlog，不阻塞語音功能開發；T0004/T0005 半平行（T0003 完成後同時開始）
- **理由**：Phase 1 優先交付語音功能，技術債非阻塞

---

### D001-D012（歷史決策）

早期 Phase 1 設計階段的前置決策，包含：
- 引擎選型（whisper.cpp）
- 語言支援（繁中為主）
- UI 觸發方式（麥克風按鈕 + Alt+M）
- 結果呈現（預覽框）
- 語音功能範圍（Phase 1 Agent terminal）
- GPU 策略（Phase 1 CPU-only）
- 模型下載策略（Settings 手動下載）

詳細紀錄見：`_archive/checkpoint-2026-04.md`（需求對齊紀錄 + §G 8 題決策）
