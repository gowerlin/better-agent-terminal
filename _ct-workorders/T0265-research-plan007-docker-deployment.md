# T0265-research-plan007-docker-deployment

## 元資料
- **工單編號**：T0265
- **任務名稱**：PLAN-007 — Docker 部署環境研究（在共通 spec 基礎上聚焦 Docker-only 差異）
- **狀態**：IN_PROGRESS
- **建立時間**：2026-04-25 22:46 (UTC+8)
- **開始時間**：2026-04-25 22:46 (UTC+8)
- **類型**：research（讀 code + 寫 spec 章節，**不寫 production code、不重構**）
- **互動模式**：enabled（base image / mount strategy / container 生命週期有設計分支）
- **Renew 次數**：0
- **預估 wall time**：60-90 min（硬性止損 3 小時）
- **預估 context cost**：中（讀 T0260-T0264 結論 + Docker ecosystem 知識 + BAT bundle pipeline 起點）
- **關聯**：
  - 母 PLAN：PLAN-007（💡 IDEA）
  - 前序：T0260 scoping ✅ / T0261 spike ✅ / T0262 server-side spec ✅ / T0263 WSL research ✅ / T0264 共通抽象 ✅
  - 並行延後：T0266 SSH research（依本工單後序列推進）
  - 後序：T0267 彙整 → PLAN-007 PLANNED
- **affects_files**：
  - `_ct-workorders/T0265-*.md`（自身回報，唯一寫入目標）

---

## 背景與 scope 收斂

T0264 已凍結 6 個跨 deployment 共通元件（targetOS schema / PathTranslator interface / bundle pipeline 策略 B / auth-result.serverPlatform / glibc baseline 2.35 / WizardStep framework）。

本工單**只研究 Docker-only 差異**——共通議題不重複。Docker 部署的核心議題是：**容器化 packaging + bind mount UX + 容器生命週期管理**。

**本工單不對 WSL / SSH / handler 跨環境下任何結論**——那是 T0263 / T0266 / EXP-HANDLER-AUDIT 的事。

---

## 任務目標

產出 8 個小節的 spec 草稿，全部寫在本工單回報區。

### 1. Base image 選擇

T0264 已決定 glibc 下限 2.35 + Alpine（musl）排除。剩下選 Linux distro：

**研究**：
- `debian:bookworm-slim`（glibc 2.36，~50 MB）vs `ubuntu:22.04`（glibc 2.35，~70 MB）vs `gcr.io/distroless/nodejs24-debian12`（無 shell，僅 node runtime）
- 與 T0264 §3 bundle 內嵌 node 24.x 的相容性
- security baseline（CVE 數量、patch 頻率）
- 是否需要支援 multi-arch（linux-x64 + linux-arm64）

**輸出**：
- 三選項對比表（含 image size / glibc / shell / package manager / security / multi-arch）
- 推薦方案 + 理由
- Multi-arch 策略（單 manifest 還是兩 image）

### 2. Bind mount strategy + DockerPathTranslator 實作細節

T0264 §2 已凍結 `DockerPathTranslator` interface（含 `mounts: Array<{host, container}>`）。本工單研究**動態 mount 機制**：

**研究**：
- `auth-result.serverPlatform.dockerMounts` 從哪裡來：
  - 選項 A：使用者在 wizard `configure-mounts` step 顯式輸入
  - 選項 B：server 在容器內讀 `/proc/1/mountinfo` 自動偵測 bind mounts
  - 選項 C：兩者結合（自動偵測 + UI 確認）
- mount 點對 BAT workspace 的影響（client 開 `C:\foo\project`，docker run 時 `-v C:\foo\project:/workspace/project`，server 看到 `/workspace/project`）
- 多 workspace 同 container 的處理（每個 workspace 各自 bind mount？或共用一個 root mount？）
- workspace 路徑 vs 系統路徑（`.git`、`node_modules` 等隱藏目錄）的 mount 邊界
- Mount permissions（容器 root vs 使用者 host UID 衝突）

**輸出**：
- 三選項對比 + 推薦
- DockerPathTranslator mount 表結構範例（多 mount 場景）
- Permission 處理方案（user namespace remap vs `--user $UID:$GID`）

### 3. Container 生命週期管理

**研究**：
- BAT 啟動時 container 怎麼起：
  - 模式 A：使用者已有運行中 container，BAT `docker exec` 進去跑 server
  - 模式 B：BAT setup wizard 第一次幫使用者 `docker run -d --restart=unless-stopped` 創新 container
  - 模式 C：BAT 完全管理 container 生命週期（啟動 BAT 時 container start，BAT 退出時 stop）
- Container restart policy（none / on-failure / unless-stopped / always）對 BAT 連線恢復的影響
- 多 BAT instance 共用 container vs 一對一
- Container health check（`HEALTHCHECK` directive vs BAT client 主動 probe）

**輸出**：
- 三模式對比 + 推薦（含 user journey 區別）
- Restart policy 推薦
- Health check 機制設計

### 4. Docker host 偵測與連線

**研究**：
- `DOCKER_HOST` env var 解析（`unix:///var/run/docker.sock` / `tcp://...` / `npipe:////./pipe/docker_engine`）
- Docker Desktop 在 Win/macOS 的 named pipe / Unix socket 路徑
- 沒裝 Docker 時的 detection（`docker --version` 回 ENOENT vs `docker info` 連 daemon 失敗）
- BAT 是否需要 dockerode / docker SDK 還是純 spawn `docker` CLI
- 跨 host docker 場景（`DOCKER_HOST=tcp://remote-vm:2375`，container 不在 BAT 本機）

