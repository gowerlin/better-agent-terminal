---
schema_version: 1
schema_kind: plan
id: PLAN-052
title: "Docker 遠端路線可用性：發佈 `bat-server` 映像或讓精靈把伺服器套件裝進任意容器；「Use existing」可選容器；重跑精靈更新既有設定"
status: IDEA
priority: low
created_at: "2026-10-18T18:33:43+0800"
links:
  source: "T0646 回報區「給塔台的後續建議」第 4、5 點；使用者 2026-10-18 18:3x 同意記成 PLAN"
  related: [T0646, BUG-156, BUG-158, PLAN-031]
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
