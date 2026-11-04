---
schema_version: 1
schema_kind: workorder
id: T0849
title: "Docker 精靈 W1：權杖不進命令列、healthy 後才讀權杖、三段式權杖取得與明確錯誤碼、inspect 不回傳 env、docker 指令補 timeout"
type: implementation
status: TODO
repo: better-agent-terminal
project: PLAN-052
priority: P2
sizing: M
created_at: "2026-11-04T15:18:27+0800"
depends_on: []
related:
  - "PLAN-052；D282 / D283；T0848 回報區〈調查結論〉1、3、5 與〈建議下一步〉W1；T0743（Docker 精靈驗收）；BUG-097（`DOCKER_PUBLISH_HOST`）；BUG-111 / T0444（不動使用者容器）"
affects_files:
  - _ct-workorders/T0849-docker-token-and-security-fixes.md
  - electron/docker-lifecycle.ts
  - electron/docker-detect.ts
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/components/setup-wizard/steps/docker/start-server.ts
  - src/components/setup-wizard/steps/wsl/connect-test.ts
  - src/components/setup-wizard/error-mapper.ts
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - electron/__tests__/docker-lifecycle.test.ts
  - electron/__tests__/docker-server-port.test.ts
  - electron/__tests__/docker-detect.test.ts
  - electron/remote/__tests__/headless-server.test.ts
  - src/components/setup-wizard/__tests__/docker-flow.test.ts
  - src/components/setup-wizard/steps/docker/__tests__/
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不改映像來源（W4a / W4b 的範圍）、不改容器選單（W2）、不改寫設定（W3 / T0850 與本單並行，不要碰 `steps/wsl/write-profile.ts`）。"
  - "🔴 埠映射維持 `-p 127.0.0.1:<P>:9876`（`DOCKER_PUBLISH_HOST`，不得放寬）；不動使用者容器（BUG-111：沿用既有容器時不重設權杖、不改容器設定、取消只停回自己啟動的）。"
  - "🔴 權杖值不得出現在命令列、日誌、錯誤訊息、IPC 回傳給 renderer 以外的地方；舊容器 `--token` 的解析只在 main。child_process 一律 `execFile` + 陣列參數 + timeout，容器名稱過 `/^[a-zA-Z0-9._-]+$/`（CLAUDE.md「Child Process Spawning」）。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。本機 Docker 沒有 engine：不建立 / 啟動 / 刪除容器或映像。"
---

# T0849 — Docker 精靈 W1：權杖與安全修正

## 元資料
- **工單編號**：T0849｜**類型**：implementation｜**狀態**：TODO｜**建立**：2026-11-04 15:18 (UTC+8)
- **規模**：M｜**決策**：D283（U5：新容器不再帶 `--token`）｜**可並行**：T0850（W3）

## 背景
T0848 研究（回報區〈調查結論〉1、3、5，附 `檔案:行`）：「沿用既有容器讀不到權杖」的推論不成立（帶 `--token` 啟動也會寫 `server-token.json`），但現行流程有這些問題：建立新容器把 `--token` 放在 `docker run` 參數（`docker-lifecycle.ts:268`，`docker inspect` / 程序列表看得到）；沿用既有容器在 `docker start` 後、等 healthy **之前**就 `exec cat`（`:283-284`）；讀不到時 `allowFailure` 不報錯，最後在 connect-test 顯示看不出原因的 `PRECONDITION_MISSING`；`docker:inspect-container` 把 `Config.Env` 整串回傳給 renderer（`docker-detect.ts:103`）；`listContainers` 等 docker 呼叫沒有 timeout。

## 任務
1. **建立新容器不帶 `--token`**：server 第一次啟動自己產生並寫檔（`loadOrGenerateToken`，`electron/remote/headless-entry.ts`）；精靈在 healthy 後經 `docker exec cat` 讀取，與沿用既有容器同一條路徑。同時加 label `bat.server=1`（W2 的選單用來標「BAT 建立」）。
2. **讀權杖移到 healthy 之後**（兩條路徑都是）。
3. **三段式權杖取得**（只在 main，只回傳 token 本身）：
   1. 路徑：`docker inspect` 的 `Config.Cmd` / `Entrypoint` 有 `--data-dir <d>` → `<d>/server-token.json`；否則依 `Config.Env` 的 `XDG_DATA_HOME` / `HOME` 推算；最後 `/root/.local/share/bat-server`。
   2. 舊容器 fallback：檔案讀不到、但 `Config.Cmd` 有 `--token <t>` → 用 `<t>`。
   3. 都沒有 → 新錯誤碼 `docker-token-unavailable`（error-mapper＋三語文字：確認容器跑的是 bat-server、看 `docker logs`），取代現在的 `PRECONDITION_MISSING`。
   - 不重新簽發權杖。
4. **`docker:inspect-container` 不回傳 env**：renderer 只用 `image` / `state`；確認所有 consumer 後從回傳形狀移除 `env`（型別一併改）。
5. **timeout**：`listContainers`、`execDocker` 與其他 docker `execFile` 補 timeout（偵測類 5 s、IO 類 30 s；既有 `docker run` / 等 healthy 的時限照舊）。
6. **測試**：純函式（權杖路徑推算、`--token` 解析、`docker run` 參數組裝斷言「沒有 `--token`、只綁 127.0.0.1、有 label」）；main 以既有 `setExecFileImplForTests` 模式 mock；`headless-server.test.ts` 補「帶 `opts.token` 時 `server-token.json` 寫入且內容相同」（T0848 的探測腳本是雛形）；精靈流程 `docker-flow.test.ts` 更新。

### 驗收條件
- [ ] 上述測試通過；既有 docker / 精靈 / headless 測試不回歸
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npx vite build` 成功
- [ ] 回報區列出 `--token`、`env` 在程式碼中已不再出現的 grep 證據（權杖值相關）
- [ ] 若 WSL 內有可用的 Docker（T0743 的環境），可選跑 `BAT_E2E_T0743_DOCKER=1` 的 T0743 spec；沒有就在回報區列〈待實機驗收〉
- [ ] commit 只含本單範圍

---

## 回報區

（Worker 填寫）