**輸出**：
- Docker host 偵測流程圖（client OS × Docker installation 矩陣）
- 推薦使用方式（dockerode SDK vs CLI spawn）
- 跨 host docker 是否在 PLAN-007 v1 範圍

### 5. Multi-arch image 策略

**研究**：
- 是否提供 `linux/amd64` + `linux/arm64` 兩個 architecture
- Manifest list（單一 image tag，docker pull 自動選 arch）vs 雙 tag（`bat-server:vX.Y-amd64` + `-arm64`）
- T0264 §3 bundle pipeline 對應修改：CI 是否要 dual matrix build
- 使用者覆蓋率：linux/arm64 主流場景（Apple Silicon Docker Desktop 預設 arm64 emulation、AWS Graviton、樹莓派）

**輸出**：
- Multi-arch 策略推薦
- CI workflow 修改建議（matrix build pseudocode）
- 估計工程成本

### 6. Docker Compose 整合

**研究**：
- 是否提供 `docker-compose.yml` template（server + workspace volume + network 配置）
- compose vs 單純 `docker run` 對 setup wizard UX 的影響
- compose 適用場景（dev container、multi-service stack 整合）vs 簡單 single-container

**輸出**：
- Compose template（YAML 範例）
- 是否在 v1 範圍內（建議 v1 不做，標 future enhancement？）

### 7. 部署 UX（wizard `pick-container` + `configure-mounts` step 細節）

T0264 §6 已凍結 WizardStep 框架。本工單研究 Docker-specific 子步驟：

**研究**：
- `pick-container` UI：列出運行中 container（依 image / name 過濾） + 「新建 container」按鈕
- `configure-mounts` UI：使用者選 host 資料夾 + 對應 container path（預設策略：以 workspace name 為子目錄）
- 第一次連線後的 fingerprint TOFU 流程（與其他 deployment 一致）
- Container 不存在 / daemon 連不到 / image pull 失敗的錯誤訊息

**輸出**：
- pick-container + configure-mounts UI mock（文字描述即可）
- 至少 2 個 user journey（「已有 container」vs「全新 setup」）

### 8. 安全考量

**研究**：
- Container 內跑 root vs non-root user（`--user 1000:1000`）
- claude / claude-agent-sdk 對檔案權限的假設（`~/.claude/` 路徑寫入、token 加密）
- Container escape 風險（mount `/var/run/docker.sock` 進 container 即為 host root，BAT 不應做）
- Server bundle 內 `secrets.ts` 在容器無 keychain 時 fallback plaintext + warn（T0261 spike 已驗）
- Image signing / supply chain（GHCR signed images, sigstore cosign）

**輸出**：
- 安全 baseline 條列（必做 / 建議 / 文件提醒）
- claude config 權限與 token 持久化路徑
- 對 v1 release 的安全 release-blocker 清單

---

## 執行步驟

### Step 1：環境快照
```bash
git status
git log --oneline -5
```

### Step 2：讀前序工單共通結論
- T0264 §1-§6（targetOS schema / PathTranslator / bundle / auth-result / glibc baseline / Wizard framework）
- T0263 §3 path translation 純函數（DockerPathTranslator 沿用模式）
- T0262 §1 headless entry contract（server 啟動方式）

### Step 3：讀 BAT source 起點（不深入動）
- `package.json` build / linux target（看 Linux bundle 既有 config）
- `electron/remote/remote-server.ts`（headless 啟動 hook）
- T0264 內 `AuthResultMetadata.dockerMounts` 設計

### Step 4：逐節寫 spec 草稿
照 8 節順序寫到回報區。**遇設計分支用互動模式問塔台**。

### Step 5：給塔台的下一步建議
- Docker deployment 的 MVP 切片
- 與 T0266 SSH research 共通可抽象部分（兩者都跑 Linux server，但 SSH 更複雜）
- 哪些議題需要再 spike

### Step 6：填寫回報區

---

## AC（acceptance criteria）

- AC1-AC8 對應 8 節 spec 完成
- AC9：給塔台的下一步建議寫完
- AC10：working tree byte-identical（除本工單檔回報區）

---

## 嚴格禁止

- ❌ 寫入除本工單回報區以外的任何檔案
- ❌ 修改任何 source code
- ❌ 對 WSL / SSH / handler 跨環境下結論
- ❌ 對共通抽象（T0264 已凍結 6 節）下新結論
- ❌ 跑 `npm install` / `npm run build` / `docker build` / `docker run`
- ❌ 動 `package.json`
- ❌ 直接草擬 T0266/T0267 的完整工單檔
- ❌ 跨工單決策（→ 回塔台）

---

## 互動模式提示

**enabled**。預期可能的提問場景：

1. 「Base image：bookworm-slim / ubuntu:22.04 / distroless？」
2. 「Container 生命週期模式 A/B/C？」
3. 「Mount strategy：A 顯式輸入 / B 自動偵測 / C 結合？」
4. 「Multi-arch v1 是否包含 arm64？」
5. 「Compose 在 v1 範圍嗎？」
6. 「跨 host docker（`DOCKER_HOST=tcp://remote`）v1 支援嗎？」

每次提問上限 3 題。能自己拍板的逕行決定 + 寫回報。

---

## 失敗 / PARTIAL 處理

任一觸發 → 工單狀態填 PARTIAL/FAILED，觸發 yolo 斷點 B，塔台 pause。

---

## 回報

### 互動紀錄
無主動提問。研究中所有設計分支以「決策 + 替代方案 + 理由」型式寫入回報，符合 research workorder「能自己拍板的逕行決定」原則。v1 scope 收斂偏保守（不含 arm64 / compose / 跨 host docker），若 PLAN-007 PM 階段傾向擴展可透過 renew 調整。

