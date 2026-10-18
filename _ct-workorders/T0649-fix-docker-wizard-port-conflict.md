---
schema_version: 1
schema_kind: workorder
id: T0649
title: "BUG-156：Docker 設定精靈的容器埠不再固定 9876，避開 BAT 自己的 RemoteServer 埠與已佔用埠"
type: bugfix
status: TODO
repo: better-agent-terminal
project: BUG-156
priority: P2
sizing: S
created_at: "2026-10-18T18:33:43+0800"
depends_on: [T0646]
related:
  - "BUG-156（T0646 程式碼追蹤）；T0129（RemoteServer 自動啟動、`REMOTE_PORT_DEFAULT`）；WSL 挑埠 `electron/wsl-systemd.ts` `pickServerPort` / `pickServerPortForUnit`；CLAUDE.md「Child Process Spawning」「Remote 資安」節"
  - "網站 `site/remote/docker.md` 有「埠衝突」警告（T0646），修正後由塔台另案更新網站，本單不改 `site/**`"
affects_files:
  - "src/components/setup-wizard/docker-flow.ts"
  - "src/components/setup-wizard/steps/docker/**"
  - "electron/docker-lifecycle.ts"
  - "electron/** 中 Docker 精靈直接相關的 IPC handler（只在需要新增 / 改挑埠 IPC 時）"
  - "src/**/__tests__/**、electron/__tests__/**（新增 / 更新測試）"
  - "docs/agent-guide/** 中提到 Docker 埠的段落（只在有時補一句；CLAUDE.md 只在必守規則改變時動一句）"
  - _ct-workorders/T0649-fix-docker-wizard-port-conflict.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 先確認根因再修：讀程式碼確認 Docker 精靈的埠與 BAT RemoteServer 的實際 bind（host / port、設定可改值）；能實機就實機（本機有 Docker 時以隔離方式跑一次 `docker run -p 127.0.0.1:9876:…`，用完刪掉自己建立的容器，不碰使用者既有容器 / 映像 / volume）。確認不是 bug（例如兩者其實不衝突）→ 不改程式碼，回報 `FAILED` 並附證據，塔台改 BUG 狀態。"
  - "🔴 不改 BAT RemoteServer 的預設埠或 bind 行為（會影響所有分頁 env、helper、遠端連線）；只改 Docker 精靈這一側。挑埠須避開：BAT 目前實際使用的伺服器埠（讀設定，不寫死 9876）、已被佔用的埠；重跑 / 升級若有既有設定，沿用原埠。"
  - "🔴 child_process 一律 `execFile` / `spawn` + array args + timeout；外部輸入（容器名等）過白名單 regex（CLAUDE.md「Child Process Spawning」）。"
  - "🔴 非隔離工單。T0650（BUG-157，改 `ProfilePanel.tsx` / `EditRemoteProfileModal.tsx`）與 T0648（唯讀探針）可能同時進行，不碰它們的檔。不改 i18n 字串（英文按鈕由 BUG-158 處理，避免衝突）；必要的新訊息先用既有 key 或在回報列出需要的 key。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。不 push。"
---

# T0649 — Docker 精靈避開 9876 埠衝突

## 背景

T0646 依程式碼改寫 `/remote/docker` 時發現：Docker 精靈的容器埠固定 `127.0.0.1:9876`（`docker-flow.ts` `DEFAULT_SERVER_PORT`、`docker-lifecycle.ts` `DOCKER_PUBLISH_HOST`），而 BAT 啟動時自動開的 RemoteServer 預設也在 `127.0.0.1:9876`（`main.ts` `REMOTE_PORT_DEFAULT`）。推論預設設定下「Create new」必定失敗。詳見 BUG-156。

## 要做的事

1. 確認根因（程式碼 + 可行時實機），列出精靈從挑埠到 `docker run`、寫入設定檔、之後連線的完整路徑。
2. 修正：容器公開埠改為挑選可用埠（參考 WSL `pickServerPort` 的範圍與避讓規則；可共用就共用，不要複製一份）；設定檔記錄實際埠，之後連線用它。「Use existing」若容器已有公開埠，沿用。
3. 錯誤處理：埠真的用完或 `docker run` 因埠失敗時，精靈顯示可理解的錯誤（沿用既有 error-mapper 形式）。
4. 測試：挑埠避開 BAT 伺服器埠、避開已佔用埠、沿用既有設定的埠、設定檔寫入實際埠。

## 驗證

- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npm run test:unit` 全綠（回報 passed / files 數；基線 5384 / 311）
- `npx vite build` 成功
- 實機（可行時）：本機 Docker 以預設設定跑「Create new」成功；無 Docker 時寫明未實機

## 驗收

- Docker 精靈在 BAT RemoteServer 使用 9876 時仍可完成；設定檔與連線使用實際埠
- RemoteServer 行為不變；WSL / SSH 精靈不受影響
- 三項驗證通過；回報區附根因確認、修正說明、測試清單、實機結果（或未實機原因）、commit，以及網站 `/remote/docker`「埠衝突」段落需要怎麼改（給塔台）
- 只改 `affects_files`；未 push
