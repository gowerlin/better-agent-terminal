# 決策日誌 — better-agent-terminal

> 記錄所有影響專案方向的重要決策。
> 建立時間：2026-04-12 (UTC+8)（T0062 遷移產出，從 _tower-state.md 提取）
> 最後更新：2026-10-04 23:58 (UTC+8)（第五十三 session 新增 D129）

---

## 決策索引

| ID | 日期 | 標題 | 相關工單 |
|----|------|------|---------|
| D129 | 2026-10-04 | PLAN-036 headless 功能 handler 層：共用註冊模組 + DI（Electron main 與 headless 同一份 `registerXxxHandlers`）；fs sandbox 由 client 推送 workspace roots（fail-closed）；遠端 Agent 沿用遠端 settings 的 runtime router；P0 先開 T0388-T0391，T0388+T0391 立即平行、T0389 等 T0387、T0390 接 T0388+T0389；P1-P3 待 P0 實機後開；PLAN-036 P0 優先於 PLAN-035 Phase 2 | PLAN-036 / T0386 / T0388-T0391 |
| D128 | 2026-10-04 | PLAN-035 Phase 1 依 T0380 拆 4 張串行實作單：T0381 指紋改 TLS 握手 + timeout（BUG-090，三精靈共用）→ T0382 WSL 埠探測避開主機 RemoteServer + startService 穩定性（BUG-091）→ T0383 `wslinfo` 判網路模式（BUG-089）→ T0384 BAT 持有 `wsl.exe` 保活（BUG-092）；網路模式改為選用、預設不勾；保活不改全機 `instanceIdleTimeout` | T0380-T0384 / BUG-089~092 / PLAN-035 |
| D127 | 2026-10-04 | WSL 環境全自動化立 PLAN-035，研究先行（T0380）；同意模型為「偵測 → 列清單 → 一次同意」；WSL 未安裝時全自動安裝含重開機後接續；BUG-089 網路模式誤判併入研究 | PLAN-035 / T0380 / BUG-089 |
| D126 | 2026-10-04 | BUG-086 + BUG-087 合併為 T0378：linger 帶明確使用者名稱並以 `Linger=yes` 判定；systemd unit 改用解析出的絕對 `$HOME` 路徑（不留 `~`、預設不用 `%h`）；可重試的失敗不回滾前步；WSL 偵測以 exit code 區分「沒裝 WSL / 無發行版」 | T0378 / BUG-086 / BUG-087 |
| D125 | 2026-10-04 | 本地打包（`release.ps1` / `build-version.js`）版號來源改為：顯式指定 → `package.json` → 時間戳（僅最後手段且不得大於真實版號）；保留 `-pre.N` 後綴、移除非 exact `git describe` fallback、打包不留 dirty、補齊 verify / fetch:baseline 前置檢查；CI `VERSION` env 路徑行為不變 | T0376 |
| D124 | 2026-10-04 | BUG-085 採 T0375 方案 B'：Windows 提權時 `codex-cli` 啟動指令注入 `-c features.daemon_auto_start=false`（不用 `--no-daemon`，舊版 codex 會 exit 2）+ 一次性 i18n 提示；SDK 路徑不注入 | T0375 / T0377 / BUG-085 |
| D123 | 2026-10-04 | BUG-084 Phase 2（SDK 0.3.289）：`claude-code-v2`「Claude Agent V2」preset **下架**（使用者裁決），不遷移成 `query()`。須含既有設定遷移：已存檔 workspace / terminal 指向 `claude-code-v2` 者自動改指 `claude-code` | BUG-084 / D122 |
| D122 | 2026-10-04 | BUG-084（內嵌 Claude CLI 2.1.113 被服務端擋 Opus 5.5 / Fable 5.1）依 T0368 採分階段：Phase 1 只升 CLI 2.1.289（SDK 留 0.2，實測相容含 V2）+ Claude 5 模型清單；隨後錯誤分類 / DISABLE_UPDATES / 計價表；Phase 2 SDK 0.3 待使用者決定 V2 preset 去留。為避免主工作樹 `npm install` 與 T0370 測試互擾，T0371 排在 T0370 之後 | T0368 / T0371 / BUG-084 |
| D121 | 2026-10-04 | BUG-083 依 T0366 結論採 S1（bump SDK + 內嵌解析相容新目錄）+ S2（選最新 binary + 錯誤分類）；S3 Settings runtime 選擇後排。四張實作單共改 `codex-agent-manager.ts`，依序串行 T-A 誤報/錯誤分類 → T-B bump → T-D 模型清單 → T-C 選最新 binary | T0366 / T0367 / BUG-083 |
| D120 | 2026-10-04 | BUG-071 runtime 下載來源：desktop release workflow（`release.yml` / `pre-release.yml`）建完 baseline 後**自動發佈** `server-bundle-v<版號>` prerelease 到 gowerlin；預設下載網址 owner 由不存在的 `anthropics` 改為 `gowerlin`；網址格式與 D093 tag 命名不變。驗收做到發 pre 版 + 實機 wizard | T0365 / BUG-071 / PLAN-031 |
| D119 | 2026-09-02 | 社群 PR #19 不 merge，改在 main 取骨架重新實作 —— 其 `cmd` 分支有兩處經確認的缺陷（`%`→`%%` 為批次檔限定語意、`""` 非 `CommandLineToArgvW` 逃逸），bot review 三個月未回應且該 bot 已停止服務；posix/pwsh 與 `agentCustomArgs` 判斷沿用其設計，出處以 `Co-authored-by` 保留 | T0362 / PR #19 |
| D118 | 2026-04-27 | T0333-D1：`ssh-permission-denied` registry entry 加 `patterns: [/permission denied/i]` regex fallback（spec 嚴格用 errorCode，但 Shell 從 snapshot 取 error 時無 errorCode 通道；後續若補 errorCode 通道可拿掉 pattern） | T0333 / PLAN-032 |
| D117 | 2026-04-27 | T0332-D3：`WizardContext.preflightCache` 設為 optional 不破壞既有 callsite；runner constructor `??=` 注入預設 cache 後 runtime invariant always-defined | T0332 / PLAN-032 |
| D116 | 2026-04-27 | T0332-D2：preflight hard fail 透過 throw 重用既有 catch 分支（不另開 error pipeline），避免兩條 pipeline drift；對外行為與 spec 等價 | T0332 / PLAN-032 |
| D115 | 2026-04-27 | T0332-D1：runner 自動 cache result（只要 `result.cacheKey` 有值即 `setPreflightCached`）；hit 邏輯仍由 step 自決，省 step 重複 boilerplate | T0332 / PLAN-032 |
| D114 | 2026-04-27 | T0331-D2：errorCode 從 `error.code` 屬性抽（非依賴 `WizardStepError` class，spec § AC-4 Optional 已允許）；SSH structured error 在 T0335 / Sprint 3 收緊 | T0331 / PLAN-032 |
| D113 | 2026-04-27 | T0331-D1：`WizardErrorPlatform` 軸獨立於 `WizardTargetOS`（runner 既有型別含 `wsl-linux` / `ssh-darwin` 等需轉換）；新增 `targetOSToErrorPlatform()` helper，error 軸不需區分 ssh-linux/ssh-darwin 但保留 local | T0331 / PLAN-032 |
| D112 | 2026-04-27 | T0330-D3：configure-mounts 也標 `kind: 'input'`（selectFolder dialog 雖非 requestChoice，語意對等；runner 暫不 wrap selectFolder 留 Sprint 3） | T0330 / PLAN-032 |
| D111 | 2026-04-27 | T0330-D2：spec 寫 `awaiting-input → skipped` 改成 `awaiting-input → succeeded(skipped flag)`（runner 中 skipped 是 boolean flag 不是獨立 status，語意對等） | T0330 / PLAN-032 |
| D110 | 2026-04-27 | T0330-D1：transition rules 加 `failed → running`（spec 寫 retry 走 `failed → pending`，但 runner 實際 retry 直接 continue loop 寫 Running，重排 loop 結構超出本票範圍且無 user 可見差異） | T0330 / PLAN-032 |
| D090 | 2026-04-26 | Renderer 嚴禁 import Node builtin（含 `node:*` 與裸 `fs/path/...`）— BUG-069 根因，採 Spike A IPC 遷移 + ESLint `no-restricted-imports` 守衛防復發 | BUG-069 / T0303 / T0304 / PLAN-029 |
| D089 | 2026-04-26 | PLAN-007 全案閉環 — 23 張藍圖工單全 DONE，session 31 一氣呵成 10 工單 121 min wall，GP099 連 10 次下界 → 強烈建議 `*evolve` 重校準 | PLAN-007 / T0282-T0291 |
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
| D059 | 2026-04-18 | PLAN-020 yolo 模式插隊啟動，PLAN-018 冷凍作為驗證場景 | PLAN-020/T0167/PLAN-018 |
| D060 | 2026-04-18 | yolo 下一張工單資訊來源採 Q2.A（研究工單 D 區段） | PLAN-020/T0167 |
| D061 | 2026-04-18 | CT-T002 閉環 + v4.2.0 tag，對方塔台已吸收 yolo 功能 | CT-T002/PLAN-020 |
| D062 | 2026-04-18 | Worker 無狀態原則：所有 runtime context 由塔台派單 explicit 傳遞 | BUG-040/BUG-041/T0176+ |
| D063 | 2026-04-19 | BUG-050 階段 1 smoke 通過 → FIXING → VERIFY,觀察 YOLO log 再決策階段 2 | BUG-050/T0215/PLAN-024 |
| D064 | 2026-04-19 | BUG-050 階段 2 暫緩:2 樣本 + 真實 YOLO 工作流驗證零異常,保持 VERIFY 待真實問題觸發 | BUG-050/PLAN-024/T0216/T0217 |
| D065 | 2026-04-19 | PLAN-021 UX 簡化:移除 Test 按鈕(error path 已提供回饋),新增停止伺服器前連線數警告 | PLAN-021/T0218/T0219 |
| D066 | 2026-04-19 | BUG-047 驗收失敗處理:派研究工單 T0220 而非直接修復 | BUG-047/T0220 |
| D067 | 2026-04-19 | T0221 YOLO 回報策略:code-only 必回 PARTIAL 觸發斷點 A | T0221/T0223 |
| D068 | 2026-04-19 | BUG-051 範圍判定:派研究工單深查 consumer + 跨平台 | BUG-051/T0222 |
| D069 | 2026-04-19 | BUG-051 與 BUG-047 關係:不算翻案,獨立編號 | BUG-047/BUG-051 |
| D070 | 2026-04-19 | T0222 附加發現處理:BUG-052 獨立 + T0223 合併修 | BUG-052/T0222/T0223 |
| D071 | 2026-04-20 | PLAN-021 dev smoke 驗收暫緩,UX 另案 | PLAN-021/T0218/T0219 |
| D072 | 2026-04-20 | archive_days 7 → 2 歸檔門檻調整 | _tower-config.yaml / *archive |
| D073 | 2026-04-20 | PLAN-022 結案,Step 3 TOFU fallback 不做 | PLAN-022 / T0217 |
| D074 | 2026-04-22 | BAT 塔台接手 Phase 1-4 派發(T0099-T0106)| PLAN-028 / CT-T010 / T0098 |
| D075 | 2026-04-23 | GPU Whisper 技術方向由雙軌翻轉為 Vulkan-first | T0236 / PLAN-004 / EXP-GPUWHIS-001 |
| D076 | 2026-04-23 | T-A PoC PARTIAL 接受 — 硬體瓶頸非套件缺陷,繼續推進 T-B/C/D 合入主線 | T0237 / EXP-GPUWHIS-001 |
| D077 | 2026-04-23 | EXP-GPUWHIS-001 T-D 合入主線 — Option 1 Squash merge + 刪除 worktree | T0240 / EXP-GPUWHIS-001 |
| D078 | 2026-04-23 | BUG-056 NSIS 打包版啟動崩潰（regression from `cb65614`）— 暫停 T0241 版號 bump，派研究工單定位根因 | BUG-056 / T0241 / cb65614 / EXP-GPUWHIS-001 |
| D079 | 2026-04-23 | T0241 結論吸收 — BUG-056 根因為 main repo 缺 `npm install`；修復拆 T0242（npm install + NSIS 雙 path 驗收）+ T0243（build fail-fast + CI `npm ci`）| T0241 / T0242 / T0243 / BUG-056 |
| D080 | 2026-04-23 | BUG-056 CLOSED — T0242 zero-diff fix via `npm install` + 雙 path 驗收全綠，VERIFY 決策 [1] 直接 CLOSED | BUG-056 / T0242 / `e46932e` |
| D081 | 2026-04-23 | BUG-057 OPEN（第二 regression from `cb65614`）— 語音辨識繁中翻英，走 T0244 研究路線（A/A/A），T0243 延下 session | BUG-057 / T0244 / `cb65614` / T0243 |
| D082 | 2026-04-23 | T0244 結論吸收 — H2 確認：`@kutalia/whisper-node-addon` default `translate: true`（舊套件 false），派 T0245 單行 fix（加 `translate: false`）+ dev mode 驗收 | T0244 / T0245 / BUG-057 / `526b7c1` |
| D083 | 2026-04-23 | BUG-057 CLOSED — T0245 單行 fix `translate: false` 閉環,使用者雙情境(zh+auto)runtime 驗收通過,session 22 收工條件達成 | BUG-057 / T0245 / `b2124b5` |
| D084 | 2026-04-23 | BUG-058 OPEN(session 24) — packaged BAT 缺 `_bat-*.mjs` helper scripts,Q3.A 拆鏈:T0246 研究 → T0247 修復 → T0248 預防 → T0249 v0.3.1 release prep | BUG-058 / T0246 / T0247 / T0248 / T0249 |
| D085 | 2026-04-24 | BUG-058 CLOSED — v0.3.1 GitHub Actions release(commits `a460d8b` filter fix + `a73a965` `1009154` 預防 + `eca8ab6` `02d8bb2` release),NSIS installer 實測 `$BAT_HELPER_DIR` 含 4 個 `.mjs`,使用者驗收通過 | BUG-058 / T0247 / T0248 / T0249 / `b0b8128` |
| D086 | 2026-04-25 | BUG-059 OPEN + BUG-055 REOPEN(session 25) — packaged embedded `claude.exe` auto-update 失敗(觀測 `.old.<ts>` 殘留 + binary missing),T0250 反組譯研究 + cross-ref BUG-055 同根因疑慮 | BUG-059 / BUG-055 / T0250 |
| D087 | 2026-04-25 | T0250 結論吸收 — 根因確認:embedded claude auto-update orphans binary 到 npm prefix(不在 BAT 路徑);採方案 A 在所有 BAT spawn 路徑無條件注入 `DISABLE_AUTOUPDATER=1`,派 T0251 單檔多點修改 | T0250 / T0251 / `2d5db28` |
| D088 | 2026-04-25 | BUG-059 + BUG-055 一同 CLOSED — T0251 commit `426d6fc` runtime 驗收通過(AC1-5 全綠,使用者實機確認無 `.old.*` 殘留 + `claude --version` 不觸發 update),BUG-055 連帶閉環(同根因) | BUG-059 / BUG-055 / T0251 / `426d6fc` |

---

## 決策紀錄（降序，最新在上）

---

### D090 2026-04-26 — Renderer 嚴禁 import Node builtin（架構鐵律）— BUG-069 根因 + 守衛策略

- **背景**：v0.4.1 NSIS 安裝啟動 100% 觸發 `Uncaught ReferenceError: require is not defined`（renderer index-DiPLuJp3.js:127:6608）。T0303 研究 22 min 用靜態證據鏈定位根因。
- **根因**：`src/components/setup-wizard/steps/wsl/fetch-fingerprint.ts:1` 寫了 `import * as https from 'node:https'`（T0275 commit `5d75d4b` 引入）。`vite-plugin-electron-renderer` 0.14.6 在 build 時把 `node:*` import 轉成虛擬 `.mjs` chunk，內容固定為 `const avoid_parse_require = require; const _M_ = avoid_parse_require("node:https");`。setup-wizard 未獨立 chunk 進主 bundle eager-load，啟動時執行 top-level `const avoid_parse_require = require;`，但 `electron/main.ts:881-882` 設 `nodeIntegration:false` + `contextIsolation:true`，renderer 沒有 `require` 全域變數 → 炸。
- **為何 v0.4.0 不炸 / vite 7 升級不是因果**：v0.3.1 renderer 沒任何 `node:*` import；T0275 是真正觸發點。Vite 5/6/7 同樣會炸（plugin behavior 自 v0.13 起一致）。
- **決定**：
  1. **修復策略**：採 Spike A IPC 遷移 — 移除 renderer 的 `node:https` import，改 main process IPC handler `wsl:fetchFingerprint`，preload 暴露 `window.electronAPI.wsl.fetchFingerprint(port)`
  2. **架構鐵律**：Renderer source（`src/**`）禁止 import 任何 Node builtin — 含 `node:*` 前綴與裸名（`fs`、`path`、`os`、`http`、`https`、`crypto`、`stream`、`net`、`url`、`buffer`、`child_process`）。所有 Node 能力一律經 IPC 取得。
  3. **守衛機制**：T0304 同步加 ESLint `no-restricted-imports` 規則（僅 `src/**`），訊息引用 `D090`。
- **理由**：
  - Spike A 對齊既有架構（contextIsolation:true + IPC 是主流），工時 30-45 min，可逆性最佳，不引入新全域 hook（否決 Spike B 的 `setCertificateVerifyProc`）
  - Spike C（manualChunks 切分）只延後 crash 不修根因，使用者明確要求避免「補一個又發現一個」
  - ESLint 守衛 ~5-10 min 加碼換永久防復發，CP 值極高
- **不採行**：Spike B（fetch + cert hook，全域 session 影響面太大）、Spike C（假修復）、回測 v0.4.0（使用者明確跳過）
- **後續處理**：
  - T0304：實作 Spike A + R2 ESLint 守衛（v0.4.2 patch）
  - PLAN-029（IDEA）：R3 indexBench.ts misplaced require 整理 + R5 setup-wizard manualChunks 切分（backlog，非阻塞）
  - R4（移除 `vite-plugin-electron-renderer`）：知識記錄，需獨立評估，不在此決策範圍
- **相關工單**：BUG-069 / T0303 / T0304 / PLAN-029
- **觸發 commit**：`5d75d4b`（T0275 wizard，引入 `node:https`）

---

### D089 2026-04-26 — PLAN-007 全案閉環 — 23 張藍圖工單全 DONE，session 31 神速交付里程碑

- **背景**：Session 31 從 14:00 起跑 PLAN-007 Phase 4-5（T0282-T0291，10 張工單），期間順帶 BUG-060 CLOSED + BUG-061 OPEN（baseline）+ decision-log drift 修復。所有工單採 yolo `--no-interactive` fire-and-forget 模式，零 Renew、零真正 FAILED、僅 1 環境性 PARTIAL（T0283 CI matrix）+ 1 baseline 豁免（T0282 AC8）。
- **里程碑**：
  - PLAN-007 全 5 Phase 完成（Phase 1 T0268-T0272 / Phase 2 T0273-T0276 / Phase 3 T0277-T0280 / Phase 4 T0282-T0287 / Phase 5 T0288-T0291）
  - 23 張藍圖工單全 DONE（T0268-T0291，期間 T0281 為 BUG-060 fix 占用）
  - 4 environment 完整支援：local / WSL / Docker / SSH（linux + darwin）
  - 8 RFC 全部落地（C-1 ~ C-7 + D-SSH-6）
  - 累計 Worker wall ~121 min（spec 估 22-30 工程日 / 含風險係數 30-40d）
- **session 31 效率指標**：
  - 10 工單 / 121 min wall = 平均 12 min/工單
  - GP099 校準後預期 wall：M sizing 10-30 min / L sizing 30-90 min；實際全落 lower bound 以下（M: 3-13 min / L: 11-18 min）
  - 連 10 次下界 → GP099 重校準訊號極強烈
- **Worker 神速三要素**（候選 GP103 抽象）：
  1. **Spec freeze 完整**：T0266 §6 給逐字 production code、T0267 §3 拍板所有 RFC、避免 Worker 設計分支
  2. **既有 mock pattern 沿用**：T0282 ssh-config-parser → T0284 SshTunnel → T0285 ssh-auth-probe → T0289 wizard-rollback；mock spawn / mock IPC pattern 跨工單復用
  3. **Worktree 隔離**：所有 commit 走 worktree `feature/plan-007-remote-dev`，主線零汙染，rollback 安全
- **決定**：
  1. PLAN-007 metadata → ✅ DONE
  2. 評估 v0.4.0 release（依 T0290 寫的 release checklist 跑 pre-release verification）
  3. 強烈建議跑 `*evolve` 萃取（GP099 重校準 + Worker 神速三要素）
  4. Worktree merge 評估（直接 squash merge 還是 PR review）
- **本 session 學習候選**（給 `*evolve` 處理）：
  - L候選：YOLO + worktree + spec freeze 三合一適合長 Phase 鏈式派發（PLAN-007 驗證 10 工單無中斷）
  - GP候選：研究型工單給 production code 逐字 spec 是 Worker 神速關鍵（vs. 設計分支留給 Worker 自決）
  - GP候選：BUG-061 baseline 豁免先例可作為「不阻塞主線開發的 dev-only 技術債」處理通則
- **相關工單**：PLAN-007 / T0282-T0291（10 張）/ BUG-060（CLOSED）/ BUG-061（OPEN baseline）

---

### D088 2026-04-25 — BUG-059 + BUG-055 一同 🚫 CLOSED — T0251 runtime 驗收全綠，Session 25 收工

- **背景**：T0251 修復鏈完成（commit `426d6fc` env 注入 + `42abda5` worker report + `f572a06` meta + `3101c6b` BUG CLOSED 收工）。使用者重建 packaged installer 後實機驗收 AC1-5：
  - AC1 build green ✅
  - AC2 `claude --version` 不觸發 update ✅（無 `.old.<ts>` 殘留）
  - AC3 spawn 後無 `.old.*` 殘留 ✅
  - AC4 worker session 鏈路完整 ✅
  - AC5 dev 環境連帶 `.old.*` 解除 ✅
- **VERIFY 決策**：[1] 直接 CLOSED — 使用者實機 5/5 AC 全綠
- **連帶閉環**：BUG-055（原 WONTFIX，session 25 因 BUG-059 反證 install hook 同根因 → REOPEN → 一同 CLOSED）— 同根因 fix 一次解兩條
- **本 session 25 成就**：熱區 8 張 BUG **全數 🚫 CLOSED 首次達成**（BAT 專案歷史首次零 open BUG 狀態）
- **效率指標**：T0250（13 min 反組譯研究）+ T0251（7 min fire-and-forget 修復），平均 Worker wall 10 min，零 Renew，零 FAILED
- **相關工單**：BUG-059 / BUG-055 / T0250 / T0251 / `426d6fc` / `3101c6b`

---

### D087 2026-04-25 — T0250 結論吸收 — 採方案 A spawn env 注入，派 T0251 單檔多點修改

- **背景**：T0250 反組譯 13 min DONE（commit `2d5db28`），找出 `node_modules/@anthropic-ai/claude-code/cli.js` 的 auto-update flow：將 `app.asar.unpacked/.../bin/claude.exe` rename 為 `.old.<ts>` 後 `npm install -g` 到使用者 npm prefix（不在 BAT spawn 路徑），導致 binary missing。BUG-055（dev 殘留）同根因確認。
- **方案選項**（Worker 提供）：
  - **A 推薦**：在 BAT 所有 spawn 路徑無條件注入 `DISABLE_AUTOUPDATER=1`（最 robust，env flag native installer 已自我關閉，npm-global 路徑亦受益）
  - B：patch `cli.js`（侵入式，每次 SDK 升級需重新處理）
  - C：自行重打包 `@anthropic-ai/claude-code`（維護成本高）
- **決定**：**[A] spawn env 無條件注入**
- **理由**：
  1. **防御性最強**：env flag 是 short-circuit update flow 的最早攔截點，config 值不會再被讀取觸發 update
  2. **零侵入**：不 patch 第三方套件，SDK 升級無需重新處理
  3. **同時解兩條 BUG**：embedded（BUG-059 packaged）+ dev（BUG-055）皆 spawn 路徑統一注入
- **執行工單**：T0251（`pty-manager.ts` 三處 envWithUtf8 + `claude-agent-manager.ts` constructor + `CLAUDE.md` 補「Embedded claude auto-update 停用」段落）
- **相關工單**：T0250 / T0251 / `2d5db28`

---

### D086 2026-04-25 — BUG-059 OPEN + BUG-055 REOPEN — Session 25 起手，反組譯研究路線

- **背景**：使用者觀測 packaged BAT 內 embedded `claude.exe.old.<ts>` 殘留 + `claude --version` 觸發 update + binary missing → packaged 用戶端 worker session 整條鏈路斷。BUG-059 OPEN（🔴 High）。同時 BUG-055（原 WONTFIX，T0235 過程中觀測 dev 環境 `.old.*` 殘留）疑似同根因，重評估 cross-ref。
- **選項**：
  - Q1：[A] 派研究工單反組譯 cli.js / [B] 直接修
  - Q2：[A] BUG-059 + BUG-055 同案 / [B] 拆兩條獨立追
- **決定**：**Q1=A（派 T0250 反組譯研究）+ Q2=A（cross-ref 同案，待 T0250 確認再決定 BUG-055 REOPEN）**
- **理由**：
  1. **反組譯是套件行為違反文件預期時的高效武器**（L067 候選）— 直接讀 `cli.js` 比測試假設快 5-10 倍
  2. **Cross-ref 避免 scope 切割**：若同根因，一次修可解兩條；若不同根因，再拆案不晚
- **執行工單**：T0250（research，反組譯 `node_modules/@anthropic-ai/claude-code/cli.js` auto-update flow）
- **本 session 收工條件**：BUG-059 🚫 CLOSED（並評估 BUG-055 連帶處理）
- **相關工單**：BUG-059 / BUG-055 / T0250

---

### D085 2026-04-24 — BUG-058 🚫 CLOSED — v0.3.1 GitHub Actions hotfix release 驗收通過

- **背景**：T0249 release prep DONE（`eca8ab6` chore + `02d8bb2` v0.3.1 hotfix bump）後，使用者 push + tag 觸發 GitHub Actions release。NSIS installer 實機重裝驗收 `$BAT_HELPER_DIR` 含 4 個 `.mjs` helper（T0247 修復 + T0248 預防雙保險生效）。
- **VERIFY 決策**：[1] 直接 CLOSED — GitHub Actions release artifact + 使用者實機重裝實測雙確認
- **修復鏈總結**：T0246 研究（filter 漏列根因）→ T0247 fix（filter 改 glob 白名單）→ T0248 預防（`scripts/verify-helper-bundle.js` fail-fast）→ T0249 release prep（CHANGELOG + bump 0.3.0→0.3.1）→ v0.3.1 GitHub Actions release
- **教訓**（本 session 24 學習候選）：
  1. **packaging filter 變更要靜態檢查**（L108 候選）— `extraResources.filter` glob 白名單漏列即時靜檢
  2. **release 必須跑完 GitHub Actions 實機驗收**（L101 三度驗證）— session 23 v0.3.0 在打包前未實測 NSIS 完整路徑，BUG-058 在 release 後 30 min 內被回報
  3. **預防工單與修復工單應同 session 處理** — T0247 修 + T0248 預防同 session 完成，確保 release prep 包含完整修復鏈