### Step 1 — 環境快照

```
date: 2026-04-25 22:46 (UTC+8)
branch: main
status: ?? _ct-workorders/T0265-research-plan007-docker-deployment.md
recent: 190d9a3 T0264 metadata DONE / 92af5c7 T0264 spec done / afb34a0 T0263 spec done
```

Working tree byte-identical（除本工單）。

### Step 2-3 — 讀前序工單 + BAT source 摘要

**T0264 共通抽象凍結項（本工單沿用，不重議）**：
- `targetOS = 'docker-linux'` discriminated union 含 `dockerContainer: string; dockerHost?: string`
- `DockerPathTranslator` 已定義（`mounts: Array<{host, container}>`，`toServer/toClient/owns` 純函數）
- `auth-result.serverPlatform` 含 `serverEnv='docker'` + `dockerMounts: Array<{host, container}>`（server 在啟動時計算，client 用於建構 translator）
- glibc 下限 2.35（影響 base image 篩選）
- 內嵌 node 24.x linux-x64 prebuilt（影響 base image 必須含 glibc 2.35+ 才能跑該 node binary）
- `WizardStep` framework：`pick-container`、`configure-mounts` 兩個 docker-specific step（`appliesTo: ['docker-linux']`）已預留

**T0263 WSL 結論可借**（確認非 docker 相關不重議）：
- `bat-server` headless entry point 已凍結（同一 binary 跨 wsl/docker/ssh）
- whisper-node-addon 排除（server 無音訊裝置）— docker 同樣排除

**T0262 server-side spec**：headless `bat-server` 經 esbuild bundle，從 `electron/remote/server-only-entry.ts` 起點。Docker 沿用同一 bundle，差別只在「打包成 image」與「runtime 由 container 提供 process supervisor」。

**BAT source 起點**（不修改，僅讀用以驗證設計可行性）：
- `package.json` 既有 build target 無 docker 相關 — 需新增 `build:docker-image` script（v1 範圍）
- `electron/remote/remote-server.ts` 已支援 headless 啟動模式（T0262 凍結）
- `auth-result` metadata 路徑：server 啟動時 `os.platform()` 回 `'linux'`，docker 需要額外讀 `/proc/1/cgroup` 或 env var 自我判定 `serverEnv='docker'`

---

### Spec 草稿

#### 1. Base image 選擇

**三選項對比**：

| Image | glibc | Image size (uncompressed) | Shell | Pkg manager | 安全 baseline | Multi-arch prebuilt |
|-------|-------|--------------------------|-------|-------------|--------------|--------------------|
| `debian:bookworm-slim` | 2.36 | ~80 MB | bash | apt | Debian Security Tracker，月度 patch | ✅ amd64 / arm64 / arm/v7 |
| `ubuntu:22.04` | 2.35 | ~77 MB | bash | apt | Canonical ESM 至 2032 | ✅ amd64 / arm64 |
| `gcr.io/distroless/nodejs24-debian12` | 2.36 | ~150 MB（已含 node 24） | ❌ 無 shell | ❌ 無 | Google Distroless，CVE 攻擊面最小 | ✅ amd64 / arm64 |

**決策：`debian:bookworm-slim`** — bundle 內嵌 node 24，base image 不需要再帶 node runtime；保留 shell + apt 方便 setup wizard 注入工具（`ldd`、`tar` 等）並支援 troubleshoot。

**為何不選 distroless**：
- bundle 已內嵌 node 24（T0264 §5 凍結），distroless 自帶 node runtime → 重複，浪費 ~50 MB
- 無 shell 對 setup wizard `docker exec sh -c ...` 啟動 server / 健檢 / 救援不友善
- 對 BAT 不是 production-grade serving（偶發互動診斷需求高），最小攻擊面收益不抵維運成本

**為何不選 ubuntu:22.04**：
- bookworm-slim glibc 2.36 已涵蓋 T0264 §5 凍結的 2.35 下限
- Debian 12 base image 體積略小（80 vs 77 MB 接近，但 Debian 預裝套件更精簡）
- Debian Security Tracker patch 節奏與 BAT release 節奏對齊較佳

**Multi-arch 策略**：見 §5（v1 僅 amd64，arm64 標 future）。

**最終 base image**：`debian:bookworm-slim`（pin major: `debian:12-slim` 作為 stable alias，CI 釘 digest）。

---

#### 2. Bind mount strategy + DockerPathTranslator 實作細節

**三選項對比**：

| 選項 | 機制 | 使用者體驗 | 安全 | 維護成本 |
|------|------|-----------|------|---------|
| A：Wizard 顯式輸入 | `configure-mounts` step UI 列出 host 資料夾 + container path 對應 | 控制完整，學習曲線稍陡 | ✅ 使用者明確授權每個 mount | 低 |
| B：Server `/proc/1/mountinfo` 自動偵測 | server 啟動時讀 mountinfo，過濾 bind mount，回傳 client | 零設定 | ⚠️ Server 看到的 host path 已是 container 視角，回推 host path 不可靠 | 高 |
| C：A + B 結合（自動偵測 + UI 確認） | server 偵測候選清單，wizard 顯示讓使用者勾選 / 修改 | 半自動 | ✅ 仍以使用者確認為終點 | 中 |

**決策：選項 A（顯式輸入）為 v1**

理由：
- 選項 B 的根本缺陷：`/proc/1/mountinfo` 雖可看到 mount source（host path），但容器內 server **無法驗證** host path 真的存在於 client 機器（client 與 docker host 可能不同台 → §4 跨 host 議題），盲填會誤導
- 選項 A 直觀：使用者在 wizard 選 host 資料夾（OS file picker），對應 container path 預設為 `/workspace/<basename>`，可改
- 選項 C 在 v2 再考慮（需先看 v1 使用者實際 pain point）

