---
schema_version: 1
schema_kind: workorder
id: T0552
title: "BUG-138 + BUG-139：WSL 精靈升級既有 server 時沿用原 port 與既有 profile；覆蓋安裝前清掉 bundle 管理的舊檔（並確認 SSH 精靈是否同病）"
type: bugfix
status: TODO
repo: better-agent-terminal
project: "BUG-138 / BUG-139"
priority: P1
sizing: M
created_at: "2026-10-16T02:50:44+0800"
updated_at: "2026-10-16T02:50:44+0800"
started_at: ""
completed_at: ""
commit: ""
target_version: "0.6.1-pre.5（與 T0551 同批）"
depends_on: []
related:
  - "BUG-138 / BUG-139（現象、證據、修正方向）；T0550 回報區「發現的產品缺陷」與 `e2e/t0550-wsl-acceptance.spec.ts`"
  - "T0511（SSH 上傳先刪舊 `staging/`、enable 階段 restart / reload）；T0546 / T0492 / T0503（bundle 移除的套件）"
affects_files:
  - electron/wsl-systemd.ts
  - electron/wsl-detect.ts
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/components/setup-wizard/steps/wsl/write-systemd-unit.ts
  - src/components/setup-wizard/steps/wsl/install-server-bundle.ts
  - "src/components/setup-wizard/**（WSL 精靈建立 / 更新 profile 的步驟；列出實際檔案）"
  - "electron/remote/ssh-bundle-uploader.ts、electron/remote/ssh-setup-handlers.ts、electron/remote/ssh-start-server.ts（僅在 SSH 確認同病時）"
  - "src/locales/*.json（若新增使用者可見文字，三語）"
  - "electron/__tests__/**、src/components/setup-wizard/__tests__/**（新增 / 更新測試）"
  - "e2e/t0550-wsl-acceptance.spec.ts（僅加 env 開關或新增升級情境，預設行為不變）"
  - "CLAUDE.md / docs/wsl-deployment.md（若升級行為描述需更新）"
  - _ct-workorders/T0552-wsl-wizard-upgrade-keep-port-clean-install.md
  - _ct-workorders/BUG-138-wsl-wizard-upgrade-changes-port.md
  - _ct-workorders/BUG-139-wsl-bundle-overlay-install-leaves-stale-files.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`（`src/styles/settings.css` 的 M 不是你的變更）。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）；e2e 只用隔離實例（需先 `npx vite build`）。"
  - "🔴 WSL 實機：可以用 `Ubuntu-24.04` 驗證升級（它目前是 T0550 裝的 0.6.1-pre.4，service 在 9877，使用者 profile `wsl-ubuntu-24-04` 依賴這個 port 與憑證）。實機驗證後 server 必須仍在 **9877**、憑證指紋不變、service active；動之前先備份（同 T0550 做法，備份路徑寫進回報區）。不要刪 T0550 的備份 `~/.local/bat-server.bak-0.5.9-pre.4-t0550`。不動其他發行版、Docker、`~/.ssh`、`.wslconfig`。"
  - "🔴 不要碰 T0551 的檔案（`electron/handlers/pty.ts`、`electron/pty-manager.ts`、`electron/close-worker.ts`、`electron/remote/headless-entry.ts`）。"
  - "🔴 清舊檔時絕不能刪使用者資料（`~/.local/share/bat-server`：憑證、token、settings 等）與 installRoot 以外的任何路徑；清除範圍必須是明確白名單，路徑需驗證（拒絕空字串、`/`、`~` 等）。"
---

# T0552 — BUG-138 + BUG-139：WSL 精靈升級沿用 port、乾淨覆蓋安裝

## 背景

T0550 用安裝版 pre.4 的 WSL 精靈把使用者的 `Ubuntu-24.04` server 從 0.5.9-pre.4 升到 0.6.1-pre.4，發現兩個缺陷：

- **BUG-138**：舊 server 執行中時，`write-systemd-unit` 的 `wsl:pick-server-port` 探測到原 port（9877）被佔用（就是舊 server 自己），改挑 9878；unit 改寫並重啟後，既有 profile 連不上，精靈另建新 profile。T0550 靠先停 service 避開。
- **BUG-139**：`installBundle` 只 `mkdir -p` + `tar -xzf --strip-components=1`，不清目錄；升級後 0.5.9 的 `claude-agent-sdk-linux-x64`（226M）、`@img`、`better-sqlite3`、`sharp` 殘留（約 256 MiB）。

重跑精靈是目前唯一的升級路徑，這兩點會直接影響每個升級的使用者。

## 任務

### BUG-138：升級沿用 port 與 profile

1. 偵測同 distro 已有精靈安裝的 bat-server（既有 unit 與 `BAT_SERVER_PORT`）時，沿用該 port（或先停舊 service 再探測，取捨由你決定並說明）；探測邏輯不得把「同 distro 舊 bat-server 自己佔的 port」當成衝突。真正被其他程式佔用時，維持現行挑新 port 的行為。
2. 精靈結束時更新既有的對應 profile（同 distro、同 port / 同 installRoot），而不是另建一個；憑證 / token 沿用（現況已沿用，確認不退步）。
3. 確認 SSH 精靈是否有同樣問題（遠端 port 挑選與 profile 建立）。有就一併修，沒有就在回報區寫明依據。

### BUG-139：乾淨覆蓋安裝

4. WSL 安裝前清掉 bundle 管理的內容，或解到暫存目錄後整批換名（原子性較好，取捨由你決定）。使用者資料（`~/.local/share/bat-server`）與 installRoot 以外的路徑不得受影響；路徑防呆見 memory_overrides。
5. 確認 SSH 上傳路徑（`ssh-bundle-uploader.ts`）是否也會殘留舊檔，有就一併修。

### 驗證

6. 單元測試：port 沿用、真衝突仍換 port、profile 更新而非新建、清除範圍白名單與路徑防呆、SSH 對應情境。
7. 實機（WSL `Ubuntu-24.04`，條件見 memory_overrides）：以本機 build（`npx vite build` 後的隔離實例，或擴充 `e2e/t0550-wsl-acceptance.spec.ts` 加升級情境開關）在 **server 執行中**跑精靈升級（同版重裝即可）。判準：port 仍是 9877、沒有新建 profile、`du -sh ~/.local/bat-server` 明顯下降（不再含 `claude-agent-sdk-linux-x64` / `@img` / `better-sqlite3` / `sharp`）、smoke `npm run smoke:remote:headless` 13/13。
8. BUG-138 / BUG-139 狀態改 FIXED、填修正 commit；需要時更新 `CLAUDE.md` / `docs/wsl-deployment.md` 的升級說明。

## 驗收條件

- [ ] 舊 server 執行中跑精靈：port 不變、更新既有 profile、不新建
- [ ] 覆蓋安裝後 installRoot 內容等於新 bundle；使用者資料不受影響
- [ ] SSH 兩項有判定（修正或「不同病」的依據）
- [ ] `npm run test:unit` 全綠（基線 4073 passed / 243 files，加上新測試）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功
- [ ] WSL 實機驗證通過，結束時 server 在 9877、指紋不變、active
- [ ] BUG-138 / BUG-139 → FIXED

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

### 產出摘要

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 回報時間
