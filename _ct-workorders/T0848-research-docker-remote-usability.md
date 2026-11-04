---
schema_version: 1
schema_kind: workorder
id: T0848
title: "研究：PLAN-052 Docker 遠端路線可用性（映像來源、Use existing 選容器與權杖、重跑精靈更新既有設定）的設計與拆單"
type: research
status: TODO
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-04T15:06:25+0800"
depends_on: []
related:
  - "PLAN-052；D282；T0646（`/remote/docker` 改寫，後續建議 4、5）；T0743（WSL 內 Docker＋shim 驗收）；BUG-156 / T0649（挑埠，CLOSED）；PLAN-031（server bundle 發佈）；T0552 / T0554（`server-bundle-install-script.ts`）；PLAN-059 子項 E（不納入）"
affects_files:
  - _ct-workorders/T0848-research-docker-remote-usability.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 唯讀研究：只寫本工單檔，不改程式、不建檔、不開分支。可讀程式、跑唯讀指令與既有測試；可以查詢本機 `docker version` / `docker ps -a` / `docker images`（唯讀），不得建立、啟動、停止、刪除任何容器或映像，不得 `docker build` / `push` / `pull`；不連任何實際遠端主機、不碰本機 BAT 安裝版與它的 Terminal Server。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台（研究型提問上限依 `research_max_questions`）。不 push。Git：只 commit 本工單檔（`git add <明確路徑>`，不用 `-A` / `.`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
  - "公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0848 — 研究：Docker 遠端路線可用性（PLAN-052）

## 元資料

- **工單編號**：T0848
- **任務名稱**：研究：PLAN-052 Docker 遠端路線的設計與拆單
- **狀態**：TODO
- **類型**：research
- **互動模式**：enabled（yolo：問塔台）
- **intervention_type**：context-dependent
- **Renew 次數**：0
- **建立時間**：2026-11-04 15:06 (UTC+8)

## 研究目標

使用者決定 PLAN-052 先研究再拆單（D282）。目標是產出可以直接拆成實作工單的設計，讓一般使用者走得通 Docker 遠端精靈：

1. 精靈不必自己從原始碼建映像就能用。
2. 「Use existing」可以選容器，並且拿得到權杖。
3. 重跑精靈時更新既有設定，不再新增一筆。

## 已知資訊（2026-11-02 第一百零五 session 核對，見 PLAN-052〈狀態核對〉）

- 精靈預設映像是 `bat-server:latest`（`src/components/setup-wizard/docker-flow.ts:12`），只能用 `npm run build:docker-image`（`docker/Dockerfile`、`scripts/build-docker-image.mjs`）自己建。沒有 workflow 推送映像。
- 「Use existing」取 `containers[0]`（`src/components/setup-wizard/steps/docker/pick-container.ts:75`）。精靈建立的容器以 `--token` 帶權杖、沒寫 `server-token.json`（程式碼推論），之後以 Use existing 接回時可能讀不到權杖。
- Docker 分支寫設定一律 `profile.create`（`src/components/setup-wizard/steps/wsl/write-profile.ts`）；WSL / SSH 有 `findExistingProfiles`，Docker 沒有。
- `src/components/setup-wizard/steps/docker/` 已有 `install-server-bundle.ts`：先查清楚它現在做什麼，和「把伺服器套件裝進任意容器」差多少。
- BUG-156（挑埠）已 CLOSED（T0649）。T0743 用 WSL 內的 Docker＋測試用 `docker.exe` shim 驗收，繞過了上面三點。目前沒有使用者卡住的回報。
- **不納入**：PLAN-059 子項 E（SSH stdio、遠端不開埠、暫時沙箱），使用者決定維持只記錄。

## 調查範圍與要回答的問題

1. **現況盤點**：寫出 Docker 精靈每一步的實際流程（`steps/docker/*`、`docker-flow.ts`、對應的 IPC / main 端 handler）：建新容器與 Use existing 兩條路徑各自怎麼取得映像、怎麼啟動 bat-server、權杖與憑證放哪、怎麼寫設定。標出 PLAN-052 的三個問題在程式碼的實際位置，並確認「讀不到權杖」這個推論是否成立。
2. **映像 / 伺服器來源（主要比較項）**：比較三種做法，每種列出工作量（S / M / L）、維護成本（每次發版要做什麼）、使用者步驟、離線 / 企業網路下能不能用、與現有 `server-bundle-v<版號>` 發佈線（D120 / D146）和 distributor（`electron/remote/server-bundle-distributor.ts`）的關係：
   - (a) release workflow 推 GHCR 映像（`ghcr.io/gowerlin/...`）：權限、多架構（amd64 / arm64）、版號 tag、`latest` 規則、預覽版要不要推。
   - (b) release asset 放 `docker save` 的 tar，精靈下載後 `docker load`：大小、驗證（sha256 sidecar）。
   - (c) 不發佈映像，精靈把已下載的 server bundle 裝進使用者指定的容器（共用 `electron/server-bundle-install-script.ts`）：容器要有什麼（glibc / musl、架構、`tar`、可寫目錄、bundle 內 node 能不能跑）、bat-server 在容器裡怎麼常駐（沒有 systemd）、容器重啟後怎麼回來。
   最後給一個推薦，並說明理由。
3. **Use existing 選容器**：UI（清單欄位：名稱、映像、狀態、埠；空清單與停止中的容器怎麼處理）、選完後權杖 / 憑證指紋怎麼取得（讀容器內檔案、`docker exec`、重新簽發），以及與 TOFU 指紋（PLAN-018）的關係。
4. **重跑精靈更新設定**：怎麼辨識「同一個」Docker 設定（容器 id / 名稱 / 埠 / 映像），比照 WSL `findExistingProfiles`；容器被刪掉重建時怎麼處理；與多 profile 同時連線（PLAN-039）是否衝突。
5. **安全**：權杖不進命令列與日誌（`--token` 目前出現在 `docker run` 參數，會出現在 `docker inspect` 與程序列表，要評估）、容器內權杖檔權限、bind 介面（只綁 localhost 的埠映射）。
6. **測試策略**：哪些可以單元測試；哪些需要 e2e（既有 Docker / WSL e2e 基礎設施與 T0743 的 shim）；CI 上有沒有 Docker 可以用。

## 研究指引

- 先讀 T0646 與 T0743 的回報區（`_ct-workorders/_archive/workorders/`）、`docs/agent-guide/multi-remote-profiles.md`、`docs/agent-guide/remote-security.md`、`docs/agent-guide/packaging-release-checks.md`（server bundle 一節）、`docs/server-bundle-distribution.md`，以及網站 `/remote/docker` 頁的原始檔。
- 結論要能拿來做決定：每題給建議值與理由，並列出需要使用者決定的事項（例如映像來源、預覽版要不要推映像）。

## 預期產出（寫在回報區）

- 〈調查結論〉：逐題回答（附 `檔案:行`）。
- 〈建議方向〉：映像來源三選一的比較表與推薦；Use existing 與重跑精靈的設計。
- 〈建議下一步〉：拆成實作工單，每張寫範圍、`affects_files` 預估、規模 S / M / L、依賴、能否並行、驗收方式。另列需要使用者裁決的問題。

---

## 回報區

（Worker 填寫）