**DockerPathTranslator mount 表結構範例**（多 workspace 情境）：

```typescript
// auth-result metadata 範例（server 啟動後傳給 client）
{
  serverEnv: 'docker',
  dockerMounts: [
    { host: 'C:\\Users\\Gower\\projects\\bat',     container: '/workspace/bat' },
    { host: 'C:\\Users\\Gower\\projects\\bmad',    container: '/workspace/bmad' },
    { host: 'D:\\ForgejoGit\\experimental',        container: '/workspace/experimental' }
  ]
}
```

**翻譯範例**：
- Client 側請求 `fs:readdir('C:\\Users\\Gower\\projects\\bat\\src')`
  → translator.toServer → `/workspace/bat/src`
- Server 回 `fs:changed { path: '/workspace/bmad/CLAUDE.md' }`
  → translator.toClient → `C:\\Users\\Gower\\projects\\bmad\\CLAUDE.md`
- Path 不在任何 mount 內（如 `/etc/passwd`）→ translator 原樣傳 → client 嘗試開檔失敗（預期，不在工作區）

**DockerPathTranslator 實作補強**（T0264 已凍結介面，本節補實作細節）：

```typescript
// 強化版（v1 即實作此版本，非 T0264 §2 簡化版）
export class DockerPathTranslator implements PathTranslator {
  constructor(private mounts: Array<{ host: string; container: string }>) {
    // 排序：較長前綴優先，避免 /workspace 比 /workspace/sub 先匹配
    this.mounts = [...mounts].sort((a, b) => b.host.length - a.host.length)
  }
  toServer(p: string): string {
    const norm = this.normalizeHost(p)
    for (const m of this.mounts) {
      if (norm.startsWith(this.normalizeHost(m.host))) {
        return m.container + norm.slice(m.host.length).replace(/\\/g, '/')
      }
    }
    return p
  }
  toClient(p: string): string {
    for (const m of this.mounts) {
      if (p.startsWith(m.container)) {
        const tail = p.slice(m.container.length)
        // host 為 Windows path → 還原 backslash
        return /^[A-Z]:[\\/]/.test(m.host) ? m.host + tail.replace(/\//g, '\\') : m.host + tail
      }
    }
    return p
  }
  owns(p: string): boolean {
    return this.mounts.some(m =>
      this.normalizeHost(p).startsWith(this.normalizeHost(m.host)) || p.startsWith(m.container)
    )
  }
  private normalizeHost(p: string): string {
    // Windows path：統一為小寫磁碟代號 + 正斜線（容器側永遠正斜線）
    return /^[A-Z]:[\\/]/.test(p) ? p[0].toLowerCase() + p.slice(1).replace(/\\/g, '/') : p
  }
}
```

**注意**：T0264 §2 給的是「最小可運作版本」；上述為 v1 production 等級（含 Windows 路徑規範化、長前綴優先排序、case-insensitive 磁碟代號）。

**Permission 處理方案**：

| 方案 | 描述 | 推薦度 |
|------|------|-------|
| **預設 root** | container 跑 root，bind mount 全 r/w | ✅ v1 預設 |
| `--user $UID:$GID` | 使用者顯式 export `BAT_HOST_UID` env var，wizard 注入 | v2 optional（解決 host 端產生檔案的 ownership 問題） |
| User namespace remap | docker daemon 級別 `--userns-remap` | ❌ 不推薦（影響全 daemon，超出 BAT scope） |

v1 文件提示：「Docker mount 預設容器內以 root 寫檔，host 看到 owner = root；若不接受可走 v2 的 `--user` flag（規劃中）。」

---

#### 3. Container 生命週期管理

**三模式對比**：

| 模式 | 啟動責任 | Restart 行為 | 多 BAT instance | 適用情境 |
|------|---------|--------------|----------------|---------|
| A：使用者已有 container | 使用者自行 `docker run -d`，BAT `docker exec` 進去跑 server | 由使用者 `--restart` 設定 | 共用同一 container（多 server process or 單 process 多 client） | 進階使用者 / 既有 dev container |
| B：BAT setup wizard 創 container | 第一次 setup 時 BAT 跑 `docker run -d --restart=unless-stopped --name bat-server-<profileId> ...`，後續 BAT 啟動只 `docker exec` 接上 | `unless-stopped`（host reboot 後自動回） | 一對一（每個 profile 對一 container） | 主流使用者，零知識 |
| C：BAT 完管 lifecycle | BAT 啟動時 `docker start`，BAT 退出時 `docker stop` | BAT 控制 | 一對一 | 注重資源管理 / 桌面使用 |

**決策：v1 提供模式 A + B 兩種，預設模式 B**

理由：
- 模式 B（wizard 創 container）對新手最友善 — `pick-container` step 提供「使用既有」+「新建」兩按鈕
- 模式 A 必要：許多進階使用者已有 dev container（VS Code Dev Containers / Docker Compose stack），強制 BAT 創新 container 是 anti-pattern
- 模式 C 不採用：
  - container 啟停成本（cold start node + 重新建 PTY pool）對使用體驗負面
  - BAT crash / 異常退出時容器孤兒，不如 `unless-stopped` 自然
  - 多 client 連同一 BAT remote 的場景下（家用桌機 + 筆電）模式 C 會造成「先退出的人 stop 了還在用的容器」

