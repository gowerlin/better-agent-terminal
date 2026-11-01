---
schema_version: 1
schema_kind: workorder
id: T0743
title: "Docker 類待驗收 BUG（097 / 105 / 111）：以 WSL 內的 Docker（優先）或 gxdocker 遠端 Docker 跑驗收，不改使用者環境設定、只動自己建立的資源"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-01T18:36:08+0800"
started_at: ""
updated_at: "2026-11-01T18:36:08+0800"
completed_at: ""
depends_on: [T0742]
related:
  - "T0738 回報區〈C 類需要的環境〉（BUG-105 / 111）；BUG-097（T0738 對象漏列，塔台補上）"
  - "BUG-097 / T0418 / T0427 / T0428、BUG-105 / T0434 一帶、BUG-111 / T0444；`e2e/pre6-ui-remote-acceptance.spec.ts`（U4 BUG-105，需 `node e2e/real-remote/t0514-env.mjs up`）、`e2e/pre6-wizard-acceptance.spec.ts`（W8 BUG-111）、`e2e/real-remote/t0514-env.mjs`"
  - "`electron/docker-detect.ts`、Docker 設定精靈相關程式（以實際檔案為準）；CLAUDE.md「Remote 資安（PLAN-018 T0182）」「多 remote profile 同時連線（PLAN-039）」"
affects_files:
  - "e2e/（只在既有 spec 需要可設定的 Docker 端點時新增 opt-in 參數或新 spec；🔴 不改既有斷言的意圖，預設行為不變）"
  - "e2e/real-remote/（同上，只加 opt-in 參數）"
  - _ct-workorders/T0743-docker-bug-acceptance-wsl-or-gxdocker.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 使用者指定（2026-11-01 第一百零三 session）：Docker 用 WSL 內的 Docker 或 gxdocker remote，不用 Docker Desktop。塔台 18:3x 唯讀探測：Windows `docker context ls` 只有 `default`（npipe docker_engine，未執行）/ `desktop-linux`（未執行）；WSL `Ubuntu-24.04` 有 `/usr/bin/docker`、server 29.1.3、已有 1 個使用者自己的容器在跑；`~/.ssh/config` 有 `Host gxdocker`（`User gower`）。"
  - "🔴 第一階段（先查證，不動手）：讀 BAT 連 Docker 的方式（docker CLI？是否尊重 `DOCKER_HOST` / `DOCKER_CONTEXT`？精靈與 docker-linux 遠端 profile 各自怎麼呼叫）與 `t0514-env.mjs` / 兩支 pre6 spec 的前提（mount 路徑、port、映像來源），判斷在**不改使用者環境設定**下可行的端點：(a) WSL Docker：例如測試程序與隔離實例經 `wsl -d Ubuntu-24.04 -- docker …`、或 BAT 本身支援的 WSL 路徑；(b) gxdocker：只在測試程序 / 隔離實例的 env 設 `DOCKER_HOST=ssh://gxdocker`（用使用者既有 ssh 設定與金鑰）。優先 (a)；(a) 不可行才考慮 (b)，🔴 改用 (b) 前先以提問通道問塔台（附理由與會在 gxdocker 上建立的資源清單），塔台答覆後才可動 gxdocker。兩者都需要改環境設定才可行 → 停下回報 BLOCKED，寫明需要什麼。"
  - "🔴 不得改使用者環境：不改 WSL / gxdocker 的 daemon 設定（`daemon.json`、systemd）、不讓 dockerd 新增監聽（tcp 2375 等）、不新增 / 切換 `docker context`（會寫 `~/.docker`）、不改 `~/.ssh/config` 或金鑰、不啟動 Docker Desktop、不在使用者 WSL 安裝 / 移除 server bundle（使用者已有 `WSL Ubuntu-24.04` 遠端 profile 與其 bat-server，絕不碰）、不改 Windows 防火牆。"
  - "🔴 只動自己建立的資源：容器、映像、volume、網路、暫存目錄一律以 `bat-e2e-t0743-` 開頭（既有 spec 寫死的名稱如 `bat-t0514-srv` 若無法改，以 opt-in 參數加前綴，或先確認該名稱在目標 Docker 上不存在）。開始前與結束後各記一次 `docker ps -a` / `images` / `volume ls` / `network ls` 的清單（只記名稱與 id），回報區附比對：使用者原有的資源一個都沒變（含那個正在跑的容器）。🔴 不得 `prune`、不得 stop / rm 非自己建立的任何資源；port 只綁 127.0.0.1（BUG-097 驗的就是不全介面暴露），先確認 port 未被佔用。跑完清掉自己建立的全部資源；清不掉就列出並說明。"
  - "🔴 情境：① BUG-097：bat-server 容器的埠只綁 127.0.0.1（不全介面暴露）、container 內 bind 可達、HEALTHCHECK 有路由（以 T0418 / T0427 / T0428 的實際修正為準）。② BUG-105：docker-linux 遠端視窗的 proxied channel 路徑轉換（`pre6-ui-remote-acceptance` U4：claude:* cwd、github:*、git-scaffold:*、worktree:create 轉成容器路徑）；🔴 需要真實 Claude 登入的那一步（`claude:start-session` 後 `pwd`）不做，沿用 spec 的 recorder 取代，回報標明。③ BUG-111：精靈 rollback / 取消時不刪、不停使用者事先建立的容器與資料（`pre6-wizard-acceptance` W8 Docker 側）—— 「使用者事先建立的容器」一律由本單自己建立並命名 `bat-e2e-t0743-user-*` 來扮演，🔴 不得拿使用者真正的容器當受測對象。"
  - "🔴 不改產品程式碼（`src/` / `electron/` / `scripts/` 都不動）；發現產品缺陷記在〈發現的問題〉，由塔台開 BUG。不改 BUG 單狀態與 `_bug-tracker.md`；回報區列〈BUG 結案建議〉。隔離：BAT 一律用 `e2e/fixtures/electron-isolation.ts` 的隔離實例（不碰使用者正在用的 BAT 與 userData、不執行安裝檔）。T0742 完成後才派本單（避免同時 build）；先 `npx vite build`。不使用真實模型。既有 spec 若預設對安裝版（`BAT_E2E_EXECUTABLE`），本單以 source build 跑並說明；需要 server bundle tarball 時用 repo 的建置腳本產生到暫存目錄或已發佈的 `server-bundle-v0.7.2-pre.8`（`gh release download -R gowerlin/better-agent-terminal`）。"
  - "🔴 驗證：跑到的 spec 連跑 2 次綠（Docker 環境準備時間長時可說明只跑 1 次的原因）；改了 e2e 檔則 `npm run typecheck` = 0、`npm run typecheck:electron` = 0（e2e 另以單檔 tsc 檢查）。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，🔴 回報、spec、log 摘錄不得寫 gxdocker 的 HostName / IP、使用者帳號或家目錄路徑（主機只寫 `gxdocker`）。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0743 — Docker 類待驗收 BUG（WSL Docker / gxdocker）

