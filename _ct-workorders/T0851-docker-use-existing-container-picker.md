---
schema_version: 1
schema_kind: workorder
id: T0851
title: "Docker 精靈 W2：「沿用既有容器」可選容器（可用性判斷、BAT 建立標示）並從容器帶出既有掛載"
type: implementation
status: TODO
repo: better-agent-terminal
project: PLAN-052
priority: P2
sizing: M
created_at: "2026-11-04T15:18:27+0800"
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
- **工單編號**：T0851｜**類型**：implementation｜**狀態**：TODO｜**建立**：2026-11-04 15:18 (UTC+8)
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

（Worker 填寫）