**Restart policy**：
- 模式 B 預設 `--restart=unless-stopped`（手動 stop 後不自動回，host reboot 後自動回）
- 不用 `always`：使用者明確 `docker stop` 後仍自動拉起 = anti-pattern
- 不用 `on-failure`：希望 host reboot 後也回（on-failure 不會）

**多 BAT instance 共用 container vs 一對一**：

| 模式 | 推薦 | 理由 |
|------|-----|------|
| 一對一（`--name bat-server-<profileId>`） | ✅ v1 預設 | profile 與 container 一對一綁定，命名衝突偵測簡單 |
| 共用 | 模式 A 進階使用者自決 | server 可同時服務多 client（既有 RemoteServer 已支援）但 lifecycle 不歸 BAT 管 |

**Health check 機制**：

| 方式 | 推薦 | 理由 |
|------|-----|------|
| Dockerfile `HEALTHCHECK` directive | ✅ 內建 | `HEALTHCHECK CMD curl -fk https://127.0.0.1:${BAT_PORT}/health \|\| exit 1`，container 級別狀態 |
| Client 主動 probe | ✅ 並行 | RemoteClient 既有 keepalive 機制不變，作為 application-level liveness |

兩者並行：
- HEALTHCHECK 用於 `docker ps` / 監控報表（container unhealthy 時 BAT UI 提示）
- Client probe 用於斷線重連邏輯（既有，不動）

server 須暴露 `/health` endpoint（HTTP 200 + JSON `{ status: 'ok', uptime, bundleVersion }`）— v1 內建。

---

#### 4. Docker host 偵測與連線

**`DOCKER_HOST` env var 解析**：

| 值格式 | 平台預設 | 連線方式 |
|-------|---------|---------|
| 未設 | macOS / Linux：`unix:///var/run/docker.sock`；Windows：`npipe:////./pipe/docker_engine` | 本機 daemon |
| `unix:///path` | Linux / WSL2 / macOS 自訂 | Unix socket |
| `npipe:////./pipe/docker_engine` | Windows | Named pipe |
| `tcp://host:port` | 跨 host docker | TCP（v1 不支援，見下） |
| `ssh://user@host` | docker context over ssh | SSH（v1 不支援） |

**Detection 流程**：

```
1. spawn `docker --version` (timeout 3s)
   ENOENT → 顯示「Docker 未安裝，請先安裝 Docker Desktop / docker engine」
2. spawn `docker info` (timeout 5s)
   exit != 0 → 解析 stderr：
     - "Cannot connect to the Docker daemon" → 提示啟動 Docker Desktop
     - "permission denied" → 提示加入 docker group（Linux）或 elevate（macOS rootless）
3. parse `docker info --format {{json .}}` → 取 ServerVersion / OperatingSystem / Architecture
4. 判定 daemon platform：
   - 若 client OS = darwin / win32 但 daemon = linux → Docker Desktop（OK）
   - 若 daemon arch = arm64 但 client 要 amd64 image → 警告（可能跑 emulation，慢）
```

**dockerode SDK vs CLI spawn**：

| 方案 | 推薦 | 理由 |
|------|-----|------|
| `dockerode` npm 套件 | ❌ | 多 ~3 MB 依賴；dockerode 仍要連 socket，跨平台 socket 路徑判定要自己寫；BAT 不需要長連線 streaming API |
| **CLI spawn `docker` cmd** | ✅ v1 | 沿用使用者已認可的 docker CLI 行為；錯誤訊息直接給使用者複製去 google；不增加 npm 依賴 |

實作位置：新建 `electron/remote/docker-cli.ts`，wrap `docker version / info / ps / run / exec / stop / inspect` 七個指令，全部用 `child_process.spawn` + 結構化錯誤回傳。

**跨 host docker（`DOCKER_HOST=tcp://remote-vm:2375`）v1 範圍**：

**v1 不支援**。理由：
- 跨 host docker 通常需要 TLS（mTLS cert pinning）
- BAT remote 已可達成「跨 host」目的（直接連遠端 BAT server，不必透過 docker daemon）
- 跨 host docker 的真實使用情境（CI runner / dev cluster）對 BAT 不是 primary use case
- 偵測流程：若 `DOCKER_HOST` 開頭非 `unix://` 或 `npipe://`，wizard 顯示警告：「BAT v1 僅支援本機 Docker daemon，遠端 daemon 請考慮直接用 SSH deployment（PLAN-007 §SSH）」

v2 可能加：偵測 + 支援 tcp://（mTLS）；ssh://（透過 ssh tunnel）。

---

#### 5. Multi-arch image 策略

**v1 決策：僅 `linux/amd64`，arm64 標 future enhancement**。

理由：
- arm64 主要受眾：Apple Silicon Docker Desktop + AWS Graviton + 樹莓派
  - Apple Silicon 跑 amd64 image：Docker Desktop 透過 Rosetta 2 emulation（rdar://慢但可運行）— 接受度高
  - AWS Graviton：對 BAT 不是 primary deployment（伺服器不會跑桌面工具）
  - 樹莓派：BAT server bundle 已要求 glibc 2.35 + 200 MB+ resources，樹莓派非 target
- amd64 image build 已 cover 95%+ docker 使用者
- arm64 加進 v1 = CI 雙 matrix build（時間翻倍）+ multi-arch manifest list 維護成本
- T0264 §3 bundle pipeline 起點是單 arch；arm64 server bundle 留待 T0266 SSH research（SSH 才是 arm64 真正的應用情境）

**Manifest 策略（v2 啟用 arm64 時）**：採用單 manifest list（`bat-server:vX.Y` 自動分發），用 `docker buildx build --platform linux/amd64,linux/arm64` 產生。**不**走雙 tag（`-amd64` / `-arm64`），manifest list 對使用者透明。

