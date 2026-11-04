---
schema_version: 1
schema_kind: workorder
id: T0830
title: "PLAN-043：WSL keep-alive 每個 profile 可關閉（預設開）＋設定精靈每一步可中止"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-04T08:52:59+0800"
started_at: "2026-11-04T09:21:08+0800"
updated_at: "2026-11-04T09:47:53+0800"
completed_at: "2026-11-04T09:47:53+0800"
session_ids:
  - "75db52b2-1e9b-4a68-86c5-254f987c63c2"
depends_on: [T0829]
related:
  - "PLAN-043 範圍 3；D271；T0384（keep-alive holder；per-profile 開關或 lazy 的候選）；T0381（runner 層 step abort 的候選）；T0552 / T0554（精靈升級 rollback）"
affects_files:
  - _ct-workorders/T0830-wsl-keepalive-toggle-and-step-abort.md
  - electron/wsl-keepalive.ts
  - electron/wsl-detect.ts
  - electron/wsl-systemd.ts
  - electron/main.ts
  - electron/preload.ts
  - electron/profile-manager.ts
  - src/types/electron.d.ts
  - src/components/profiles/details/WslDetails.tsx
  - src/components/setup-wizard/
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - electron/__tests__/
  - src/components/profiles/__tests__/
  - docs/wsl-deployment.md
  - docs/agent-guide/multi-remote-profiles.md
  - CHANGELOG.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 keep-alive 預設維持現行行為（開）；既有 profile 沒有新欄位 = 開。不做 lazy 模式（D271 選 per-profile 開關）。"
  - "🔴 profile index 寫入照 CLAUDE.md「多 remote profile 同時連線」：`profiles/index.json` 讀改寫一律經 `withIndexLock()`，鎖內不得呼叫 `ProfileManager` 公開方法。"
  - "🔴 精靈 step abort：中止後必須走既有 rollback / 清理路徑，不得留下半裝狀態；SSH / Docker 精靈若共用 runner，行為變化要逐一確認不回歸（現有取消行為若已涵蓋某些步驟，回報寫明）。Dialog 規則照 CLAUDE.md（ModalOverlay、Esc）。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0830 — keep-alive 開關＋精靈 step abort（PLAN-043）

## 元資料

- **工單編號**：T0830
- **類型**：implementation
- **狀態**：DONE
- **建立時間**：2026-11-04 08:52 (UTC+8)
- **依賴**：T0829（同改 `electron/wsl-keepalive.ts` / `main.ts`）
- **預估規模**：M；Context Window 風險：中
- **降級策略**：A、B 各自獨立；只完成一項時回 PARTIAL 並寫明

## 任務指令

### 前置條件
- `electron/wsl-keepalive.ts`、`electron/main.ts` `syncWslKeepAlive`、`electron/profile-manager.ts`
- `src/components/profiles/details/WslDetails.tsx`、`src/components/setup-wizard/`（`wizard-runner.ts`、`wsl-flow.ts`、`ssh-flow.ts`、`docker-flow.ts`、`steps/`）
- `_ct-workorders/_archive/workorders/T0384-wsl-keepalive-holder.md`、`T0381` 回報區（runner step abort 的候選說明）
- `CLAUDE.md`「多 remote profile 同時連線（PLAN-039）」節

### 任務

**A. keep-alive 每個 WSL profile 可關閉**
- WSL profile 新增設定「保持 WSL 執行（keep-alive）」，預設開；關閉後該 profile 對應的 distro 不由 BAT 持有 `wsl.exe`（若多個 profile 指向同一 distro，任一開著就保持，規則寫進 docs）。
- UI：`WslDetails`（或 profile 編輯處）一個開關＋一句說明（關閉後 WSL 閒置時可能自動關機，下次連線較慢）。
- 變更立即生效（`syncWslKeepAlive`）。

**B. 精靈每一步可中止**
- 先盤點現況：精靈「取消」目前在步驟執行中按下會怎樣（等步驟跑完？子程序是否被終止？rollback 是否執行？）。
- 實作：執行中的步驟可被中止（`AbortSignal` 傳到步驟，子程序 `execFile` / `spawn` 收到後終止），中止後跑該步與先前步驟既有的 rollback；UI 顯示「正在中止…」→ 完成。逾時或中止失敗時的處置寫清楚。
- 範圍：WSL 精靈必做；SSH / Docker 共用 runner 時一併受惠，但要確認不回歸。

