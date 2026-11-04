---
schema_version: 1
schema_kind: workorder
id: T0851
title: "Docker 精靈 W2：「沿用既有容器」可選容器（可用性判斷、BAT 建立標示）並從容器帶出既有掛載"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-052
priority: P2
sizing: M
created_at: "2026-11-04T15:18:27+0800"
started_at: "2026-11-04T15:38:03+0800"
updated_at: "2026-11-04T15:50:30+0800"
completed_at: "2026-11-04T15:50:30+0800"
session_ids:
  - "a40bf9ed-f194-40da-8d1c-015258155de2"
depends_on: [T0849]
related:
  - "PLAN-052；D282 / D283；T0848 回報區〈調查結論〉3 與〈建議下一步〉W2；T0849（label `bat.server=1`、timeout）；BUG-111 / T0444"
affects_files:
  - _ct-workorders/T0851-docker-use-existing-container-picker.md
  - electron/docker-detect.ts
  - src/types/electron.d.ts
  - src/components/setup-wizard/steps/docker/pick-container.ts
  - src/components/setup-wizard/steps/docker/configure-mounts.ts
  - src/components/setup-wizard/wizard-runner.ts
  - src/components/setup-wizard/SetupWizardShell.tsx
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - electron/__tests__/docker-detect.test.ts
  - src/components/setup-wizard/steps/docker/__tests__/
  - src/components/setup-wizard/__tests__/
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 `WizardChoiceOption` 加 `disabled` / reason 時，WSL / SSH 精靈既有選單的外觀與行為不變（沒有設 `disabled` 的選項照舊）。"
  - "🔴 不動使用者容器（BUG-111）：選單只讀 `docker ps -a` / `docker inspect`；停止中的容器沿用現有行為（精靈啟動、取消只停回自己啟動的）。不改映像來源（W4）。"
  - "🔴 child_process 一律 `execFile` + 陣列參數 + timeout；容器名稱過 `/^[a-zA-Z0-9._-]+$/`。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。本機 Docker 沒有 engine：不建立 / 啟動 / 刪除容器或映像。"
---

# T0851 — Docker 精靈 W2：沿用既有容器的選單與掛載

## 元資料
- **工單編號**：T0851｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-04 15:18 (UTC+8)
- **規模**：M｜**決策**：D283｜**依賴**：T0849

## 背景
「沿用既有容器」取 `docker ps -a` 第一列（`steps/docker/pick-container.ts:136`），沒有選擇 UI；掛載挑選的資料夾不會套用到容器，只存進 profile，與容器實際的 mount 對不上時路徑轉換就錯（`docs/docker-deployment.md:128`）。設計見 T0848 回報區〈調查結論〉3。

## 任務
1. `listContainers`（`electron/docker-detect.ts`）多取 `Ports`、`Labels`、`CreatedAt`（`docker ps -a --format '{{json .}}'` 已有）。
2. 純函式 `buildDockerContainerChoices(containers, activeServerPort)`：每個容器一個選項（label = 名稱；說明 = 映像 · 狀態 · 發佈埠 / 「未發佈 9876」· 「BAT 建立」（label `bat.server=1`，T0849 加上））；排序 BAT 建立、可用、執行中在前。
3. 不可用（沒有發佈 `9876/tcp`，或發佈埠等於 RemoteServer 埠；就是 `pickDockerServerPort` 現在在第 5 步才報的兩種錯）→ 在選單階段判斷：`WizardChoiceOption` 加 `disabled?: boolean` + reason key，`SetupWizardShell` 顯示但不能選。
4. 空清單或全部不可用 → 顯示說明＋「改用建立新容器」，取代 `docker-no-containers` 錯誤。
5. 沿用既有容器時從 `docker inspect` 的 `Mounts`（type=bind）帶出 host ↔ container 對照，預設不開資料夾挑選、讓使用者確認；沒有 bind mount 時照現在的挑選流程。
6. 可選（成本低才做）：`docker exec cat <dataDir>/server-cert.json` 在 main 算指紋，與 handshake 指紋比對；不做就在回報區寫明。
7. 測試：選單函式（排序、不可用判斷、空清單）、掛載帶出、`disabled` 選項不能選、WSL / SSH 選單不回歸。