- **相關工單**：BUG-058 / T0247 / T0248 / T0249 / `b0b8128` / `02d8bb2`

---

### D084 2026-04-23 — BUG-058 OPEN + T0246-T0249 拆鏈派發 — Session 24 起手，v0.3.0 release 後 30 min regression

- **背景**：使用者打包 v0.3.0 NSIS 後實機觀測 — `$BAT_HELPER_DIR` 缺 `_bat-*.mjs` helper scripts，yolo 派發鏈斷。BUG-058 OPEN（🔴 High，session 23 v0.3.0 release 後立即 regression）。
- **選項**（Q3 拆單策略）：
  - A：研究 → 修復 → 預防 → release 四工單拆鏈
  - B：合併研究+修復為一張，預防+release 各一張
  - C：單一巨單一次處理
- **決定**：**Q3=A 四張拆鏈（T0246 研究 / T0247 修復 / T0248 預防 / T0249 v0.3.1 release prep）**
- **理由**：
  1. **研究先行避免盲修**（L103 先研後修 ROI）— 雖 root cause space 看似小（filter 漏列），但 `extraResources.filter` glob 行為易踩坑
  2. **預防工單獨立**：靜態檢查工具（`verify-helper-bundle.js`）與 fix 邏輯解耦，未來 helper 新增自動受保護
  3. **Release prep 獨立工單**：CHANGELOG / bump / commit 訊息規格化，方便 review
- **執行工單**：T0246（research）→ T0247（fix-and-forget）→ T0248（preventive）→ T0249（release prep）
- **本 session 收工條件**：v0.3.1 hotfix release 上架（GitHub Actions artifact + 使用者實機驗收）
- **相關工單**：BUG-058 / T0246 / T0247 / T0248 / T0249

---

### D083 2026-04-23 — BUG-057 CLOSED — T0245 單行 fix 閉環，Session 22 收工

- **背景**：T0245 Worker 10 min wall（05:25-05:35）交付修復（commit `b2124b5`），單行 diff 套用於 `electron/voice-handler.ts:462` 加 `translate: false`（含 BUG-057 inline 註解）。TS 編譯全 green，`@kutalia` 套件 `TranscribeOptions` type 本身含 `translate` 欄位，無需 `as any` cast。使用者回報「驗收通過」（情境 1 繁中 + 情境 2 auto 雙綠）。
- **VERIFY 決策**：
  - [1] 直接 CLOSED（使用者已 runtime 驗收）
  - [2] 進入 VERIFY
  - [3] 派驗收工單
- **決定**：**[1] 直接 CLOSED**
- **理由**：
  1. **使用者雙情境驗收明確**：zh 設定輸出中文 ✅ + auto 設定輸出中文 ✅（auto 情境的通過同時驗證 auto-detect 正常 + translate=false 生效）
  2. **修復範圍精確**：單行 diff 覆蓋 @kutalia default，無副作用可能
  3. **零意外發現**：Worker 回報無其他語言路徑 / GPU 路徑退化
- **本 session（22）收工條件達成**：BUG-056 + BUG-057 雙 CLOSED
- **BUG-057 效率側記**：OPEN → CLOSED 合計 **50 min wall**（04:45-05:35）；對比 BUG-056 **1h 29min**（packaging 複雜度高於純 JS 邏輯）
- **整體 session 22 救火統計**：
  - Wall time：**2h 30min**（03:05-05:35）
  - 兩個 regression 閉環：BUG-056（packaging）+ BUG-057（runtime flag）
  - Worker 效率：4 個實作工單（T0241/T0242/T0244/T0245）平均 15 min wall，全 DONE
  - 零 Renew、零 FAILED、零盲修（T0241 + T0244 皆反轉 / 排除塔台假設）
- **相關工單**：BUG-057 / T0245 / `b2124b5` / T0244 / BUG-056（同源 regression）

---

### D082 2026-04-23 — T0244 結論吸收 — `@kutalia` default 行為差異，T0245 單行 fix

- **背景**：T0244 Worker 9 min wall（05:16-05:25）交付研究結論（commit `526b7c1`），根因 **H2 確認成立**，H1/H3/H4/H5 全數排除（證據鏈完整）。
- **真正根因**：`@kutalia/whisper-node-addon` 套件 **default `translate: true`**；舊 `whisper-node-addon` 套件（session 21 前）default `translate: false`。`cb65614` regression commit 的 import path 變動（`whisper-node-addon` → `@kutalia/whisper-node-addon`）**繼承了新套件的 default 行為**，voice-handler 從未明確覆寫 `translate`，導致升級即退化。
- **關鍵機制**：whisper.cpp 的 `translate` flag 與 `language` 欄位**正交獨立** — 即使傳 `language: 'zh'`，只要 `translate: true` 仍強制翻譯為英文。使用者「沒傳 lang=zh」假設是副作用非主因（auto 模式確實沒傳 language，但 zh 模式有傳卻仍翻譯 → 證明 translate flag 才是主因）。
- **證據鏈**（T0244 提供）：
  - 證據 1：`node_modules/@kutalia/whisper-node-addon/dist/js/index.js:39` 顯示 `defaultParams` 含 `translate: true`
  - 證據 2：`grep -n "translate" electron/voice-handler.ts` 整檔零命中（唯一語言相關字串為 `language`）
  - 證據 3：`voice-handler.ts:457-466` whisperOpts 組裝僅 4 個 explicit 欄位（`model`/`fname_inp`/`use_gpu`/`no_prints`）無 `translate`
  - 證據 4：`git diff cb65614^ cb65614 -- electron/voice-handler.ts` 唯一變動是 `use_gpu` 表達式（T0239 GPU 讀取）+ import path，與 `translate` 正交
- **決定**：**派 T0245 單行 fix（`electron/voice-handler.ts` 加 `translate: false`）+ dev mode 驗收**
- **理由**：
  1. **根因單一明確**：Worker 證據鏈完整覆蓋所有假設，無歧義
  2. **XS sizing**：1 行 diff 解決全部問題（translate=false 後 language 鏈路自動生效，auto 模式也會正確輸出中文因為 @kutalia auto-detect + translate=false 會輸出原語言）
  3. **Dev mode 驗收夠**：本 fix 純 JS 層（voice options 組裝），非 native binary，不需 NSIS 重裝。dev 或 dir mode 可完整驗證 translate 行為
  4. **不暴露 translate flag 到 Settings UI**：YAGNI — 本 bug 無需使用者控制 translate，強制 false 即可。若未來有翻譯需求再開 PLAN 評估
- **執行工單**：T0245（implementation，`--mode on --interactive`，XS sizing）
- **收工條件不變**：BUG-057 🚫 CLOSED（T0245 驗收通過後）
- **Worker 效率側記**：T0241（BUG-056 研究）13 min + T0244（BUG-057 研究）9 min — **兩次研究型工單皆在 10-20 min XS 預估內完成**。研究前對齊愈精準（BUG 描述含現象特徵 + 塔台假設清單 + 建議前置檔），Worker 神速交付率愈高。L103（先研後修 ROI）本 session 第三度驗證
- **相關工單**：T0244 / T0245 / BUG-057 / `526b7c1`（T0244 commit）

---

### D081 2026-04-23 — BUG-057 OPEN — 第二 regression 發現，A/A/A 路線（研究優先 + 救火優先）

- **背景**：BUG-056 🚫 CLOSED 04:34 後 11 分鐘，使用者立即發現語音辨識繁中設定輸出為精確英文翻譯（非拼音，非音譯）。BAT voice UI 僅提供 auto / zh 兩個語言選項，兩者皆中招，100% 可重現，無 workaround。強懷疑根因 **H2**：whisper `translate: true` 在 Vulkan backend 被誤啟用（「精確翻譯為英文」是 translate mode 招牌特徵）。使用者提示「沒傳 lang=zh」亦相關（H1）。
- **選項**（塔台給三題對齊）：
  - Q1 調查方式：[A] 先研後修 / [B] 直接修 / [C] 探索式合一
  - Q2 與 T0243 順序：[A] BUG-057 優先 / [B] 並行 / [C] T0243 下 session
  - Q3 T0244 sizing：[A] XS / [B] S
- **決定**：**Q1=A（先研後修）+ Q2=A（BUG-057 優先）+ Q3=A（XS 10-20 min）**
- **理由**：
  1. **Q1.A 遵循 L103**：BUG-056 T0241 剛驗證「先研後修 ROI」— 13 min 研究反轉塔台 5 個假設，避免誤派。本次根因空間雖小，但涉及 voice-handler / gpu-detector / Settings UI 三檔鏈路，直接修有風險（例如只改 translate=false 但忽略 language 未傳的問題，或改了 Settings 但 IPC 漏）
  2. **Q2.A core UX > process hardening**：T0243 是「避免未來 BUG-056 類型重演」的預防機制；BUG-057 是「當下繁中使用者核心功能完全不可用」的 P0。L103 原則：使用者可見功能退化 > 未來防呆
  3. **Q3.A XS 預估合理**：根因空間已由使用者提示收斂（精確翻譯 = `translate` mode 特徵 + lang 未傳假設 + cb65614 diff 範圍小）。Worker 10-20 min 可靜態分析收斂，無需大量 grep
- **執行工單**：T0244（research，`--mode on --interactive`，XS sizing）→ T0245（fix，暫定 XS-S，待 T0244 提案定 sizing）
- **本 session 收工條件**：BUG-057 🚫 CLOSED
- **延後事項**（下 session）：
  - T0243（BUG-056 預防對策）
  - T0246 版號 bump + CHANGELOG + Homebrew tap（原 session 21 pending）
  - PLAN-004 狀態更新
  - `*evolve` 批次萃取 L101-L106 候選
- **風險提示**（給使用者）：本 session 已 wall 1h40min（03:05-04:45），若 BUG-057 研究+修復再 30-60 min，合計可能達 2.5-3h。使用者可中途 `*pause` 切下 session。
- **相關工單**：BUG-057 / T0244 / `cb65614` / BUG-056（同源 regression 已 CLOSED）/ T0243（延）

---

### D080 2026-04-23 — BUG-056 CLOSED — T0242 救火完成，零 source diff 修復

- **背景**：T0242 Worker 39 min wall（03:55-04:34，含 2 次使用者互動未觸發 3 題上限）完成修復工單。commit `e46932e` `fix(build): restore @kutalia/whisper-node-addon via npm install (BUG-056)`。
- **修復結果**：
  - Step 1：`npm install` ✅ 補齊 `@kutalia/whisper-node-addon`（8 檔案完整，ggml-vulkan.dll 29.78 MB / whisper.node 413 KB 等）
  - Step 2：SKIPPED（Worker 合理判斷合併至 Step 3/5）
  - Step 3：Path A ✅（`npm run build:dir` 成功，`release/win-unpacked/` `@kutalia` 落地驗證通過）
  - Step 4：✅（NSIS installer 295 MB + signtool 簽章通過，符合 T0238 基準）
  - Step 5：Path B ✅（**使用者完整驗收**：uninstall → install → 啟動 → **Vulkan loader ✅ 偵測到截圖**）
- **VERIFY 決策三選一**：
  - [1] 直接 CLOSED（使用者已驗收）
  - [2] 進入 VERIFY
  - [3] 派驗收工單
- **決定**：**[1] 直接 CLOSED**
- **理由**：
  1. **使用者 runtime 驗收證據強**：Path B Step 5 全程使用者參與 + 明確回報「安裝成功, 正確執行」+ 截圖附件（BAT 設定面板 Voice 頁籤「Vulkan loader: ✅ 偵測到」= ggml-vulkan.dll 成功 load = `@kutalia` native module 工作正常）
  2. **零 source diff 低風險**：T0241 判定 + T0242 證實本 fix 純粹是 `npm install` 補 node_modules，無 code / config 變更，無新 regression 可能
  3. **VERIFY 中間態無新增價值**：VERIFY 用於「code fix 完成但 runtime 尚未驗收」，本次 runtime 已驗收完整，VERIFY 只會增加流程噪音
- **後續**：
  1. T0243（預防對策）排隊待派 — 建議立即派發（fire-and-forget M sizing）
  2. Session 22 pending 恢復：T0243 DONE 後 → T0244 版號 bump + CHANGELOG + Homebrew tap
  3. 意外發現「3 個 zombie `BetterAgentTerminal.exe` 進程」另記為 L 候選 或 BUG-057 另案（不納入 T0243 範圍避免 scope creep）
- **本 session 救火計時**：使用者 03:05 回報 → 04:34 CLOSED = **1h 29min wall**（含塔台對齊 / 研究 / 修復 / 驗收全流程）
- **相關工單**：BUG-056 / T0241 / T0242 / `e46932e` / `cb65614`（regression 源頭）

---

### D079 2026-04-23 — T0241 結論吸收 — BUG-056 修復拆兩張（T0242 修復 + T0243 預防對策）

- **背景**：T0241 Worker 13 min 神速交付（2026-04-23 03:17-03:30），研究結論反轉塔台 H1-H5 預設假設，提出 **H6（塔台未列）**：`cb65614` squash merge 只更新 `package.json` / `package-lock.json`，main repo **從未跑 `npm install`** → `node_modules/@kutalia/` 不存在 → NSIS installer 本質上不含 `@kutalia/whisper-node-addon`。T0238 驗收全綠是因在 **worktree** 打的 installer（worktree node_modules 完整），從 main repo 打是第一次。
- **選項**（使用者提供）：
  - 選項 A：僅修復（T0242 範圍 = npm install + rebuild + 雙 path 驗收）
  - 選項 B：修復 + 預防合一（T0242 merged CI + fail-fast）
  - 選項 C：**拆兩張**（T0242 修復救火 + T0243 預防對策另案）
- **決定**：**Q1=C（拆兩張）+ Q2=B（雙 path 驗收）+ Q3=C（`--mode on --interactive` 保留 NSIS 重裝互動窗口）**
- **理由**：
  1. **Q1.C 救火與治本解耦**：release pipeline 已被 bug 阻塞，T0242 必須最小範圍最快落地；預防對策（CI pipeline 調整 + fail-fast script + CLAUDE.md 文件更新）屬 process 改進，本質 M sizing，硬塞進 T0242 會拖長救火時間。使用者明示「避免以後其他套件加入又發生類似問題」→ T0243 明確預防 BUG-056 類型（多 native module 通用，非僅 `@kutalia`）
  2. **Q2.B 符合 BUG-056 Q3.C 承諾**：T0238 盲點即跳過 NSIS install 路徑，T0242 必須涵蓋 Path A + Path B；跨平台擴展（macOS / Linux）延後到 T0243 評估
  3. **Q3.C 保留互動窗口**：NSIS 重裝需使用者配合 uninstall → install，`--mode on --interactive` 讓 Worker 可在卡關時問使用者（如「可以卸載 BAT 了嗎？」），走 yolo 會卡死
  4. **零 code 修改原則**：T0241 明確驗證 `package.json` asarUnpack / `vite.config.ts` external / `electron/voice-handler.ts` import **全部無需改**。T0242 禁止改 source code，僅補 node_modules + rebuild + 驗收
- **執行工單**：T0242（fix，`--mode on --interactive`，S sizing）→ T0243（prevention，`--mode on`，M sizing，排隊 BUG-056 CLOSED 後派發）
- **成功指標**：
  - T0242：Path A + Path B 雙驗收全綠 → BUG-056 CLOSED
  - T0243：Build fail-fast + CI `npm ci` + CLAUDE.md 更新 → BUG-056 類型重演防護
- **相關工單**：T0241（研究源頭）/ T0242（修復）/ T0243（預防）/ BUG-056（目標 CLOSED）

---

### D078 2026-04-23 — BUG-056 NSIS 打包版啟動崩潰 — 暫停 release pipeline，派研究工單定位根因

- **背景**：Session 21 收工後（2026-04-23 02:45）使用者實機 NSIS installer 測試，啟動瞬間跳 `Cannot find module '@kutalia/whisper-node-addon'`。Require stack 指向 `C:\Program Files\BetterAgentTerminal\resources\app.asar\dist-electron\main.js:1:810`，為 main process 入口。**Regression from `cb65614`**（EXP-GPUWHIS-001 Phase 1 squash merge）。
- **選項**：
  - 選項 A：**開 BUG-056 + 派 research 工單**（根因不明，Worker 靜態分析 + asar 實際內容驗證）
  - 選項 B：先 revert `cb65614` 穩定 main，再從 `exp/` 分支補強 packaging 重新合入
  - 選項 C：直接派修復工單（塔台假設是 `asarUnpack` 缺 `@kutalia/*`，Worker 直接改 `package.json`）
- **決定**：**Q1=B（pause T0241 版號 bump）+ Q2=A（開 BUG-056 + 派 research）+ Q3=C（dir/ 模式 + NSIS 重裝雙路徑驗收）**
- **理由**：
  1. **Q1.B 聚焦 bug**：Release pipeline 已被 bug 阻塞（無法發版），T0241 版號 bump 暫停是自然結果；本 session 完全聚焦 bug 修復避免注意力分散
  2. **Q2.A 拒絕盲修**：塔台已列出 5 個假設（H1-H5），無任一有決定性證據；若直接 revert（選項 B）會浪費 session 21 完整的 Vulkan 整合成果；若直接派修復（選項 C）有盲修風險 — T0238 packaging 驗收剛好是偽陽性前例
  3. **Q3.C 雙路徑驗收**：T0238 驗收盲點正是「用 `ELECTRON_RUN_AS_NODE=1 probe.js` 繞過 Electron main process 的 asar resolver」→ 本次驗收必須涵蓋 NSIS installer 完整重裝路徑，不能再只跑 probe.js
  4. **編號承接**：原 session 21 收工快照預留 T0241 給版號 bump（pending 項目），本次研究工單佔用 T0241 編號；版號 bump 未來用 T0242（或依 bug 修復後實際進度另編）
- **執行工單**：T0241（research，建議 `--mode on --interactive`，`research_max_questions: 3`）
- **成功指標**：
  - 根因收斂到單一或兩個最可能假設
  - 產出可直接派修復工單的提案（具體檔案 / 欄位 / diff 量）
  - 驗收情境涵蓋 NSIS installer 完整重裝路徑
  - T0238 盲點記錄為 L### 學習候選（packaging 驗收必須含 NSIS 路徑）
- **相關工單**：BUG-056 / T0241 / `cb65614` / EXP-GPUWHIS-001 / T0238（盲點來源）/ T0240（squash merge 執行者）

---

### D077 2026-04-23 — EXP-GPUWHIS-001 T-D 合入主線 — Option 1 Squash merge + 刪除 worktree

- **背景**:EXP-GPUWHIS-001 Phase 1 T-A/B/C 全綠交付(commits `bd27732` + `2080880` + `eba79b1` on `exp/gpu-vulkan-poc`)。T-D 最後一張依 spec §7 三選一:(1) 直接 PR 回主線 / (2) BAT 自 fork Kutalia 升 v1.8.4 / (3) 退回紙上評估。
- **決定**:**Q1=A(Option 1 直接 PR)+ Q2=A(Squash merge)+ Q3=A(合入後刪 worktree + branch)+ Q4=B(CHANGELOG/版號下次)**
- **理由**:
  1. **D076 一貫性**:使用者 Q1.A「保留成果合入主線使未來硬體升級零設定自動 enable」,Option 1 是唯一達成此目標的路徑
  2. **Squash merge 歷史乾淨**:3 個 PoC commits(swap / packaging / detection)合為 1 個 feature commit 對未來 bisect/rollback 更友善;PoC 迭代細節在 worktree branch 若有需要可從本 D077 引用的 commit hash 查
  3. **Worktree 刪除符合 EXP CONCLUDED 流程**:本專案 EXP 命名慣例為 worktree 實驗 → 結論後合入主線即刪除 branch(參照 PLAN-004 / EXP-GPUWHIS-001 文件)
  4. **版號與 CHANGELOG 分離降低本 session 複雜度**:本 session 已完成 9+ commits,Q4.B 讓 session 21 收工更乾淨,版號另開工單時可同時處理 CHANGELOG + release pipeline(參照 GP036)
- **執行工單**:T0240(T-D,impl,S sizing)
- **成功指標**:
  - main branch 新增 1 個 feature commit(訊息 `feat(voice): GPU acceleration via Vulkan (EXP-GPUWHIS-001 Phase 1)`)
  - `git worktree list` 不再顯示 `bat-gpu-vulkan-poc`
  - `git branch --list exp/*` 不再顯示 `exp/gpu-vulkan-poc`
  - build + 既有測試在 main 上通過
  - EXP-GPUWHIS-001 狀態 🧪 EXPLORING → 📊 CONCLUDED
- **保留條件(後續可追溯)**:
  - 本 D077 保留 3 個原 worktree commit hash(`bd27732` / `2080880` / `eba79b1`),若未來需對照 T-A/B/C 細節可查 reflog 或重建 branch
  - EXP-GPUWHIS-001 檔案保留在 hot zone,`*archive` 達 `archive_days` 後歸檔到 `_archive/workorders/`
- **後續延伸工作**(**不在 T-D 範圍,另開工單**):
  - 版號 bump + CHANGELOG entry(Q4.B 延後)
  - Phase 2(CUDA advanced tier)— 依使用者硬體反饋決定是否啟動
  - Kutalia upstream 追蹤(fork 停更風險 D076 記錄)
- **關聯**:EXP-GPUWHIS-001(🧪 EXPLORING → 📊 CONCLUDED)/ D076(T-A PARTIAL 接受)/ T0240(執行工單)/ `_spec-gpu-whisper-2026-04.md` §7 T-D

---

### D076 2026-04-23 — T-A PoC PARTIAL 接受 — 硬體瓶頸非套件缺陷,繼續推進 T-B/C/D 合入主線

- **背景**:T0237(EXP-GPUWHIS-001 T-A)13 分鐘交付,commit `bd27732`。**3 項成功判準 2/3 通過**:Vulkan 被選用 ✅、零 crash ✅、但**效能僅 0.99x CPU**(base.en 實測),觸發 spec §6.4 停損 #2。Worker 以 PARTIAL 回報請求塔台拍板 Renew 方向。
- **根因分析**:
  - **套件層完美**:`@kutalia/whisper-node-addon@1.1.0` Vulkan prebuilt 在 BAT Electron 41 / ABI 145 環境**零缺陷載入**,文本輸出正確,10+ 次 inference 無 crash
  - **硬體層瓶頸**:測試環境為 **GTX 1050 Ti(Pascal 2016)**,`fp16: 0` + 無 tensor cores + 無 matrix cores → Vulkan 跑 fp32 kernel 在 12 核 CPU + AVX2 + F16C + FMA + OpenBLAS 面前無優勢
  - **v1.8.3 升級無法解決**:v1.8.3 主要差異在 realtime API 與 VAD,kernel 層未改,Pascal fp16 限制是**物理限制**,非軟體可克服
- **選項**:
  - A. **繼續跑 T-B/C/D 合入主線**(package 能力永久保留,未來硬體升級零設定自動 enable)
  - B. **Worktree 凍結不合主線**(EXP 暫停 EXPLORING,等使用者硬體升級後再跑 T-B/C/D)
  - C. **暫停 EXP 評估其他方案**(Kutalia v1.8.3 升版 / CUDA backend / 保留 legacy 只動 Metal)
  - D. **ABANDONED**(Worker 不推薦 — package 無缺陷,硬體單一樣本不足以否定方向)
- **決定**:**A(繼續跑 T-B/C/D 合入主線)**
- **理由**:
  1. **T-A 證明整合路徑可行**:package 層零缺陷,`use_gpu: true` 在現行套件為 auto-detect,新硬體自動受益、舊硬體走 CPU fallback 不劣化
  2. **未來硬體升級零工作**:使用者明確表達「升級到 4070 之類,自然可開啟支援」→ 唯有 package 進主線才能達成 zero-config enable
  3. **T-B/C/D 不依賴 perf 數據**:T-B(打包)驗證 asarUnpack 與 installer 路徑、T-C(runtime detection)驗證 CPU fallback、T-D(PR 決策)獨立可推進
  4. **ABANDONED 機會成本過高**:package 無缺陷,未來重做一次 PoC 成本高於現在推進成本
- **附帶意外發現(T-A 報告記錄,此處收錄)**:
  1. **Kutalia v1.1.0 API 破壞性變更**:`transcribe()` 回傳值從 `string[][]` 改為 `{ transcription: string[][] | string[] }` → voice-handler 已加 unwrap 邏輯(T0237 `bd27732`)。T-D 合入主線時需在 type 定義補記
  2. **v1.8.3 對 fp16 問題無幫助**:kernel 層未變,Pascal fp16 限制是物理限制
  3. **T-B asarUnpack 需補規則**:`@kutalia/whisper-node-addon` path 需加入 electron-builder asarUnpack config,否則打包後 `.node` 解析路徑失敗
  4. **體積成本實測吻合**:Win x64 ~80 MB / 平台(`whisper.node` 404 KB + `ggml-vulkan.dll` 29 MB + `libopenblas.dll` 49 MB + 其他 ~1.5 MB),四平台約 ~320 MB 總 binary(與 T0236 spec 估算吻合)
- **執行路徑**:
  - T0237 PARTIAL → ✅ DONE(塔台接受,perf caveat 記錄在本 D076)
  - 立即派發 T-B(T0238,electron-builder 打包驗證)
  - T-C(runtime GPU detection + CPU fallback)可與 T-B 平行派發,或依序
  - T-D(PR 正式化)於 T-B/C 全綠後啟動
- **成功指標(合入主線後)**:
  - 使用者硬體升級到 RTX 30/40 系列或同等有 fp16/tensor cores 的 GPU 時,BAT Whisper 自動走 Vulkan 加速,無需任何設定或工單
- **關聯**:T0237(T-A PoC,commit `bd27732`)/ EXP-GPUWHIS-001(🧪 EXPLORING)/ D075(Vulkan-first 決策,本決策接續)/ `_ct-workorders/_spec-gpu-whisper-2026-04.md` §6.4(停損條件參照)

---

### D075 2026-04-23 — GPU Whisper 技術方向由雙軌翻轉為 Vulkan-first

- **背景**:T0236(PLAN-004 研究工單)原假設「CUDA-first + Vulkan fallback 雙軌」(工單建立於 2026-04-23 00:50,基於 T0058 2026-04-12 過時研究)。Worker 在 12 分鐘內完成 2026 年現況調查(commit `f6a2720`,報告 `_spec-gpu-whisper-2026-04.md` 360 行),結論**翻轉原假設**。
- **選項**:
  - A. **維持雙軌**(CUDA-first + Vulkan fallback):忠於原 T0236 假設,完整跨廠商覆蓋
  - B. **Vulkan-first + CUDA 未來 advanced tier**:採 Worker 建議,CUDA 保留延後
  - C. **CUDA-only**:放棄跨 AMD/Intel,僅服務 NVIDIA 使用者
  - D. **暫緩**:延後決策到 PoC 實測後
