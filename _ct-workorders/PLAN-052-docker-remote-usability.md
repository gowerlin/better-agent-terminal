---
schema_version: 1
schema_kind: plan
id: PLAN-052
title: "Docker 遠端路線可用性：發佈 `bat-server` 映像或讓精靈把伺服器套件裝進任意容器；「Use existing」可選容器；重跑精靈更新既有設定"
status: IN_PROGRESS
priority: low
created_at: "2026-10-18T18:33:43+0800"
links:
  source: "T0646 回報區「給塔台的後續建議」第 4、5 點；使用者 2026-10-18 18:3x 同意記成 PLAN"
  related: [T0646, BUG-156, BUG-158, PLAN-031, PLAN-059]
---

# PLAN-052 — Docker 遠端路線可用性

## 動機

T0646 依程式碼改寫 `/remote/docker` 時發現，一般使用者走不通 Docker 路線：

- 精靈用 `bat-server:latest` 映像，但安裝檔與 GitHub 都沒有發佈，必須自己從原始碼 `npm run build:docker-image` 建置（`docker/Dockerfile`、`scripts/build-docker-image.mjs`）。
- 「Use existing」不能選容器，取 `docker ps -a` 第一個（`steps/docker/pick-container.ts`）；精靈建立的容器以 `--token` 帶權杖、沒寫 `server-token.json`，之後以 Use existing 接回可能讀不到權杖（程式碼推論）。
- 精靈每次都新增設定，不像 WSL / SSH 會更新同一筆。

## 待研究 / 待決

1. 映像發佈管道（GHCR、release asset、或不發佈改為「把已下載的伺服器套件裝進使用者指定的容器」，與 WSL / SSH 共用 `server-bundle-install-script.ts`）。
2. 「Use existing」的容器選擇 UI 與權杖取得方式。
3. 重跑精靈時以容器 / 埠辨識既有設定並更新（比照 WSL `findExistingProfiles`）。
4. 與 BUG-156（挑埠）的關係。

## 2026-11-02 狀態核對（第一百零五 session）

- **維持 IDEA**：動機的三個問題都還成立。
  1. 映像未發佈：精靈預設仍是 `bat-server:latest`（`src/components/setup-wizard/docker-flow.ts:12`），沒有任何 workflow 推送映像。
  2. 「Use existing」不能選容器：仍取 `containers[0]`（`src/components/setup-wizard/steps/docker/pick-container.ts:75`）。
  3. 重跑精靈新增設定：Docker 分支仍是 `profile.create`（`src/components/setup-wizard/steps/wsl/write-profile.ts`）；WSL / SSH 有 `findExistingProfiles`，Docker 沒有。
- 待決第 4 點：BUG-156（挑埠）已 CLOSED（T0649 `99abe9a1`；T0743 驗收）。
- T0743 以 WSL 內的 Docker＋測試專用 `docker.exe` shim 驗收，繞過上述三點；沒有實際使用者卡住的回報。
- 與 PLAN-059 E（遠端改走 SSH stdio、支援暫時沙箱）可能重疊，日後一起評估。

## 2026-11-04 → IN_PROGRESS（第一百一十九 session，D282）

- 使用者決定先研究再拆單：研究單 **T0848**（唯讀）。映像來源三種做法（GHCR、release asset tar、把 server bundle 裝進任意容器）交由研究比較後推薦。
- **不納入** PLAN-059 子項 E（SSH stdio、暫時沙箱），該項維持只記錄。