### 驗收條件
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npx vite build` 成功
- [ ] A：既有 profile（無新欄位）keep-alive 照舊的測試；關閉後不持有的測試
- [ ] B：中止執行中步驟會終止子程序並 rollback 的測試（mock runner）；既有精靈 e2e / mock 測試（如 `tests/wsl-wizard-e2e.test.ts`，若 `test:legacy` 涵蓋）通過
- [ ] docs 同步、`CHANGELOG.md` `[Unreleased]`；commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 待塔台決策

#### Q-1：B 項「子程序收到中止後終止」需改 `electron/wsl-detect.ts` / `electron/wsl-systemd.ts`（不在 affects_files），要擴大範圍嗎？
- **提問時間**：2026-11-04 09:27 (UTC+8)
- **背景**：精靈步驟在 renderer 跑，子程序都在主行程。WSL 精靈的長步驟：`wsl:install-bundle`（`wsl-detect.ts` `installBundle`，execFile timeout 300 s）、`wsl-systemd:start-service`（`wsl-systemd.ts` 輪詢，約 10 s＋每次 probe 15 s）、server bundle 下載（`server-bundle-distributor.ts` 已支援 `signal`，只缺 main.ts handler 接線，在範圍內）、fetch-fingerprint（5 s）。兩個 `execFileBuffered` 目前沒有 `signal` 參數。
- **選項**：
  - A. 擴大 affects_files 加入 `electron/wsl-detect.ts`、`electron/wsl-systemd.ts`：`execFileBuffered` 加選用 `signal`（不給 = 行為完全不變），`installBundle` / `startService` 加選用 `{ signal }`；main.ts 以 operation id 登錄 AbortController，新 IPC `wizard:abort-operation` 中止；下載也接上。
  - B. 不擴大：只做範圍內的部分（runner 層 abort＋輸入步驟中止＋下載中止）；install-bundle / start-service 的子程序照舊等各自 timeout 結束，runner 等該步結束（上限見下）再 rollback，回報寫為已知限制。
  - 其他。
- **建議**：A。理由：工單明寫「子程序收到後終止」，最長的就是 install-bundle（300 s）；只多一個選用參數，未帶時行為不變，既有測試守得住。SSH / Docker 精靈的主行程模組（ssh 安裝、docker-lifecycle）不改，只受惠於 runner 層 abort。
- **影響**：A 多改 2 個檔＋其測試；B 的中止在 install-bundle 期間最久要等到 300 s timeout 才能 rollback（runner 等步驟結束才 rollback，避免 rollback 與還在解壓的 tar 競爭）。
- **是否阻擋後續步驟**：只阻擋 B 項主行程的 wsl-detect / wsl-systemd 部分；A 項已完成，runner 層 abort 兩案都要做。

### 完成狀態

- **狀態**：DONE（A、B 兩項都完成，驗收條件全過）
- **完成時間**：2026-11-04 09:47 (UTC+8)
- **產品 commit**：`add1b932`（`feat(wsl): per-profile keep-alive switch; setup wizard steps can be stopped (T0830)`，30 檔，+1828 / −78）
- **session_id**：75db52b2-1e9b-4a68-86c5-254f987c63c2
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS；C-1 工單在 REPO_ROOT 下 → PASS；C-3 `affects_files` 前 5 項皆存在 → PASS（資訊性）；C-2 無 `branch` 欄位。`CT_HOME` 未設（不是 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。
- **環境**：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；BAT 變數 `BAT_HELPER_DIR` / `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN`（已設定）/ `BAT_TERMINAL_ID` / `BAT_TOWER_TERMINAL_ID` / `BAT_WORKSPACE_ID` 等存在。

### 產出摘要

**A. keep-alive 每個 WSL profile 可關閉**
- 資料：`ProfileEntry.wslKeepAlive?: boolean`（`electron/profile-manager.ts`）。`false` = 不持有；沒有欄位 / `true` = 持有（既有 profile 行為不變）。`ProfileManager.update` 在 `withIndexLock()` 內只接受 boolean（鎖內未呼叫公開方法）。
- 規則唯一實作：`keepAliveProfileDistros`（`electron/wsl-keepalive.ts`）：只看 `wsl-linux` 且有 distro 的 profile；同一 distro 多個 profile 時任一開著就持有。`main.ts` `syncWslKeepAlive` 改用它（原 inline filter 移除，source guard 守住）。精靈的 `pin()` 與開關無關，精靈執行中照樣持有。
- 生效：`profile:update` 本來就呼叫 `syncWslKeepAlive('profile:update')`，所以開關變更立即 stop / spawn holder。
- UI：`WslDetails` 多一列「保持執行」勾選框＋說明（開：連線較快；關：WSL 閒置時可能自動關機、下次連線較慢），存檔失敗回復原值並顯示錯誤；三語字串 `profiles.details.keepAlive*`。
- IPC 型別：`profile:update`（main / preload / `electron.d.ts`）多 `wslKeepAlive`；`ProfileRecord` 多同名欄位。

**B. 精靈每一步可中止**
- 盤點（T0830 前）：
  1. 步驟執行中**沒有**取消按鈕；只有失敗畫面的 Cancel，或關閉精靈視窗（unmount → `runner.cancel()`）。
  2. 執行中 cancel 只設 `cancelRequested`：步驟照跑到結束（主行程子程序不終止，install-bundle 最長 300 s、start-service 輪詢約 10 s），之後下一輪迴圈才 rollback 已完成的步驟（含剛跑完的那步）。步驟若在 cancel 後失敗，走一般失敗路徑、丟出步驟自己的錯誤。
  3. 輸入步驟（`requestChoice` / `requestText` 等待中）被 cancel：提示永遠不會被回答（Shell 已卸載），runner 永遠卡住、已完成的步驟**永遠不 rollback**。
  4. 失敗畫面的 Cancel：rollback 失敗的步驟＋已完成的步驟（T0426），行為正確。
- 實作：
  - runner（`wizard-runner.ts`）：每次執行步驟（含 retry / jump 重跑）一個 `AbortController`，`ctx.signal` 只在步驟 preflight / run 期間設定。`cancel()` 遇到 Running / AwaitingInput 的步驟 → abort、snapshot `aborting: true`；等步驟真正結束（成功或失敗都一樣）→ `finishAbortedStep`：標 `aborted`、rollback 該步（→ RolledBack）、再反序 rollback 已完成的步驟，run() reject `Wizard cancelled`。所有步驟的 `requestChoice` / `requestText` 都包一層 abort race（輸入型步驟另外照舊切 AwaitingInput）。失敗畫面的 Cancel、步驟之間的 cancel 不變。
  - 逾時 / 中止失敗的處置：中止後 15 s（`WIZARD_ABORT_SLOW_NOTICE_MS`）仍未結束 → snapshot `abortSlow`，UI 說「這一步還在結束中，停下後會立刻開始復原」，**繼續等**；🔴 不在步驟仍在跑時 rollback（rollback 可能和還在寫入的子程序競爭）。步驟在中止後仍成功完成（不可中斷的 IPC）→ 照樣當作中止並 rollback 它的結果。
  - 主行程：`WizardOperationRegistry`（`src/components/setup-wizard/wizard-operation-registry.ts`，純模組、main.ts 引用；比 begin 先到的 abort 記 60 s、上限 64 筆）＋ IPC `wizard:abort-operation`；renderer `runAbortableOperation`（`wizard-abort.ts`）。三個 handler 收到 `operationId` 才拿 signal，沒有就是 T0830 前的原呼叫（source guard 守住）：
    - `server-bundle:distribute`：signal 交給 distributor（原本就支援）→ 下載取消。
    - `wsl:install-bundle` → `installBundle({ signal })`：腳本 `$0` 改成每次安裝的標記 `bat-wizard-install-<12 hex>`；中止時另跑 `INSTALL_STOP_SCRIPT`，以 `[b]at-…` 樣式找到該腳本、只 `pkill -TERM -x -P <pid> tar`。腳本走自己的「extract failed」路徑刪 `.bat-new`、exit 1；🔴 不殺安裝的 `wsl.exe`，所以腳本不會停在兩次 `mv` 之間（避免半裝）。extract 已結束時什麼都不殺，安裝完成後由步驟記錄並 rollback。
    - `wsl-systemd:start-service` → `startService({ signal })`：每個 `wsl.exe` 帶 execFile `signal`、輪詢 sleep 可中斷，中止即回 `wsl-service-start-aborted`（不讀 journal）。
  - WSL 步驟：install-server-bundle（下載、安裝）、write-systemd-unit（服務啟動）經 `runAbortableOperation`，呼叫後 `throwIfWizardAborted`；install 完成後才中止時先記錄再丟出，rollback 才能還原。
  - UI（`SetupWizardShell.tsx`）：步驟執行中 / 等待選擇時顯示「中止設定」（`wizard-abort`）；按下後按鈕停用、顯示「正在中止…」，detail panel 也顯示；結束後出現「設定已取消」。中止的步驟不顯示 Retry / Skip / Cancel、錯誤文字顯示「已由使用者中止」。三語 `wizard.abort.*`。Dialog 本身未改（仍是既有 `ModalOverlay` 與 [X]，未加 Esc / 外部點擊）。
  - SSH / Docker 精靈：共用 runner，受惠於「提示可中止」與「中止後 rollback」；它們的主行程呼叫沒有接 operation id（不中斷，等它結束）。既有 SSH / Docker 單元與 legacy e2e 全過，未回歸。
- 文件：`docs/wsl-deployment.md`（After setup 的 keep-alive 開關、Rollback chain 新增「Stopping a running step」、Editing、Pre-Flight Checklist 兩項）、`docs/agent-guide/multi-remote-profiles.md`（`wslKeepAlive` 規則）、`CHANGELOG.md` `[Unreleased]` Added 兩條。

**異動檔案**（commit `add1b932`）
- 產品：`electron/main.ts`、`electron/preload.ts`、`electron/profile-manager.ts`、`electron/wsl-keepalive.ts`、`electron/wsl-detect.ts`、`electron/wsl-systemd.ts`、`src/types/electron.d.ts`、`src/components/profiles/details/WslDetails.tsx`、`src/components/setup-wizard/{wizard-runner.ts, SetupWizardShell.tsx, wizard-abort.ts（新）, wizard-operation-registry.ts（新）, steps/wsl/install-server-bundle.ts, steps/wsl/write-systemd-unit.ts}`、三個 locale。
- 新測試：`electron/__tests__/wsl-keepalive-profile-toggle.test.ts`（10）、`electron/__tests__/wsl-wizard-step-abort.test.ts`（14，含 main.ts source guard）、`src/components/profiles/__tests__/WslDetails.test.tsx`（5）、`src/components/setup-wizard/__tests__/wizard-step-abort.test.ts`（18，mock runner＋假主行程）、`src/components/setup-wizard/__tests__/SetupWizardShell.abort.test.tsx`（4）。
- 既有測試調整（都在 `src/components/setup-wizard/__tests__/`，為新行為而改，不是放寬）：
  - `configure-host` / `pick-container` / `pick-wsl-distro`：「等待輸入時 cancel」原本 `void runner.run()`（舊行為 run() 永遠不結束）；現在中止會 reject，改為斷言 `rejects.toThrow('Wizard cancelled')`。
  - `wizard-upgrade-rollback` / `server-bundle-import`：`installBundle` 的參數斷言加 `operationId: expect.any(String)`（runner 內執行時多帶中止 id）。
- 🔴 `electron/__tests__/wsl-detect.test.ts` / `wsl-install-bundle.test.ts` / `wsl-systemd.test.ts` 未修改、全部通過（Q-1 條件 3）。

**驗證**（`validated_sha` 概念不適用：非 worktree；驗證時工作樹在 HEAD `3661afed`＋本單未提交變更，驗證後未再改產品檔，直接 commit 成 `add1b932`）
- `npm run typecheck`：0 錯誤（exit 0）
- `npm run typecheck:electron`：0 錯誤（exit 0）
- `npm run test:unit`：Test Files 416 passed / 3 skipped；Tests 7270 passed / 39 skipped，0 failed、無 unhandled rejection
- `npm run test:legacy`：33 檔 / 472 tests 全過（含 `tests/wsl-wizard-e2e.test.ts` 5、`ssh-wizard-e2e` 5、`docker-wizard-e2e`、`wizard-runner` / `wizard-rollback*`、`wsl-flow-journeys`）
- `npx vite build`：成功（exit 0）
- 證據分道：source / 單元 / legacy / build = PASS；實機 WSL（真 distro 的 `pkill tar`、真 keep-alive 關機）**未跑**（CI / 本 session 不做實機），已寫進 `docs/wsl-deployment.md` Real WSL Pre-Flight Checklist 兩項，屬人工發版關卡。

**相關通過案例判定**：本單沒有〈相關通過案例〉段落，不適用。

### 互動紀錄

- [09:27] Q-1: B 項主行程子程序終止需改 `electron/wsl-detect.ts` / `electron/wsl-systemd.ts`，是否擴大範圍（BAT 通道 `--ask --submit`，question `q-e42318d1-339909841f0a263e`） → A（塔台，09:28，範圍內 Tower 裁決）: 選 A，擴大到兩檔與 main.ts 的 operation id 中止；不給 signal 時行為完全不變；條件 1) 在 T0838 commit `919a006e` 之上改、只 `git add` 本單檔案，動手前 `git diff` 確認兩檔沒有別人的未提交變更 2) 兩檔與測試補進 affects_files、記錄本裁決 3) 既有 wsl-detect / wsl-systemd 測試語意不改 → Action: 09:28 `git diff --stat -- electron/wsl-detect.ts electron/wsl-systemd.ts` 為空（無他人變更）；frontmatter `affects_files` 補兩檔（測試已在 `electron/__tests__/` 範圍內）；移除 `tower_question`；續做 B。

### Renew 歷程

（無）

### 遭遇問題

- 範圍：B 項子程序終止需改 affects_files 以外的 `electron/wsl-detect.ts` / `electron/wsl-systemd.ts` → Q-1 問塔台，塔台裁示擴大（見互動紀錄），已補進 frontmatter `affects_files`。
- 範圍內的小調整（未另問）：`src/components/profiles/types.ts` 不在 affects_files，`WslDetails` 改以本地型別 `ProfileEntry & { wslKeepAlive?: boolean }` 讀取欄位，未動 `types.ts`；operation registry 放在 `src/components/setup-wizard/`（在範圍內的目錄、純模組），由 main.ts 引用，未新增 `electron/` 檔案。
- 已知限制：
  1. install-bundle 的停止依賴 distro 內有 `pgrep` / `pkill`（procps）；沒有時安裝跑完後才 rollback（結果相同、等得較久），主行程記 `[wizard] install-bundle abort: stop=failed: …`。
  2. 中止送出時若 distro 內的安裝腳本尚未啟動，停止輔助程式最多等 5 s、總共輪詢 20 s，之後放棄（安裝照跑、完成後 rollback）。
  3. 不可中斷的呼叫（fetch-fingerprint 5 s、connect-test、SSH / Docker 主行程呼叫）中止時照舊等它結束。
  4. 關閉精靈視窗觸發的中止在背景完成 rollback；若使用者立刻重開同一 distro 的精靈，新舊 runner 仍可能並行（T0830 前就存在，中止使它變短但未消除）。
- 後續候選（給塔台）：SSH / Docker 精靈的主行程長呼叫（SSH bundle 上傳安裝、docker 容器啟動）接 operation id；`src/components/profiles/types.ts` 的 `ProfileEntry` 補 `wslKeepAlive`（移除 WslDetails 的本地型別）；CLAUDE.md 若要列 keep-alive 開關／精靈中止的必守規則需另開單（本單未改 CLAUDE.md）。

### 回報時間

2026-11-04 09:47 (UTC+8)