- **決定**:**B(Vulkan-first + CUDA 未來 advanced tier)**
- **理由**:
  1. **prebuilt 生態現實**:`@kutalia/whisper-node-addon@1.1.0`(2025-07)已 ship Win/Linux Vulkan prebuilt,**零環境配置 + 跨 NVIDIA/AMD/Intel 全覆蓋**;CUDA **沒有**任何 npm 套件同時滿足「Electron ABI 145 + CUDA prebuilt + 零環境配置」
  2. **速度差異不顯著**:CUDA 對 Whisper 場景僅 +20-30% 加速,使用者體感無感
  3. **installer 成本差異懸殊**:Vulkan +30-50 MB vs CUDA +150-300 MB
  4. **UX 衝擊差異**:Vulkan 零衝擊(套件內建 auto-detect) vs CUDA 中等衝擊(使用者需安裝 CUDA Runtime)
  5. **v1.8.3 iGPU 優化加碼**:whisper.cpp v1.8.3(2026-01)專為 iGPU 做 12x 優化,**Stable 非 experimental**,社群實測 ≈ 10x CPU
  6. **CUDA 延後不失**:未來若使用者明確反饋速度不足,可加做 CUDA advanced tier,Vulkan-first 不阻斷 CUDA 路徑
- **執行路徑**:
  - 建 EXP-GPUWHIS-001 `vulkan-first-integration`,合併 Worker 建議的 T-A/B/C/D 四張拆單統一追蹤
  - Phase 1 以 Vulkan(Kutalia fork)為主,CUDA 完全延後到 Phase 2+
  - EXP worktree 隔離實驗,PoC 成功後 PR 回主線(成功路徑)或丟棄(失敗路徑)
- **已識別風險**(EXP 追蹤):
  - Kutalia fork 9 個月未更新(whisper.cpp submodule 停在 v1.7.6)→ 若 Vulkan 效能不如預期,升級路徑為 BAT 自 fork Kutalia + rebase upstream v1.8.4
  - Electron 41 ABI 145 與 node-addon-api 8.3.1 相容性 → PoC 第一件事驗證
  - Intel iGPU compute feature 不支援 → 已設計 CPU fallback
- **關聯**:T0236(研究工單,commit `f6a2720`)/ PLAN-004(IN_PROGRESS)/ EXP-GPUWHIS-001(本決策產生)/ `_spec-gpu-whisper-2026-04.md`(Worker 產出技術選型報告)

---

### D074 2026-04-22 — BAT 塔台接手 Phase 1-4 派發(T0099-T0106)

- **背景**:CT-T010(2026-04-22 11:25 ✅ DONE,commit `e362ed1`)交付 BMad-Guide 主 PLAN T0098 + Phase 1-4 骨架 8 張(T0099-T0106,全 📋 TODO)。原本 CLT 對齊 6 項改良預期由 BMad-Guide 自行推進,BAT 僅作 dogfood 驗證場 #1。
- **選項**:
  - A. BAT 僅 dogfood,Phase 1-4 交還 BMad-Guide 自行派發
  - B. BAT 塔台接手 Phase 1-4 派發,透過 CT-T### DELEGATE 工單逐張推進 T0099-T0106
- **決定**:B(BAT 接手派發)
- **理由**:
  1. **consumer 感最強**:BAT 已是 CT skill 成熟 consumer,對 6 項改良(intervention_type / affects_files / spec_level_check / *evolve distillation 等)在真實工作流的痛點最清楚
  2. **double-loop 第一 loop 就地承擔**:BAT dogfood + 專案A 激進驗證的雙 loop 架構下,第一 loop 直接主導派發能壓縮回饋路徑
  3. **DELEGATE 模式已熟**:CT-T008/T009/T010 連續三張 DELEGATE 都順利交付(含 yolo 模式),pattern 已驗證
  4. **skill 改動風險可控**:T0098 骨架 sanitize 零命中,BMad-Guide worker 執行時 BAT 塔台僅做協調與驗收,不寫 CT skill 檔
- **執行模式**:
  - 每個 Phase 以 CT-T### DELEGATE 工單派發(mode 依 Phase 風險決定,Phase 1 可 yolo、Phase 2 建議 non-yolo)
  - 派發順序:Phase 1(audit,低風險熱身)→ Phase 2(template 最高衝擊)→ Phase 3(*evolve 輸出拆分)→ Phase 4(doctrine 文件)
  - BAT 本地 dogfood 在每個 Phase 交付後立即做(`*sync` / `*evolve --status` / 新工單驗證 template v3.7 等)
- **時機**:等 T0229(PLAN-027 research)回報後評估 — 若 T0229 結論明確且 PLAN-027 Phase 1 派發不急,可先啟 CT v4.4 Phase 1;若 PLAN-027 需立即推進,CT v4.4 Phase 1 延後
- **關聯**:PLAN-028(主 PLAN 接手登記)/ CT-T010(骨架交付)/ T0098(BMad-Guide meta-PLAN)/ L089(跨專案 DELEGATE 降格模式)
- **⚠️ 過時標記**(2026-04-22 20:50,session 20):對端塔台 BMad-Guide 在 2026-04-22 下午(12:10-22:40)自主執行並完成 Phase 1-2 全部(T0099-T0104 + T0108 bootstrap 順修),push 到 `origin/dev-main`。BAT 未派發任何 CT-T### DELEGATE 工單。**本決策實際未執行**。Phase 3-4(T0105/T0106)處理方式需重新決策(由對端續作 / BAT 派發 / 暫緩),候選為 D075。

---

### D073 2026-04-20 — PLAN-022 結案,Step 3 TOFU fallback 不做

- **背景**:PLAN-022 dispatcher fingerprint pinning,Step 1+2(T0217,2026-04-19 DONE)採 fail-close 模式(`server-cert.json` 讀失敗即拒絕連線)。Step 3 TOFU fallback 原標「選用」,規格預留作延伸。第十七 session 使用者 review 時提問「做 Step 3 有什麼好處?」,塔台作利弊分析後使用者決策結案。
- **選項**:
  - A. Step 3 不做,PLAN-022 直接 DONE
  - B. 補 Step 3(20-30 min 工單,新增 `~/.bat-dispatcher/trust.json` TOFU 機制)
- **決定**:A(Step 3 不做,結案)
- **理由**:
  1. **安全性倒退**:TOFU 第一次若被惡意 process 騙就永久失陷;fail-close 每次讀最新 cert,無此風險
  2. **好處不成立**:TOFU 主要好處(dispatcher 脫離 BAT 路徑假設、跨機器使用)在當前威脅模型**不存在** — dispatcher 限 localhost、BAT 是 Electron 單機 app、無 portable 模式計畫
  3. **與實作決策衝突**:T0217 當時**刻意**選 fail-close(「BAT app 已啟動」是隱含前提,cert 讀失敗 = BAT 未準備好 = 應拒絕),回退等於推翻刻意決策
  4. **對稱性 ≠ 正確**:PLAN-018 server 端 TOFU 面對任意 client,dispatcher 面對本機 cert,威脅模型不同,不需機械式對稱
  5. **錯誤訊息已足夠**:fail-close 的 mismatch log 含「Possible MITM or BAT app reinstalled」,使用者可自行清 cache
- **未來重啟條件**(任一觸發才重新評估 Step 3):
  - BAT 要支援 portable 模式或非標準安裝路徑
  - Dispatcher 要跨機器使用
  - 收到 UX 回報「cert mismatch 訊息看不懂」
- **相關**:PLAN-022、T0217(Step 1+2 實作)、PLAN-018 T0182(server TOFU 基建)、BUG-046(延伸議題)

---

### D072 2026-04-20 — archive_days 7 → 2(歸檔門檻)

- **背景**:第十六 session `*sync` 後熱區累積 73 T + 17 BUG + 19 PLAN。`*archive` 在 7 天門檻下 0 候選(所有 T 工單都在 7 天內被後續 session meta commit 動到,計時重置)。
- **選項**:
  - A. `archive_days: 3` — 嚴格 `>3` 邏輯下仍 0 候選(最老 T 工單剛好 3 天)
  - B. `archive_days: 2` — `>2` 邏輯抓到 ≥3 天前,實測 4 張候選
  - C. 維持 7 天,熱區自然成長
- **決定**:B(`archive_days: 2`)
- **理由**:
  1. 對齊第十五 session 歷史決策「歸檔閾值降為 2 日」
  2. 本專案 session 密度高(3 天 ≈ 3-4 sessions),2 天冷卻足夠
  3. 比先前 dogfood `archive_days: 1` 保守,避免 L066「過度頻繁觸發」
  4. 歸檔只是 `git mv`,可用 `*archive --restore` 取回
- **執行結果**:歸檔 T0149/T0150/T0154/BUG-034 共 4 張(commit `cd3b0d8`)
- **相關**:`_tower-config.yaml`、L066、`*archive`、`*sync`

---

### D071 2026-04-20 — PLAN-021 dev smoke 驗收暫緩,UX 另案

- **背景**:第十六 session 收尾後,塔台列出 T0218+T0219 合併 dev smoke 9 情境清單,使用者審視後識別「UX 體驗設計不佳」。
- **選項**:
  - A. 硬著跑 9 情境,驗收通過閉環 PLAN-021
  - B. 暫緩 smoke,另開議題討論 UX refactor
  - C. 直接 drop PLAN-021
- **決定**:B(暫緩 + UX 另案)
- **理由**:
  1. T0218/T0219 code 本身正確(已 commit),功能無錯
  2. 使用者識別整體 Settings Remote 區塊 UX 有改進空間(非單一按鈕問題)
  3. smoke 通過不等於 UX 好,硬驗反而掩蓋問題
- **後續**:PLAN-021 保留 code 不退版,UX 另案待使用者開議題時討論
- **相關**:PLAN-021、T0218、T0219

---

### D070 2026-04-19 — T0222 附加發現處理:BUG-052 獨立 + T0223 合併修

- **背景**:T0222(BUG-051 研究工單)完成時,Worker 從 `install.cjs` 挖出額外發現:`main.ts:1882` + `tests/claude-code-path.test.ts` 假設 POSIX 檔名為 `claude`(實際跨平台永遠叫 `claude.exe`),影響非 Windows 平台。
- **選項**:
  - A. 併入 BUG-051/T0223,不獨立編號
  - B. 開 BUG-052 獨立追蹤 + T0223 一次修兩處
  - C. 開 BUG-052 + 獨立 T0224 修
- **決定**:B(獨立編號 + 合併修)
- **理由**:
  1. 同族 root cause(對 CLI binary 的錯誤假設)→ 適合同工單修
  2. Min-diff 仍成立(~2 行 code + 2 行 test),不需拆工單
  3. 獨立編號便於追蹤(macOS/Linux 樣本出現時好找)
  4. 沿用 T0221 Worker 品質亮點「同 pattern 一併修」
- **執行結果**:T0223 4 min 完成,commit `42b45b0`,BUG-051 + BUG-052 雙 CLOSED(smoke pass)
- **相關**:BUG-052、T0222、T0223

---

### D069 2026-04-19 — BUG-051 與 BUG-047 關係:不算翻案,獨立編號

- **背景**:BUG-047 驗收通過後,使用者立即回報新 bug(claude-cli preset 終端 `node <claude.exe>` 失敗)。需判定是翻案還是新 bug。
- **選項**:
  - A. 翻案 BUG-047 → FIXING(認定 T0221 修復不完整)
  - B. 獨立開 BUG-051(BUG-047 root 已修,此為 downstream consumer bug)
- **決定**:B(獨立追蹤)
- **理由**:
  1. BUG-047 的 SDK 側 resolve path 已由 T0221 完全修正(smoke pass 驗證)
  2. 新 bug 是 T0221 修改回傳值後,consumer(`WorkspaceView.tsx:684`)未跟著調整的 downstream 影響
  3. 兩個 bug 現象、影響範圍、修復位置不同
  4. 獨立編號便於後續樣本追蹤和歸檔
- **相關**:BUG-047、BUG-051

---

### D068 2026-04-19 — BUG-051 範圍判定:派研究工單深查

- **背景**:BUG-051 根因看似明確(`WorkspaceView.tsx:684` 無條件 prefix `node`),但使用者補充「要考慮相容 dev server 執行」,牽動 dev/packaged × Windows/POSIX 4 象限驗證。
- **選項**(需求對齊 Q2):
  - A. Min-diff 直修(去 `'node'` prefix 1 行)
  - B. 加 unit test regression guard
  - C. 深查 — 派研究工單調查所有 consumer 假設 + dev/packaged 相容性
- **決定**:C(派研究工單 T0222)
- **理由**:
  1. 使用者特別提「相容 dev server」→ 不只是 packaged 問題
  2. 避免 BUG-047 重演「只驗某面沒驗另一面」
  3. 研究成本低(Worker 壓縮比通常 5-10x),翻車風險高於直修
- **執行結果**:T0222 3 min 完成,壓縮 ~7-13x(研究工單破紀錄),交付 4 象限驗證結論 + α 方案推薦
- **相關**:BUG-051、T0222

---

### D067 2026-04-19 — T0221 YOLO 回報策略:code-only 必回 PARTIAL 觸發斷點 A

- **背景**:T0221(BUG-047 code 修復)在 YOLO 模式派發,Worker 完成 code + build + unit test 後,需決定是否直接回報 DONE 或 PARTIAL。
- **選項**:
  - A. DONE(Worker 完成所有可做的事)
  - B. PARTIAL(code-only 不含 packaged smoke,需使用者驗機)
- **決定**:B(PARTIAL 觸發斷點 A)
- **理由**:
  1. Packaged smoke 屬於「需人介入」類型,YOLO 無法自動化
  2. 若直接 DONE,使用者必須手動翻 PARTIAL,多一步
  3. 原則明確化:「可自動化 → YOLO / 需人介入 → 斷點」
- **通用化**:此決策作為本專案 YOLO + 驗收類工單的回報約定,後續 T0223 沿用
- **相關**:T0221、T0223

---

### D066 2026-04-19 — BUG-047 驗收失敗處理策略:派研究工單而非直接修復

- **背景**:BUG-047 T0198/T0199 修復後 Rico 驗證仍失敗(v0.2.2-pre.1),後 Gower 裝 v0.2.2-pre.1 也複現同路徑錯誤,樣本 2 人跨版本 100% 阻擋。嚴重度升 High。
- **選項**(需求對齊 Q2):
  - A. 退 FIXING + 派研究工單 T0220 調查根因
  - B. 直接派修復工單(根據 Rico 錯誤訊息推測 asar resolve 問題)
  - C. 翻案 T0197 + T0198/T0199,重新評估
- **決定**:A(先研究)
- **理由**:
  1. T0197/T0198/T0199 已嘗試多種修復都未生效,直接再修風險高
  2. 根因不明時先研究,避免重蹈 T0198「驗證缺口」覆轍(當時只驗檔案位置沒跑 packaged smoke)
  3. 研究成本低(Worker 壓縮 5-10x),收斂後再派修復工單風險更低
- **執行結果**:T0220 6 min 完成(壓縮 ~3x),定位根因為 `resolveClaudeCodePath()` `require.resolve('cli.js')` 在 v2.1.113 拋 MODULE_NOT_FOUND → 回空字串
- **相關**:BUG-047、T0220、T0221

---

### D065 2026-04-19 — PLAN-021 UX 簡化:移除 Test 按鈕(error path 已提供回饋),新增停止前連線數警告