### 驗收條件
- [ ] 上述測試通過；既有精靈測試不回歸
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npm run test:legacy` 全過（發版 Test gate；T0850 漏跑造成 `tests/docker-flow-journeys.test.ts` 回歸，由 T0855 修）、`npx vite build` 成功
- [ ] 若 WSL 內有可用的 Docker，可選延伸 T0743 spec「選第二個容器」；沒有就列〈待實機驗收〉
- [ ] commit 只含本單範圍

---

## 回報區

### 完成狀態
- **狀態**：DONE
- **完成時間**：2026-11-04 15:49 (UTC+8)
- **一句話結論**：「沿用既有容器」改成可選的容器清單（說明 = 映像 · 狀態 · 發佈埠 · BAT 建立；不可用的顯示但不能選並附原因；可用、BAT 建立、執行中在前）；沒有可用容器時改顯示說明＋「改用建立新容器」；第 3 步改從容器的 bind mount 帶出對照、確認後使用。可選的 cert 指紋交叉比對未做（理由見下）。
- **session_id**：a40bf9ed-f194-40da-8d1c-015258155de2

### 落點檢查
- **結果**：PASS
- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單位於 REPO_ROOT 下 → PASS
- C-3：資訊性；`affects_files` 前 5 項皆存在 → PASS
- C-2：工單無 `branch` 欄位 → 略過；目前分支 `main`
- 非 worktree（`CT_HOME` 未設）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）；`CT_MODE` = `yolo`、`CT_INTERACTIVE` = `0`；`BAT_REMOTE_TOKEN` 已設定

### 產品 commit
- `c3bda9ad` feat(docker-wizard): T0851 pick an existing container and take its bind mounts（15 檔，+1135 / −82）
- 驗證在 commit 前的工作樹上跑，內容與 `c3bda9ad` 相同（commit 後只剩本工單檔有變更）

### 變更檔案
| 檔案 | 內容 |
|---|---|
| `electron/docker-detect.ts` | `DockerContainerInfo` 多 `ports` / `createdAt` / `batCreated` / `publishedPort`。`listContainers` 在 `docker ps -a` 之後對所有容器跑**一次** `docker inspect --type container <ids…>`（唯讀、5 s timeout，id 只收 12–64 位 hex）：`publishedPort` 用 `docker-lifecycle.ts` 既有的 `publishedServerPort`（執行中的 binding → `HostConfig.PortBindings`，所以停止中的容器也判斷得到），label 以 `Config.Labels` 為準。inspect 失敗 → 埠退回 `docker ps` 的 Ports 欄（只有執行中的看得到），否則 `undefined` = 未知。新增純函式 `parsePsLabels` / `parsePsPublishedServerPort`。`inspectContainer` 的 mounts 多 `type`。 |
| `src/types/electron.d.ts` | `DockerContainerListEntry`（新欄位皆 optional，舊 mock 照樣通過型別）；`inspectContainer` mounts 多 `type` |
| `src/components/setup-wizard/wizard-runner.ts` | `WizardChoiceOption` 加 `disabled?` / `disabledReasonKey?` / `disabledReasonParams?` |
| `src/components/setup-wizard/SetupWizardShell.tsx` | disabled 選項：button `disabled`＋淡化（inline style，`profile-action-btn` 沒有 `:disabled` 樣式，`settings.css` / `setup-wizard.css` 不在本單範圍）、onClick 再擋一次、下方顯示原因（`aria-describedby` 指向它）。沒有 `disabled` 的選項輸出與 T0851 前完全相同（測試斷言沒有 `disabled` / `style` 屬性、`aria-describedby` 不變、沒有說明時仍是單一 button）。 |
| `src/components/setup-wizard/steps/docker/pick-container.ts` | 匯出純函式 `buildDockerContainerChoices(containers, activeServerPort)`、`dockerContainerUnusableReason`。選「沿用既有容器」後問選哪個容器；RemoteServer 埠由 `window.electronAPI.remote.serverStatus()`（`running` 時的 `port`，失敗視為 null）取得，與 `docker:pick-server-port` 用的 `remoteServer.port` 同一個值。沒有可用容器 → 說明（空清單 / 全部不可用兩種文字）＋列出不可用的容器（disabled）＋「改用建立新容器」（`DOCKER_CREATE_NEW_CHOICE`）→ 走建立新容器。關掉提示（`null`）或回答不可用 / 不在清單的值 → 仍丟 `docker-no-containers`（step 自己驗證回答）。重跑時換了模式或容器 → 清掉舊的 `dockerMounts`。 |
| `src/components/setup-wizard/steps/docker/configure-mounts.ts` | 沿用既有容器且沒有已存的掛載（或跳回本步）→ `docker inspect` 取 `Type: bind` 的掛載（排除 volume、`.sock`、非絕對路徑目的地），Docker Desktop 的 `/run/desktop/mnt/host/<碟>/…`、`/host_mnt/<碟>/…`（Windows）與 `/host_mnt/Users/…`（macOS）轉回本機路徑；先 `validateMounts`，通過才以 requestChoice 確認（「使用這些資料夾」/「改選其他資料夾」），預設不開資料夾挑選。沒有 bind mount、inspect 失敗 → 照舊開資料夾挑選；掛載的資料夾不在本機 → 加 warning 後開資料夾挑選。建立新容器路徑不變（不 inspect）。 |
| `src/locales/{en,zh-TW,zh-CN}.json` | `wizard.docker.pickContainer.{choose,container,none}.*`、`wizard.docker.configureMounts.fromContainer.*`、`wizard.docker.warning.containerMountsUnusable`；第 2、3 步說明改寫（不再寫「使用最近建立的既有容器」） |
| 測試 | 見〈驗證〉 |

### 介面 / 行為決定（Worker 判斷，未問塔台）
1. **排序**：工單寫「排序 BAT 建立、可用、執行中在前」。實作優先序為「可用 → BAT 建立 → 執行中 → `docker ps` 原順序（新的在前）」，讓不能選的容器不會排在最上面（BAT 建立的容器幾乎都可用，兩種讀法差別只在 BAT 建立但埠撞到 RemoteServer 的容器）。要改成字面順序只改 `buildDockerContainerChoices` 的 sort 一行與測試。
2. **何時問容器**：只在模式提示有出現時（第一次、或跳回本步）問容器；已存模式＋容器（重跑、retry、legacy 測試的預設 state）不問，沿用已存的容器。沒有提示 UI 時用第一個可用的（T0851 前是 `containers[0]`）。
3. **可用性未知**（inspect 失敗）不判為不可用、不顯示埠，交給第 5 步照舊檢查。
4. **停止中的容器**可選，沿用現有行為（精靈啟動、取消只停回自己啟動的，BUG-111）；選單只讀 `docker ps -a` / `docker inspect`，沒有建立 / 啟動 / 刪除任何容器。

### 可選項 6（cert 指紋交叉比對）：未做
要在 main 端加 `docker exec cat <dataDir>/server-cert.json`＋算 SHA-256 的 IPC，需要改 `electron/docker-lifecycle.ts` / `electron/main.ts` / `electron/preload.ts`，都不在本單 `affects_files`；`server-cert.json` 格式也還沒確認。建議併入後續單（W4a 或另開小單）。

### 驗證
| 關卡 | 結果 |
|---|---|
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0 |
| `npm run test:unit` | 438 files passed / 3 skipped；7823 passed / 40 skipped，0 failed |
| `npm run test:legacy` | 33 / 33 檔、472 tests passed（含 `tests/docker-flow-journeys.test.ts`、`docker-wizard-e2e`、`docker-wizard-runner`；T0855 已在 `3d042497` 修好 Journey 3） |
| `npx vite build` | 成功 |

新增 / 調整的測試：
- `electron/__tests__/docker-detect.test.ts`：`listContainers` 一次 inspect 取得發佈埠（含停止中容器的 `PortBindings`）與 label、全部 5 s timeout；inspect 失敗退回 ps Ports 欄；非 hex id 不送進 docker；`parsePsLabels` / `parsePsPublishedServerPort`；`inspectContainer` mounts 帶 `type`。
- `src/components/setup-wizard/steps/docker/__tests__/use-existing-container.test.ts`（新）：選單排序、說明文字、不可用判斷（未發佈 / 撞 RemoteServer 埠 / 未知）、空清單；選容器、拒絕 disabled 回答、全部不可用 →「改用建立新容器」、空清單關掉提示 → `docker-no-containers`、無 UI 時跳過不可用、已存容器不問、換容器清掉舊掛載 / 同容器保留；掛載帶出（確認使用、改選資料夾、沒有 bind、inspect 失敗、不在本機 → warning、無 UI 直接使用、建立新容器不 inspect、已存掛載不 inspect）；bind 過濾與 Docker Desktop 路徑轉換。
- `src/components/setup-wizard/__tests__/SetupWizardShell.disabled-choice.test.tsx`（新）：disabled 選項顯示原因、點了不回答；一般選項屬性與 T0851 前相同（WSL / SSH 不回歸）。
- 既有測試因多一個容器提示而調整答案佇列（只加答案 / 次數，斷言的結果不變）：`pick-container.test.ts`（「選第一個」改成「選清單中的 second」並斷言兩次提示的選項；零容器測試多回答一次 null）、`pick-container-retry.test.ts`（3 例）、`wizard-jump-edit.test.ts`（3 例）。`step-error-i18n.test.tsx` 的 `docker-no-containers` 例未改即通過。

### 待實機驗收
- 本機 Docker 沒有 engine，T0743 spec「選第二個容器」未延伸、未跑。建議 W5 或實機驗收時：WSL Docker 建兩個容器（一個 `-p 127.0.0.1:<P>:9876`、一個不發佈），確認選單排序 / disabled 原因、選第二個容器後連線成功、第 3 步帶出 bind mount。
- Docker Desktop（Windows）`docker inspect` 的 bind `Source` 實際格式未實測；`/run/desktop/mnt/host/c/…` / `/host_mnt/c/…` 兩種都會轉回 `C:\…`，原樣的 `C:\…` 不動。實測若是其他格式，`validateMounts` 會擋下並退回資料夾挑選（加 warning），不會寫錯路徑。

### 遭遇問題
- 無阻斷。以 Python heredoc 改 `docker-detect.ts` 時 `\r?\n` / `\b` 被轉成控制字元，已改回並以 `cat -A` 確認檔案無控制字元。

### 後續建議
- `e2e/v071-pre2-acceptance.spec.ts` V4.a 期望「沿用既有容器＋沒有容器」直接出現 `docker-no-containers` 錯誤；本單起先出現說明提示（關掉提示才是該錯誤）。該 spec 不在 CI、不在本單範圍，下次重跑前要調整。
- `docs/docker-deployment.md:128`（掛載不套用到容器）與 `site/remote/docker.md` 的「沿用既有容器」說明要配合改（W5）。
- 可選項 6 見上。

### 互動紀錄
- 無（未向塔台提問）。

### 回報時間
- 2026-11-04 15:49 (UTC+8)
