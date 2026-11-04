---
schema_version: 1
schema_kind: workorder
id: T0852
title: "Docker 精靈 W4a：(c′) 主行程端 docker 原語（pull、架構、bundle volume 安裝、相容性探測、建立容器參數）"
type: implementation
status: TODO
repo: better-agent-terminal
project: PLAN-052
priority: P2
sizing: M
created_at: "2026-11-04T15:18:27+0800"
depends_on: [T0849, T0851]
related:
  - "PLAN-052；D283（U1 (c′)、U4 root＋`--data-dir /var/lib/bat-server`、U5 無 `--token`）；T0848 回報區〈調查結論〉2 與〈建議下一步〉W4a；PLAN-031（server bundle distributor）；T0552 / T0554（`server-bundle-install-script.ts`）"
affects_files:
  - _ct-workorders/T0852-docker-bundle-volume-primitives.md
  - electron/docker-bundle-volume.ts
  - electron/docker-lifecycle.ts
  - electron/docker-detect.ts
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - electron/server-bundle-install-script.ts
  - electron/__tests__/docker-bundle-volume.test.ts
  - electron/__tests__/docker-lifecycle.test.ts
  - electron/__tests__/server-bundle-install-script.test.ts
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只加 main 端原語與 IPC，精靈步驟不改（W4b / T0853）；現行建立 / 沿用容器的流程行為不變。"
  - "🔴 `server-bundle-install-script.ts` 若要把 root 參數化：WSL / SSH 產出的腳本逐字不變（既有測試斷言照舊通過）。BAT 不跑依賴安裝（D152），只裝 BAT 自己的 bundle、不碰基底映像套件。"
  - "🔴 建立容器的參數由純函式組出：只綁 `-p 127.0.0.1:<P>:9876`、沒有 `--token`、server 以 root 執行並 `--data-dir /var/lib/bat-server`（U4）。tarball 經 stdin 串流，不寫暫存檔進容器以外的地方。權杖 / 憑證不記日誌。"
  - "🔴 child_process 一律 `execFile` / `spawn` + 陣列參數 + timeout（pull 可長、要可中止）；映像名稱、容器名稱、volume 名稱都要過白名單（映像名稱允許 `/`、`:`、`@` 的 registry 形式，另訂嚴格 regex 並測試）。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。本機 Docker 沒有 engine：不建立 / 啟動 / 刪除容器或映像；真 Docker 驗收列〈待實機驗收〉或在 WSL Docker 上做（只能用 `bat-t0852-` 前綴的拋棄式容器 / volume，做完刪除）。"
---

# T0852 — Docker 精靈 W4a：(c′) 主行程端 docker 原語

## 元資料
- **工單編號**：T0852｜**類型**：implementation｜**狀態**：TODO｜**建立**：2026-11-04 15:18 (UTC+8)
- **規模**：M｜**決策**：D283｜**依賴**：T0849、T0851（同改 `docker-detect.ts` / `docker-lifecycle.ts` / `electron.d.ts`，循序）

## 背景
D283：映像來源採 (c′)：精靈 pull 使用者選的基底映像（預設含 git 的官方映像，W4b 決定），把 server bundle 裝進 volume，再以基底映像建立容器。完整設計（指令形狀、限制）見 T0848 回報區〈調查結論〉2 的比較表 (c′) 欄。

## 任務
1. `docker:pull-image`：帶進度、可中止、有逾時。
2. `docker:server-arch`：`docker version --format {{.Server.Arch}}` → `normalizeArch`（`src/lib/arch-normalize.ts`）。
3. volume 建立 / 刪除（含 ownership 紀錄，比照既有精靈清理規則）：`bat-server-<name>-bundle`、`bat-server-<name>-data`。
4. `docker:install-bundle-into-volume`：`docker run --rm -i -v <vol>:/opt/bat <基底> sh -c '<buildSshBundleInstallCommand("/opt/bat/server")>'`，tarball 經 stdin 串流；沿用 T0552 / T0554 的 `.bat-new` / `.bat-old` 換版與 restore / discard。
5. 相容性探測：`bin/node -e 1`，辨識 glibc 太舊 / musl（Alpine）並回明確原因代碼；需要 `/bin/sh`、`tar`、`gzip`。
6. `buildBatContainerRunArgs`：`--init`、`--entrypoint /opt/bat/server/bin/bat-server`、`--health-cmd`（同 `docker/Dockerfile` 的 TLS 探測）、`--restart unless-stopped`、`-p 127.0.0.1:P:9876`、兩個 volume、label `bat.server=1`、`--bind-interface all --port 9876 --data-dir /var/lib/bat-server`，沒有 `--token`。
7. `docker.execCommand`：目前只在型別宣告、沒有實作（T0848 發現的死碼）→ 補實作或移除並改寫唯一呼叫點。
8. 確認 `server-cert.json`（含私鑰）與 dataDir 的權限；dataDir 建成 0700。
9. 測試：參數組裝（斷言 127.0.0.1、無 `--token`、白名單）、install 指令與 stdin 串流（mock）、探測結果分類、pull 中止。

### 驗收條件
- [ ] 上述測試通過；`server-bundle-install-script` 既有 WSL / SSH 斷言不回歸
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npx vite build` 成功
- [ ] 真 Docker 上的建立 / 安裝 / 探測：WSL Docker 可用就實測（拋棄式資源、做完刪除，回報區列指令與結果），否則列〈待實機驗收〉
- [ ] commit 只含本單範圍

---

## 回報區

（Worker 填寫）