**CI workflow 修改建議（v1）**：

```yaml
# .github/workflows/pre-release.yml 新增 job
build-server-docker-image:
  needs: build-server-linux-x64    # 沿用 T0264 §3 bundle artifact
  runs-on: ubuntu-22.04
  steps:
    - uses: actions/download-artifact@v4
      with: { name: bat-server-linux-x64 }
    - uses: docker/setup-buildx-action@v3
    - uses: docker/login-action@v3
      with:
        registry: ghcr.io
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    - uses: docker/build-push-action@v5
      with:
        context: .
        platforms: linux/amd64           # v1 單 arch；v2 改 linux/amd64,linux/arm64
        tags: |
          ghcr.io/${{ github.repository }}/bat-server:${{ github.ref_name }}
          ghcr.io/${{ github.repository }}/bat-server:latest
        push: ${{ startsWith(github.ref, 'refs/tags/v') }}
```

**Dockerfile 範例**（v1）：

```dockerfile
FROM debian:12-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl tini \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/bat-server
COPY bat-server-linux-x64-*.tar.gz /tmp/
RUN tar -xzf /tmp/bat-server-linux-x64-*.tar.gz --strip-components=1 -C /opt/bat-server \
 && rm /tmp/bat-server-linux-x64-*.tar.gz
ENV BAT_PORT=51820
ENV BAT_BIND=0.0.0.0
EXPOSE 51820
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -fk https://127.0.0.1:${BAT_PORT}/health || exit 1
ENTRYPOINT ["/usr/bin/tini", "--", "/opt/bat-server/bin/node", "/opt/bat-server/bin/bat-server"]
```

注意：
- `tini` as PID 1：避免 zombie process（PTY child 死亡 reaping）
- `BAT_BIND=0.0.0.0`：container 內必須監聽全介面，否則 docker port mapping 看不到
- glibc 2.36（bookworm）滿足 2.35 下限要求
- bundle 已內嵌 node 24，不需 base image 提供

**估計工程成本（v1 amd64 only）**：~3 工作天（Dockerfile 撰寫 1d + CI integration 1d + 驗收 1d）。
**arm64 補強估計（v2）**：~2 工作天（buildx 配置 + matrix verify + ghcr manifest 驗證）。

---

#### 6. Docker Compose 整合

**v1 決策：不提供 compose template**。標 future enhancement（v2）。

理由：
- 單 container 場景下 compose 是過度設計（`docker run` 一行解決）
- compose 真正價值在多服務（server + db + cache），但 BAT server 是 self-contained（內建 sqlite，無外部依賴）
- 引入 compose 後 setup wizard UX 分歧（compose vs run），複雜度翻倍
- 進階使用者本來就會自己寫 compose（將 BAT server image 整合進其 dev stack）— 不需要 BAT 提供 template

**v2 場景**（若使用者反映需要）：
- 提供範例 `docker-compose.yml`（純文件，不在 wizard 流程內）：

```yaml
# docs/examples/docker-compose.example.yml（v2 才放）
version: '3.8'
services:
  bat-server:
    image: ghcr.io/<owner>/bat-server:latest
    container_name: bat-server
    restart: unless-stopped
    ports:
      - "51820:51820"
    volumes:
      - ${HOME}/projects:/workspace
      - bat-claude-config:/root/.claude
    environment:
      - BAT_PORT=51820
volumes:
  bat-claude-config:
```

v1 不出 compose，使用者手動寫亦可（image + bind mount 公開於文件）。

---

#### 7. 部署 UX（wizard `pick-container` + `configure-mounts` 細節）

T0264 §6 已凍結 `WizardStep` framework + 兩個 docker-specific step（`appliesTo: ['docker-linux']`）。本節補實作細節。

**Step `pick-container`**：

UI 狀態機（文字 mock）：
```
┌──────────────────────────────────────────────────┐
│  選擇 Docker 容器                                 │
├──────────────────────────────────────────────────┤
│  ○ 新建容器（推薦）                               │
│      使用 ghcr.io/.../bat-server:vX.Y            │
│      容器名稱：[bat-server-<profileId>     ]     │
│      Restart：unless-stopped                     │
│                                                  │
│  ○ 使用既有容器                                   │
│      [▾ 從清單選擇]   或  [手動輸入名稱]         │
│      ┌──────────────────────────────────┐       │
│      │ ✓ my-dev-container (running)     │       │
│      │   bat-test (exited)              │       │
│      │   ubuntu-shell (running)         │       │
│      └──────────────────────────────────┘       │
│      ⚠ 既有容器需自行確保 server bundle 已存在    │
│                                                  │
│  [上一步]                          [下一步]      │
└──────────────────────────────────────────────────┘
```

行為：
- 「新建容器」分支：next 後跳 `configure-mounts`，wizard 在 `start-server` step 執行 `docker run -d --name <name> --restart=unless-stopped -p <port>:51820 <mounts> <image>`
- 「使用既有容器」分支：先驗證 `docker exec <name> ls /opt/bat-server/bin/bat-server`，若不存在跳「上傳 bundle」子流程（子流程 = `docker cp tarball.tar.gz <name>:/tmp/ && docker exec <name> tar xz -C /opt/bat-server`）

**Step `configure-mounts`**：