## 元資料

- **工單編號**：T0743
- **類型**：implementation（驗收）
- **優先級**：P2
- **建立時間**：2026-11-01T18:36:08+0800
- **預估規模**：M

## 背景

T0738 盤點後，BUG-097 / 105 / 111 需要執行中的 Docker 才能驗（BUG-097 為 T0738 對象漏列）。本機 Docker Desktop 未執行；使用者指定改用 WSL 內的 Docker 或 gxdocker 遠端 Docker。本單先查證可行端點，在不改使用者環境、只動自己建立的資源的前提下跑既有 spec（`pre6-ui-remote-acceptance` U4、`pre6-wizard-acceptance` W8）與 BUG-097 的檢查。

## 範圍

1. 第一階段查證與端點選擇（WSL 優先；gxdocker 須先問塔台）。
2. 情境 ①–③。
3. 資源清單前後比對與清理。
4. 〈BUG 結案建議〉。

## 不做

- 不改產品程式碼、不改 BUG 狀態。
- 不改任何環境設定、不碰使用者既有容器與 WSL bat-server、不啟動 Docker Desktop、不用真實模型。

## 驗收

- [ ] 端點查證結論（選哪個、為什麼、另一個為何不用）
- [ ] ①–③ 逐項 PASS / 未涵蓋與原因
- [ ] 資源清單前後比對：使用者原有資源不變、自建資源已清除
- [ ] 〈BUG 結案建議〉

---

## 回報區

### 完成狀態

### 端點查證

### 情境結果

### 資源比對

### 發現的問題

### BUG 結案建議

### 互動紀錄

### 回報時間