- **背景**:T0218 Worker 忠實照 PLAN-021 原始設計實作 Step 1+2+3+4(含 Test 按鈕 + OS-specific 佔用查詢)。使用者跑 7 情境 smoke 中,提出 UX 觀察:
  1. **啟動伺服器時若 port 衝突會直接 EACCES 報錯**(Image #5:port 80 `listen EACCES: permission denied`)→ 使用者已獲清楚回饋
  2. **熱切換失敗時 Worker 實作有 rollback + 錯誤訊息** → 同樣提供清楚回饋
  3. **兩個 error path 加總 = Test 按鈕功能** → Test 按鈕成為**多餘的中介步驟**,增加使用者心智負擔(要先 Test 再 Save,雙重操作)
  4. **真正 UX 缺口**:停止伺服器時無警告,可能誤斷他人活躍連線(現況一點就停)
- **選項**:
  - [A] 保留 Test 按鈕 + 現有 UI,不改
  - [B] 移除 Test 按鈕 + 相關邏輯,改加停止前警告 dialog
  - [C] 兩者都做:保留 Test 但加停止警告(UI 越來越複雜)
- **決定**:[B] 簡化設計
- **理由**:
  1. **KISS**:error path 已存在時,獨立「測試 helper」反增摩擦
  2. **使用者真實痛點**:未警告的停止比未預驗的 port 更有風險(前者可能影響他人,後者只會在 local 報錯)
  3. **減少維護**:移除 IPC handler `settings:test-port` + OS-specific 查詢(Windows netstat / Unix lsof)+ 相關 22 i18n key 的一部分
  4. **對齊 error UX**:使用者習慣「試了再說」而非「先 simulate」(PLAN-021 原設計受 Nmap 等網路工具習慣影響,但 app settings 不是網工場景)
- **落地範圍**(T0219 執行):
  - **移除**:
    - UI Test 按鈕 + 相關 state(`portTestResult`, `portTesting`)
    - IPC handler `settings:test-port`
    - `electron/remote/port-test.ts` 的 OS-specific 查詢邏輯(保留 `testPort` helper 供未來他用,或整個刪除)
    - preload `window.electronAPI.settings.testPort` bridge
    - i18n:`remotePortTest`, `remotePortTesting`, `remotePortTestHint`, `remotePortAvailable`, `remotePortInUse`, `remotePortInUseBy`, `remotePortPermissionDenied`, `remotePortInvalid`, `remotePortUnknown`(9 key × 3 locales = 27 行)
  - **新增**:
    - 停止伺服器 confirm dialog:「即將停止伺服器,將中斷 N 個活躍連線。確定?」(N = `serverStatus.clients.length`)
    - N=0 時可選:不彈 dialog 直接停(UX 順)或仍彈 dialog 統一行為(安全)
  - **保留**:
    - Port editor + Save & hot-switch + Reset + URL preview
    - 改 port 時的 active conn 警告(已在)
    - hot-switch rollback + restartError 回傳
- **UX 原則衍生**:「error path 已提供回饋時,勿另加『測試 helper』中介步驟」— 候選 Global GP,待 T0219 完成後 `*evolve` 評估
- **影響**:
  - PLAN-021 狀態:IDEA → IN_PROGRESS(Step 1+2+4 DONE T0218,Step 3 UI 簡化由 T0219 接手)
  - T0218 狀態:PARTIAL → DONE(技術實作 + backend + 核心 smoke 6/7 通過,UX 改動為後續迭代)
  - T0219 待開:UX 簡化工單
- **相關工單**:PLAN-021 / T0218 / T0219(待開)/ T0215(T0217 smoke 回歸驗證 backend 不破壞)

---

### D064 2026-04-19 — BUG-050 階段 2 暫緩:2 樣本 + 真實 YOLO 工作流驗證零異常,保持 VERIFY 待真實問題觸發

- **背景**:D063 決議 VERIFY + 觀察 3-5 張 YOLO log 再決策階段 2 啟動 vs CLOSED。第十三 session 派了 T0216(PLAN-023 階段 3)與 T0217(PLAN-022 Step 1+2)作為 YOLO 樣本 #1/#2。兩張全 clean,writeResp payload 結構 100% 符合預期(`hasError:false` + `payload.ok:true` + `reason:"queued"`),未觀察到 BUG-050 描述的 silent drop 或異常。T0217 更進一步:真實 YOLO 工作流 end-to-end 驗證(Worker smoke 1 訊息 + auto-submit 都直接到塔台 terminal,非剪貼簿 fallback)。
- **證據質量**:
  - 樣本 #1(T0216):Worker 開工 + auto-submit 全鏈路 OK,Step 0 banner 正常,CT_MODE=yolo env 注入正確
  - 樣本 #2(T0217):更強驗證 — Worker 主動改 bat-notify.mjs + 跑 smoke match 情境 + auto-submit,三次經過新 notify 鏈路都正常
  - 樣本量:2 張(下限目標 3 張未達)但**證據質量 > 數量**
  - 0 個異常跡象,與樣本數的距離不具實質價值
- **選項**:
  - [A] 再派 1-2 張樣本湊滿下限 3(保守)
  - [B] 階段 2 暫緩,保持 VERIFY,階段 2 待真實問題觸發再啟動
  - [C] 直接 CLOSED + 清理 `[T0215-DEBUG-REMOVE]` debug log + PLAN-024 階段 2 ABANDONED(激進)
- **決定**:[B] 階段 2 暫緩
- **理由**:
  1. **證據質量支持**:2 樣本全 clean + 真實工作流 end-to-end 通過,比單純 smoke 更有價值
  2. **避免「解決不存在的問題」**:階段 2 目標是修 refork race(#2/#6/#7),但這些在真實工作流中未觸發 — 推測性修改有引入新問題風險(階段 1 本身就是先修後觀察的實證)
  3. **GP058 區分**:GP058 警告「偶發症狀複測正常不等於根因消除」,但本案是**完全無症狀**(連偶發都沒有),不適用該警告情境
  4. **保留階段 2 選擇權**:PLAN-024 階段 2 仍 PLANNED,未來若觀察到 refork race 真實觸發(如 BAT 重啟場景、多 Worker 並發)可立即啟動,不是 ABANDONED
  5. **debug log 保留**:`[T0215-DEBUG-REMOVE]` 3 處標記暫不清理,可繼續觀察自然累積的 YOLO log 樣本
- **後續觀察策略**:
  - BUG-050 保持 🧪 VERIFY 狀態
  - 每張 YOLO 派發自然累積樣本(免專門派測試工單)
  - 若觀察到異常 payload(非 `{ok:true,reason:"queued"}`)→ 立即轉 FIXING + 啟動 PLAN-024 階段 2
  - 若連續 10+ 張 YOLO 樣本全 clean → 下次決策點考慮 CLOSED + 清理 debug log
- **相關工單**:BUG-050(VERIFY 保持)/ PLAN-024 階段 2(PLANNED 保持)/ T0216 / T0217 / D063

---

### D063 2026-04-19 — BUG-050 階段 1 smoke 通過,FIXING → VERIFY,觀察 YOLO log 再決策階段 2

- **背景**:T0215 交付 BUG-050 Option C 階段 1 方案 A(`38725e9`)— `writeWithResult` 新 API + `bat-notify.mjs` 嚴格 `ok === false` 阻斷,覆蓋 9 個 silent drop 點中的 6 個(#1/#3/#4/#5/#8/#9)。第十三 session 啟動後使用者重啟 BAT 載入新 server,跑 smoke 場景 1(正常 target,預期 ok:true)+ 場景 2(不存在 target,預期 ok:false + 顯性錯誤)。
- **smoke 結果**:場景 1 `exit=0` + `{ok:true,reason:"queued"}` + 訊息到達;場景 2 `exit=1` + `{ok:false,reason:"pty-not-found"}` + stderr `Error: PTY write failed: pty-not-found`。兩場景 100% 符合 T0215 預期。
- **F-13 三選項**:
  - [A] VERIFY + 觀察 YOLO log(3-5 張樣本)
  - [B] 直接 CLOSED
  - [C] 派 AI 驗收工單
- **決定**:[A] VERIFY + 觀察 YOLO log
- **理由**:
  1. 階段 1 方案 A 僅覆蓋 6/9 silent drop 點,refork race(#2/#6/#7)要階段 2 correlation id
  2. smoke 只驗 happy path + 1 error path,不等於真實 YOLO 工作流全覆蓋
  3. 第十二 session 快照明確指引「連續觀察 3-5 張 YOLO log 樣本」— 這是評估階段 2 必要性的關鍵資料
  4. PLAN-024 雙階段包裹已 PLANNED,VERIFY 期間累積的 log 樣本直接餵給階段 2 決策
- **觀察目標**(3-5 張 YOLO log):
  - `[T0215-DEBUG-REMOVE]` 出現頻率與 payload 結構穩定性
  - 是否有 `ok:false` 以外的非預期 reason
  - refork race(#2/#6/#7)是否在真實 YOLO 流程中觸發
  - 若階段 1 已足夠 → CLOSED + 清理 debug log;若 refork race 出現 → 啟動階段 2
- **下一步**:
  - 階段 1 留 VERIFY,累積 YOLO 派發樣本
  - `[T0215-DEBUG-REMOVE]` 3 處標記供未來 grep 清理(CLOSED 或 階段 2 完成時)
  - PLAN-024 階段 2(correlation id)等觀察期結論
- **相關工單**:BUG-050 / T0214(research)/ T0215(fix 方案 A)/ PLAN-024

---

### D062 2026-04-18 — Worker 無狀態原則：runtime context 由塔台派單 explicit 傳遞

- **背景**：T0175 研究 DONE 後，使用者觀察 Worker 回報「auto-session 未設 → 預設 ask → 跳過 Step 8.5」，但塔台 project config 明明是 `auto-session: yolo`。實證 Worker 側沒讀到或讀錯 config 檔，yolo 自動化鏈路斷半（Worker 走 Step 11 剪貼簿而非 Step 8.5 自動 submit）。
- **問題**：BUG-040（workspace 錯派）和 yolo gap 是**同一設計缺失的兩個症狀** — Worker 依賴「共享狀態」（config 檔 / activeWorkspaceId UI 焦點）推斷 runtime context。
- **選項**：
  - [A] Worker 讀 config 檔（現狀延續）
  - [B] Worker 讀環境變數，由塔台派發時注入
  - [C] Worker 讀 flag，由塔台派發時傳遞
  - [D] 混合：flag + env
- **決定**：[D] Worker 無狀態，所有 runtime context（`workspaceId`、`yolo` 旗標、其他 mode flags）由塔台派單當下透過 flag/env **explicit** 傳遞
- **理由**：
  1. **防止中途設定異動**：工單派發後使用者改 config 不應影響執行中 Worker
  2. **單因子除錯**：失敗時只需檢查「派單當下傳了什麼」，不用追跨 session 共享狀態
  3. **與 T0173 方案 A 同哲學**：`--workspace` flag 就是此原則的第一個應用實例
  4. **race condition 防護**：多塔台/多 Worker 平行時不會互相污染 config
  5. **跨環境一致**：本機 vs Remote Desktop vs BAT 內部終端皆同行為
- **落地規則**：
  - Worker skill（`/ct-exec`）**不應讀** `_tower-config.yaml` 或 `~/.claude/control-tower-config.yaml`
  - Worker 判斷 mode 一律走「塔台派單時注入的 env 或 flag」
  - 塔台派發指令模板（`SKILL.md` + `auto-session.md`）需補上所有 mode flags
  - BAT 端（`bat-terminal.mjs`）負責接收 flag → 注入 env 給 Worker PTY
- **影響範圍**：
  - 現有：BUG-040 `--workspace` flag（Phase 1 修復中）
  - 新增：BUG-041 yolo flag 傳遞（Phase 2）
  - 未來：任何新 mode / 新 runtime context 都遵循此原則
- **反模式警告**：Worker 絕不讀 `_tower-config.yaml`。若未來發現 Worker 需要「全局偏好」（非 runtime context），另開 PLAN 討論是否該提升為 explicit 傳遞。
- **相關工單**：BUG-040 / BUG-041（待開）/ T0175 / T0176（Phase 1）/ CT-T004（Phase 1 DELEGATE）/ T0179+（Phase 2）
- **衍生學習候選**（L068）：「Worker 無狀態」為 CT 通用設計原則，值得晉升 Global playbook

---

### D061 2026-04-18 — CT-T002 閉環 + v4.2.0 tag，對方塔台已吸收 yolo 功能

- **背景**：CT-T002 Worker 首次執行完成技術實作 commit `bfc4ba5` 後回報 PARTIAL（remote 是 Forgejo 非 GitHub，無法 `gh pr create`）。塔台 Renew #1 指示沿用 CT-T001 先例 push + snapshot + CHANGELOG 流程。Worker 第二次執行時 F-11 範圍守衛觸發：前提失真，對方塔台（BMad-Guide）已透過 CP-T0094/CP-T0095 自行吸收 yolo 功能（`def3053` 重做 + `d65f451` CHANGELOG + `3a93952` source sync + ZIP 已產出）。
- **選項**：
  - [A] 直接 DONE，不補 tag
  - [B] 打 v4.2.0 tag + DONE
  - [C] 比對 `def3053` vs `bfc4ba5` 等價性
  - [D] 保持 PARTIAL，開新 CP-T00XX 只處理 tag
- **決定**：[B] 補打 v4.2.0 tag + DONE
- **理由**：極小動作（單 tag）閉環乾淨；未來引用 v4.2.0 可精準回溯；不重複對方塔台已做的事
- **執行結果**：Worker Renew #2 執行 `git tag -a v4.2.0 -m "feat: yolo autonomous mode (PLAN-020)" d65f451 && git push origin v4.2.0` 成功（15:09:10 UTC+8）
- **附帶收穫**：
  - Worker F-11 範圍守衛行為正確（避免衝突操作，紀錄學習候選）
  - 對方塔台 source sync 已完成（T0172 驗證 [OK]），本機 `~/.claude/skills/` yolo 可用
  - 對方塔台實作比 Worker 草稿更嚴謹（yolo 硬鉤子失敗**不跑 Step 11**，避免狀態重複）
- **跨專案學習候選**：「長時差異 DELEGATE 的 Renew 前置驗證」值得晉升為 playbook
- **相關工單**：CT-T002 / T0172 / PLAN-020

---

### D060 2026-04-18 — yolo 下一張工單資訊來源採 Q2.A（研究工單 D 區段）

- **背景**：T0167 研究工單回報區針對「塔台如何判斷下一張工單」列出 Q2 A/B/C 三選項，Worker 刻意不推薦、要求塔台出面決策。工單 3（塔台 skill 自主決策規格）與工單 4（上游 COORDINATED）卡在此決策。
- **選項**：
  - [A] 研究工單 D 區段：重用現有機制，零模板升級
  - [B] PLAN 檔案結構化工單清單：語意最正確，模板升級成本高
  - [C] `_yolo-queue.md` 專用檔：獨立乾淨，但與 PLAN/工單資訊重複
- **決定**：[A] 研究工單 D 區段
- **理由**：
  1. 立即可用，零模板升級（B 需回填 PLAN-018/020 等所有現有 PLAN）
  2. T0164/T0166/T0167 三張研究工單都穩定產出結構化 D 區段 — Worker 產能已驗證
  3. 失敗可回退 ask 模式（斷點 A 觸發即可）
  4. B 可作為未來演進（非本 PLAN 範圍，需另開 PLAN）
- **影響**：
  - 工單 3 規格收斂為單一分支（A 分支），可立即開工（依賴工單 2 完成）
  - 工單 4 上游 COORDINATED 可啟動
  - 未來若要升級到 B，需新開 PLAN 處理模板遷移
- **相關工單**：PLAN-020 / T0167 / 未派工單 3 / 未派工單 4

---

### D059 2026-04-18 — PLAN-020 yolo 模式插隊啟動，PLAN-018 冷凍作為驗證場景

- **背景**：使用者在 PLAN-018 對齊 Q1/Q2 中途（T0166 研究 DONE 後）觀察 `auto_session: on` 反向通道（Worker→塔台）未觸發，提出 yolo 模式提案：Worker 自動送出 + 塔台自主決策多工單 PLAN。此為跨 skill + BAT code 的架構改善，直接影響 PLAN-018 剩下 4 張實作工單的效率。
- **對齊結果**（Q1-Q3）：
  - Q1.B：開 PLAN-020 + 立刻派研究工單（T0167）
  - Q2.B：skill + BAT 同時改（整合 bat-notify 基礎設施）
  - Q3.C：PLAN-018 冷凍，yolo 完成後用 PLAN-018 剩下 4 張工單作驗證
- **決定**：
  1. 建立 PLAN-020（🔴 High）
  2. 立刻派 T0167 研究工單（~1.5-2h）
  3. PLAN-018 進入 PAUSED 狀態，保留 T0166 研究產出完整性
  4. yolo 完成後 `*resume` PLAN-018 → 用 yolo 跑剩下 4 張驗收
- **理由**：yolo 的投資報酬率高（後續每張工單省 1 輪人工介入），且 PLAN-018 正好是 4 張工單的驗證場景（dogfood）
- **關鍵技術發現**（見 T0167 研究結論）：
  - env 注入鏈路完整（本 session 實測 `BAT_TOWER_TERMINAL_ID=c8a43b...` 有值）
  - 真正根因是 ct-exec Step 8.5 被標為「可選/靜默跳過」+ `pty:write` 不加 `\r` + Step 11 剪貼簿蓋過 Step 8.5
- **跨專案邊界**：BAT code 改動走本專案，skill 改動需先本地草稿 → 上游 `CT-T###` COORDINATED 工單，遵循 PLAN-011 先例
- **相關工單**：PLAN-020 / T0167 / PLAN-018（冷凍）

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
    - ⚠️ **2026-10-13 更正（T0473 實測）**：`npm rebuild better-sqlite3` 依 prebuild-install 預設 `runtime=node` 產出 **Node ABI 137**，不是 Electron ABI 145；當時「無 mismatch」實因 better-sqlite3 不在任何執行路徑上（repo 無程式 import）。postinstall 已改為非 CI 時跑 `@electron/rebuild -f -w better-sqlite3`（`eaa8cca`）
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

### D139 2026-10-13 — 已知問題一次開單（T0484-T0493），分波並行，整批完成並聯合複驗後才發 v0.6.0-pre.5

- **背景**：使用者 23:11 指示「Haiku 5.5 成本低估也開單修，還有發現甚麼問題請一次開單，不要每次改一個發布一次」
- **決定**（範圍與分組由塔台依 breakpoint C 決定）：
  - 納入（缺陷 / 技術債）：T0484 Claude 面板成本分段計價 + `setModel()` 5 系列上限；T0485 提早日誌 / early crash handler / macOS PATH 修正提前；T0486 tsc 基線清零（含 BUG-061）+ typecheck scripts；T0487 Actions 原生 Node 24 + 釘 ubuntu runner；T0488 BUG-115；T0489 wizard jumpToStep rollback（T0309 TODO）；T0490 BUG-114 研究；T0491 remote 失敗對話框三語化 + detached 視窗終端持久化（BUG-113 已知限制）；T0492 移除未使用 better-sqlite3；T0493 文件收尾 + `.gitattributes`（採 T0454 建議，renormalize 須 0 檔才 commit）
  - fsevents：比照 electron-winstaller **不列入** `allowScripts`（寫 `false` 會改變 npm 11 / CI 行為），由 T0493 記入 CLAUDE.md
  - 分波：第一波 T0484 / T0485 / T0486 / T0487 / T0490（檔案不重疊）；名額空出後 T0488 / T0489；第二波 T0491（依 T0485 + T0486，皆改 main / preload）、T0492（依 T0486 + T0487 + T0488，皆改 package.json / workflows / scripts）；最後 T0493
  - 並行規則：`git commit --only` 本單檔案；除 T0492 / T0493 外不改 CLAUDE.md（建議文字寫回報區由 T0493 套用）；tsc 以檔案為單位不增加
  - 發版：T0493 後塔台聯合複驗全綠才提 pre.5（仍需使用者確認發版）
  - 追加（23:23）：T0487 發現 server-bundle darwin-arm64 用的 `macos-14` 進入淘汰 brownout（runner-images#13518，UTC 10/16、19、23、26、29、30 14:00–24:00 job 必失敗，11/02 停用）→ 開 **T0494**（改 `macos-15`、維持 darwin server bundle 最低 macOS），T0492 / T0493 改為依賴 T0494；追加（23:25）：T0486 清零 src/ tsc 並建議 CI gate → 開 **T0495**（CI `typecheck` 硬 gate）與 **T0496**（electron 端 77 → 0 + `typecheck:electron` gate）；workflows 串行 T0494 → T0495 → T0492 → T0496；追加（23:26）：T0490 確定 BUG-114 根因（`bat-terminal.mjs` 不比對 frame id，廣播誤判成功並提前退出）→ 開 **T0497**（P1，修法 A）；ct-exec 中途停住不通知屬 skill 層（另案回饋）；追加（10-14 01:00）：T0508 發現 → **T0509**（profile index 讀改寫未序列化，並行 create EPERM / 遺失更新）；追加（10-14 00:38）：T0504 殘餘 → **T0508**（helper-connection-hygiene 計時敏感測試確定化 + detached 關窗兩邊界）；追加（10-14 00:36）：T0506 後續 → **T0507**（wizard error-mapper 寫死 zh-TW → 全面三語）；追加（10-14 00:31）：T0505 後續 → **T0506**（SshDetails 空 user 顯示 + `configure-host-invalid` mapper）；追加（10-14 00:12）：T0502 觀察 → **T0505**（P1：SSH wizard 選 alias 時 sshUser 空 → verify-ssh-auth 必失敗，依 T0496）；追加（10-14 00:01）：T0491 殘餘風險 → **T0504**（detached 視窗關閉前 flush-save，依 T0496）；追加（23:55）：T0492 範圍外 → **T0503**（sharp / @img runtime 盤點，未使用即移出 bundle / asarUnpack / optionalDependencies）；step 改名併 T0496、project-context / INSTALL_SCRIPTS_DOC / server bundle 文件併 T0493；追加（23:41）：T0500 觀察 → **T0502**（pick-container retry 卡死 + SSH 手動輸入 host）；追加（23:39）：T0499 後續 → **T0501**（bat-terminal 暫存 handler 前早到 frame）；追加（23:33）：T0497 / T0489 後續 → 開 **T0499**（bat-notify auth 拒絕診斷 + 測試日誌隔離）、**T0500**（wizard 跳回後真的可編輯）；追加（23:27）：T0484 殘餘風險 4 / 6 → 開 **T0498**（Cache History 單次呼叫列改用 per-call 資料 + 查明 grandTotal 是否重複加總，依 T0496）；pre.5 dispatch 須避開 brownout 時段（台北 22:00–隔日 08:00 該幾日）
- **不納入**：功能性工作（snippet「agent 提案 → 一鍵套用」、PLAN-038、BUG-084 Phase 2、PLAN-035 Phase 2）；Haiku 5.5 CLI 版本門檻（無證據）；Vite `hashbangRE` 上游回報（外部）；實機驗收項目；D094 門檻復議 / archive
- **相關**：T0483 / T0479 / T0464 / BUG-113 / BUG-114 / BUG-115 / BUG-061 / T0454 / L146

---

### D148 2026-10-16 — PLAN-044 範圍改定：claude 信任 CLI 內建自動繼續、BAT 只提示（休眠後補 Enter）；Codex 由 BAT 自動輸入；預設關；塔台以 `--set-role tower --mode <m>` 宣告模式（pre.6 前擴充 T0562 契約）

- **背景**：T0564 研究發現 claude CLI ≥ 2.1.234 內建 `autoContinueAtUsageLimit`（預設開；重置後 30–90 s 自動續行，> 24 h 不排、連續上限 2 次）；使用者同事亦口頭確認「只要 session 沒關，用量恢復後 claude 會自行繼續，只有 claude 支援」。BAT 再送「繼續」會雙送。Codex 無此功能
- **決定**（使用者 2026-10-16 選定，塔台記錄於 15:05:50）：
  - **D1 claude 分頁**：信任 CLI；BAT 只辨識限制並提示（縮圖 / toast：何時自動繼續、或週限制不會自動繼續）；唯一補位為電腦休眠跨過重置後 CLI 停在 `Press enter to continue` 時只送 Enter
  - **D2 claude 內建不可用**（API key、舊 CLI、設定 / 政策關閉）：不送，只提示
  - **D3 Settings**：預設關；文字預設「繼續」；延遲預設 2 分鐘
  - **Codex 分頁**：完整 PLAN-044（辨識 → 重置 + 延遲 → 再確認 → 文字 + Enter）；週限制只提示
  - **塔台 yolo 宣告**：擴充 T0562 契約為 `--set-role tower [--mode yolo|ask|off|on]`（T0565），與 T0562 同版（`0.6.1-pre.6`）發佈；CT-T013 同步帶 `--mode`
- **不採用**：claude 也送「繼續」（雙送）；claude `StopFailure` hook 注入（D1 選 A）；預設開
- **相關**：PLAN-044 / T0564 / T0565 / T0566 / T0562 / CT-T013 / D147 / T0551

---

### D149 2026-10-17 — PLAN-047 採路線 [A]：先 A1（本機範圍權杖）+ A2（跨重開持久化，同版發佈）+ T（測試解耦），MCP 走 stdio shim、合併走工單

- **背景**：外部提案「BAT MCP Server 與 Worktree 合併」；T0574 研究證實本機 PTY 持有可呼叫所有 handler 的全權 server token，範圍權杖程式碼已在共用 `RemoteServer` 只差接線；stdio shim 原型實測可行
- **決定**（使用者 2026-10-17 選 [A]，塔台記錄於 2026-10-17 19:07:08）：
  - 階段：A1 + A2（同版發佈）→ M1（`bat-mcp.mjs` 手寫 dual-era stdio shim + 唯讀 channel）→ M1b（blocked）；T / W1 / CT-T014 / CT-T015 並行；M2 / M3 待 M1 使用後再議。不做 bat-daemon 分離、不開 Streamable HTTP 埠
  - 第一批：T0575（A1）、T0576（A2，依賴 T0575）、T0577（T）
  - A1 細節（使用者授權塔台依研究建議預設）：本機 tower 角色允許 raw command（`terminal:create-with-command`，限制同 create-agent-command），headless 暫不動；本機每 tower 存活子 PTY 上限沿用 8、不加 Settings；升級當下存活的舊分頁維持全權 token 至重開，不輪替 server token
- **不採用**：提案原樣（HTTP + daemon 分離 + BAT 合併引擎）；只做 CLI 不做 MCP（[C]）
- **相關**：PLAN-047 / T0574 / T0575 / T0576 / T0577 / PLAN-036 K / D134

---

### D150 2026-10-17 — 合併工單由 AI 判斷執行：機械合併 / 衝突解決 / 等價移植三種模式，main 一律 `--ff-only`

- **背景**：使用者 2026-10-17 指示合併改由塔台派合併工單（PLAN-047 §三之一），並問合併工單可否由 AI 判斷做衝突解決或等價移植，而非單純合併
- **決定**（塔台 2026-10-17 19:07:08 記錄，細節待 CT-T015 合併工單模板定稿）：
  - 合併工單可做三種模式：① 機械合併（無衝突，符合 T0574 R5 五條判準時塔台可直接做）② 衝突解決（AI 在整合 worktree 解衝突）③ 等價移植（分支過舊或結構性衝突時，以原工單驗收條件為規格，在目前 main 上重新實作其意圖）
  - 共同護欄：只在整合 worktree 工作；main 只 `--ff-only`；不 push；完整驗收（本專案 build + 兩個 typecheck + test:unit，加原工單的驗收項）；回報衝突檔與每處解法理由（②）或「原 commit / hunk → 新位置」移植對照表與等價證據（③）；範圍以原工單 `affects_files` 為準，超出須列明
  - 模式升級由塔台決定：合併工單遇到超出衝突解決範圍的情況 → 回報 PARTIAL + 建議改移植，不自行改做移植
  - 斷點 E：② 在 yolo 下驗收全綠且無範圍外檔案可自動 ff；③ 一律暫停請使用者確認後才 ff
- **相關**：PLAN-047 / T0574 / D149 / CT-T015（待開）

---

### D151 2026-10-17 — 下一版為 `v0.7.0-pre.1`（重大改版）；預覽版號不再進入兩位數 `-pre.N`

- **背景**：A1 / A2（本機 PTY 改用範圍權杖、跨重開持久化）改變所有本機分頁的 helper 權限，屬重大改版；另 `-pre.10` 以上在 GitHub Release 等字串排序列表中會排在 `pre.9` 之前 / 之後錯亂（D143 已遇過）
- **決定**（使用者 2026-10-17 指示，塔台記錄於 2026-10-17 19:58:41）：
  - T0578（BUG-146）與 T0579（headless raw command）收單後，T0575 / T0576 / T0577 / T0578 / T0579 一起發 **`v0.7.0-pre.1`**
  - 預覽版 `-pre.N` 最多到 `pre.9`；需要第十個預覽版時改升 minor / patch 線（例 `0.7.1-pre.1`），不發 `pre.10`
- **相關**：D143 / D149 / T0575 / T0576 / T0577 / T0578 / T0579

### D152 2026-10-17 — PLAN-047 第二批：M1（唯讀 channel → shim）與 W1（worktree 隔離派工 → 唯讀狀態）並行；worktree 依賴由 Worker 自己安裝

- **背景**：`v0.7.0-pre.1` 實機驗收通過（T0581、BMad-Guide T0150），A1 / A2 前置完成；使用者指示開始 M1 / W1
- **決定**（使用者 2026-10-17 選定，塔台記錄於 21:51:48）：
  - 拆 4 張：**T0582** M1-1 唯讀 channel（+ `shell` 角色、輸出遮罩）、**T0583** W1-1 worktree 隔離派工（`--isolation worktree`、repo 外位置、`ct/T####`、`CT_HOME`、`--close-worker --worktree keep|remove|archive`）先並行；**T0584** M1-2 `bat-mcp.mjs` shim + agent 注入（依賴 T0582）、**T0585** W1-2 唯讀 `worktree:terminal-status`（依賴 T0582 / T0583）之後派
  - worktree 建立後**由 Worker 依專案規則自己安裝依賴**（BAT 不執行 npm / setup 指令，保持通用）；worktree 池 / lock hash 跳過列為後續候選
  - 隔離預設關閉（Q12），只有派工明確帶 `--isolation worktree` 才建 worktree；`--close-worker` 未帶 `--worktree` = `keep`
  - 並行規則：兩張共用 `helper-capability.ts`（T0582 只改 `HELPER_CHANNEL_ROLES` 與角色判定、T0583 只改 `customEnv` 白名單）與 `CLAUDE.md`（各自新增獨立小節），commit 一律 `--only` 自己的檔，收單核對 diff
  - T0584 注入：Settings → Advanced「BAT MCP」開關**預設開**（唯讀、權杖範圍、不蓋使用者 MCP 設定）；使用者 2026-10-17 22:2x 確認「依塔台建議設計即可」
  - 附帶事實（M1b 用）：本機 Settings `agentCustomArgs` 的 claude 系列帶 `--dangerously-skip-permissions`，CT yolo Worker 以略過權限模式執行 → M1b 以 AskUserQuestion / elicitation 為主，PermissionRequest 仍需支援（他人設定不同）
- **相關**：D149 / D150 / PLAN-047 / T0574 / T0581

### D153 2026-10-18 — codex CLI × Tower / Worker 整合測試分兩層：A 層自動化 e2e（不呼叫模型）開工單，B 層實機探針只在 codex 升版 / 發版前手動跑

- **背景**：既有 codex 相關 e2e 都以 node 腳本模擬 CLI；T0586 雖啟動真 codex（`app-server`），shim 連的是不存在的 port。BUG-148（設定解析正確但實際連不上 BAT）因此漏到實機才發現；codex 版號幾天內 0.160 → 0.163，行為可能隨時改變
- **決定**（使用者 2026-10-18 00:50 選定「照預設安排」）：
  - **A 層（T0591，T0590 合併後派）**：隔離 BAT 實例 + 內嵌 codex（`app-server`、隔離 `CODEX_HOME`），以 BAT 為 codex 分頁實際產生的啟動參數連**真的** BAT：塔台 / Worker 的 `bat_whoami` role、Worker 讀塔台 `NOT_OWNER`、`--agent codex` 派工送 `$ct-exec T####` 且帶自訂參數、codex 分頁內 `bat-notify --submit` 送達；不耗 token；codex 升版時必跑。T0590 的 claude `--settings` 注入不影響 codex 也一併驗。之後 M1b-2（codex OSC 9）沿用此架構
  - **B 層（不開工單，驗收清單）**：codex 當 Worker 跑一張極小探針工單（比照 T0581 / T0587：讀工單 → 回報 → `bat-notify` 回塔台 → `--close-worker` 回收），最便宜的模型。**改由 codex 使用者協助**（使用者 2026-10-18 指示）：發版時寫進更版重點，請 codex 使用者幫忙測試並回報（規則見 `_local-rules.md`「更版重點必寫」）
- **不採用**：把真模型執行工單放進常態自動化（耗 token、結果不穩定）
- **相關**：BUG-148 / T0584 / T0586 / T0590 / PLAN-047

### D154 2026-10-18 — 塔台派出的 Worker 分頁不搶焦點；Worker 啟動確認以 claude `SessionStart` hook 為信號、helper 可選擇等待

- **背景**：BUG-151（T0598）根因是派工分頁搶走鍵盤焦點、指令寫入前的輸入接在指令前；修正後輸入不再破壞指令，但使用者接著打的字仍會進 Worker 分頁。另 helper exit 0 時指令尚未送出，塔台無法得知 Worker 是否真的啟動。
- **決定**（使用者 2026-10-18 03:13 選定建議方案）：
  - **焦點（BUG-152 / T0599）**：只有 helper 派出的分頁不搶焦點（分頁照常出現在清單與縮圖）；手動開的分頁、UI 按鈕開的分頁照舊。
  - **啟動確認（T0600）**：claude 的 `SessionStart` hook 回報「已啟動」，狀態查詢多一個欄位；helper 加 opt-in 等待參數，逾時回新的 exit code。不帶參數時行為不變；codex 等沒有信號的 agent 回「無法判定」，不得當成失敗。介面契約由 T0600 寫定後轉交 CT。
- **不採用**：「最近沒打字才切焦點」（規則複雜、行為難預測）；Settings 開關（多一個設定項）；只揭露狀態不加 helper 參數。
- **相關**：BUG-151 / T0598 / BUG-135（T0532 `addExternalTerminal` 在 active 工作區取得焦點）/ PLAN-047 / CT-T017

### D161 2026-10-18 — PLAN-049 網站 v2：以「AI 協作開發的卡關時刻 vs BAT + CT 解法」故事為首頁主軸；主標「一個塔台，指揮整隊 AI Agent」

- **背景**：W1（T0624）上線後使用者預覽（13:00 前後）：「介紹過於簡單，沒有體現出 BAT 與 CT 整合使用的優勢」，要求以進階思考設計，必要時推薦產品設計 / 前端網站設計 skill；補充「建議可以有故事性敘述，AI 協作開發常見問題 vs BAT + CT 解法」。
- **決定**（塔台起草規格 `_ct-workorders/_spec-site-v2-bat-ct-story.md`，使用者 2026-10-18 13:03 前四題皆選推薦）：
  1. 首頁改以故事為主軸：虛構 demo-shop「結帳加折扣碼」的一個早上，7 個卡關時刻（對話越聊越長 / 人肉剪貼簿 / 不知道誰在等你 / Agent 停下來問而你在開會 / 兩個 Agent 改同一檔 / 做完了嗎 / 一個月後為什麼這樣決定），每章「以前 vs BAT + CT」並標分工；接三欄對照（只用 BAT / 只用 CT / 一起用）、自動但不失控、實績、BAT 單獨也好用、下載。另開 `/control-tower` 深入頁（機場比喻、一張工單的一生）。
  2. 主標「**一個塔台，指揮整隊 AI Agent**」。
  3. 實績數據上站，四捨五入（600+ 工單 / 150+ bug 單 / 60+ 預覽版 / 5,000+ 單元測試，2026-04 起）。
  4. 預覽關卡：Worker 實作後本機預覽 + 截圖，使用者確認後塔台 push（每次 push 另取授權；D160 授權只限 W1）。
  5. 不先跑 `bmad-prfaq`；實作用 `ct-fieldguide`（從 BAT UI 抽設計語言到 `docs/design/site-design-language.md`）、`vitepress-book`、`bmad-editorial-review-prose`；不用 `bmad-ux`。
  6. 示意一律用虛構專案 `demo-shop` 與虛構工單編號 `T1024`–`T1026`（避開本 repo 真實編號，`site/` 內部編號 grep 規則不變）。
- **切分**：W2a 設計語言 + 元件 + 首頁（T0630）→ 預覽通過後 W2b（`/control-tower`、功能、FAQ、回報頁）→ W2c 遠端開發；W3 / W4 不變。
- **相關**：PLAN-049 / D159 / D160 / T0624 / T0630

### D185 2026-10-25 — T0701 收單；後續兩項開 T0702，完成後與 T0701 一起發 `v0.7.1-pre.7`

- **背景**：T0701 DONE（`e7b20593`）：總覽 R1–R5 完成；塔台複驗 `typecheck` 0 / `typecheck:electron` 0、相關 4 檔 224 測試過；BMad-Guide 真實摘要顯示正常、`9 pending` → 0。Worker 後續建議：① legacy parser 讀不到引用區塊形式的狀態（`> 狀態:✅ DONE`，BMad-Guide `T0098`）；② BAT 工單狀態列舉沒有 CT 的 `PAUSED`（CT `interrupt-protocol.md`），塔台開單用的 `status: TODO` 被判為 `INVALID`（CT 範本是 `PENDING`，屬塔台寫錯）。
- **決定**（使用者 2026-10-25 19:4x，選推薦）：T0701 先 push 到 main（不發版，`babab5d2..04937c8f`）；開 T0702 修 ①②（`PAUSED` 列為進行中；`TODO` 當 `PENDING` 的別名，塔台之後開單一律用 `PENDING`）；完成後聯合驗證，與 T0701 一起發 `v0.7.1-pre.7`，更版重點含「待驗收」清單（L174）。
- **相關**：T0701 / T0702 / D184 / L174

### D184 2026-10-25 — 受理 CT 塔台請求「指揮塔總覽顯示塔台狀態與 `*config`」（→ T0701）：混合做法，config 由 BAT 讀檔、狀態摘要由 BAT 訂格式請 CT 寫入

- **背景**：BMad-Guide 塔台協作請求 `_request-2026-10-25-bat-overview-tower-state-config`（CT D338，2026-10-25T19:15:05+0800）：「塔台 › 指揮塔 › 總覽」只認 `_ct-workorders/sprint-status.yaml`，沒有就只顯示「未找到 sprint-status.yaml」（`src/components/SprintDashboard.tsx`）；CT v6 起該檔只在主方法論是 bmad 時才有。需求 R1 塔台最新狀態、R2 `*config` 生效值與來源層、R3 沒有 sprint-status 不擋；附帶觀察：BAT 計數 `9 pending`，CT 熱區沒有 `status: PENDING`，疑似把無 frontmatter `status` 的報告檔算進 pending。塔台查證各專案 `_tower-state.md` 章節標題不一致（CT 範本「立即待辦」「編號追蹤」，BAT 自己的是「待辦（依優先序）」「編號起始」），直接切 Markdown 易壞，問使用者。
- **決定**（使用者 2026-10-25 19:1x，選推薦）：受理，混合做法——
  1. **R2 / R3 / pending 計數**：BAT 直接讀檔（project `_tower-config.yaml`、global `~/.claude/control-tower-data/config.yaml` 與舊路徑、已安裝 CT 的 `tower-config.md` § 可用選項 表當預設值）。
  2. **R1**：BAT 現在顯示「最後更新」與進行中工單（frontmatter）；待辦與下一個編號改讀 **`_tower-state.md` 的 YAML frontmatter 機器可讀摘要**（`schema_kind: tower-state`、`summary_version: 1`，欄位見 T0701），格式由 BAT 訂、請 CT 塔台開單寫入；沒有摘要時不切 Markdown，只顯示提示。
- **派工**：T0701（DELEGATE，`coordination.source.workorder: _request-2026-10-25-bat-overview-tower-state-config`）。回覆稿 `_ct-workorders/_reply-2026-10-25-bat-overview-tower-state-config.md`（含摘要格式需求）。
- **相關**：T0701 / D183 / CT D338

### D183 2026-10-25 — 受理 CT 塔台 HANDOVER「CT 正式公開」（→ T0700）；D182 / D159 改寫：BAT 站可寫 CT 已公開與取得方式（連 CT Portal 安裝頁），細節只留在 Portal

- **背景**：BMad-Guide 塔台交辦 `_handover-2026-10-25-ct-public-release`（BMad-Guide `_ct-workorders/`，2026-10-25T08:56:38+0800）：Control Tower 2026-10-25 起正式公開下載（GitHub Release、CT Portal 安裝頁、MIT 授權；CT 塔台 D307 / D315 / D317）。BAT 站 5 處仍寫「Control Tower 目前未公開提供」（`site/control-tower.md` 75 / 307、`site/control-tower-tour.md` 19 / 290、`site/faq.md` 75）。D182 規定「CT skill 仍不開源、BAT 站不寫取得方式、連結文字不得寫『下載』『開源』」，與現況衝突，問使用者。
- **決定**（使用者 2026-10-25 08:5x，選推薦）：D182 / D159 ② 改寫為「**CT 已公開（MIT 授權），BAT 站可以說明這件事，『去哪取得』連到 CT Portal 安裝頁**；取得、下載、公開、開源、MIT 授權等字樣可用」。BAT 站**仍不寫** CT 版本號、skill 名稱、指令名稱、CT 文件名、安裝 / 升級步驟、CT 資料存放路徑：這些只放在 CT Portal 一處，CT 改版時 BAT 站不必跟著改。D165 / D166 / D173 其餘字樣規則（內部編號、`CLAUDE.md`、真實人名等）不變。
- **派工**：T0700（DELEGATE，`coordination.source.workorder: _handover-2026-10-25-ct-public-release`）；網站改動依 D161 預覽關卡，Worker 不 push。回覆稿 `_ct-workorders/_reply-2026-10-25-ct-public-release.md`。
- **相關**：D182 / D159 / D161 / D165 / D166 / D173 / T0699 / T0700 / PLAN-049

### D182 2026-10-23 — 受理 CT 塔台 HANDOVER「CT Portal 互連」（P1–P3 → T0699）；D159 改寫：BAT 站可連 CT Portal，CT skill 仍不開源

- **背景**：BMad-Guide 塔台交辦 `_handover-2026-10-23-ct-portal-link`（BMad-Guide `_ct-workorders/`，2026-10-23T08:35:22+0800）：CT Portal（https://gowerlin.github.io/Control-Tower/，repo `gowerlin/Control-Tower` public）已上線，請 BAT 站 ① 加 Portal 連結、② 檢查 CaseCard 375px 是否橫捲、③ 確認 `--close-worker` 最低 BAT 版本（CT 寫 `>= 0.6.1-pre.3`，BAT README 寫 `>= 0.6.1-pre.4`）。塔台查證 Portal `install.md` 有 skill 名稱、安裝路徑、版號、下載元件，與 D159「不提供取得管道」、D166 字樣規則衝突，問使用者。
- **決定**（使用者 2026-10-23 09:1x）：P1 連結，D159 改寫——**CT 的設計理念與使用說明已公開（CT Portal），BAT 站可以連過去；CT skill 仍不開源，目前只給少數測試者私下申請取得**。BAT 站自己不寫取得方式，D165 / D166 的字樣規則（不寫 CT 版本號、指令、skill 名稱、CT 文件名、安裝步驟）不變；連結文字不得寫「下載」「開源」。P2 / P3 塔台受理。
- **派工**：T0699（DELEGATE，`coordination.source.workorder: _handover-2026-10-23-ct-portal-link`）；網站改動依 D161 預覽關卡，Worker 不 push。回覆稿 `_ct-workorders/_reply-2026-10-23-ct-portal-link.md`（T0699 完成後由塔台寫 P3 結論）。
- **相關**：D159 / D161 / D165 / D166 / D173 / T0699 / PLAN-049
- **改寫**（2026-10-25，D183）：CT 已正式公開（MIT），「CT skill 仍不開源」「BAT 站不寫取得方式」「連結文字不得寫『下載』『開源』」三項取消；細節字樣規則照舊。

### D181 2026-10-22 — `v0.7.1-pre.6` 發版批次：T0691 / T0692 / T0694 加內嵌 codex 追版（T0697），聯合驗證後發

- **背景**：使用者「下一批發版」。`v0.7.1-pre.5` 之後已修未發：BUG-169（T0691 `b0ff5673`）、T0692（`560409a3`）、T0694（`cefb9db3`）；BUG-170 為 CT 端修正（CT v5.12.x，T0695 / T0696 驗收），不需發版。依 L173 查內嵌版本：claude CLI 2.1.306 = npm latest；`@openai/codex-sdk` / `@openai/codex` 實裝 0.160.0、npm latest 0.163.0。BUG-165 / 166 等外部測試者A、BUG-156 / 159 等特定環境，不在本批。
- **決定**（使用者 2026-10-22，選推薦）：開 T0697 內嵌 codex 追版 0.160 → 0.163，完成後塔台聯合驗證（`test:unit` / `test:legacy` / 兩個 typecheck / `vite build`）→ push → `pre-release.yml -f version=0.7.1-pre.6`；更版重點含「歡迎協助測試」（D153，內嵌 codex 升版）。
- **追加**（使用者 2026-10-22 01:4x）：使用者指出待驗收項目要包進預覽版讓測試者更新測試 —— BUG-166（pre.4 起）、BUG-156 / 159（pre.2 起）修正已在版本內、pre.6 照帶，維持 FIXED 不結案，更版重點加「待驗收」清單；BUG-165 尚無修正 → 本批開 T0698 修正（選推薦），與 T0697 並行（T0698 不改 CLAUDE.md，建議段落由塔台在兩張完成後套用）。
- **T0698 Q-1**（2026-10-22T01:51:08+0800，塔台代決，BAT 通道 `--answer` exit 0）：「是 codex 分頁」只認 `agentPreset === 'codex-cli'`（使用者自開的 Codex CLI 分頁）；helper 派工的 codex Worker 分頁（`addExternalTerminal` 不存 `agentPreset`）維持 xterm 預設，記為後續候選。理由：BUG-165 回報的是自開分頁；涵蓋 Worker 需改共用 store 與持久化格式，同批 T0697 並行，風險大於收益。
- **相關**：T0698 / BUG-165 / T0670 / T0697 / T0690 / T0691 / T0692 / T0694 / BUG-169 / L173 / D153 / D179

### D180 2026-10-22 — Renew 後 Worker 分頁的 ✓：採 T0693 方案 a + d1 + d2（BAT 內部，不改 CT）；旁支 e 開 BUG-170 之後再排

- **背景**：使用者問「塔台 Renew 工單後，通知 Worker 重讀繼續執行，BAT 終端 title 狀態已打勾，是否要設回執行中？」。T0693 研究（`6f3f623c`）：`✓`（`workerReport`）只在 renderer、只由下一次 notify 或關分頁改變，使用者輸入 / hook / OSC / 輸出都不碰；塔台無權寫入 Worker 分頁，所以 Renew 實際是使用者在原分頁輸入；手動批次關閉以 `reportedWorkersOfTower` 選分頁、無輸出檢查，會關掉 Renew 中的 Worker。`--close-worker` 與 MCP 查詢不受 `✓` 影響。
- **決定**（使用者 2026-10-22 00:2x，兩題皆選推薦）：
  1. **a + d1 + d2**：主行程以既有信號記「回合進行中」（claude `user-prompt-submit` / `stop` hook、codex OSC `working` / `idle` / `clear`），經 `terminal:attention-changed` 推送狀態欄位；renderer 在回報後收到回合開始 → 「已回報、又在執行」：不顯示 `✓`、不列入批次關閉；回合結束而無新回報 → 回到 `✓`。批次關閉確認框對近期有輸出的分頁加註「仍在輸出」（不排除）。不改 helper / MCP / CT 契約。實作前先查 claude 在 Esc 中斷、API 錯誤時是否送 `Stop`，決定是否需要逾時備援 → T0694。
  2. **旁支 e**（yolo 提問備援重派後舊 `BLOCKED` 分頁留著，新 Worker `DONE` 時 `--close-worker` 回 `AMBIGUOUS`）：開 BUG-170 記錄，修法（CT 端重派前回收 / BAT 端派工偵測）之後再決定。
- **相關**：T0693 / T0694 / BUG-170 / T0538 / T0609 / T0613 / T0590 / T0621 / PLAN-041

### D179 2026-10-21 — `v0.7.1-pre.5` 發版前先開一批小單（B4 文件、SSH 錯誤字首與 `@` 測試、安裝檔只收執行期 helper），收齊並聯合驗證後再發

- **背景**：使用者問「可以發布 v0.7.1-pre.5 了嗎」。`v0.7.1-pre.4` 之後幾乎都是測試、CI（Test gate，T0686）、去識別化與網站，使用者看得到的產品改動近乎沒有；PLAN-054 B4 已決定併入下一次發版批次；另有三個已知小項：SSH `start-failed` 的錯誤訊息仍以 `enable-failed:` 開頭（T0685 回報）、`buildSshConnectArgs` 拒絕 `@` 沒有測試、安裝檔經 `extraResources` 的 `*.mjs` 把開發腳本一起打包（含 T0685 新增的 `run-legacy-tests.mjs`）。
- **決定**（使用者 2026-10-21，兩題皆選推薦）：① 先開一批小單，全過後再發 `v0.7.1-pre.5`（也是 Test gate 第一次在 pre-release 生效）；② 安裝檔只收執行期 helper 併入這批。
- **塔台排程**：T0687（B4 文件）、T0688（SSH 字首與 `@` 測試）先派（22:03 兩張 `started:`）；T0689（安裝檔白名單 + verify 守門 + `build:dir` 實測）與 T0687 都改 CLAUDE.md（不同節），overlap check 為 BLOCK，依規則選「等 T0687 完成再派」，不請使用者接受衝突。兩單 commit 前仍各自確認 `git diff -- CLAUDE.md` 只有自己的 hunk。T0689 會重建 `dist-electron`，所以 T0688 不跑 build 與整包 `test:unit`；塔台收齊後聯合驗證（`test:unit`、兩個 typecheck、`vite build`），再進發版流程。
- **追加**（22:17，塔台決定，事後回報）：① 聯合驗證時查到內嵌 claude CLI 落後（實裝 2.1.300、npm latest 2.1.306）。CLAUDE.md 規定每次預覽版發布前追版，屬既定流程，開 T0690 併入本批（比照 T0541）；T0690 完成後重跑聯合驗證再發。② T0689 發現安裝版 helper 回報版號 `v0.0.0`（BUG-169，既有行為、只影響顯示、修法需設計），不併入本版，排進下一批。
- **相關**：PLAN-054 / T0685 / T0686 / BUG-058 / T0433 / D177 / T0541 / BUG-169

### D178 2026-10-21 — T0684 Q-1／Q-2：檢查 Windows 路徑的地方明確用 `path.win32`（塔台代決）

- **背景**：T0684 讓 ubuntu 試跑失敗的測試改成跨平台時，有 4 項的根源在程式碼：① `electron/wsl-detect.ts` 的 `validateWindowsAbsolutePath` 用主機的 `path.isAbsolute` 檢查 WSL 安裝用的 Windows tarball 路徑（只在 Windows 主機呼叫，唯一呼叫點在同檔）；② `e2e/real-remote/baseline-source.mjs` 的 `defaultInstalledBaselineDirs` 已接受注入的 `platform`，組路徑卻用主機的 `path`。工單規定改產品檔前先問塔台。
- **決定**（21:2x，塔台代決，BAT `--answer` 兩題皆選 [A]）：兩處改成明確的 `path.win32`（後者依注入的 `platform` 選 `path.win32` 或 `path`）。Windows 上 `path === path.win32`，行為不變；Linux 也能跑同一組斷言，不必 `skip`，覆蓋不降。不採 [B]（`it.skipIf` 跳過），因為會讓 CI 少測這幾項。因改到產品檔，T0684 收尾必跑 `test:unit`、typecheck、build；e2e helper 不實跑 Playwright。
- **相關**：T0684 / D177 / BUG-168 / T0683

### D177 2026-10-21 — BUG-168 修正：G1～G4 全做、舊測試往 vitest 收斂；CI 分兩步（先 test:unit 試跑再擋版，修完再加 test:legacy）

- **背景**：T0679 研究（`6fb40e70`）：`tests/` 底下不在 `test:unit` 的 29 項失敗與 9 個逾時全部是測試過時，沒有產品回歸；3 組 5 個失效 script；**CI 完全沒跑 `npm run test:unit`**（四個 workflow 只有 typecheck，塔台已確認）；`pty-manager-helper-env.test.ts` 有環境變數隔離問題。
- **決定**（使用者 2026-10-21，三題皆選推薦）：
  1. **修正範圍 G1～G4 全做**。塔台排程：第 1 波 G2（T0680）、G3（T0681）與 CI 第一步（T0683）並行（檔案不重疊）；第 2 波 G4（T0682，Docker → WSL → SSH）；G1 刪失效 script 併入最後的 CI 第二步，連同 G2／G3 刪檔後新失效的 script 一起清。
  2. **CI 分兩步**：① 先修 `pty-manager-helper-env` 隔離、新增只能手動觸發的 `tests.yml` 在 ubuntu 跑 `test:unit`，塔台 push 並試跑確認全過後，再把 `test:unit` 設成 pre-release／release 的擋版關卡（比照 Typecheck gate）；② G2～G4 修完後新增 `test:legacy`（tsx／node:test，帶 `--test-timeout`）並加進 CI。
  3. **舊測試往 vitest 收斂**：profile-card 搬到 vitest + RTL 實際渲染並補 ProfileCard／DockerDetails 覆蓋；G2／G3 與 `electron/__tests__` 等 vitest 版重複的刪掉、獨有且仍有效的搬過去（不得保留舊的錯誤期望），最後刪掉 `tests/` 的舊檔。G4 的精靈 journey／e2e 測試先留在 `tests/`，由 `test:legacy` 執行。
- **相關**：BUG-168 / T0679 / T0680 / T0681 / T0682 / T0683 / BUG-167

### D176 2026-10-21 — 公開 repo 去識別化：移除 claude-mem 記憶檔、客戶與測試者名稱改代稱、家目錄路徑改寫；不改寫 git 歷史（T0676）

- **背景**：使用者要求 push 前檢查金鑰與個資。塔台掃描（2026-10-21）：沒有真的金鑰（只有測試用假值）、GitHub release 說明沒有命中、未 push 的 3 個 commit 乾淨；但已公開的追蹤檔有：① `_ct-workorders/AGENTS.md`（claude-mem 自動寫入，含其他專案的內部紀錄，2026-05-15 起）；② 客戶與外部專案名稱、路徑（約 39 檔，含 `CHANGELOG.md` 一行、`src/types/bmad-workflow.ts` 一行註解）；③ 外部測試者的名字與家目錄路徑（約 39 檔，含 5 個測試檔與 1 個檔名）；④ 使用者家目錄路徑（約 85 檔，含 4 個測試檔）；⑤ 根目錄 `AGENTS.md`（claude-mem，只有 BAT 自己的歷史）；⑥ T0674 的字詞檢查清單直接列出名稱（塔台寫工單時造成）。
- **決定**（使用者 2026-10-21，四題）：① 兩個 `AGENTS.md` 移除，`.gitignore` 擋 `AGENTS.md`；② 客戶與外部專案名稱換代稱（專案A／B／C）；③ 外部測試者名字換代稱（外部測試者A）；④ 修 T0674 清單、忽略 `Claude outputs/`、移除根目錄 `AGENTS.md`、家目錄路徑改寫。**不改寫 git 歷史**：改寫會讓工單與決策裡引用的 commit SHA 全部失效，舊 commit 仍看得到這些內容（使用者選項說明已載明）。
- **塔台補充**（範圍內）：真名與代稱的對照表只存本機 `.private/T0676-deid-mapping.md`（`.gitignore` 擋 `/.private/`），公開檔案、commit 訊息與工單只寫代稱；`_local-rules.md` 新增「公開 repo 去識別化」一節防再犯。
- **相關**：T0674 / T0676 / D165 / D173

### D175 2026-10-21 — 網站新頁「把腦力留給判斷」（`/why`）：以認知負荷說明 BAT + CT 的設計初衷；範圍完整版（T0674）

- **背景**：使用者第八十八 session 讀完兩篇文章（BMad 生態系積木圖、CT v4.4 對照認知負荷理論的審稿文）與群組討論（Workflow 提案沒過、專案工作例外太多、可否放心 clear、Worker 執行中自己動檔、同一客戶可能提煉出流程、推廣門檻）後，問如何把「解決或轉移認知負荷」放上網站、呈現 BAT + CT 的設計初衷。塔台盤點：首頁「7 個卡關時刻」與 `/control-tower-tour` 演進史都隱含此主題（首頁結尾「這個早上你只做了三個決定」），但全站沒有明說「為什麼這樣設計」。
- **決定**（使用者 2026-10-21，16:28 前作答，四題）：
  1. 範圍採完整版：新頁 + 首頁故事後接一段 + 故事 7 章各加「你不用再記住：…」+ `/control-tower` 常見問題加兩題（放心清掉對話、Worker 執行中自己改檔）+ 演進史收尾一句 + 導覽列。
  2. 「只自動化外殼、不把內容做成 SOP」上站，**不提試驗細節**（EXP-WFMINE-001 的試驗、數字、Workflow 功能名稱都不寫，只寫原則）。
  3. 新頁「起點」用**作者第一人稱**（同時顧好幾個專案、A 專案的 prompt 貼進 B 專案）；不寫真實專案、客戶或人名。
  4. 頁名「**把腦力留給判斷**」、網址 `/why`（塔台推薦的「設計初衷」未採用）。
- **塔台補充**（範圍內）：主旨句「記憶交給檔案，跑腿交給 BAT，判斷留給你」；首頁主標維持 D161；D165 / D166 / D173 字樣規則不變（另加：不寫 CT 原則文件檔名與塔台狀態檔檔名；認知負荷理論用通稱，不引用特定文章或作者）；第一人稱只限新頁「起點」與作者的學習順序；「外殼」一節須與「越用越懂你的專案」相容（經驗累積成規則與教戰手冊幫 Worker 判斷，但不變成不准例外的劇本）；預覽關卡沿用 D161（Worker 不 push，塔台 push 前另取授權）。
- **使用者補充**（同日，16:32 前，選「加入並派工」）：BAT + CT 不規定 SDD / TDD / BDD，是輔助開發流程與狀態管理；使用者仍需具備專業知識；不是 Vibe Coding → 新頁加一節「這不是什麼」（不規定開發方法、不取代專業知識、不是 Vibe Coding），首頁新段落卡片下方加一句。
- **相關**：PLAN-049（DONE，D172）/ D159 / D161 / D164 / D165 / D166 / D170 / D173 / EXP-WFMINE-001 / T0674

### D174 2026-10-19 — T0672 Q-1：F2 新選單項目允許更新 t0571 e2e 的選單清單斷言（塔台代決）

- **背景**：T0672（BUG-166 F2）在終端右鍵選單加「重設滑鼠模式」，`e2e/t0571-shift-right-click-copy.spec.ts`（不在 affects_files）6 處斷言選單精確等於 `['複製', '貼上']`，新選項正好出現在追蹤中 Shift + 右鍵的狀態。
- **決定**（17:40，塔台代決，BAT `--answer` 選 [A]）：把 t0571 e2e 加進 T0672 範圍，只改選單清單的精確斷言，複製 / 選取 / 不送回報等行為斷言不動；`terminal-context-menu.test.tsx` 同理。不採 [B]（另用 class 繞過斷言），避免同一選單兩套樣式來源。
- **相關**：T0672 / BUG-166 / BUG-142 / T0571

### D173 2026-10-19 — 網站示意可用真實工單目錄名 `_ct-workorders/`（放寬 D159 / D165 的 grep 規則一項）

- **背景**：網站故事插圖（`site/.vitepress/theme/components/StoryIllo.vue` 的 `files` / `workorder` 兩張）原本用虛構目錄 `work-orders/`；使用者第八十五 session 指出應為 `_ct-workorders`（`3262b416` 已改）。D159 / D165 與 T0630 / T0634 起的網站工單驗收寫「`site/` 內 grep `_ct-workorders` = 0」，若不記錄，之後的網站工單會把它改回去或判驗收失敗。
- **決定**（使用者 2026-10-19 指示）：網站示意插圖與說明可以出現工單目錄名 `_ct-workorders/`（含其下虛構工單檔名，例 `_ct-workorders/T1024-discount-code.md`、`_decision-log.md`）。之後網站工單的 grep 驗收**移除 `_ct-workorders` 這一項**；其餘限制照舊（不得出現內部編號 `T0\d{3}` / `D1\d{2}` / `BUG-` / `PLAN-`、`CLAUDE.md`、CT 文件名 / 版本號 / 星號指令 / skill 名稱 / CT 資料存放路徑 / 取得管道；示意仍只用 `demo-shop` 與 `T1024` 以後的虛構編號）。
- **相關**：D159 / D165 / T0630 / T0634 / `3262b416`

### D172 2026-10-18 — PLAN-049 結案（DONE）：手動素材改為使用者拍好後另開工單

- **背景**：使用者第八十四 session 問 PLAN-049 是否可 done。W1–W4、W2a–W2d、D170 演進史、T0665 皆完成上線（Pages run `39137082682`，link-check 0 errors），D159 / D160 待決事項已全數決定。
- **決定**（使用者 2026-10-18 22:4x 同意塔台建議）：PLAN-049 → DONE。T0656 列的手動素材不擋結案（網站 / README 未預留位置），使用者拍好後另開小工單；網站維運依 `_local-rules.md` 發版流程，不另留 PLAN。
- **相關**：PLAN-049 / D159 / D160 / D161 / D166 / D170 / T0656 / T0665

### D171 2026-10-18 — PLAN-047 結案（DONE）：M2 / M3 不在本單續做

- **背景**：使用者第八十四 session 要求盤點 PLAN-047「缺什麼或可 done」。路線 [A]（D149）的 A1 / A2 / T / M1 / M1b / W1 與 CT-T014–T018、CT-T020 全部 DONE，且都已在安裝版驗過（最後一項 BUG-162 於 `0.7.1-pre.2` T0664）；PLAN-047 frontmatter 仍是 IN_PROGRESS，M2 / M3 依 D149「待 M1 使用後再議」從未決定。
- **決定**（塔台依使用者「看缺甚麼或可 done」裁定）：PLAN-047 → DONE。M2（訊息 / artifact / 跨 workspace）的實際需求已由 PLAN-048、PLAN-050 以 helper + 唯讀 MCP 滿足，跨塔台傳訊留在 PLAN-051（IDEA，D169）；M3 控制類 tool 依 D155 / D156「BAT MCP 全唯讀」不做，控制動作維持 helper CLI。日後若有新需求另開 PLAN，不重開 PLAN-047。
- **已知缺口**：T0620（`ElicitationResult` 清 `elicitation`）無安裝版實機驗收，遇到 MCP elicitation 時再驗。
- **相關**：PLAN-047 / D149 / D150 / D152 / D155 / D156 / D158 / D169 / PLAN-048 / PLAN-050 / PLAN-051 / T0664

### D170 2026-10-18 — PLAN-049 網站：CT 演進史以「網站版摘要」加在 `/control-tower-tour` 下方（等 BMad-Guide T0175 完成再開單）

- **背景**：使用者考慮把《Control Tower 演進史.html》（BMad-Control-Tower/docs，BMad-Guide T0175 正在補 v5.2.4–v5.9.0）放到網站「Control Tower 功能導覽」下方。演進史以版本表、CHANGELOG、`SKILL.md` / frontmatter、zip 大小圖為骨幹，原文上站會牴觸 D166（不寫命令名稱、skill 名稱、CT 版本號、檔案格式範本）。
- **決定**（使用者 2026-10-18 20:4x，選塔台推薦 B）：在 `/control-tower-tour` 下方加一節「Control Tower 怎麼長出來的」——以六個世代講設計思路（例：把人手從傳輸線上拿掉、塔台和 Worker 分開、一條規則只寫一處），不寫版本號、檔名、命令名稱，寫法比照 `/cases`；D166 不放寬。不放原文、不連 artifact。
- **時機**：BMad-Guide T0175 完成（世代劃分補到 v5.9.0）後開單，排在 `0.7.1-pre.2` 發版之後。
- **相關**：PLAN-049 / D159 / D165 / D166 / `_handover-2026-10-18-ct-evolution-doc-update`（BMad-Guide T0175、D073）

### D169 2026-10-18 — PLAN-051 跨塔台傳訊維持 IDEA；開 codex 共用 daemon 環境變數繼承探針

- **背景**：T0647 研究 DONE（`c3497907`）：跨塔台往來全為「兩個 Claude 塔台、同一台機器」，失敗兩次皆為認錯收件人（PLAN-050 已解）；codex / 遠端塔台卡住 0 件。另更正兩項前提：Claude Code SendMessage 經 Remote Control 可跨機器與雲端（雲端不能回覆；WSL 2 / container 與 host 互不通）；codex `0.163.0` 有 Stable 的 `codex queue --thread … --message …`（經共用 app-server daemon）。順帶發現未驗證風險：第三方回報 codex 共用 daemon 底下各 session 繼承第一個 session 的環境變數。
- **決定**（使用者 2026-10-18 18:2x，兩題皆選推薦）：
  1. PLAN-051 **維持 IDEA**：塔台更正 PLAN 前提、寫入重新評估觸發條件；T0647 Q5 契約草案（結構化訊息箱）留作日後依據。
  2. **開探針單 T0648**：查證 codex 共用 daemon 下 BAT 分頁的 `BAT_TERMINAL_ID` / 權杖 / BAT MCP 是否可能取到別的分頁的值（本機 BAT 為系統管理員權限、已注入 `features.daemon_auto_start=false`，推論不受影響；非系統管理員的 BAT 使用者可能受影響）。
- **相關**：PLAN-051 / T0647 / T0648 / PLAN-050 / D149 / D155 / T0377（BUG-085）

### D168 2026-10-18 — 下一個預覽版號線 `0.7.1-pre.1`

- **背景**：`0.7.0` 線已發到 `pre.9`（D151：不發兩位數 pre）。下一版內容：BUG-155（T0639）、PLAN-050 session 識別（T0641 / T0642 / T0643 / T0644，D167）。
- **決定**（使用者 2026-10-18 17:1x，選塔台推薦）：下一版為 **`0.7.1-pre.1`**（新功能與修正，無破壞相容的改動）；`0.7.1` 線同樣最多到 `pre.9`。
- **時機**：T0643 完成、塔台複驗後發版（使用者 16:0x 指示「等 T0640 研究完、PLAN-050 定案後一起發」）。
- **相關**：D151 / D167 / PLAN-050 / BUG-155

### D167 2026-10-18 — PLAN-050 Claude 分頁的 session 識別：R2 採 (a)+(b)；hook 回報 sessionId（改 T0600）；放寬 D149 加 `scope: 'towers'`；`--name` 不加 Settings 開關

- **背景**：BMad-Guide 塔台需求提案（CT D067，`BMad-Guide/_ct-workorders/_request-2026-10-18-bat-session-identity.md`）：ListAgents 只顯示「目錄名＋兩字元」，CT 分不出 BAT 塔台與 Worker（2026-10-18 兩次實例）。T0640 研究 DONE（16:07）：claude `--name` 在 2.1.300 / 2.1.302 實測可用（ListAgents 顯示、中文與 `·` 正確、上限 200 字元、重複時最後一個生效）；`< 2.1.76` 不認得 → claude exit 1（system runtime 需版本檢查）；`--session-id` 會在 resume / 重啟 / 重複時讓 claude 啟動失敗 → 不用；`SessionStart` hook stdin 有 `session_id`；hook `sessionTitle` 不改 ListAgents 名稱 → 排除。
- **決定**（使用者 2026-10-18 16:1x，四題皆選推薦）：
  1. **R2 採 (a)+(b) 並用**：(a) 所有 claude-cli 分頁啟動即 `--name "<工作區> · <短 ID>"`（Worker 為 `<工作區> · Worker · T####`）＋ R3 ＋ `scope: 'towers'`；(b) 新增「以塔台開啟 Claude」入口，啟動即 `<工作區> · Tower`（只命名，不代替 `--set-role tower`）。(c) 使用者 `/rename` 作為發版前過渡。
  2. **改 T0600 契約**：`SessionStart` hook 回報時多帶驗證過的 `session_id`（UUID），日誌只記前 8 碼；hook 仍 exit 0、stdout 不輸出。
  3. **放寬 D149**：`terminal:list { scope: 'towers' }`，只有已宣告的 tower 可呼叫，回同一 BAT host 所有 tower 分頁的 `id` / `workspaceId` / `workspaceName` / `claudeSessionName` / `state` / `alive`；不回 sessionId、cwd、輸出；`read-output` / `wait` 範圍不變。
  4. 刪除 T0640 實驗留在 `~/.claude/projects/` 的兩個 transcript（塔台已刪，16:1x）。
- **塔台補充（範圍內）**：`--name` 注入不加 Settings 開關、預設啟用（比照 D144；Worker 建議）；介面契約以 T0640 回報區 C-1–C-8 為底，實作工單可微調並在回報說明。
- **派工**：A（T0641，C-1 / C-2 / C-3 + R1）先做；A 完成後 B（T0642，C-4 / C-5 / C-8 + R3）與 D（T0644，C-7「以塔台開啟」）並行；B 完成後 C（T0643，C-6 `scope: 'towers'`）。全部完成後開 CT-T021 委派 CT 改「跨 session 選收件人」規則，並發下一個 BAT 預覽版（版號線發版前問使用者）。
- **相關**：PLAN-050 / T0640 / D149 / T0600 / T0590 / D144 / T0562 / T0582 / T0584

### D166 2026-10-18 — PLAN-049 網站：CT 不開源但可「概念加細節」介紹；新開「Control Tower 功能導覽」頁

- **背景**：使用者 14:29 前：「CT 不開源，但是可以稍微詳細介紹」，參考 CT 使用指南 v5（`BMad-Control-Tower-v5.8.0/docs/BMad Control Tower 安裝(升級)與使用指南 v5.md`，2007 行：§ 1 這是什麼、§ 2 v4.0–v5.8.0 新功能、§ 3–4 升級與安裝、§ 5 四級能力、§ 6 基本流程、§ 7 使用情境、§ 8 自我學習、§ 9 多塔台、§ 10 Debug 三層防線、§ 11 FAQ、§ 12–14 速查表）。
- **決定**（使用者選定）：
  1. **公開程度「概念加細節」**：可寫 CT 的功能與流程——四級能力、基本操作流程、工單生命週期與狀態、自主模式與斷點、自我學習、多塔台協調、Debug 三層防線、去識別化使用情境、常見問題。**仍不寫**：命令名稱、skill 名稱、CT 版本號、取得管道、安裝 / 升級步驟、skill 檔原文、完整參數 / 設定表、檔案格式範本（D159 的「不開源、不提供取得管道」不變；D165 的 CT 字樣規則不變）。塔台推薦的「功能導覽級」（含命令名稱與版本演進）未採用。
  2. **放置**：新開「Control Tower 功能導覽」頁（`/control-tower-tour`）；`/control-tower` 維持「BAT × CT 協作」重點並連過去。
- **派工**：T0636（W2b-3），排在 T0635 之後（兩者都改 `config.mts` 與 `/control-tower` 的連結）。
- **相關**：PLAN-049 / D159 / D165 / T0634 / T0635 / T0636

### D165 2026-10-18 — PLAN-049 網站 v2 加入 CT 進階能力與案例：首頁「越用越懂你的專案」一段、`/control-tower` 三節、新頁 `/cases`

- **背景**：使用者 13:36 補充 4 份 CT 文件（自助擴充指南、DESIGN.md 視覺規範指南、FIELDGUIDE 教戰手冊指南、實戰補充 8 篇）可作為案例或功能特點 → T0633 研究 DONE（13:43，提案稿 `_ct-workorders/_spec-site-v2-ct-features-cases.md`，`714ba3b1`）：17 個功能點（13 ✅ / 3 ⚠️ / 1 ❌）、4 個去識別化情境案例、3 個 BAT 真實案例；「資深開發者除錯模式分析」整份不用（含真實客戶與系統細節）。
- **決定**（使用者 2026-10-18 13:46 前，提案稿 § 6 七題全部採推薦）：① 首頁在「自動，但不失控」後加「越用越懂你的專案」（3 卡 + 成長管線）；② 開 `/cases`（W2d，排在 W2b 之後）；③ R1 寫「約 20 次、10 項功能」並標截至日期；④ 第三根支柱延伸為「看得見、留得住、還會長大」（只改說明）；⑤ 「塔台被慣壞」只放 `/control-tower` FAQ；⑥ R1 **不加**「CT 新版由 BAT 塔台實機驗收」（超出 D159 整合點範圍）；⑦ 首頁新段落併入 W2b，不改進行中的 T0630。
- **規則**：網站不寫 CT 文件名、CT 版本號、塔台指令、skill 名稱、CT 資料路徑；提案稿的「出處」欄只供內部核對。
- **落點**：主規格 `_spec-site-v2-bat-ct-story.md` § 3 / § 4.4a / § 5 第 11–12 點 / § 6 / § 8 / § 10 已併入；W2b / W2d 工單待 T0630 預覽通過後開立（屆時一併納入預覽意見）。
- **相關**：PLAN-049 / D159 / D161 / D164 / T0633 / T0630

### D164 2026-10-18 — PLAN-049 網站 v2 視覺方向：A「進場雷達」為主 + C「一個早上」的故事時間軸；全站一套字體（A）

- **背景**：T0632 DONE（13:30）：設計語言 `docs/design/site-design-language.md`（`647bfeca`）、Design System「Better Agent Terminal」（https://claude.ai/artifact/FgvvUnYMgJwsEkrS2ATCBj）、Design 畫布「BAT 網站視覺方向」（https://claude.ai/artifact/2LN8rmZ3VbGwZSLpN18mPv，三方向 × 4 artboard）；Worker 推薦 A + C 時間軸。塔台查證三方向所用 7 個 Google Fonts 字族 css2 皆回 200（含 Worker 未查證的 Chiron Hei HK、LXGW WenKai TC）。
- **決定**（使用者 2026-10-18 13:33 選推薦）：Hero、終端 / 示意區塊、三欄對照、字體系統與品牌色用 **A**（深色航管雷達：塔台在圓心、Worker 光點標 ⚠️ / `?` / `✓`、事件紀錄；Chiron Hei HK 900 / Noto Sans TC / Martian Mono）；故事 7 章用 **C** 的版面（大時間數字、捲動「現在」線、以前 / BAT + CT 兩欄），回到淺色長篇閱讀。塔台補充（範圍內技術選擇）：全站只用 A 的字體系統，C 只借版面與時間敘事；雷達避開資安 / 駭客語彙。
- **派工**：T0630 填入「選定的視覺方向」節後重新派工。
- **相關**：PLAN-049 / D161 / D162 / T0632 / T0630

### D163 2026-10-18 — CT v5.7.1 / v5.7.2 × BAT 0.7.0-pre.8 代跑實機驗收結案（T0625–T0629）；pre.9 延後到網站改版與驗收告一段落

- **背景**：BMad-Guide D057 請 BAT 代跑 CT v5.7.1 / v5.7.2 實機驗收（規格 BMad-Guide T0170 / T0171），第七十九 session 交接給本 session。
- **執行**（塔台代決的探針設計，比照 D157）：5 張探針依序派工——T0625（F-1 ①，Q-1 後刻意延遲 60 秒）、T0626（F-1 ② + 第 6 步，塔台刻意不答 Q-3）、T0627（F-1 ③ 全部失敗 + ④(a) 立刻取消）、T0628（④(b) + 對已答題 `--cancel-question`）、T0629（codex：fenced code block awk + O-2 自檢，塔台刻意延遲 90 秒才答）。T0628 / T0629 因使用者插入網站改版而暫停約 25 分鐘，使用者指示「也處理暫停的項目」後續跑。
- **結果**：5 項 PASS、0 FAIL；④(b) 自然時序未重現（塔台忙時通知排隊，以刻意 `--answer` exit `9` 為證）；新發現 **F-2**（codex 的「提問時間」不是取自系統，自檢時又改了已送出的題目）、觀察 O-3（塔台未 commit 的答覆行被 Worker commit 帶入）、O-4。CT v5.8.0 於 12:48 裝到本機，T0628 / T0629 跑在 v5.8.0（V72 / V80 提問規則全文相同，雙方塔台各自比對確認）。
- **交付**：回函 `D:\ForgejoGit\@Gower_Labs\BMad-Guide\_ct-workorders\_reply-2026-10-18-ct-v571-v572-runtime.md`（13:28 傳訊 `bmad-guide-d8`）；對方 13:29 回覆 PASS 採信、D057 結案（對方 D061，`e96b84a`），F-2 / O-3 列 CT v5.8.1 候選、O-4 只記錄。
- **CT-T020**：對方 CT v5.8.0 完成（回覆 `_reply-2026-10-18-ct-t020-done.md`），BAT 端委派單標 DONE（`65ab4663`）；BAT 最低版本占位字串待 BAT 發版後替換。
- **發版決定**（使用者 2026-10-18 13:2x）：含 T0620 / T0621 / T0623 的 `v0.7.0-pre.9` **等網站改版（PLAN-049 W2a）與驗收告一段落再發**；發佈後告知 BMad-Guide 版號，再照 CT-T020 § 驗收建議代跑 codex 實機驗收。pre.9 是 0.7.0 線最後一個預覽版（D151）。
- **相關**：D057（BMad-Guide）/ D157 / D158 / CT-T020 / T0625–T0629

### D162 2026-10-18 — PLAN-049 網站 v2：加入 `frontend-design`、`theme-factory`，先以 Design System + Design 畫布定視覺方向再實作；`frontend-design` 由工單授權安裝

- **背景**：T0630 13:05 派工後，使用者貼上另一段建議（做有設計感的產品介紹網站：核心用 `frontend-design`；先用 Design 畫布定方向再做成網頁；`theme-factory` 試主題；有品牌規範可先整理成 Design System；`brand-guidelines` 是 Anthropic 自家規範可略過；`canvas-design` 適合做 hero 主視覺 / 海報，不適合整站），指示「加入這些考量：幫我安裝 SKILL」，並自行停止 T0630（Worker 啟動約 47 秒、無產出），要求「加上上述 SKILL 後重新安排」。
- **查證**（塔台，2026-10-18 13:07–13:08，唯讀）：`frontend-design` 為 Anthropic 官方 plugin（Claude Code 內建 marketplace `anthropic-plugin-directory`；repository `anthropics/claude-plugins-official` `plugins/frontend-design`，目錄審查 commit `ea10b213…`），本機未安裝（`claude plugin list` 只有 `codex`）；`anthropic-skills:theme-factory` 已可用；Artifact 有 Design 與 Design System 類型；使用者沒有既有的 Design System。CT 寫入規則 Q3：塔台模式沒有安裝例外，須另開工單、工單內明文授權（具體 skill / 版本 / 目標）由 Worker 執行。
- **決定**（塔台依使用者指示安排）：
  1. **T0631**：Worker 以 `claude plugin install` 安裝 `frontend-design`（user scope；授權範圍寫在工單；不寫 `~/.claude/skills/`、`~/.codex/skills/`，Codex 端不裝）。
  2. **T0632**（新，W2a-0）：載入 `frontend-design` + `theme-factory`；`ct-fieldguide` 從 BAT UI 抽設計語言 → `docs/design/site-design-language.md`（repo 唯一來源、固定錨點）；建立 BAT **Design System** Artifact；**Design 畫布** 3 個視覺方向 × 4 張 artboard（Hero 桌面 / 故事一章 / 三欄對照 / Hero 手機）；回報連結與推薦，不改 `site/`。
  3. **T0630** 改為實作工單：依使用者在畫布選定的方向（塔台派工前填入「選定的視覺方向」節）＋ `frontend-design` 實作；字型只用 Google Fonts、不加 npm 依賴。
  4. 不用 `brand-guidelines`（Anthropic 品牌）；`canvas-design` 留給 W4 的 OG 卡片 / hero 主視覺（選用）。
- **順序**：T0631 → T0632（新 session 才載入得到 plugin）→ 使用者選方向 → T0630 → 預覽 → 使用者授權 push。
- **相關**：PLAN-049 / D161 / T0630 / T0631 / T0632

### D160 2026-10-18 — PLAN-049 技術與部署（塔台依 D159 授權決定）：VitePress 1.6.4 於 `site/`、Actions `pages.yml`、發版同步併入三文件 commit

- **背景**：T0622 研究 DONE（推薦組合 + W1–W4 切分）；D159 授權塔台決定技術選型、素材、部署。
- **決定**（塔台 2026-10-18 12:24，採 T0622 推薦）：
  1. VitePress 1.6.4，原始碼放新頂層目錄 `site/`（**不用 `docs/`**，避免內部文件被渲染公開），獨立 `package.json` / lockfile，`base: '/better-agent-terminal/'`，local search；`site/package.json` 的 `allowScripts` 只放行 `esbuild`（name-only，與根目錄政策一致）。
  2. 部署：獨立 workflow `.github/workflows/pages.yml`（push main 且 `site/**`、`README.md`、`release-note.md`、本 workflow 變更 + `workflow_dispatch`；`concurrency: pages`；只在 deploy job 給 `pages: write` / `id-token: write`）；Pages source = GitHub Actions。不碰 `pre-release.yml` / `release.yml`。
  3. 發版同步：網站 include `README.md`（版本對照）/ `release-note.md`，既有「發佈後同步 repo 文件」三文件 commit push 後自動重建；下載按鈕於 build 時以 Releases API 取最新 `v*`（排除 `server-bundle-v*`）。`_local-rules.md` 發版流程加「確認 Pages workflow 綠燈、首頁版號 = 本版」（W4 時由塔台加）。
  4. 素材：手動執行、不進 CI 的 `e2e/site-media.spec.ts`（隔離實例、虛構示範專案）產生截圖與 WebM 短片，網站用 `<video autoplay muted loop>` 取代 GIF；上站前逐張過 T0622 Q3-3 隱私清單；既有 `assets/screenshot-*.png`（上游舊 UI、含上游作者路徑）網站不沿用。
  5. 維運：OG 卡片、sitemap、lychee 連結檢查；內部內容（T / D / BUG 編號密集的 `CHANGELOG.md`、`docs/agent-guide/`、`_ct-workorders/`）不上站，只改寫可公開段落。
- **使用者決定**（2026-10-18 12:29，全部依建議）：自訂網域先不用；繁中單語；W3 一併把 README 舊截圖換成新截圖；不加網站分析。**授權**：W1 由塔台在 Worker 完成後 push 並把本 repo Pages source 設為 GitHub Actions（`gh api -X POST repos/gowerlin/better-agent-terminal/pages -f build_type=workflow`，一律帶明確 repo），限 W1 這一次。
- **相關**：PLAN-049 / T0622 / D159

### D159 2026-10-18 — PLAN-049 網站：專案站 `gowerlin.github.io/better-agent-terminal`；CT 只介紹概念與 BAT 整合點

- **背景**：PLAN-049（GitHub Pages 介紹 BAT + CT）的兩個待決點；T0622 研究派工後使用者直接決定。
- **決定**（使用者 2026-10-18 12:18）：① 站台用專案站 `gowerlin.github.io/better-agent-terminal`（本 repo 部署），不另開使用者站；② CT 維持未開源，網站只介紹 CT 的概念與它跟 BAT 的整合點，不提供取得管道（與 README 規則一致）。
- **追加**（使用者 2026-10-18 12:20）：③ 技術選型、截圖 / 示範 GIF、部署方式授權塔台依 T0622 建議決定並設計；④ 使用者向內容可公開、可同步，發版時一起更新網站。
- **處置**：T0622 工單加「塔台補充」，Q1 改研究專案站的具體做法、Q4 改列可公開的概念與整合點；Q2 / Q3-3 / Q5-1 要求單一推薦、Q5-2 設計成併入發佈後同步。
- **相關**：PLAN-049 / T0622 / `_local-rules.md`「發佈後同步 repo 文件」
- **改寫**（2026-10-23，D182）：② 改為「CT 設計理念與使用說明已公開（CT Portal），BAT 站可連過去；CT skill 仍不開源，只給少數測試者私下申請」。
- **改寫**（2026-10-25，D183）：② 再改為「CT 已公開（MIT 授權），BAT 站可寫取得方式並連到 CT Portal 安裝頁；版本號、skill 名稱、安裝步驟等細節只留在 Portal」。

### D158 2026-10-18 — PLAN-047 M1b-2：codex 以 OSC 7501 回報 `blocked` 與啟動；新增 `blockedDetection: osc`、`blockedReason: input`

- **背景**：T0619 研究（0 次模型呼叫，假 Responses API 驅動真 codex 0.163.0 TUI）發現 codex `>= 0.163.0` 自己在 PTY 送 `ESC ] 7501 ; state=idle|working|blocked`（結束 `clear`），不需設定、與焦點無關；TUI 就緒約 0.5 s 送第一個值，卡在啟動前畫面（信任目錄 / hooks review）不送。T0574 建議的 OSC 9 只在失焦時送、無清除信號，不採用；codex hooks 注入會觸發信任畫面擋住 `--yolo`，列備案。BAT 派出的 codex Worker 帶 `--yolo`，回合中幾乎不停，價值主要在啟動信號。
- **決定**（使用者 2026-10-18 選 [A]，T0619 建議 6 點全採用）：① `blockedDetection` 新增 `osc`（觀察式，看到 7501 即設）；② `blockedReason` 新增 `input`（7501 不分 reason），使用者輸入不清除；③ codex `agentStarted` = 第一個 7501，`--wait-started` 對 codex 生效；④ 派工前 `codex --version`（`execFile` + 5 s timeout + 快取），確認不到 → `none` / `unknown`，絕不 `unconfirmed`；⑤ 派工的 codex Worker 加 `-c check_for_update_on_startup=false`；⑥ BAT 重開時掃 replay 內容補回最後狀態。
- **派工**：T0621（L，非隔離，契約 C-1–C-8）；DONE 後開 CT-T020（斷點 D 接受 `osc` / `input`、`started: unknown` 說明更新，CT MINOR）。
- **不採用**：OSC 9（`-c tui.*` 覆寫使用者設定、無清除）；`-c notify`（會取代使用者 notify）；codex hooks + 預給信任雜湊（未公開格式）。
- **相關**：PLAN-047 / T0619 / T0621 / T0590 / T0600 / T0607 / D153

### D157 2026-10-18 — CT v5.7.0 × BAT 0.7.0-pre.8 實機驗收由 BAT 塔台統一執行（5 張探針），結果以回函交 BMad-Guide

- **背景**：BMad-Guide 也已換上 CT v5.7.0，使用者要求協商由哪一邊統一驗收（第七十九 session 10:55）。
- **決定**：BAT 塔台提議、BMad-Guide 同意（對方使用者 10:57 確認，CT 不另開 T0170）。兩邊共用同一份 BAT 安裝版與 `~/.claude/skills`，BUG-154 又需使用者目視，一次驗完。對方追加 12 項（5–16），使用者選 [A]：拆成 T0614（claude 主流程）/ T0615（codex）/ T0616（多題混合，以 `--expires-min 999` 製造 `--ask` 失敗、Worker 自行 `--cancel-question`）/ T0617（timeout 1，塔台刻意不答 → expired → Renew）/ T0618（timeout 0 → Renew → ct-done），依序派工。
- **塔台代決的提問**（皆範圍內技術選擇）：T0614 Q-1 [A] 驗證清單節末新增條目（BAT 答覆）；T0615 Q-1 [A] codex 另起一條（BAT 答覆）；T0616 Q-1 [A]（BAT）、Q-2 / Q-3 [A]（工單答覆行）；T0617 / T0618 Q-1 [A]（Renew #1）。T0616 時序：第一則提問早於後續 `--ask` 登記，塔台先只答已確定的 Q-3（回函 F-1）。
- **結果**：16 項 claude 路徑無 FAIL、codex 主流程 PASS；未驗項目與 F-1 / O-1 / O-2 見回函 `D:\ForgejoGit\@Gower_Labs\BMad-Guide\_ct-workorders\_reply-2026-10-18-ct-v570-runtime.md`。
- **相關**：PLAN-048 / BUG-154 / CT-T019 / T0614–T0618 / D156

### D156 2026-10-18 — PLAN-048 契約：採用 T0606 全部 12 項推薦；實作切 A（主行程）/ B（helper + MCP，worktree 隔離）並行，C（e2e）合併後

- **背景**：T0606 研究完成介面契約草案（回報區 C-1–C-11）與 12 個待決點。
- **決定**（使用者 2026-10-18 04:50 選定，全部採用推薦）：
  1. Worker 提問走 helper `bat-notify.mjs --ask`（內容只從 stdin 傳入），BAT MCP 維持全唯讀；等答覆以唯讀 MCP `bat_wait_question` 為主、helper `--wait-answer` 為備援。
  2. codex（`blockedDetection: none`）也回 `blocked` / `tower`；T0590 契約「`none` 永遠不會 `blocked`」改為「`none` 永遠不會回 hook reason」，CT 斷點 D 一起改。
  3. 使用者在 Worker 分頁輸入不清除 `tower`、不取消問題；中斷後由 120 s 租約到期 `expired / not-polled`。
  4–12. 通知由 `--ask` 同一指令送 notify（BAT 不主動推送）；租約 120 s（只對 blocking 問題）；`--expires-min` 由 CT 帶 `worker_question_timeout`；塔台分頁結束取消送給它的問題；重複答覆第一個生效、之後 exit `9` CLOSED；新 exit code `9` / `10`；`T#### 提問` 訊息不附問題 id；實作 A → B（契約鎖定後並行，B worktree 隔離）→ C（e2e），文件跟著 A / B。
- **派工**：T0607（A，主 checkout）、T0608（B，`--isolation worktree`）；C 與 CT-T019 轉交在 A / B 合併、契約經實作確認後進行。
- **相關**：PLAN-048 / D155 / T0606 / T0590 / CT-T019

### D155 2026-10-18 — PLAN-048 Worker 問塔台通道：先研究再實作；答覆走 helper CLI；待答問題只存記憶體；等待中為 `blocked` / `tower`

- **背景**：BMad-Guide D036 要求 yolo Worker 以結構化通道問塔台、等答覆，取代 CT v5.5.0 的工單檔往返（PLAN-048）。
- **決定**（使用者 2026-10-18 04:36 選定建議方案）：
  - **進行方式**：先派研究單 T0606 寫介面契約草案，審過後再開實作單，契約同時轉交 CT（CT-T019）。
  - **答覆通道**：塔台以 helper CLI（`bat-terminal.mjs --answer …`）回答，待答問題以唯讀 MCP tool 讀取；BAT MCP 維持唯讀。
  - **持久化**：只存記憶體；BAT 重開後待答問題消失，Worker 收到「已遺失」，CT 改走工單檔往返。「不落地」只指 **BAT 端**：BAT 不另存問答快取、日誌只記 id / 長度 / 結果；**工單照常記錄**問題與答覆（ct-exec 回報區「互動紀錄」，隨工單 commit，屬 CT 紀錄、BAT 不負責保存）（使用者同日澄清）。
  - **狀態**：Worker 等塔台答覆時 `blocked`，新增 `blockedReason: tower`（擴充 T0590 契約，CT 斷點 D 需跟著更新）。
  - 等待方式由塔台預設：單次最多等 45 s，未答回 pending 再呼叫（研究單可提案修正）。
- **不採用**：直接實作（契約可能返工）；MCP 寫入 tool（打破 MCP 唯讀）；寫入檔案保留（內容落地、需另做遮罩與清理）；不算 blocked（斷點 D 無法分辨在等塔台）。
- **相關**：PLAN-048 / T0606 / T0582 / T0584 / T0590 / T0600 / CT-T017

### D147 2026-10-16 — 塔台分頁標題：`/control-tower` 啟動後 BAT 分頁改為 `<Agent 顯示名> · Tower`；BAT 提供 helper `--set-role tower`，CT 啟動時呼叫

- **背景**：使用者要求塔台分頁像 Worker 分頁（T0553 `Claude CLI · Worker · T####`）一樣一眼可辨。BAT 目前沒有讓分頁內程式改標題的管道（不處理 OSC 標題序列、helper 無改名 API）
- **決定**（使用者 2026-10-16 選定，塔台記錄於 14:34:53）：
  - 格式 **`<Agent 顯示名> · Tower`**（例 `Claude CLI · Tower`），分隔與 Worker 一致（` · `）
  - **使用者命名優先**：分頁標題已被使用者改過 → 保留不動；只在標題仍是 BAT 預設值（或已是 Tower 標題）時套用（沿用 T0553 原則）
  - 範圍 **本機 + 遠端**：遠端 tower 權杖新增「只能設定自己」的權限
  - 塔台結束後 **維持** Tower 標題（不偵測 agent 結束、不還原）
  - 分工：BAT 提供能力（T0562：helper `bat-terminal.mjs --set-role tower`、主行程 channel、renderer 套用與持久化）；CT 在 Tower 啟動時呼叫，失敗不影響啟動（CT-T013，由 BMad-Guide 塔台派發）
- **不採用**：處理 OSC 0 / 2 標題序列（任何程式都能改標題，與「使用者命名優先」衝突，且 claude / codex TUI 會自行送標題）；格式 `Claude CLI : Tower`（使用者改選與 Worker 一致）
- **相關**：T0562 / CT-T013 / T0553 / T0538 / PLAN-036 K

---

### D146 2026-10-16 — 安裝檔瘦身：第一階段直接做（T0546）；第二階段推翻 D092「安裝檔內建 server bundle baseline」改隨需下載 + 匯入本機 tarball + 較強壓縮（T0547）；codex 繼續內建；D094 改為每平台上限

- **背景**：pre.3 安裝檔 exe 693.9 / zip 868.8 / AppImage 1030.7 / dmg 871.9 MiB，D094（mac 280 MB）長期超標（L130）。T0544 實測組成：server bundle baseline 228–455、codex 103–155、Electron 94–131、claude 86–114、Windows 重複 claude.exe 86–112、SDK 內建 claude（不執行）48–139、asar 內用不到的 node_modules 約 29–39 MiB
- **決定**：
  - **第一階段**（塔台依 T0544 推薦直接開單，不需推翻決策）：C1 / C2a / C2b / C3 / C4 白名單 / C5 → T0546 DONE（`dc64388d`），預估 exe ≈ 454 / zip ≈ 570 / AppImage ≈ 554 / dmg ≈ 640 MiB；CI 實測待 pre.4
  - **第二階段**（使用者 2026-10-16 選「做 A，加匯入本機 tarball」）：**推翻 D092 的「安裝檔內建 baseline」部分**——三平台安裝檔都不再附 server bundle，首次設定遠端時從 GitHub Release 下載（D120 每版都發 `server-bundle-v<版號>`）；新增 wizard「匯入本機 tarball」（含 `.sha256` 驗證）給離線 / 內網；修正無 baseline 時 cache 無法驗證的缺口；搭配 D1（`compression: maximum`）→ T0547。D093 / D095 / D120 保留
  - **第三階段 B**（使用者選「繼續內建」）：codex 維持內建，不做
  - **D094 改寫**：每個平台安裝檔 ≤ 320 MiB（可攜 zip 另計 ≤ 450 MiB），由 CI `Report artifact sizes` 量測；第二階段 CI 實測後確認數值，並解除 L130
- **定案**（2026-10-16 02:08，`v0.6.1-pre.4` CI 實測，run `38781893001`）：exe 298.0 / zip 412.3 / AppImage 297.3 / dmg 309.6 MiB（pre.3：693.9 / 868.8 / 1030.7 / 871.9）；server bundle linux-x64 158.6 / linux-arm64 157.9 / darwin-arm64 143.5 MiB。**D094 由本決策取代**：每平台安裝檔 ≤ 320 MiB、可攜 zip ≤ 450 MiB，以 CI `Report artifact sizes` 量測；L130（長期超標）解除
- **不採用**：mac 只附一份 baseline 的折衷（dmg 仍約 499）；B1 / B2（codex 不內建）；D2（ULMO dmg，需後處理與重簽）；D3（server bundle 改 xz，遠端需 `xz`）
- **相關**：T0544 / T0546 / T0547 / D092 / D094 / D120 / PLAN-031 / L130

---

### D145 2026-10-15 — `--close-worker` 改為「等分頁安靜再關」：收單時仍有輸出不再拒絕（BUSY），延遲到期後最多再等 60 秒（PLAN-041 實機驗收）

- **背景**：PLAN-041 實機驗收（T0542，claude-cli 2.1.300）：Worker 通知後約 6 秒仍在輸出收尾內容，塔台收單後 9 秒呼叫 `--close-worker` 得 exit 6 `BUSY`；CT v5.1.0 對 6「回報、不重試」⇒ claude Worker 分頁實務上不會被自動回收。30 / 90 秒後探測皆 exit 0，閒置時無週期輸出；codex 分頁閒置亦無週期輸出（T0543）
- **決定**（使用者 2026-10-15 20:1x 選「BAT：等安靜再關」，並指示「等待時間可以放寬，不是所有電腦都很快，慢個 30~60 s 才回收不急」）：
  - 修在 BAT（T0545）；CT 與介面契約不變（exit 6 保留在契約中供舊版 BAT，新 BAT 不再因「最近有輸出」回 6）
  - 請求當下最近有輸出 → 照常排程（exit 0）；延遲期間的**輸出**不再取消，只有**使用者輸入**（本機 `pty:write` / 遠端 client 連線）取消
  - 到期時最近 5 秒仍有輸出 → 等到安靜 5 秒再關，最多再等 **60 秒**；仍未安靜 → 放棄回收並記日誌（分頁保留）
- **不採用**：CT 收到 6 等待後重試（要委派 BMad-Guide 改 CT，塔台收單需等待）；維持手動（自動回收實務上無效）
- **相關**：PLAN-041 / D144 / T0535 / T0536 / T0542 / T0543 / T0545

---

### D144 2026-10-15 — 收單後自動回收 Worker 分頁：開關與延遲放 CT `*config`，BAT 只提供能力與安全檢查（PLAN-041）

- **背景**：使用者問塔台能否在收單後自動關掉 Worker 分頁。T0534 研究：只改 CT 做不到（只有 renderer 能移除分頁；`pty:kill` 留下死分頁；遠端權杖不允許），推薦方案 B'（BAT 提供歸屬驗證的關閉能力，CT 決定時機）
- **決定**（使用者 2026-10-15 15:3x「不做 local_rule，加在下一版 CT」，並問開關與延遲該放 BAT 還是 CT；塔台建議放 CT，使用者指示「依這個方向」開 PLAN，B'-1～B'-4 完整版 + 一張 CT 單）：
  - CT `*config`：`worker_auto_close: off | done`（預設 `off`）、`worker_close_delay: 0–300` 秒（預設 `10`）；只在 DONE 且不 Renew、收單確認後呼叫
  - BAT **不設 Settings 開關**；只在塔台呼叫時動作，固定檢查：歸屬（`BAT_TOWER_TERMINAL_ID` / 遠端 `isWorkerOf`）、工單唯一命中、最近 5 秒有輸出 → `BUSY`
  - 延遲由 BAT 主行程計時；期間有新輸出或使用者輸入即取消
  - 介面：`bat-terminal.mjs --close-worker T#### --notify-id … [--delay-ms]`，exit `0` / `3 NOT_FOUND` / `4 NOT_OWNER` / `5 AMBIGUOUS` / `6 BUSY` / `1` 其他（舊 BAT 對未知參數 exit 1，不建立分頁）
  - 工單：T0535（本機）、T0536（遠端）、T0537（持久化歸屬）、CT-T011（CT 下一版，取代 local_rule）；BAT 三張併入 `0.6.1-pre.3`
- **不採用**：只改 local_rule（A，做不到真正關閉）；BAT 收到「完成」通知自動關（C，BAT 內嵌 CT 語意、塔台尚未收單即關閉）；BAT 與 CT 兩邊都設開關（使用者需設兩處，BAT 回 `DISABLED` 時塔台無法分辨原因）；遠端開關以哪一邊為準（隨開關移到 CT 而不存在）
- **補充**（2026-10-15 16:13，使用者「完整版包含這部分」）：方案 D（分頁標示 + 批次關閉）納入 PLAN-041（T0538）；T0534 §8 衍生問題另開 PLAN-042（T0539 / T0540 / CT-T012）；BAT 工單同一工作樹依序派發不並行
- **相關**：PLAN-041 / PLAN-042 / T0534 / T0535 / T0536 / T0537 / T0538 / CT-T011

---

### D143 2026-10-15 — 預覽版改走 `0.6.1-pre.N` 版號線；pre.11 照發，T0532 隨 `v0.6.1-pre.1` 發佈

- **背景**：`v0.6.0-pre.10` / `pre.11` 起，`-pre.N` 兩位數在部分以字串排序的列表中排到 `pre.9` 之後，最新版不在最上方
- **決定**（使用者 2026-10-15 01:47 指示「改版號到 0.6.1-pre.1 方便排序最上方」，選「pre.11 跑完，接著發 0.6.1-pre.1」）：
  - `v0.6.0-pre.11`（BUG-134，run `38607028430` @ `49af84ca`）照常發完，不取消、不刪除
  - 隨即發 `v0.6.1-pre.1`（run `38610008131` @ `e715c2b1`，含 T0532 / BUG-135），原訂 pre.12 批次提前
  - 之後預覽版沿用 `0.6.1-pre.N`（下一版 `0.6.1-pre.2`）；`-f version=` 仍須顯式指定（L123）
- **不採用**：取消進行中的 pre.11 run（release job 已在建立 GitHub Release，取消可能留下孤兒 release / tag）
- **相關**：BUG-134 / BUG-135 / T0531 / T0532 / L150

---

### D142 2026-10-14 — PLAN-040 擴大為「工作區層級 Agent ＋ 啟動參數」，現在開工（T0529）；以 preset 為單位覆寫全域、detached 只讀、helper `--agent` 派工套用生效參數

- **背景**：`v0.6.0-pre.9` 發佈後使用者詢問是否已含「各 workspace 獨立設定 Agent 與啟動參數」—— 未含：PLAN-040 尚未開工，且原範圍只有 Agent，沒有啟動參數（全域 `settings.agentCustomArgs`，T0128）
- **決定**（使用者 17:4x 選「一起做」「現在拆單派工」；以下細節塔台裁決）：
  - `Workspace.agentCustomArgs?: Record<presetId, string>`；以 preset 為單位：無 key = 跟隨全域，有 key（含空字串）= 整串取代，不串接
  - `defaultAgent` 未設 = 跟隨全域；D140 查找順序不變
  - 生效值解析集中單一函式
  - detached 視窗設定入口只讀（不動 `saveDetachedWorkspaceTerminals` 語意）
  - 外部 helper `--agent` 模式（含 `default`）套用落點工作區的生效參數，與 UI 按鈕一致；raw command 模式不加
  - 遠端 headless 不做
  - 不等 外部測試者A pre.9 回饋；回饋若帶出新 BUG 併入同批，整批完成後發 pre.10（D139）
- **不採用**：工作區參數與全域串接（無法表達「這個工作區不要某個全域旗標」）；detached 視窗經 main `updateEntry` 寫入（成本高，先只讀）
- **相關**：PLAN-040 / T0529 / D140 / T0128 / T0523 / T0527

---

### D141 2026-10-14 — BUG-129 外部測試者A 情境判定 #11 → 開 BUG-132；先做 cwd 一致性檢查（T0527，T0526 建議 [B]），PID 鏈根治入 backlog

- **背景**：T0526 以 外部測試者A 日誌判定 BUG-129 為 T0523 §1 #11：外部測試者A 的 Codex 在 專案D 分頁看到的 `BAT_TERMINAL_ID` / `BAT_WORKSPACE_ID` 整天都是專案B 塔台分頁的值（agent CLI 自行保存的環境），`--notify-id` 與 `--workspace` 都錯，pre.8 的「塔台終端優先」救不回；yolo 時 Worker 完成訊息會送進專案B 塔台。開成 Claude 是另一個原因（當時全域 Settings 未存、工作區層級無 UI → PLAN-040）
- **決定**（yolo 授權，塔台依 breakpoint C 裁決）：
  - 開 **BUG-132**（#11）；BUG-129 維持 FIXED（BAT 端 #4 / #5 / #10 已在 pre.8 修），待 外部測試者A pre.8 回饋後結案
  - **T0527**：派工 cwd 與落點工作區 `folderPath` 一致性檢查。不一致 → 警告；**只有** yolo 且 cwd 明確屬於另一個工作區時拒派（cwd 不屬於任何工作區時不擋，保留跨專案派工）；併做 `--agent codex` 簡寫與未知 agent id 提示
  - [A] PID 祖先鏈辨識呼叫者 PTY：backlog，#11 反覆發生或其他 agent CLI 出現同類情況時提高優先
  - [C] codex-cli preset 關 shell snapshot：等 外部測試者A 確認機制再評估
  - T0527 併入下一批（與 PLAN-040 一起），不單獨發版（D139 / 整批再發）
- **不採用**：yolo 下 cwd 不一致一律拒派（會誤擋跨專案派工）；直接做 [A]（Windows 取祖先鏈成本高、daemon 執行時鏈會斷，先用便宜檢核擋住實害）
- **待辦**：control-tower skill `references/auto-session.md` 補「派工前核對 `$BAT_WORKSPACE_ID` 工作區是否涵蓋 cwd」屬 skill 上游修改，塔台不寫安裝版 skill，記入 backlog
- **相關**：BUG-129 / BUG-132 / T0523 / T0526 / T0527 / PLAN-040 / D140

---

### D140 2026-10-14 — `--agent default` 維持現有語意（落點工作區 defaultAgent → Settings defaultAgent → claude-code）；T0521-T0525 批次發 v0.6.0-pre.8

- **背景**：BUG-129（外部測試者A 的 Codex 塔台派工開成 Claude）。T0523 修正落點後，`default` 以落點工作區解析；外部測試者A 的 專案D 工作區與全域推定未設 Codex，所以仍會開 Claude。T0523 §4 提出選項 B：工作區 / 全域都未設時改用塔台終端自己的 agent preset
- **決定**：使用者選 **A**（2026-10-14 14:07，14:17 確認）。不改 `default` 語意；選項 B 不做
- **更正（14:21，使用者指出）**：工作區層級的預設 agent **沒有 UI 可設**。`Workspace.defaultAgent` 欄位存在且被讀取（`src/types/index.ts:18`、`App.tsx:855`、`WorkspaceView.tsx:519/641`、`electron/main.ts:543`），但 store 與 UI 都沒有寫入點，實務上恆為空 ⇒ 查找順序第 ① 層目前形同不存在。外部測試者A 現在可用的做法：全域 Settings → 預設 Agent 設 Codex（他兩個工作區都用 Codex），或塔台派工帶 `--agent codex`（他的 Codex 塔台已自行改用）。工作區層級設定 UI 另案評估
- **發版**：BUG-127-131（T0521-T0525）聯合複驗全綠（13:58 @ `b00c4f9`）後，使用者同意發 `v0.6.0-pre.8`
- **相關**：BUG-129 / T0523 / D139（整批修完再發版）

---

### D138 2026-10-13 — BUG-119 userData 統一：採 T0479 推薦 (a)+(c)+(b)，統一到 `BetterAgentTerminal[-runtime-<N>]/`，拆 A / B / C 三張

- **背景**：T0479 研究完成。`snippet-db` import 期 `getPath('userData')` 把小寫路徑寫進 PathService 快取，`Local State`（safeStorage 金鑰）/ lock / Logs / Crashes / `message-archives` / mirror `bat-scripts.log` 落小寫，設定與 sessionData 落大寫；runtime 實例整個在 `better-agent-terminal-runtime-N`。衍生：啟動時日誌設定被忽略。🔴 統一時若未在 ready 前複製 `Local State`，`server-token.json` 解不開 → 遠端全部重配（probe 實證）
- **決定**（使用者 22:20 裁決先研究再修；細節塔台依 breakpoint C 決定）：
  - 統一到大寫（設定 / whisper 模型 / sessionData 已在此，反向需搬 GB 級資料）
  - **T0480（A，P1）**：`app-paths-bootstrap.ts` 為 `main.ts` 第一個 import：`setName` → runtime → ready 前同步 migration（`Local State` 缺才複製、snippets 複製 / 合併、`message-archives` 單檔 rename、runtime 目錄整個改名、marker 只跑一次、一律複製不刪舊、失敗不阻擋）→ 顯式 `setPath('userData')`；`snippetDb` lazy；whenReady 自檢；單元 + 產物順序 + e2e
  - **T0481（B，P2，與 A 並行）**：本機 PTY 注入 userData env，helper 以 env 為準
  - **T0482（C，文件）**：A / B 完成後
  - runtime 實例 snippets 改為各自一份（不從預設實例複製）
- **不採用**：單獨 (b)（日後任一 import 期 getPath 即靜默回歸）；單獨 (c)（setPath 仍晚於 import 期取值）；統一到小寫；搬走 / 刪除舊目錄（降版不安全）
- **另案**：T0479 選配 D（提早 logger.init / early uncaughtException，BUG-116 可診斷性）；macOS PATH 修正實際晚於 import（範圍外發現 4）
- **殘餘風險**：mac Keychain / Linux libsecret 與 `Local State` 關係未驗證，需 mac 實機確認升版後 server-token 不變
- **相關**：BUG-119 / T0478 / T0479 / T0480 / T0481 / T0482

---

### D137 2026-10-13 — fork 的 release.yml 下游發佈（Homebrew tap / Chocolatey）改為 opt-in、預設關閉；README 移除指向上游套件的安裝方式；`DESKTOP_PACKAGE_HOSTS` 移除 `darwin-x64`

- **背景**：T0475 發現 `release.yml` 正式版 tag 會 `repository-dispatch` 到 upstream 的 `tonyq-org/homebrew-tap`（本 fork 的 v0.x 版號送進上游 tap）；塔台複查另見 `choco` job 的日期 gate（2026-04-10）已過期，正式版會 `choco push` package id `better-agent-terminal`（chocolatey.org 上 owner 為 tonyq），installer 檔名規則亦與本 fork 不符。README「快速開始」方式一 / 二指向上游 tap 與上游 choco 套件，安裝到的是上游版本線。D136 後 Intel Mac 不再是打包 host
- **決定**（使用者 2026-10-13 指示「另外發現也安排修正」，細節由塔台依 breakpoint C 決定）：
  - `Update Homebrew tap` 改為 opt-in：tap repo 改讀 repo variable（`vars.HOMEBREW_TAP_REPO`），未設定即跳過；不再寫死 `tonyq-org/homebrew-tap`
  - `choco` job 改為 opt-in：`vars.CHOCOLATEY_PUBLISH == 'true'` 才跑，移除過期日期 gate
  - README 移除 Homebrew / Chocolatey 安裝方式（本 fork 未發佈這兩個通道），只留直接下載
  - `verify-native-modules.js` `DESKTOP_PACKAGE_HOSTS` 移除 `darwin-x64`（Intel Mac host 改為 warn-only）
- **不採用**：整段刪除 step（日後 fork 自建 tap / choco 時要重寫）；以 `github.repository` 判斷（換 owner / 轉移 repo 時會靜默失效）；保留 README 方式一 / 二僅加註（使用者仍會裝到上游版本）
- **相關**：T0475 / T0476 / D136 / BUG-117

---

### D136 2026-10-13 — v0.6.0-pre.3 範圍：BUG-116 + BUG-118 一併修、BUG-117 採 B3 停發 Intel Mac（x64）dmg

- **背景**：BUG-116（所有 mac 啟動崩潰，T0468 已修）待發 pre.3；T0474 以 pre.2 實物證實 BUG-117（x64 dmg 84 個 binary 中 55 個為 arm64：內嵌 claude / codex / node-pty / whisper 皆 arm64，上游 whisper `mac-x64` 實為 arm64）並發現 BUG-118（electron-builder 非 Windows 目標排除 node_modules 內 `.exe` → mac / Linux 打包版無 `claude-code/bin/claude.exe`，內嵌 claude 不可用）
- **決定**（使用者 2026-10-13 17:02 裁決）：
  - **BUG-118 放進 pre.3**：採 T0474 方案 A1（非 win32 的 electron-packaged 版面改指 `claude-code-<platform>-<arch>[-musl]/claude`，`bin/claude.exe` 為 fallback，加 existsSync）＋ 擴充 `verify-packaged-native.js` 檢查打包產物內嵌 claude 存在且 arch 正確
  - **BUG-117 採 B3**：`mac.target.arch` 只留 `arm64`，停發 Intel Mac dmg；release notes 寫明不支援 Intel Mac。D057（不改回 universal）仍有效，雙 arch dmg 的部分由本決策取代
- **不採用**：B1（Intel runner 分 job：CI 時間約加倍、Intel runner label 存續不確定，且 Intel 上語音仍因上游無 x64 binary 無解）；B2（同 host 換子套件：子套件清單 whack-a-mole）；BUG-118 延到下一版（pre.3 主要受益者 mac 使用者仍無內嵌 claude）
- **相關**：BUG-116 / BUG-117 / BUG-118 / T0468 / T0470 / T0474 / T0475 / D057

---

### D135 2026-10-05 — PLAN-039 多 remote profile 同時連線：拆單與時程（T0459 研究結論）

- **背景**：T0459 研究完成（`49d71f9`），Worker 期間使用者裁決 Q1（最後視窗關閉 + 15 s 寬限期再斷）、Q2（同時連線上限 8，超過拒絕）、Q3（兩 profile 同 target 允許 + warn）；建議 5 張單，其中工單 2 為 🔴 L（大範圍改 `main.ts` 熱點並遷移 T0419 / T0430 / T0442 / T0443 / T0446 守門）
- **決定**（使用者 11:28 裁決「下 session 做」）：本 session 只開單不派發。下 session 排程：

| # | 標題 | 專案 | 依賴 | 工時 | 🚦 |
|---|------|------|------|------|-----|
| 1 | T0462 connection registry 模組 + 純函式以 profile 為鍵（不接 main.ts） | 本專案 | — | M | 🟢 |
| 2 | T0465 SSH tunnel 本機埠健壯性 | 本專案 | — | S | 🟢 |
| 3 | T0463 main.ts 以 registry 取代單一槽位（執行期間不派其他改 main / preload / d.ts 的單） | 本專案 | T0462 | L | 🔴 |
| 4 | T0464 生命週期接線（寬限期 / 上限 / quit） | 本專案 | T0463 | M | 🟡 |
| 5 | T0466 e2e 兩實例 + WSL / SSH 實機步驟 | 本專案 | T0464 | M | 🟡 |

- **理由**：本 session 已近 6 小時、`main.ts` 為本 session 最多平行修改的熱點，需在穩定基線上開工；工單 1 / 4 可平行起手
- **不採用**：立即續做全部（風險集中在 session 尾）；只先做 1 + 4（仍會在 session 尾留半套狀態）
- **相關**：PLAN-039 / T0459 / BUG-110 / D134

---

### D134 2026-10-05 — 第五十五 session YOLO 排程：遠端收尾小單 + SSH / Docker 安全 BUG + 兩張設計研究

- **背景**：第五十四 session 收工待辦第 3、4 項。使用者 05:33 裁決範圍為批 1（小單）+ 批 2（遠端安全）+ 批 3（設計研究）；批 4（BUG-084 Phase 2 SDK 0.3、PLAN-035 Phase 2）留待後續 session
- **決定**（使用者 05:33 裁決）：
  - BUG-106：**移除** `worktree:merge` 殘留（與 `3a470eb` 讓使用者以 CLI merge 的設計一致），不補回實作
  - BUG-098：**移除 SSH 精靈 direct 模式**，只保留 tunnel（不為 direct 設計對外 bind 的暴露面）
  - BUG-099 + BUG-100 合一張：runner 取消時 rollback 失敗中的步驟 + 實作 `ssh.stopServer` / `ssh.uninstallBundle`
  - K（遠端 Tower 通知）與自由文字路徑轉換先開研究單，實作依研究結論另行決策
  - 本 session `auto-session: yolo`（未 `--save`），研究單 `--interactive`、實作單 `--no-interactive`
- **排程表**（依賴欄位為檔案鎖或邏輯前置；同工作樹平行，L141：Worker 只跑 unit test + tsc，vite build / e2e 由塔台每波聯合複驗）

| # | 標題 | 專案 | 依賴 | 工時 | 🚦 |
|---|------|------|------|------|-----|
| 1 | T0417 BUG-106 移除 worktree:merge 殘留 | 本專案 | — | S | 🟢 |
| 2 | T0418 BUG-097 Docker 埠綁 loopback + container bind + HEALTHCHECK | 本專案 | — | S | 🟢 |
| 3 | T0419 BUG-096 renderer 遠端重連帶 fingerprint / 重用已驗證 client | 本專案 | — | S | 🟢 |
| 4 | T0420 研究：K 遠端 Tower 通知（helper / token 注入設計） | 本專案 | — | M | 🟡 |
| 5 | T0421 研究：自由文字中的 client 路徑轉換 | 本專案 | — | M | 🟡 |
| 6 | T0422 J always-local 改分類（snippet / logging） | 本專案 | T0417, T0419 | S | 🟢 |
| 7 | T0423 headless git / gh 子行程 `BAT_*` scrub | 本專案 | T0417 | S | 🟢 |
| 8 | T0424 遠端 PTY 達上限 UI 提示 | 本專案 | T0419 | S | 🟢 |
| 9 | T0425 BUG-098 移除 SSH direct 模式 | 本專案 | T0424 | S | 🟢 |
| 10 | T0426 BUG-099 + BUG-100 精靈取消 rollback + SSH stop / uninstall IPC | 本專案 | T0425 | M | 🟢 |
| 11 | T0427 既有 Docker container 暴露偵測 + 引導重建 | 本專案 | T0426 | S | 🟢 |
| 12 | T0428 Docker 文件同步（移除 `/health`、`BAT_SERVER_PORT`） | 本專案 | — | S | 🟢 |
| 13 | T0429 headless worktree / git-scaffold env scrub | 本專案 | T0422 | S | 🟢 |
| 14 | T0430 remote:connect 失敗分支舊 client 處理 | 本專案 | T0422 | S | 🟢 |

| 15 | T0431 K-1 headless `terminal:*` + 事件 | 本專案 | T0429, T0430 | M | 🟢 |
| 16 | T0432 K-2 每 PTY 範圍權杖（+ log 不印 token 前綴） | 本專案 | T0431, T0424 | M | 🟡 |
| 17 | T0433 K-3 helper 隨 bundle + PTY env 注入 | 本專案 | T0432 | M | 🟢 |
| 18 | T0434 K-4 端到端驗收 + 文件 | 本專案 | T0431, T0432, T0433 | M | 🟡 |

| 19 | T0435 BUG-107 拖放 `webUtils.getPathForFile` | 本專案 | — | S | 🟢 |
| 20 | T0436 BUG-108 圖片附件 client 端讀取 | 本專案 | T0435 | M | 🟡 |
| 21 | T0441 BUG-109 `/snippet` prompt 路徑 | 本專案 | T0436 | S | 🟢 |
| 22 | T0437 `remote:resolve-client-paths` + 遠端附件 | 本專案 | T0441, T0431 | M | 🟢 |
| 23 | T0438 複製遠端路徑選單 | 本專案 | T0437 | S | 🟢 |
| 24 | T0439 終端拖放檔案 | 本專案 | T0438 | S | 🟡 |
| 25 | T0440 prompt 內 client 路徑提示（非阻斷） | 本專案 | T0439 | S | 🟡 |
| 26 | T0442 remote client candidate 清理 + pin 變更 fail-closed | 本專案 | T0431 | S | 🟢 |
| 27 | T0443 BUG-110 遠端視窗未連線 fail-closed 路由 + 狀態事件 | 本專案 | T0442 | M | 🟢 |
| 28 | T0444 BUG-111 精靈 rollback 只清精靈自有資源 | 本專案 | T0427 | S | 🟢 |
| 29 | T0445 安全 review：T0432 每 PTY 範圍權杖（只出 findings） | 本專案 | T0432 | M | 🟡 |
| 30 | T0446 BUG-112 detached workspace 視窗綁回 profile（fail-closed） | 本專案 | T0443 | S | 🟢 |
| 31 | T0447 🔴 RemoteServer 預設拒絕 + frame 強化（T0445 #1/#2/#3） | 本專案 | — | S | 🔴 |
| 32 | T0448 restart 保留權杖角色（T0445 #4） | 本專案 | T0433 | XS | 🟡 |
| 33 | T0449 auth 節流分流（T0445 #5/#8） | 本專案 | T0447 | S | 🟡 |
| 34 | T0450 helper 能力收斂（T0445 #6/#7） | 本專案 | T0449 | M | 🟡 |
| 35 | T0451 helper 連線衛生（T0445 #9） | 本專案 | T0450 | XS | 🟢 |
| 36 | T0452 精靈重試路徑（Docker start 重試 / write-profile 孤兒） | 本專案 | T0444 | S | 🟢 |
| 37 | T0453 BUG-113 detached workspace 載入（自 `512c118` 失效） | 本專案 | T0446 | M | 🟡 |
| 38 | T0454 scripts 測試換行無關（CRLF checkout 4 檔失敗） | 本專案 | T0434 | S | 🟢 |
| 39 | T0455 client heartbeat 檢查 pong（半開 client 不再計入回收） | 本專案 | T0451 | XS | 🟢 |
| 40 | T0456 遠端 PTY PATH 尾端加 bundle node + `BAT_HELPER_NODE`；bat-terminal `false` → exit 1 | 本專案 | T0434 | S | 🟢 |
| 41 | T0457 `will-navigate` 對 `file:` 等不 `openExternal`（防 ShellExecute 執行本機檔） | 本專案 | T0439 | XS | 🟢 |
| 42 | T0458 所有帶 preload 的視窗（含 detached）套用導航守門 | 本專案 | T0457 | S | 🟡 |
| 43 | T0459 研究：PLAN-039 多 remote profile 同時連線 | 本專案 | — | M | 🟡 |
| 44 | T0460 `shell:open-external` 可執行副檔名確認對話框 | 本專案 | — | S | 🟢 |
| 45 | T0461 IPC `shell:open-external` scheme 白名單（擋 `ms-msdt:` 等）+ `shell:open-path` 可執行確認 | 本專案 | T0460 | S | 🟢 |

- **追加**（使用者 11:19 裁決）：第 1-42 列完成並通過最終聯合驗證後，push `e11a2f6..6286c11`（86 commits，不發版）；開 PLAN-039 研究單 T0459；T0457 遭遇問題 1 → 可執行副檔名開啟前確認（T0460，其他檔案照舊）

- **追加**（塔台 06:32 依授權，T0445 BLOCK）：T0434 改依賴 T0447 + T0448（#1-#4 修完才進實機）；#6/#7 的設計裁決取**收緊**方向（`pty:write` 拒 C0 控制字元、tower 子 PTY ≤ 8 + 1 秒間隔 + client 保留 8 格、agent 限 registry），不擴大暴露面故未交使用者；#5 權杖失敗不計 IP ban、與 server token 失敗分開計數

- **追加**（使用者 06:14 裁決）：多 remote profile 同時連線開 **PLAN-039**（PLANNED），**排在本批（D134 第 1-28 列）全部完成之後**，先開 Phase 0 研究單

- **追加**（塔台 06:12 依授權決定）：BUG-110（high）—— T0430 / T0442 回報的「槽位空時 invoke 落本機」經塔台複核 `main.ts` `bindProxiedHandlersToIpc` 屬 fail-open，且單一 `remoteClient` 槽位導致兩個不同 remote profile 同時開窗時先開者靜默變本機。T0443 只做 fail-closed + 狀態事件；**多 profile 同時連線（per-profile client map）屬架構變更，交使用者決定**

- **授權變更**（使用者 05:55「塔台給最佳建議，直接決定」）：本 session 起 scope 內的斷點 C / 排程選擇由塔台直接裁決、事後回報；push / release、破壞性操作、產品方向與擴大暴露面的安全取捨仍交使用者。第 26 列即據此由塔台決定（T0430 回報兩項合併）

- **追加**（T0421 研究，使用者 05:51 裁決全數納入）：第 19-25 列對應 T0421 拆單 1-6 + BUG-109；新開 BUG-107（拖放）/ BUG-108（圖片附件）/ BUG-109（snippet prompt）、PLAN-038（檔案上傳到遠端，IDEA，本期以拒絕代替）。`ClaudeAgentPanel.tsx` 檔案鎖串行：T0435 → T0436 → T0441 → T0437 → T0440；BUG-107 修好後遠端附件會送 client 路徑，**T0435 與 T0437 須同版發佈**
- **追加**（使用者 05:46 斷點 C 合併裁決，全數納入）：第 11-14 列來自 T0418 / T0419 / T0423 回報區的 scope 外建議
- **追加**（T0420 研究，K 採 A' 每 PTY 範圍權杖，使用者於 Worker 期間裁決）：第 15-18 列對應 T0420 拆單 1-4；T0420 範圍外 ②（`remote-server.ts` log 印 token 前 8 碼）併入 T0432；①（ct skill 降級判斷，非本 repo）③（本機回移 A'）記 backlog

- **不採用**：批 4 同 session 一併跑（SDK 0.3 與 PLAN-035 Phase 2 各需專注、斷點機率高）；BUG-098 修通 direct（需對外 bind，與 BUG-097 同類暴露面）
- **相關**：PLAN-036 P3（J / K）、T0386 建議清單 J / K、BUG-096-100 / 106、L141

---

### D133 2026-10-05 — PLAN-037 拆單與波次（T0407 研究結論）

- **背景**：T0407 研究完成，Worker 期間經使用者裁決 Q1（偵測在 server 端新共用模組）、Q2（確認框後自動執行 + 完成標記）、Q3（使用者空間優先）；建議 7 張單 A-G，其中 B / E 碰 D130 的串行檔案鎖（`main.ts` / `protocol.ts` / `headless-entry.ts`）
- **決定**（使用者 02:51 裁決「照研究建議」）：A = T0408、C = T0409（立即平行）→ D = T0410 → B = T0411 → E = T0412 ∥ F = T0413 → G = T0414 → PLAN-036 T0405 → T0406。符合 D131「實作在 T0405 前完成」
- **附帶**：T0405 搬 `github:check-cli` 時改用 `gh auth status` exit code（現行 `gh auth token` 會把 token 印到 stdout）
- **不採用**：T0405 提前到 B 之後（git 更早上遠端，但一鍵安裝延後）；先做完 PLAN-036
- **相關**：PLAN-037 / T0407 / D131 / D130 / PLAN-036

---

### D132 2026-10-05 — `claude:auth-status` 在 exit≠0 時仍解析 stdout

- **背景**：T0401 發現 `claude auth status` 未登入時 exit 1，stdout 仍為 `{"loggedIn": false, …}`；handler 走 err 分支回 `null`，無法區分「未登入」與「runtime 壞掉」，T0402 登入引導需要此區分
- **決定**（使用者 02:34 裁決）：exit≠0 時若 stdout 為含 `loggedIn` 欄位的 JSON 就照實回傳，否則照舊 `null`；本機與遠端同一份實作（`electron/handlers/claude.ts`），本機 Claude 面板也受惠
- **不採用**：維持 `null`（引導只能顯示模糊提示）
- **相關**：T0401 / T0402 / PLAN-036 / D130

---

### D131 2026-10-05 — 遠端 AI 工具套件：檢查＋一鍵安裝（PLAN-037）

- **背景**：PLAN-036 讓遠端有功能 handler，但遠端機器上的 claude / codex CLI、git、gh 是否安裝無機制處理（WSL 實測無系統 claude、未登入；codex 不在 server bundle；T0405 git 上遠端依賴遠端 git / gh）
- **決定**（使用者 02:28 裁決）：
  - 範圍 **B**：偵測安裝 / 版本 / 登入狀態＋缺的工具以按鈕在**遠端終端分頁**打入官方安裝指令（sudo 在分頁內輸入；免 sudo 者裝 `~/.local/bin`）
  - 入口：WSL / SSH 精靈最後一步「工具檢查」＋遠端 profile 設定頁隨時重跑
  - 排程：開 PLAN-037 + 研究 T0407，與 PLAN-036 平行；實作在 T0405（git 上遠端）前完成
- **不採用**：A 只檢查不安裝；C 打包進 server bundle（安裝檔變大、D094 已超標、版本綁死重演 BUG-083 / 084）
- **相關**：PLAN-037 / T0407 / PLAN-036 / PLAN-035 / D130

---

### D130 2026-10-05 — PLAN-036 P0 自動驗收結案與 P1 開工排程

- **背景**：P0（T0388-T0391、T0393）的實機驗收改為自動化（使用者 01:12 裁決兩層都做）：T0396 協定層 smoke 對 WSL `ea52b03` server 8/8 PASS；T0397 Playwright Electron e2e 4/4 PASS（source build）。使用者 01:36 裁決 BUG-095 / BUG-101 據此 CLOSED
- **決定**（使用者 01:40 裁決 P1 範圍：Claude 面板上遠端 + 遠端終端收尾 + git / fs 上遠端）：
  - 範圍與編號：T0400 E（ClaudeAgentManager DI）→ T0401 F（`claude:*` 上線 headless + UI 降級 + 事件補齊）→ T0402 G（遠端登入引導）；T0403 遠端終端收尾 A（斷線輸出回放 `pty:get-buffer` + `pty:create` 回傳是否新 spawn）；T0404 遠端終端收尾 B（孤兒 PTY 回收 + BUG-103 serverEnv）；T0405 H（git / github / worktree / git-scaffold）；T0406 I（fs / image + `workspace:sync-roots`）
  - **排程以檔案鎖決定**（所有 Worker 共用同一個工作樹，同檔平行會讓 `git commit --only` 夾帶他人未完成的 hunk）：`main.ts`（E/F/H/I）、`protocol.ts`（F/I/T0403）、`pty-manager.ts`（T0398/T0403/T0404）、`headless-entry.ts`（F/H/I/T0404）各自串行
  - 波次：① T0400（與 T0398 / T0399 平行）→ ② T0398 完成後 T0403 與 T0400 平行 → ③ T0400 + T0403 完成後 T0401 → ④ T0402 ∥ T0404 → ⑤ T0405 → ⑥ T0406
  - 只先寫 T0400；T0401-T0406 編號保留，前一波完成後依實際結果撰寫（避免 E 的 DI 形狀未定就寫死 F）
- **不採用**：git worktree 隔離平行（`main.ts` 大段搬移的 merge 成本與塔台合併負擔高於串行等待）；一次寫完 7 張
- **相關**：PLAN-036 / D129 / T0396 / T0397 / BUG-095 / BUG-101 / BUG-102（T0398）/ BUG-103

---

### D129 2026-10-04 — PLAN-036 headless 功能 handler 層（T0386 研究結論）

- **背景**：T0385 / T0386 證實 headless bat-server 註冊的功能 handler 為 0（`scripts/bat-server.mjs:118` 不傳 `handlers`；spec §2.3 的 `electron/handlers/` 從未落地），WSL / SSH / Docker 遠端 profile 只能開空視窗。`PROXIED_CHANNELS` 105 個（實際代理 103）
- **決定**（T0386 Worker 研究中經使用者選項式裁決 Q1-Q3；拆單由使用者於塔台裁決）：
  - 架構：**共用註冊模組 + DI**（`electron/handlers/*.ts` 的 `registerXxxHandlers(register, deps)`，兩端各自組 `HostDeps`），不做 electron shim、不做 headless 專用實作；以 channel parity test + electron-free guard 防漂移
  - fs sandbox：client 推送轉換後的 workspace roots（新 channel，未推送前 fail-closed）
  - 遠端 Agent：沿用遠端 settings 的 runtime router；embedded resolver 合一並支援 bundle `bin/claude`
  - 拆單：P0 = T0388（骨架 + 守門）/ T0389（router + PtyManager DI）/ T0390（pty 上線）/ T0391（dev 部署工具）；T0388 + T0391 立即平行，T0389 等 T0387（同改 `main.ts`），T0390 接 T0388 + T0389；P1-P3（T0386 清單 E-K）待 P0 實機驗收後開
  - 排程：PLAN-036 P0 優先於 PLAN-035 Phase 2（無程式碼依賴，但沒有終端的遠端環境自動化沒有價值）
  - 獨立 BUG：BUG-095（`claude:abort-session` 無 IPC，T0392 優先修）、BUG-096（renderer 遠端 connect 不帶 fingerprint）、BUG-097（Docker 埠暴露 / 可達性）
- **不採用**：一次開完 11 張（P1 後內容可能因 P0 結果變動）；全串行
- **相關**：PLAN-036 / T0386 / T0388-T0392 / BUG-095~097 / PLAN-035 / D128

---

### D128 2026-10-04 — PLAN-035 Phase 1 拆單（T0380 研究結論）

- **背景**：T0380 證實 WSL 精靈在預設設定下無法完成，有三個彼此獨立的原因：① 「取得 TLS 指紋」對沒有 HTTP handler 的伺服器發 GET 且無 timeout，永久卡住，WSL / SSH / Docker 共用（BUG-090，塔台複核程式碼屬實）；② WSL bat-server 預設埠 9876 與主機 RemoteServer 相同，Mirrored 下 `EADDRINUSE`，且 `startService` 把 crash-loop 判成功（BUG-091）；③ 沒有 `wsl.exe` 連線時發行版約 15 秒關閉（BUG-092）。另 BUG-089 證實為判定錯誤，使用者 Mirrored 已生效
- **決定**：
  - Phase 1 拆 4 張實作單，**串行** T0381 → T0382 → T0383 → T0384（四張都改 `electron/main.ts`，同一工作樹平行會互相污染 `git commit --only`）；先修指紋與埠，否則精靈走不到底、其他修正無法實機驗收
  - 指紋改 TLS 握手取對端憑證指紋（`getPeerCertificate().fingerprint256`），全路徑 timeout
  - WSL 伺服器埠改為 Windows 端探測可用埠，排除主機 RemoteServer 實際使用的埠
  - 保活：使用者裁決「只需 BAT 執行時可用」⇒ BAT 持有長駐 `wsl.exe -d <distro> -- sleep infinity`，**不改**全機 `instanceIdleTimeout`；設定開關延後到 Phase 2 評估
  - 網路模式：NAT 不必強制改 Mirrored（`localhostForwarding` 預設開啟）⇒ PLAN-035 環節 6 改為**選用、預設不勾**；Phase 1 只修判定與文案
  - Phase 2 / 3 拆單沿用 T0380 目標 6 建議（P2-a~c、P3-a~d），Phase 1 驗收後再開
- **不採用**：四張平行（`main.ts` 衝突）；改全機 `instanceIdleTimeout=-1`（影響所有發行版，超出使用者裁決範圍）；Windows 登入排程常駐
- **相關**：T0380-T0384 / BUG-089~092 / PLAN-035 / D127

---

### D127 2026-10-04 — WSL 環境全自動化（PLAN-035）

- **背景**：BUG-087 實機驗收時精靈第 1-5 步通過，第 6 步顯示 NAT 警告，但使用者 `.wslconfig` 已是 `networkingMode=Mirrored`（BUG-089：`detectNetworkMode` 以 default route 含 `via` 判 NAT）；塔台同時發現 `Ubuntu-24.04` 為 `Stopped`，疑似 WSL 閒置關閉發行版導致 bat-server 停止。使用者要求：WSL 相關設定都應自動化，從未安裝 WSL 起或環境不符時，詢問允許後自動設定
- **決定**（使用者選項式裁決）：開 PLAN-035，**研究先行**（T0380）再拆實作單；同意模型為**列清單一次同意**（先偵測、列出所有將變更項目並標示影響範圍、可勾選、一次執行）；WSL 未安裝時**全自動，含重開機後接續**；BUG-089 與常駐問題併入 T0380 研究
- **不採用**：跳過研究直接實作（重開機、WSL 版本差異會延到實作時才發現）；每項分別確認（點擊過多）；只引導不安裝 WSL
- **相關**：PLAN-035 / T0380 / BUG-089 / BUG-087 / D126

---

### D126 2026-10-04 — WSL 精靈 systemd 步驟與無發行版偵測合併修復

- **背景**：BUG-071 實機驗收第 4 步通過後，第 5 步必失敗。塔台環境檢查：`loginctl enable-linger` 未帶使用者在 `wsl --` 非登入 session 回 ENXIO（帶 `<使用者>` 即成功、不需 sudo）；unit 檔 `ExecStart="~/..."` 被 systemd 判 `bad-setting`；第 5 步失敗後 `~/.local/bat-server` 已被 `rm -rf`，但第 4 步仍顯示 ✓。另第 1 步在「有 WSL 無發行版」時誤報找不到 WSL2（BUG-086）
- **決定**：一張實作單 T0378 修四項（同屬 WSL 精靈 / `wsl-detect` / `wsl-systemd`，affects_files 重疊，拆單會互相衝突）。linger 帶 `id -un` 使用者名稱、以 `loginctl show-user -p Linger` 判定；unit 用絕對 `$HOME`；可重試失敗不回滾前步（回滾只在取消）；WSL 狀態以 exit code 判斷
- **不採用**：`%h` specifier 為預設（`escapeSystemdValue` 可能跳脫 `%`，Worker 確認後可改）；以 sudo 開 linger（不需要，polkit 允許自己）
- **相關**：T0378 / BUG-086 / BUG-087 / BUG-071 / BUG-072

---

### D125 2026-10-04 — 本地打包版號來源以 package.json 為準

- **背景**：使用者本地 task「發行: 打包發行版」產出 `1.26.1004195815`（HEAD 不在 tag 上 → 退回時間戳），CI 為 `0.5.9-pre.4`。另發現 tag 取版會砍 `-pre.N`、打包後 `package.json` / nuspec 留 dirty、`release.ps1` 繞過 verify-* 與 fetch:baseline、choco checksum pattern 永不命中
- **決定**：版號優先序 顯式指定 → `package.json`（`_local-rules` 規定發版後必同步，為 repo 版號 SoT）→ 時間戳（最後手段，不得大於真實版號）；保留 prerelease 後綴；移除非 exact `git describe --tags` fallback（三條 tag 線，L123）；打包不留 dirty；補齊前置檢查。CI 以 `VERSION` env 呼叫的行為不變
- **不採用**：維持 tag 優先 —— tag 後常有塔台紀錄 commit，exact-match 經常失敗
- **相關**：T0376 / BUG-056 / L123

---

### D124 2026-10-04 — BUG-085：提權 Windows 的 codex-cli 注入 daemon feature 旗標

- **依據**：T0375（`e9e27ec`）。只有互動 TUI 路徑（終端 preset、resume/fork、codex-cli 派發）受影響；SDK 路徑正常
- **決定**：方案 B' —— 偵測 BAT 行程提權（`whoami /groups` High Mandatory Level）時，`agent-registry.ts` `buildLaunchCommand()` 對 `codex-cli` 注入 `-c features.daemon_auto_start=false`；首次開分頁一次性 i18n 提示
- **不採用**：A `--no-daemon`（PATH 上舊版 0.133 exit 2，BAT 無法得知 shell 解析到哪版）；改使用者 `config.toml`（侵入）；降權 token 啟動（`EnableLUA=0` 無 limited token）
- **已知缺口**：「UAC 開啟 + 管理員執行 BAT + 已有非提權 daemon」情境效果無法判定，需 UAC 開啟機器驗收
- **相關**：T0375 / T0377 / BUG-085

---

### D123 2026-10-04 — `claude-code-v2` preset 下架（BUG-084 Phase 2）

- **背景**：SDK 0.3.142 移除 `unstable_v2_createSession` / `unstable_v2_resumeSession` / `unstable_v2_prompt` / `SDKSession`（T0368），`claude-code-v2` preset 是唯一使用者，升 SDK 0.3 即編譯失敗
- **選項**：A 下架；B 改寫成 `query()` + `AsyncIterable<SDKUserMessage>` thin wrapper 保留 preset
- **決定**：**A 下架**（使用者 2026-10-04 裁決）
- **實作要點**（Phase 2 工單需涵蓋）：
  - 移除 preset 定義與 V2 send/stream 路徑（`claude-agent-manager.ts` `getV2Api` 與 V2 分支、`agent-registry.ts:55`、`agent-presets.ts` 等；現有引用共 9 檔：`ClaudeAgentPanel.tsx`、`CodexAgentPanel.tsx`、`WorkspaceView.tsx`、`workspace-store.ts`、`agent-presets.ts`、`agent-runtime.ts`、`control-tower-launch.ts`、`agent-registry.ts`、`main.ts`）
  - **既有設定遷移**：已持久化的 workspace / terminal / default agent 若指向 `claude-code-v2`，載入時改指 `claude-code`，不得讓使用者開啟後出錯或分頁消失
  - CHANGELOG 註明下架與自動遷移
- **時程**：Phase 1（T0371 + 錯誤分類 + 計價）完成後
- **相關**：BUG-084 / D122 / T0368

---

### D122 2026-10-04 — BUG-084：Claude 內嵌 CLI 升級分階段

- **依據**：T0368 研究（`22e8ddc`）。內嵌 2.1.113 選 `claude-opus-5-5` / `claude-fable-5-1` 回 `400 claude_code_version_too_old`（門檻 2.1.280 / 2.1.251）；SDK 0.2.113 + CLI 2.1.289 實測全通（含 V2 `unstable_v2_createSession`）；claude-code 2.1.289 binary 目錄結構不變
- **決定**：
  - Phase 1（P1）：T0371 只升 CLI + Claude 5 模型清單 + `getSupportedModels()` 帶 runtime 路徑 + `thinking: adaptive` + `release.yml` Node 24
  - 隨後（P1）：`claude_code_version_too_old` 錯誤分類 + `HEALTHY_MIN` → 2.1.280 + embedded 注入 `DISABLE_UPDATES=1`（system 不注入）；計價表（5 系列、cache-read 倍率、共用模組，等 BUG-083 T0370 收尾避免 `CodexAgentPanel.tsx` 衝突）
  - Phase 2（P2）：SDK 0.3.289 —— V2 API 已移除（`claude-code-v2` preset 下架或遷移）、TodoWrite → Task tools，**待使用者決策**
- **不採用**：只補模型清單（C）—— Opus 5.5 / Fable 5.1 仍會 400
- **排程**：T0371 需在主工作樹 `npm install`，與進行中的 T0370（vitest / vite build）並行有 `node_modules` 互擾風險 ⇒ T0370 完成後才派發
- **相關**：T0368 / T0371 / BUG-084 / BUG-083（同型）/ PLAN-027

---

### D121 2026-10-04 — BUG-083：Codex 版本落後的修復組合與排序

- **依據**：T0366 研究（`aa970dc`）。根因 H1（服務端以 CLI 版本擋新模型）與 H3（較新 Codex 寫入 `service_tier = "default"`，內嵌 0.124 解析 `config.toml` 即 exit 1）皆本機 100% 重現；另有 H2 誤報（0.160 的 `Codex is ignoring …` 以 `item.type=error` 送出，BAT 當成錯誤並中斷 streaming 指示）
- **決定**：S1 + S2 必做，S3 後排；不以 `-c` override 硬蓋單一 config 鍵（只解已知鍵，下一個新值又壞）
- **排序**（四張皆改 `electron/codex-agent-manager.ts`，`affects_files` 重疊 ⇒ 串行）：
  1. T-A（T0367）錯誤分類 + 誤報修正 —— 最快止血，不依賴升級
  2. T-B bump `@openai/codex-sdk` → 0.160.x，**同步**改 `findBundledCodex()` 相容新目錄 `vendor/<triple>/bin/`（只 bump 會讓內嵌 binary 找不到）+ prepend `codex-path/` + 安裝檔大小實測
  3. T-D 模型清單（清下架項、讀 `models_cache.json`、effort 加 `max`）
  4. T-C 選最新 binary（`--version` 偵測，候選含 Desktop App 路徑）+ 版本 toast
- **D094 註記**：T-B 會讓 codex 平台套件 unpackedSize 約翻倍（win 223→451 MB）。Mac dmg 已連三版 ~724 MB 遠超 280 MB cap（L130），T-B 只需實測並記錄，不以 D094 擋單
- **相關**：T0366 / T0367 / BUG-083 / PLAN-027（runtime router 先例）

---

### D120 2026-10-04 — BUG-071：server bundle 隨 desktop release 自動發佈 `server-bundle-v*`

- **背景**：BUG-071 的 placeholder throw 已於 PLAN-031（T0321/T0322/T0323）移除，installer 也內建
  linux-x64 baseline。但第四十九 session 塔台複查發現 runtime fallback 下載**整條斷線**：
  1. 預設網址 `DEFAULT_RELEASE_BASE_URL` = `https://github.com/anthropics/better-agent-terminal/releases/download`
     —— 該 repo **不存在**（`gh api` 404）。同樣寫死於 `scripts/fetch-baseline-tarball.mjs:217,319`
  2. gowerlin 上 **0 個** `server-bundle-v*` release；desktop workflow 的 baseline 只走 Actions artifact，
     `build-server-bundle.yml` 需手動推 tag 才發佈，從未被推過
  3. ⇒ installer 未內建的 arch（Windows host 只帶 linux-x64，D092）一律 404。PLAN-031 AC-3
     （DGX Spark arm64 SSH target）實質無法達成
- **選項**：
  - A：desktop workflow 自動發 `server-bundle-v<版號>` prerelease（網址格式不變）
  - B：tarball 掛在 desktop `v<版號>` release 上、改網址格式（推翻 D093 tag 命名）
  - C：只修 owner，server bundle release 靠手動推 tag
- **決定**：**A**（使用者 2026-10-04 選定）
- **理由**：網址 schema 與 D093 tag 命名、`BAT_SERVER_BUNDLE_BASE_URL` override（D095）全部不動；
  bundle 版號本就等於 BAT 版號（`server-bundle-v${app.getVersion()}`），與 desktop 同 run 發佈才不會漏；
  C 每次發版都要記得多推 tag，正是這次 0 個 release 的成因
- **成本**：每次發版多一個 prerelease（3 arch × ~200 MB ≈ 580 MB）
- **驗收範圍**（使用者選定）：修完發 `v0.5.9-pre.3`，確認 `server-bundle-v0.5.9-pre.3` release 存在且資產可下載，
  再由使用者實機跑 WSL wizard（x64）；DGX Spark（arm64）視使用者時間追加。通過後 BUG-071 → CLOSED
- **相關**：T0365 / BUG-071 / PLAN-031 / D092 / D093 / D095

---

### D119 2026-09-02 — 社群 PR #19：取骨架重新實作，不直接 merge

- **決定**：不 merge PR #19（`fix/prompt-argv-shell-quote`），改在 main 以 T0362 重新實作；
  沿用其 `quoteArgForShell(arg, shell)` 介面、posix / pwsh 實作、安全字元直通、
  以及「`agentCustomArgs` 不重新 quote」的判斷；`cmd` 分支整支重寫。
- **理由**：
  1. `gemini-code-assist` 對其 `cmd` 分支留了兩則 HIGH review，作者三個月未回應。塔台獨立複核**兩則都成立**：
     `%` → `%%` 折疊僅發生於批次檔解析，互動式 / PTY 下會把 `100% done` 改成 `100%% done`
     —— 為防罕見情況而在常見情況製造回歸；`""` 不是 `CommandLineToArgvW` 的逃逸，應為 `\"`。
  2. bot 建議的 `\"` 天真替換**同樣不對** —— 反斜線串需在引號前與字串結尾加倍，
     否則 `C:\path\` 這類輸入仍壞。⇒ 照 bot 建議修也不夠，需完整演算法。
  3. 該 bot 已於 2026-07-17 停止服務，等作者修不會再有自動複驗。
- **不採用的替代方案**：merge 後另開 follow-up 修 —— 會把已知缺陷帶進 main 再回頭修，
  且 CHANGELOG 會出現「引入又修掉」的噪音。
- **出處處置**：commit 帶 `Co-authored-by: RicoChen727 <ren.asus@gmail.com>`，
  CHANGELOG 明記源自社群 PR #19；PR 上留言說明採用範圍與 cmd 分支修正理由後關閉。
- **相關**：T0362（commit `a8ee6a1`）/ PR #19 / PR #18（`238ac3d`，引入 shellFamily 佈線）

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