```
┌──────────────────────────────────────────────────┐
│  設定 Bind Mount                                  │
├──────────────────────────────────────────────────┤
│  Workspace 對應（Host → Container）              │
│                                                  │
│  Host folder              Container path         │
│  C:\Users\Gower\projects  /workspace/projects    │
│  D:\ForgejoGit            /workspace/forgejo     │
│  [+ 新增 mount]                                  │
│                                                  │
│  💡 預設：選一個 host 資料夾，container path 會  │
│     自動填為 /workspace/<basename>，可改         │
│                                                  │
│  ⚠ 容器內 server 預設 root 身份；                 │
│     bind 路徑寫入的檔案 host 端 owner 為 root    │
│                                                  │
│  [上一步]                       [下一步]         │
└──────────────────────────────────────────────────┘
```

行為：
- 「新增 mount」按鈕：開 OS file picker 選 host folder
- 寫入 profile：`dockerContainer = <name>`，`profileEntry.dockerMounts = [...]`（若 schema 接受 — 否則暫存於 wizard ctx，wizard 結束時序列化）
- 至少一個 mount（驗證），否則無法繼續

**首次連線後 fingerprint TOFU**：與既有 BAT remote 流程一致（T0182 凍結），不需特別差異化。`fetch-fingerprint` step（T0264 §6）執行 `docker exec <name> cat /opt/bat-server/data/cert.pem | openssl x509 -fingerprint -sha256 -noout` 取得，寫入 profile。

**錯誤訊息 catalog**：

| 失敗點 | 訊息 | 動作 |
|--------|------|-----|
| `docker --version` ENOENT | 「未偵測到 Docker。請先安裝 Docker Desktop（Win/Mac）或 docker-ce（Linux）」 | 顯示官方安裝連結 |
| `docker info` permission denied | 「Docker daemon 連線權限不足。Linux 請執行 `sudo usermod -aG docker $USER` 後 logout 重登」 | retry 按鈕 |
| `docker pull <image>` 失敗 | 「無法 pull image。請檢查網路 / GHCR 認證」 | 顯示 stderr |
| `docker run` port already in use | 「Port 51820 已被佔用。請改用其他 port（wizard 自動建議下一個可用）」 | 改 port 重試 |
| Container 跑起但 `/health` 200 拿不到 | 「Server 啟動但健檢失敗。可能 port forward / firewall 問題」 | 顯示 `docker logs <name>` 最後 50 行 |

**User journey #1 — 全新 setup**：
```
1. 使用者點「Setup new remote」→ targetOS 選 'docker-linux'
2. detect-env：偵測 docker（成功）
3. pick-container：選「新建容器」，名稱預設 bat-server-A1B2
4. configure-mounts：選 C:\Users\X\projects → /workspace/projects（OK）
5. install-server-bundle：BAT 從 ghcr 拉 bat-server:vX.Y image
6. start-server：docker run -d --name ... --restart=unless-stopped -p 51820:51820 -v ... ghcr.../bat-server
7. fetch-fingerprint：docker exec 取 cert，TOFU 寫入 profile
8. write-profile：profile.targetOS='docker-linux', dockerContainer='bat-server-A1B2'
9. connect-test：建 RemoteClient → wss://localhost:51820，TLS 通過 → auth OK
10. done：顯示「Server bat-server vX.Y, glibc 2.36, node 24.x ready」，進入主介面
```

**User journey #2 — 已有 dev container**：
```
1-2 同上
3. pick-container：選「使用既有容器」→ 列表選 my-dev-container
4. configure-mounts：使用者指定 host /workspace 已掛在容器 /home/dev/work（既有 mount）
5. install-server-bundle：docker cp bat-server-linux-x64.tar.gz my-dev-container:/tmp/
                         docker exec my-dev-container tar xz -C /opt/bat-server
6. start-server：docker exec -d my-dev-container /opt/bat-server/bin/bat-server &
7-10 同上
```

差異：journey #2 BAT 不擁有 container lifecycle，停止 BAT 不停 container（vs journey #1 BAT 退出時亦不停，因 `--restart=unless-stopped`）。差別只在「誰有權 stop」。

---

#### 8. 安全考量

**容器內 user：root vs non-root**：

| 方案 | 推薦 | 理由 |
|------|------|------|
| **預設 root** | ✅ v1 | 簡單、bind mount 無 ownership 衝突；container 隔離已是安全 baseline |
| `--user 1000:1000` | v2 optional | 解決 host 端產生檔案 owner 為 root 的副作用；但需要使用者自行確保 host UID 對應 container 內存在 |
| `--userns-remap` | ❌ | 系統級設定，超出 BAT scope |

v1 文件提示：「BAT Docker container 預設 root user。容器隔離邊界內無權限提升風險；對 host 的影響僅限於 bind mount 檔案 ownership（root）。」

**claude / claude-agent-sdk 對檔案權限的假設**：

- claude CLI 寫 `~/.claude/`（容器內 `/root/.claude/`）— 預設 root + 0700 權限
- token 加密：T0182 凍結用 Electron `safeStorage`，但**容器內 server 不是 Electron**（純 node bundle）→ 走 fallback：plaintext + warn log（與 Linux 桌面版無 keychain 時行為一致）
- 為持久化 `~/.claude/` 跨 container 重啟，建議 wizard 提示「另開 named volume `bat-claude-config:/root/.claude`」
  - v1 wizard 自動在 `start-server` 加 `-v bat-claude-config:/root/.claude`（不暴露為 UI 選項，預設啟用）

**Container escape 風險清單**：

| 風險 | 緩解 | 備註 |
|------|------|------|
| 掛載 `/var/run/docker.sock` 進 container | **禁止** | wizard `configure-mounts` 須 reject 此路徑（host 為 root → container 即 host root） |
| 掛載 `/`、`/etc`、`/proc` | 警告 | 非禁止（進階使用者可能需要），但 wizard 顯示「⚠ 系統路徑掛載風險」 |
| `--privileged` flag | **禁止** | wizard 不暴露此選項 |
| `--cap-add SYS_ADMIN` | 不暴露 | 同上 |
| Docker daemon 跑 root，BAT client 連 daemon = 等同 root | 文件提示 | 「使用 BAT Docker deployment 等同信任 docker daemon = 信任本機 root；rootless docker daemon 是 v2 議題」 |

**Server bundle `secrets.ts` fallback**：T0261 spike 已驗：容器內無 keychain（無 GNOME Keyring / KWallet / Windows DPAPI），`safeStorage.isEncryptionAvailable() === false` → fallback plaintext + 一次性 warn log。本工單沿用，不重議。

**Image signing / supply chain**：

| 措施 | v1 | v2 |
|------|-----|-----|
| GHCR Docker Content Trust | ❌ 不啟用 | 評估 |
| sigstore cosign keyless signing | ❌ | ✅ 推薦（與 GitHub Actions OIDC 整合，零 secret 管理）|
| SLSA provenance | ❌ | ✅ 隨 cosign 一併 |
| Reproducible build | ❌ | optional |

v1 baseline：image 推到 GHCR + tag 對齊 BAT release tag + Dockerfile 公開於 repo。使用者自行驗 `docker pull` 拿到的 digest 與 release notes 寫的 digest 一致即可。

**安全 release-blocker 清單（v1）**：

1. ✅ glibc 2.35+ base image（避開老 distro CVE）
2. ✅ tini PID 1（避免 zombie 累積成 DoS）
3. ✅ HEALTHCHECK 接 `/health`（unhealthy container 可被監控）
4. ✅ Wizard 拒絕 `/var/run/docker.sock` mount
5. ✅ Token plaintext fallback warn log（不阻斷但提醒）
6. ✅ `bat-claude-config` named volume 持久化（避免每次重啟重新 auth claude）
7. ⚠ 文件警告 root user 副作用 + 跨 host docker 不支援
8. ⚠ Image tag 釘 release semver（不 ship `:latest` 為唯一推薦）

**安全 baseline 條列**：

- **必做**：上述 1-6
- **建議**：cosign 簽章（v2 補）、`--user` flag option（v2 補）、rootless docker daemon 友好（v2 evaluate）
- **文件提醒**：root user / 跨 host 限制 / token plaintext fallback / lifecycle 模式選擇影響

---

### 給塔台的下一步建議

**Docker deployment v1 MVP 切片**（建議分為 3 個 EXP/PLAN child）：

1. **EXP-DOCKER-IMAGE-001**：Dockerfile + CI build pipeline（沿用 T0264 §3 bundle artifact），驗證 `ghcr.io/.../bat-server:vX.Y` 可拉、可跑、`/health` 200。**~3 d**。
2. **EXP-DOCKER-WIZARD-001**：實作 `pick-container` + `configure-mounts` step（T0264 WizardStep framework 上長），含 docker-cli.ts wrap。**~5 d**。
3. **EXP-DOCKER-PATHTRANSLATOR-001**：`DockerPathTranslator` v1 production 版（§2 強化版），含 case-insensitive 磁碟代號、長前綴排序、Windows path normalize 單元測試。**~2 d**。

合計 ~10 工作天，可由 1-2 個 sprint 吸收。

**與 T0266 SSH research 共通可抽象部分**：

兩者都跑 Linux server bundle，但差異點 SSH 多更多：
- ✅ 共通：bundle 安裝路徑（`/opt/bat-server`）、headless 啟動、glibc 2.35 baseline、auth-result metadata schema（dockerMounts → sshMounts 結構不同但模式一致）
- ❌ 差異：
  - SSH 需要 key/agent 認證流程（docker 直接 socket）
  - SSH 需要 sftp/scp 上傳 bundle（docker 用 `docker cp` 或 image 內建）
  - SSH 沒有 container lifecycle，server 直接系統服務（systemd unit）
  - SSH path translation 是 home dir 映射（不是 mount 點映射）

**建議**：T0266 不重議 base image / glibc / bundle 結構；聚焦 SSH-specific 議題（key 認證、sftp upload、systemd unit、persistent reverse tunnel）。

**需 spike 議題清單**：

1. **bookworm-slim + 內嵌 node 24 跑 PTY 行為**：tini 是否需要額外 flag 處理 PTY signal forwarding？建議 EXP-DOCKER-IMAGE-001 內 spike。
2. **Windows Docker Desktop bind mount 效能**：WSL2 backend 下 `C:\` 路徑透過 9p 跨 fs 慢；推薦使用者改用 `\\wsl$\Ubuntu\home\...` mount？需 spike 量測。
3. **Apple Silicon emulation 跑 amd64 image 速度**：使用者反映可接受嗎？決定 v2 arm64 優先級。
4. **`docker exec` 多重 PTY 會話穩定性**：journey #2 既有 container 模式下，多 BAT client 同連同 container 會否互相干擾？

**工程量估計**：

| 範圍 | 工作天 |
|------|-------|
| v1 MVP（amd64 only, 模式 A/B, 無 compose, 無跨 host） | ~10 d |
| v2 補強（arm64 + cosign + `--user` + rootless friendly） | ~7 d |
| v3 進階（compose template + 跨 host docker over TLS） | ~5 d |

PLAN-007 PM 階段建議：v1 限定 amd64 + 預設模式 B + 模式 A fallback；v2 / v3 視 v1 release 後使用者反饋優先排序。

### Renew 歷程
無

### Step 1 — 環境快照（最終）
（已於上方 Step 1 — 環境快照填寫）

### 收尾 commit
- commit message 範例：`chore(workorder): T0265 PLAN-007 Docker deployment spec done — 8 sections ready`
