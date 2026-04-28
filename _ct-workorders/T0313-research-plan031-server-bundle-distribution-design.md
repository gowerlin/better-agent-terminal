---
schema_version: 1
schema_kind: workorder
id: T0313
title: Research PLAN-031 Server Bundle Distribution 設計探索（含 ARM64 Linux）
type: research
status: DONE
sizing: L
created_at: "2026-04-27T00:53:00+08:00"
started_at: "2026-04-27T01:03:00+08:00"
completed_at: "2026-04-27T01:14:00+08:00"
renew_count: 0
workdir: main repo（不需 worktree，純讀取 + 文件產出）
---
# T0313 — Research PLAN-031 Server Bundle Distribution 設計探索（含 ARM64 Linux）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0313 |
| 類型 | research（互動式研究，多 phase 盤點 + 方案評估 + 拆單建議） |
| 所屬 | PLAN-031 — Server Bundle Distribution |
| 狀態 | ✅ DONE |
| 建立時間 | 2026-04-27 00:53 (UTC+8) |
| 派發時間 | 2026-04-27 01:03 (UTC+8) |
| 開始時間 | 2026-04-27 01:03 (UTC+8) |
| 完成時間 | 2026-04-27 01:14 (UTC+8) |
| Wall time | ~11 min（GP099 L sizing 60-120 min 預期，再次落於下界以下；spec / T0283 / 三 install-bundle step 結構清晰，無需探索性調查） |
| Sizing | L（estimate 60-120 min wall；6 phase 盤點 + 方案矩陣 + 拆單） |
| 依賴 | T0283 ✅（3 平台 build pipeline 已就緒）、PLAN-007 spec（`_spec-remote-dev-support-2026-04.md`）、BUG-071 |
| 後續 | 拍板後拆 Sprint 2-5 共 ~10 張實作工單 |
| 互動旗標 | `--mode ask --interactive`（研究型工單，允許 Worker 提問澄清；最多 3 輪互動） |
| Renew 次數 | 0 |
| 工作目錄 | main repo（不需 worktree，純讀取 + 文件產出） |
| `affects_files` | `_ct-workorders/T0313-*.md`（自身回報區） + 可能新增 `_spec-server-bundle-distribution.md`（如果 Worker 判定需獨立 spec） |

## 背景

PLAN-030 完工後使用者實機跑 WSL Setup Wizard 觸發 BUG-071：install-server-bundle step 找不到 tarball 即硬性 throw，placeholder 訊息誤指 T0282（實際 T0282 是 path translator，不是 download flow）。

T0283 已交付 **3 平台 build pipeline**（linux-x64 / linux-arm64 / darwin-arm64）+ 獨立 `.github/workflows/build-server-bundle.yml`，artifact 進 GitHub Actions artifact store。但**從 artifact 到 BAT runtime** 的 distribution path 是空白的。

塔台已決策：升格為 PLAN-031（Server Bundle Distribution），ARM64 Linux 必納入（使用者擁有 NVIDIA DGX Spark GB10 = aarch64 Linux，是 BAT remote 真實 target）。

## 研究目標

回答以下 6 個問題，產出**可拍板的設計提案**（含拆單建議表）：

1. **現況到底如何？** PLAN-007 spec 對 server bundle distribution 原始設計是什麼？三平台 (WSL/SSH/Docker) install-bundle step 各自現況？
2. **三方案的真實 tradeoff？** 方案 A (installer 內建) / B (runtime download) / C (Hybrid) 在 size、offline、ARM64、auto-update、私有部署等向度的具體影響？
3. **支援矩陣完整性？** BAT host (3 OS) × Server arch (3 target) = 9 cell，哪些 cell 是有效 / 不可能 / 待支援？
4. **ARM64 Linux 特殊路徑？** DGX Spark 場景下，arch detection / tarball 選擇 / native modules 完整性的細節？
5. **Distribution 與 BAT release 解耦策略？** server bundle 應與 BAT 同版號 ship 還是獨立版本？升級時如何處理既有 remote？
6. **拆單建議？** Sprint 2-5 共幾張工單？哪些可平行？依賴關係？

## 範圍（6 Phase）

### Phase A：現況盤點

#### A.1 PLAN-007 spec 對 distribution 的原始設計

讀取 `_spec-remote-dev-support-2026-04.md`，提取 server bundle distribution 相關段落（特別是 §6 C-1 / §2.5 hard-exclude），分析：

- 原始 spec 是否有指定 distribution 機制？（installer 內建 vs download）
- 是否有 ARM64 Linux 計畫？
- T0282 reference 寫錯的源頭：到底哪張工單應該負責 download flow？（檢查 PLAN-007 拆單表）
- spec 是否有「server bundle 與 BAT 版本耦合」策略？

#### A.2 T0283 已交付什麼

讀取 T0283 工單檔，確認：

- 3 平台 tarball 命名規則（如 `bat-server-linux-arm64-v0.5.0.tar.gz`）
- artifact 存放位置（GitHub Actions artifact store / 是否進 release？）
- workflow trigger（`feature/plan-007-remote-dev` push、`server-bundle-v*` tag、manual dispatch）
- tarball 內容（node 24 binary + native modules + bat-server.js）
- ARM64 Linux 已驗哪些 native modules（@lydell/node-pty / @img/sharp / better-sqlite3 prebuilt 是否齊全）

#### A.3 三平台 install-bundle step 現況

實際讀取下列 3 個檔案，分析 placeholder throw 邏輯：

- `src/components/setup-wizard/steps/wsl/install-server-bundle.ts`
- `src/components/setup-wizard/steps/ssh/install-server-bundle.ts`
- `src/components/setup-wizard/steps/docker/install-server-bundle.ts`

每個 step 紀錄：

- 目前在哪一步 throw？throw 訊息？
- 後續預期動作（上傳 tarball / 解壓 / chmod / 啟動 server）有沒有寫好？
- arch detection 邏輯是否存在？（透過 SSH `uname -m` / WSL `wsl -- uname -m` / Docker `docker exec arch`）
- 三平台 step 是否共享 distribution 函式？還是各自實作？

#### A.4 userData 結構與 lookup 邏輯

確認 `userData/bat-server-bundles/` 預期結構：

- 命名規則（`bat-server-linux-x64-v*.tar.gz`？）
- 多版本共存策略？（升級時保留舊版 tarball 嗎？）
- lookup 函式在哪裡？（`electron/server-bundle-locator.ts` 或類似？grep 找）
- Wizard 跑時是用 BAT 當前版本還是 tarball 內 manifest？

### Phase B：方案評估矩陣

#### B.1 方案 A：installer 內建所有 tarball

| 向度 | 方案 A 影響 |
|------|------------|
| Installer size | Windows NSIS 增量 = sum(linux-x64, linux-arm64 tarball)；Mac dmg 增量 = sum(linux-x64, linux-arm64, darwin-arm64)；Linux AppImage 同 Mac。具體 MB 量待 T0283 build 後量測 |
| 首次體驗 | 最佳（無網路依賴） |
| Offline | 100% 支援 |
| ARM64 Linux | tarball 已內建，DGX Spark 用戶開箱即用 |
| Auto-update | BAT 升級即 server bundle 升級，但既有 remote 端 server 不會自動升 |
| 私有部署 | 不適用（installer 是公開 release） |
| 缺點 | installer 變肥 50-100MB，首次下載慢 |

#### B.2 方案 B：runtime download from GitHub Release

| 向度 | 方案 B 影響 |
|------|------------|
| Installer size | 維持輕量 |
| 首次體驗 | 取決於網路；wizard 多一個下載步驟（5-30s） |
| Offline | 不支援（直接炸） |
| ARM64 Linux | 同 x64 path，arch detection 後挑對應 URL |
| Auto-update | 可獨立升級（不綁 BAT release） |
| 私有部署 | 需要可配 fallback URL（環境變數或 settings） |
| 缺點 | 網路依賴 / GitHub rate limit / 私有部署痛 |

#### B.3 方案 C：Hybrid（installer 內建 baseline + runtime fallback）

| 向度 | 方案 C 影響 |
|------|------------|
| Installer size | 介於 A 與 B 之間（內建 baseline = BAT release 時的 server bundle） |
| 首次體驗 | 最佳（baseline 內建，無網路也能跑） |
| Offline | 100% 支援（用 baseline）；想升級才需網路 |
| ARM64 Linux | baseline 內建 + 升級走 download |
| Auto-update | 可選（baseline 已能跑，升級可選） |
| 私有部署 | 同方案 B 需 fallback URL |
| 缺點 | 兩套 path 都要維護 |

#### B.4 額外考量

- **GitHub Rate Limit**：anonymous 60 req/hr。若 wizard 多次重跑會踩到。是否需要：(a) 重試 backoff、(b) token-based download、(c) BAT 自有 CDN？
- **SHA256 manifest**：3 平台 tarball + manifest.json 必須 sign / pin / 校驗，避免 MITM
- **Server bundle auto-update 衝突**：BUG-059 已停用 embedded claude CLI auto-update（理由：避免 binary rename 到 npm prefix）。Server bundle 是否類似衝突？是否需明確停用 server-side auto-update？
- **跨版本相容性**：BAT v0.5.0 client 連到舊版 v0.4.x server 會發生什麼？反之？是否要 protocol version handshake？

#### B.5 推薦方案

Worker 給出推薦並說明理由（不能空話「都行」）。塔台預判方案 C，但允許 Worker 反駁。

### Phase C：BAT host × Server arch 支援矩陣

填以下 9-cell 矩陣，每格回答「狀態 + 真實場景 + 待釐清問題」：

| BAT host \ Server arch | linux-x64 | linux-arm64 | darwin-arm64 |
|------------------------|-----------|-------------|--------------|
| Windows (x64) | ? | ? | ? |
| macOS (arm64) | ? | ? | ? |
| Linux (x64 / arm64) | ? | ? | ? |

每格欄位：

- 狀態：✅ 支援 / 🚧 待支援 / ❌ 不可能（給理由）
- 真實場景：使用者 X 在做什麼？（DGX Spark 是 macOS BAT × linux-arm64 server？）
- 待釐清：arch detection 機制 / WSL 細節 / Docker base image 差異等

### Phase D：ARM64 Linux 特殊路徑

#### D.1 Arch Detection IPC 設計

三平台各自的 arch detection 命令：

- WSL：`wsl -- uname -m`
- SSH：透過 SshClient 跑 `uname -m`（在 verify-auth step 之後、install-bundle step 之前）
- Docker：`docker exec <container> arch` 或 `docker version --format`

需要 IPC 接口設計（`window.electronAPI.remote.detectArch(profile)` 之類），並考慮：

- arch 值 normalize：`x86_64` → `linux-x64`、`aarch64` → `linux-arm64`、`arm64` → `linux-arm64`（不同 distro 報法）
- 不認識的 arch 怎麼辦？（給 actionable 錯誤訊息「Server doesn't support <arch>, supported: ...」）

#### D.2 Tarball 選擇邏輯

```
detected arch → tarball name:
  linux-x64 / linux-arm64 → bat-server-${arch}-v${BAT_VERSION}.tar.gz
  darwin-arm64 → bat-server-darwin-arm64-v${BAT_VERSION}.tar.gz（SSH-only?）
```

注意 darwin-arm64 server 的真實場景（macOS 互連？少見但 spec 已涵蓋）。

#### D.3 ARM64 Linux native modules 完整性

T0283 已驗 build pipeline，但**實際 tarball 內容是否完整**待 Worker 從 GitHub Actions artifact 抓一份檢查（或讓使用者跑 build 後本機檢查）：

- `node_modules/@lydell/node-pty/node-pty-linux-arm64/` ✓
- `node_modules/@img/sharp-linux-arm64/` ✓
- `node_modules/better-sqlite3/build/Release/better_sqlite3.node`（arm64 prebuilt）✓
- `bin/node`（linux-arm64 binary）✓
- 是否有遺漏的 native modules？（grep T0283 spec）

### Phase E：Distribution 與 BAT release 解耦策略

回答以下問題：

- **同版號 ship 還是獨立版本？** 推薦：同版號（BAT v0.5.0 → server bundle v0.5.0），版本耦合方便 debug
- **GitHub Release 怎麼 publish？** 三平台 tarball + SHA256 manifest 進同一個 release？還是獨立 `server-bundle-v*` tag？
- **既有 remote 升級策略？** BAT 升級後，wizard 是否提供「升級 remote server bundle」按鈕？或自動偵測版本不符 prompt？
- **Backwards compat policy？** v0.5.0 client × v0.4.x server 支援 N-1 還是強制升？

### Phase F：拆單建議

產出可派發的 Sprint 2-5 拆單表：

| 工單號 | 標題 | 類型 | 預估 wall | Sizing | 依賴 | 平行性 |
|--------|------|------|----------|--------|------|--------|
| T03xx | GitHub Release publish flow（接 T0283 workflow） | impl | 30-60 min | M | T0283 | - |
| T03xx | Electron-builder extraResources 整合 baseline tarball | impl | 60-90 min | L | T0283 | 可平行 |
| T03xx | SHA256 manifest 產生 + 校驗模組 | impl | 30-60 min | M | - | 可平行 |
| T03xx | BAT runtime download module（fetch + progress + retry） | impl | 60-120 min | L | - | 可平行 |
| T03xx | Arch detection IPC（三平台統一接口） | impl | 30-60 min | M | - | 可平行 |
| T03xx | Version pinning 邏輯（BAT version ↔ tarball URL） | impl | 30 min | S | 上述 module | - |
| T03xx | WSL install-bundle step 改寫 | impl | 30 min | S | 上述全部 | 三平台可序列或平行 |
| T03xx | SSH install-bundle step 改寫（含 arch detection） | impl | 60 min | M | 上述全部 | - |
| T03xx | Docker install-bundle step 改寫 | impl | 30 min | S | 上述全部 | - |
| T03xx | ARM64 Linux e2e（DGX Spark dogfood） | qa | 60-90 min | M | 上述全部 | - |
| T03xx | Offline / 網路 fail e2e | qa | 30-60 min | M | 上述全部 | - |

每張工單給出：

- 標題
- 類型（impl / qa / docs）
- 預估 wall（基於本專案歷史 GP 校準）
- Sizing (S/M/L)
- 依賴
- 是否可平行
- 「需要塔台拍板的子問題」（若有）

## Worker 互動規則

- **互動模式**：`--mode ask --interactive`（最多 3 輪提問）
- **Worker 可問的問題類型**：
  - PLAN-007 spec 內某段落歧義
  - 某現有檔案內容判斷不清
  - 三方案 tradeoff 的具體 BAT 內部限制（如 electron-builder 的 extraResources 限制）
- **Worker 不該問的**：
  - 已經在 BUG-071 / PLAN-031 metadata 寫明的內容
  - 方案 A/B/C 偏好（已說明讓 Worker 評估推薦）
  - Release 時程（已固定 v0.5.0）

## 回報區結構（Worker 必填）

回報必須包含以下 6 段，每段寫實證內容（不接受空話）：

### 1. 現況盤點摘要（Phase A）

- A.1 spec 對 distribution 的原始設計（引用 spec 段落）
- A.2 T0283 已交付清單（指標：tarball 命名 / artifact 位置 / workflow trigger）
- A.3 三平台 install-bundle step 現況表（throw 點 / 後續邏輯 / arch detection 是否有）
- A.4 userData 結構與 lookup 邏輯（grep 結果 + 函式位置）

### 2. 方案評估矩陣（Phase B）

- 完成 B.1 / B.2 / B.3 三表
- 列額外考量（B.4）
- 給推薦方案 + 理由（B.5）

### 3. 支援矩陣（Phase C）

- 9 cell 矩陣完整填寫

### 4. ARM64 Linux 細節（Phase D）

- arch detection IPC 設計草稿
- Tarball 選擇邏輯（含 normalize 規則）
- native modules 完整性檢查結果

### 5. Distribution 解耦策略（Phase E）

- 4 個問題給明確答案

### 6. 拆單建議表（Phase F）

- 完整 Sprint 2-5 工單表
- 標出哪些可平行 / 哪些需依賴前者完成
- 標出「需塔台拍板的子問題」

## 驗收條件（塔台用）

- 6 段回報全填寫，無空話
- 推薦方案有具體理由（不能「都行」）
- 9 cell 矩陣每格都有答案
- Sprint 2-5 拆單表至少 8 張工單，每張有 sizing 估算

## Worker 守則

1. **不要直接改 code**：本工單純研究，禁止改 src/ 下任何檔案
2. **可以新增文件**：若研究結論複雜，可寫獨立 spec 到 `_ct-workorders/_spec-server-bundle-distribution.md`，工單回報區引用之
3. **互動上限**：最多 3 輪提問，每輪最多 3 個問題
4. **時間意識**：60-120 min wall 期望，超過 90 min 仍未完成 6 段先報 PARTIAL + 拍板需求
5. **`affects_files` 紀律**：如果新增 spec 文件，更新本工單 metadata `affects_files`
6. **Commit 訊息**：研究產出走 `chore(research): T0313 - <段落>` 格式
7. **記憶覆寫**：本工單**沒有** `memory_overrides` 欄位 — 沿用所有現行 GP 規則 + 學習紀錄

---

## Worker 回報區（Worker 填寫）

<!-- Worker: 完成後填寫以下 6 段 -->

### 1. 現況盤點摘要（Phase A）

#### A.1 PLAN-007 spec 對 distribution 的原始設計

**結論：spec 從未設計 distribution path，這是真實缺口。**

引用 `_spec-remote-dev-support-2026-04.md` 關鍵段落：

- §2.3 Server bundle pipeline：定義 tarball **格式與 build pipeline**（`bat-server-<target>-v0.X.Y.tar.gz`、esbuild + 內嵌 node 24 + 重 build native modules、§6 C-1 獨立 workflow），**未提 client 如何取得 tarball**。
- §4.1 WSL Packaging：明確寫「**MVP 手動下載 `bat-server-linux-x64.tar.gz` + P1 wizard 一鍵 `wsl exec tar xz`；不上 npm registry**」— 即「下載這件事先擱一下，先讓使用者手動丟進來」。
- §4.3 SSH Bundle 上傳：寫的是「`ssh + tar` 主路徑（流式 70-100 MB）」— 但**起點檔案怎麼到 BAT host** 同樣未定義。
- §6 RFC C-1 ~ D-SSH-6：8 個拍板決策**無一觸及 distribution from server to BAT host**。
- §8 Implementation Backlog 23 張藍圖卡：T0271（linux-x64 build）/ T0282（arm64+darwin build；實際工單編號 = T0283）/ T0274 / T0284（wizard install-bundle steps）— **沒有任何一張負責 download flow**。

**T0282 mis-pointer 源頭**：`install-server-bundle.ts:36` 寫「Release download flow lands in T0282」是 T0274 worker 留的 placeholder，但 T0282 的實際職責是 SshPathTranslator + ssh-config alias parser（spec §8 line 703-708），與 download 無關。Worker 寫 placeholder 時 mis-attribute，後續沒人追到 — 這是 BUG-071 的紙面 root cause。

**spec 是否有 server bundle 與 BAT 版本耦合策略？** 無顯式策略。`auth-result.serverPlatform` metadata（§2.4）有 `bundleVersion` 欄位但只 declarative，client 端比對策略 spec 沒寫（C-4 只談 `claudeVersion` 比對，不談 bundle）。

#### A.2 T0283 已交付清單

| 指標 | 值 |
|------|---|
| 工單狀態 | ✅ DONE，worktree commit `36800f1` on `feature/plan-007-remote-dev` |
| Tarball 命名 | `bat-server-${target}-v${version}.tar.gz`（`scripts/build-server-bundle.mjs:125`） |
| 三平台 target | `linux-x64` / `linux-arm64` / `darwin-arm64`（`VALID_TARGETS` 白名單，build script line 33） |
| Workflow trigger | (1) `workflow_dispatch` 手動 (2) `push` to `feature/plan-007-remote-dev` (3) tag `server-bundle-v*` |
| Job matrix | linux-x64 → `ubuntu-22.04`；linux-arm64 → `ubuntu-22.04-arm`（GitHub 原生 ARM runner，非 QEMU）；darwin-arm64 → `macos-14`（M1 native） |
| Artifact 存放 | GitHub Actions artifact store（`actions/upload-artifact@v4`，name = `server-bundle-{target}`） |
| GitHub Release | **已有**：`if: startsWith(github.ref, 'refs/tags/server-bundle-v')` job 用 `softprops/action-gh-release@v1` 上傳，標 `prerelease: true` |
| Tarball 內容 | `bin/node`（target 對應 prebuilt）+ `bin/bat-server` (sh launcher) + `bin/bat-server.mjs` (esbuild bundle) + `node_modules/` (per-target native modules: @lydell/node-pty + sharp + better-sqlite3 + claude-code + claude-agent-sdk) + `electron/remote/` + `handlers/` + `package.json`（含 `name`/`version`）+ `README.md`（含 `version` / `target` / `glibc lower bound` / build timestamp） |
| Hard exclude 驗證 | `scripts/verify-server-bundle.js` grep `whisper` substring，存在即 abort（spec §6 C-6 雙保險：CI 自動 + release checklist） |
| SHA256 | build script 收尾印 `sha256` 在 stdout summary JSON，**但 tarball 內無 manifest.json**；release workflow 也不產生 SHA256 manifest |
| ARM64 Linux native modules | TARGET_CONFIG 列 `@lydell/node-pty-linux-arm64`、`@img/sharp-linux-arm64` + `@img/sharp-libvips-linux-arm64`、`@anthropic-ai/claude-code-linux-arm64`、`@anthropic-ai/claude-agent-sdk-linux-arm64`。**better-sqlite3 走通用 prebuilt 解析**（無 platform sub-package；依 `node-gyp-build` 在 CI runner native rebuild） |

**Spec §6 C-1 落地狀態**：✅ workflow 完全與 desktop release `pre-release.yml` 解耦，無交叉觸發。Tag 命名空間獨立（`server-bundle-v*` vs `v*`）。

#### A.3 三平台 install-bundle step 現況表

| 平台 | 檔案 | 是否找 tarball | Tarball 模式 | Arch detection | Throw 訊息 | 後續邏輯 |
|------|------|--------------|------------|---------------|----------|---------|
| **WSL** | `wsl/install-server-bundle.ts:17` | ✅ scan `userData/bat-server-bundles/` | **硬編碼** `^bat-server-linux-x64-v.+\.tar\.gz$` | ❌ 無 | `"... not found in userData/bat-server-bundles. Release download flow lands in T0282."` ← **BUG-071 mis-pointer** | `window.electronAPI.wsl.installBundle(distro, tarballPath, INSTALL_PATH)` 上傳到 `~/.local/bat-server` |
| **SSH** | `ssh/install-server-bundle.ts:26-41` | ✅ scan 同上 | **arch-aware**：`archHint === 'arm64' \|\| 'aarch64'` 時優先 `linux-arm64`，fallback `linux-x64`；否則只找 x64 | ✅ 從 `state.sshServerArch`（由 `verify-auth.ts` 透過 `ssh:probe-auth` 跑 `uname -sm` 拿）；預設 fallback `'x86_64'` | `"... not found in userData/bat-server-bundles. Ensure the BAT release shipped the linux-x64 / linux-arm64 tarball."` ← 訊息較準 | `ssh:upload-bundle` 串流上傳；`ssh:upload-progress` event 報進度 |
| **Docker** | `docker/install-server-bundle.ts` | ❌ **不找 tarball** | n/a — image-based distribution | n/a — image 內已內建 | `mode='new'`：image 內建路徑 `/opt/bat-server`，無 throw；`mode='existing'`：warn「Existing container ... must already contain /opt/bat-server」 | docker image 透過 base image build 完成 — 等同把 distribution 推給 image build pipeline（**T0278 範圍**，目前 partial） |

**架構落差**：WSL 與 SSH 期望「BAT 從某處取得 tarball → 推到遠端解壓」；Docker 走「image 已內建 → 啟動 container 即跑」。**三平台不可能共享同一份 distribution module**（Docker 不需要），但 **WSL+SSH 應該共享**。

**共享情況**：目前 WSL 與 SSH 各自實作 `findBundleInDirectory` / `resolveBundleTarballPath`（WSL line 14-37，SSH line 26-53），**程式碼複製**。SSH 多了 archHint 邏輯，WSL 只認 x64 — 已 drift。

**Arch detection 現況**：
- SSH：`verify-auth.ts:115` 拿 `result.serverArch`（main process `ssh:probe-auth` handler 跑 ssh `uname -sm`），寫進 `ctx.state.sshServerArch`。✅
- WSL：**無**。`detect-env.ts` 不偵測 arch。`install-server-bundle.ts` 也無 fallback。
- Docker：**無**。`pick-container.ts` 只 inspect image，不讀 arch。`docker exec <c> arch` 從未呼叫。

#### A.4 userData 結構與 lookup 邏輯

| 項目 | 實際情況 |
|------|---------|
| 預期目錄 | `${userData}/bat-server-bundles/`（`userData = app.getPath('userData')`，平台 default：Win `%APPDATA%\better-agent-terminal\`、Mac `~/Library/Application Support/better-agent-terminal/`、Linux `~/.config/better-agent-terminal/`） |
| 命名規則 | `bat-server-{linux-x64\|linux-arm64\|darwin-arm64}-v<semver>.tar.gz`（與 build script 一致） |
| 多版本共存 | **無策略**。`findBundleInDirectory` 用 `entries.find()` 取第一筆 match，多版本時行為 undefined（依 readdir 排序） |
| Lookup 函式位置 | **inline 在每個 step**，無共用模組。grep `findBundleInDirectory` 只在 wsl/ssh 兩檔出現。**無 `electron/server-bundle-locator.ts` 或類似**。 |
| 版本 ↔ tarball 對齊 | step 不檢查 tarball 版本與 BAT version。BAT v0.4.1 跑 wizard、user 手丟 v0.5.0 tarball → 不會 reject |
| SHA256 校驗 | **無**。`bundleSha256Verified: false` flag 在 wsl 寫死（line 69），代表「未驗」。 |
| 升級時舊版保留 | 無清理邏輯，全靠使用者手動管理 `bat-server-bundles/` |

**electron-builder extraResources 現況**（`package.json:186-194`）：

```json
{ "from": "scripts", "to": "scripts", "filter": ["*.mjs"] }
```

**只有 scripts/*.mjs**，**未內建任何 server bundle tarball**。Installer 完全空白。

**asarUnpack** 列了 `@anthropic-ai/claude-code-*`、`@lydell/node-pty-*`、`@img/**` 等，但這是 desktop 用的 native modules（client side），跟 server bundle distribution 不重疊。

---

### 2. 方案評估矩陣（Phase B）

#### B.1 方案 A — Installer 內建全部 tarball

| 向度 | 影響 |
|------|------|
| Installer size 增量 | 估算（待 T0283 release build 量測前的合理推估）：每 tarball 60-90 MB（spec §4.3 寫 70-100 MB）；3 個共 **180-270 MB**。NSIS 目前 ~172 MB → 增至 **350-440 MB**（**+100% 以上**）；mac dmg 230 MB → 增至 **410-500 MB**。 |
| 首次體驗 | 最佳：installer 跑完即可 wizard，無網路依賴 |
| Offline | 100% 支援 |
| ARM64 Linux | DGX Spark 開箱即用（installer 已含 linux-arm64 tarball） |
| Auto-update | BAT 升級即 server bundle 升級；既有 remote 端 server **不會自動升**（spec §6 C-4 不強版本一致），需 wizard 提供「升級既有 server」按鈕 |
| 私有部署 | 不適用（installer 是 anthropics/better-agent-terminal release artifact） |
| 主要缺點 | (1) installer 體積成 2 倍多，首次下載時間翻倍 (2) 大多數 user 只用一個 server arch，內建另兩個是 dead weight (3) 升級時 BAT release 必須等 server bundle build matrix 跑完才能 ship — 違反 spec §6 C-1 解耦原則 |

**致命傷**：(3) — spec 已決策解耦 CI workflow，方案 A 把兩者重新耦合（即便 release 流程上是兩個 workflow，最終 installer 必須等 server bundle 完成才能 sign + publish）。

#### B.2 方案 B — Runtime download from GitHub Release

| 向度 | 影響 |
|------|------|
| Installer size 增量 | **0**（維持 ~172/230 MB 現狀） |
| 首次體驗 | 取決於網路：wizard 多一步「下載 server bundle」+ progress UI；典型 60-90 MB / 5-30s @ 寬頻 |
| Offline | **不支援**（直接炸；除非 user 預先手動 download 丟到 userData） |
| ARM64 Linux | Arch detection 後挑對應 URL，無 special-case |
| Auto-update | 真正獨立（server bundle 可 hotfix 而不重 release BAT） |
| 私有部署 | 需要 fallback URL（環境變數 `BAT_SERVER_BUNDLE_BASE_URL` 或 settings 欄位） |
| GitHub rate limit | anonymous 60 req/hr。Wizard 重跑場景下若使用者連跑 wizard 5+ 次（dogfood 時很常見）會踩到。需 (a) 退避重試 (b) 本地 cache（驗證後同 SHA 不重抓） (c) 替代 CDN（v1 不做） |
| 主要缺點 | (1) 完全無法 offline (2) GitHub Release endpoint 偶爾 5xx 對 enterprise dogfood 是體驗痛點 (3) 私有 fork 強迫設 URL，OOTB 不通 |

#### B.3 方案 C — Hybrid（installer 內建 baseline + runtime fallback download）

兩種子變體：

**C-narrow**：installer **只內建 BAT host 對應的「最常見 server arch」tarball**

| BAT host | 內建 tarball |
|----------|------------|
| Win x64 | `linux-x64`（最常見：WSL2 + Docker Desktop linux/amd64） |
| Mac arm64 | `linux-x64` + `darwin-arm64`（Docker Desktop 仍是 amd64 emulation；Mac↔Mac SSH） |
| Linux x64 | `linux-x64` |
| Linux arm64 | `linux-arm64` |

每個 installer 只多 60-90 MB（單 tarball）或 120-180 MB（雙 tarball）。

**C-full**：installer **內建全部 3 個 tarball**（同方案 A 的 offline 體驗）+ 仍走 download 升級

| 向度 | C-narrow 影響 | C-full 影響 |
|------|------------|------------|
| Installer size 增量 | +60-90 MB（單 tarball）／+120-180 MB（Mac 雙 tarball） | +180-270 MB（同方案 A） |
| 首次體驗（local arch） | 最佳，無網路依賴 | 最佳 |
| 首次體驗（cross arch；e.g. Mac→linux-arm64 DGX） | **degrades to 方案 B**：必須 download | 最佳 |
| Offline（local arch） | ✅ | ✅ |
| Offline（cross arch） | ❌（wizard 卡 download） | ✅ |
| Maintenance | 兩 path（baseline + download）皆需維護 | 兩 path 皆需維護 |
| Installer build matrix | 多了 per-host tarball selection 邏輯 | 統一 |
| 私有部署 | 同 B 需 fallback URL 機制（升級才用） | 同 |

#### B.4 額外考量

**B.4.1 GitHub Rate Limit**

- anonymous 60 req/hr per IP；release artifact download 算 unauthenticated request
- wizard 跑 5 次 = 5 次 download；重複跑 dogfood 場景每小時可達 20-30 次
- **Mitigation 推薦**：(a) 必做：local cache by SHA256（同 SHA 已下載過則 skip）；(b) 推薦：error message 含 rate limit hint（提示使用者改用 token 或等待）；(c) v2：opt-in `GITHUB_TOKEN` env / settings UI 提升限額（5000 req/hr）；(d) 私有部署用 `BAT_SERVER_BUNDLE_BASE_URL` 完全繞開 GitHub
- **拒絕**：BAT 自有 CDN — over-engineering，runs counter to「reuse 既有 toolchain」哲學

**B.4.2 SHA256 manifest 設計**

T0283 build script 已產出 sha256（stdout summary JSON），但 release 時**無 manifest.json**。建議格式：

```json
{
  "version": "0.5.0",
  "buildDate": "2026-04-27T00:00:00Z",
  "tarballs": {
    "linux-x64":    { "filename": "bat-server-linux-x64-v0.5.0.tar.gz",    "sha256": "abc...", "size": 87654321 },
    "linux-arm64":  { "filename": "bat-server-linux-arm64-v0.5.0.tar.gz",  "sha256": "def...", "size": 84567890 },
    "darwin-arm64": { "filename": "bat-server-darwin-arm64-v0.5.0.tar.gz", "sha256": "ghi...", "size": 86543210 }
  }
}
```

Manifest 與 3 tarball 一起 publish 到 GitHub Release。BAT 先 fetch manifest（小，~1KB）→ 對 user 揭示「即將下載 84 MB」progress 預估 → fetch tarball + 串流計算 SHA256 → 比對 manifest（mitigate MITM）。

**Manifest 簽章**：v1 不做（GitHub Release artifact 已有 HTTPS + GitHub-side integrity）；v2 可考慮 GPG 簽 manifest.json。

**B.4.3 Server bundle auto-update 衝突**

BUG-059 的教訓：embedded claude CLI 內建 auto-update 機制會把 binary rename 到 npm prefix → BAT 找不到。Server bundle 內含 `@anthropic-ai/claude-code` package，**同樣的 risk 存在於 server 端**：當 server-side 跑 claude-code subprocess 時，如果 claude binary 自我更新，下次 server 啟動會失效。

**Mitigation**：server bundle 啟動 spawn claude subprocess 時，**沿用 BAT 主程序的 `DISABLE_AUTOUPDATER=1` env 注入**（CLAUDE.md「Embedded claude auto-update 停用」段；`pty-manager.ts` 三處 + `claude-agent-manager.ts`）。對應到 server bundle：`bat-server.mjs` / `headless-entry.ts` 的子行程 spawn 處要同步注入。**T0271 / T0283 落地時是否注入待 phase F 工單檢查**（不在 T0313 範圍）。

**Server bundle 自身**是否需要 auto-update？**否**。spec §6 C-4 「警告 only 不強版本一致」原則 → server bundle 升級走 wizard 「升級既有 server」按鈕（manual），不 auto-update。

**B.4.4 跨版本相容性**

spec §2.4 已定義 `auth-result.serverPlatform` metadata 含 `bundleVersion`。建議 client 比對策略：

| Client BAT version vs server bundleVersion | 行為 |
|------------------------------------------|------|
| 完全一致 | ✅ 透明 |
| Same major.minor，patch 不同（e.g., 0.5.0 vs 0.5.1） | ✅ 透明（patch 視為 hotfix 安全） |
| Major 一致，minor 不同（e.g., 0.5.x vs 0.4.x） | ⚠️ 非阻斷 toast「server bundle X.Y, client A.B — 部分功能可能不一致；建議升級 server」+ 可連線 |
| Major 不同（e.g., 1.0 vs 0.5） | ❌ 阻擋連線 + modal「不相容，請升級 server」 |
| `bundleVersion` undefined（legacy） | 同 major.minor 不同：toast 警告，可連線 |

**Protocol version handshake**：bundleVersion 已是 protocol version 的代理；不需另設 `protocolVersion` 欄位。

#### B.5 推薦方案

**推薦方案 C-narrow（Hybrid，installer 內建 host-aligned baseline，cross-arch 走 download）。**

**理由**：

1. **DGX Spark 場景（Mac × linux-arm64）才是 BAT remote dev 真實 target**。C-narrow 預設 Mac installer 帶 `darwin-arm64 + linux-x64`，**linux-arm64 跑 download 是合理 trade-off**（DGX Spark 設置本身就涉及網路 + 大量 SSH，多一次 80 MB download 不會痛）。
2. **Installer size 衝擊可控**：Win/Linux installer 多 60-90 MB（單 tarball），Mac 多 120-180 MB（雙 tarball）。對 NSIS 172 MB → 230-260 MB 仍在「網路下載 desktop app」的合理範圍（VS Code installer 也 100+ MB）。**比 C-full 的 +180-270 MB 友善很多**。
3. **解耦 BAT release 與 server bundle release**：installer 只需內建 host arch baseline，server bundle 升級獨立走 download；spec §6 C-1 解耦原則完整保留（C-full 會把 cross-arch download 也省略 → 等於要求 release 時必含三 platform tarball → 重新耦合）。
4. **GitHub Rate Limit 風險小**：90% 場景走 baseline（local cache hit），只有「跨 arch + 首次」才真 download。
5. **私有部署**：`BAT_SERVER_BUNDLE_BASE_URL` env 仍存在，但只影響升級與 cross-arch download；baseline 走 installer，不依賴 URL。

**反駁塔台預判方案 C 的 C-full 變體**：C-full 在 installer size 與「三 tarball 都得 build 才能 ship desktop」上有顯著代價，而 cross-arch offline 在現實場景中幾乎不發生（DGX Spark 使用者都是高頻 SSH，不會 offline）。C-narrow 是 Pareto-optimal 點。

**唯一拍板項給塔台**：是否接受「Mac installer 雙 tarball（darwin-arm64 + linux-x64）」；如果塔台要求「所有 host installer 單 tarball」，則 C-narrow 退化為「Mac installer 不帶 linux-x64 → Mac → Docker Desktop (linux/amd64) 流程也要走 download」，第一次 docker setup 體驗劣化。**Worker 推薦：Mac 雙 tarball**。

---

### 3. 支援矩陣（Phase C）

9-cell（BAT host 行 × Server arch 列），每格：狀態 / 場景 / 待釐清。

| BAT host \ Server arch | linux-x64 | linux-arm64 | darwin-arm64 |
|------------------------|-----------|-------------|--------------|
| **Windows (x64)** | ✅ **支援**<br>場景：(a) WSL2 Ubuntu/Debian @ x64 host（最常見）(b) Win → SSH Linux x64 server（VPS / dev VM）(c) Win → Docker Desktop (linux/amd64)<br>待釐清：WSL2 mirrored vs NAT 網路模式對 download 進度條有無影響（無，wizard 階段在 host 端 download 後再推到 WSL） | 🚧 **待支援（v1 納入）**<br>場景：(a) Win laptop → SSH DGX Spark（少見但合理；ARM Linux 主機通常無顯示器，遠端 SSH 是主流）(b) Win → Docker arm64 emulation（Docker Desktop 罕見走 arm64）<br>待釐清：Win client 偵測 remote arch 後如何挑 tarball（已有 SSH path 走 ssh:probe-auth） | ❌ **不支援**<br>理由：Win client → SSH macOS server 罕見（Mac 使用者多直接 BAT on Mac）；spec §1.3 darwin-x64 / Win SSH server 已排除；darwin-arm64 SSH server 雖然有 tarball，但 Win → Mac 的真實 use case <1%。<br>**待釐清**：是否在 wizard `pick targetOS` UI 隱藏此組合？建議**保留可選但不主推**（不需特殊 code，已是 SSH 通用 path） |
| **macOS (arm64)** | ✅ **支援**<br>場景：(a) Mac → SSH Linux x64 server（VPS）(b) Mac → Docker Desktop (linux/amd64 emulation；spec §4.2 multi-arch v1 限制) — **此格是 Mac BAT 最常用的 server**<br>待釐清：Docker Desktop on Mac 跑 linux/amd64 image 時 arch detection 應該回 `x86_64` (image arch) 還是 `arm64` (host arch)？答：用 `docker exec <c> uname -m` 回 image arch，正確 | ✅ **支援（DGX Spark 主場景）**<br>場景：(a) **Mac → SSH DGX Spark GB10**（aarch64 Linux；使用者 PRIMARY use case）(b) Mac → Docker arm64 image（spec §4.2 標 v2，emulation 替代）(c) Mac → SSH ARM Linux VPS（少見但 viable）<br>待釐清：DGX Spark CUDA driver 是否影響 Node native modules？答：sharp/node-pty/sqlite 不依賴 CUDA，無關 | ✅ **支援**<br>場景：(a) Mac → SSH Mac mini studio NAS / build farm（合理）(b) Mac↔Mac collaboration（罕見）<br>待釐清：macOS post-install quarantine（`xattr -d`，spec §4.3 / T0285）對 darwin-arm64 server bundle 的處理 |
| **Linux (x64 / arm64 合併行)** | ✅ **支援**<br>場景：(a) Linux desktop user → SSH Linux x64 (b) Linux x64 host → local server (c) Linux → Docker Engine (linux/amd64)<br>待釐清：Linux desktop user 比例 < 5%，但 spec §1.2 已支援，本格無風險 | ✅ **支援**<br>場景：(a) Linux → SSH DGX Spark（少見但 viable）(b) Linux arm64 desktop（如 Asahi Linux）→ local server (c) Linux arm64 → Docker arm64<br>待釐清：Linux arm64 desktop tarball 是否在 v1 build？答：BAT desktop 已有 linux-x64 + linux-arm64 build（pre-release.yml），server bundle linux-arm64 也有 → 完整 | 🚧 **待支援（v1 納入）**<br>場景：(a) Linux → SSH macOS server（罕見但 viable，企業環境 Mac build farm） (b) Linux → SSH NAS<br>待釐清：與 Win → darwin-arm64 同樣 use case <1%，但已是通用 SSH path |

**矩陣總結**：

- **6 格 ✅ 支援**：所有合理場景
- **2 格 🚧 待支援**：Win → linux-arm64（DGX Spark for Win user）、Linux → darwin-arm64（少數企業）— **走 v1 通用 SSH path 即支援**，不需特殊 code
- **1 格 ❌ 不支援**：Win → darwin-arm64（use case <1%；保留通用 path 可走但不主推）

**Distribution 含義**：

- 9 格的 distribution path 上 **client side 取得 tarball 邏輯**完全相同（download from GitHub Release / installer baseline），差異只在 arch detection 結果挑哪個 tarball。
- WSL 場景僅 1 格（Win × linux-x64），Docker 跨 5 格（Win/Mac/Linux × linux-x64 + Mac × linux-arm64 + Linux arm64 × linux-arm64），SSH 跨 9 格（理論全 cover）。
- **Distribution module 設計目標**：1 個共用模組（`electron/server-bundle-distributor.ts`）服務 WSL + SSH + Docker（image 模式略過）。

---

### 4. ARM64 Linux 細節（Phase D）

#### D.1 Arch Detection IPC 設計

**現況**：SSH 已有，WSL/Docker 缺。建議統一 IPC contract：

```typescript
// preload.ts
window.electronAPI.remote.detectArch(profile: ProfileEntry): Promise<{
  ok: true
  arch: 'linux-x64' | 'linux-arm64' | 'darwin-arm64'
  rawUname: string  // e.g., "aarch64", "x86_64", "arm64"
} | {
  ok: false
  error: string
  errorCode: 'unsupported-arch' | 'detect-failed' | 'remote-unreachable'
}>
```

**三平台實作 dispatch**（main process `electron/handlers/remote-arch-detect.ts`，新建）：

| targetOS | 實作 |
|----------|------|
| `wsl-linux` | `wsl -d <distro> -- uname -m` → parse stdout → normalize |
| `ssh-linux` / `ssh-darwin` | **重用 `ssh:probe-auth`** 已抓的 `serverArch`（避免重打 SSH connection）；若 ctx 沒值才補打一次 |
| `docker-linux` | `docker exec <container> uname -m` → parse → normalize（注意 image arch 可能與 host 不同，e.g. Docker Desktop on Mac 跑 linux/amd64） |
| `local` | n/a — local 不需 server bundle distribution |

**Normalize 規則**（純函數，可單元測試）：

```typescript
function normalizeArch(rawUname: string, targetOS: TargetOS): 'linux-x64' | 'linux-arm64' | 'darwin-arm64' | null {
  const trimmed = rawUname.trim().toLowerCase()
  const isLinux = targetOS === 'wsl-linux' || targetOS === 'docker-linux' || targetOS === 'ssh-linux'
  const isDarwin = targetOS === 'ssh-darwin'
  if (isLinux) {
    if (trimmed === 'x86_64' || trimmed === 'amd64') return 'linux-x64'
    if (trimmed === 'aarch64' || trimmed === 'arm64') return 'linux-arm64'
  }
  if (isDarwin) {
    if (trimmed === 'arm64' || trimmed === 'aarch64') return 'darwin-arm64'
    // darwin-x64 已 spec §1.3 排除
  }
  return null  // unsupported
}
```

**不認識的 arch** → IPC 回 `{ ok: false, errorCode: 'unsupported-arch' }`，wizard 顯示：

> Server architecture `<rawUname>` is not supported. Supported: linux-x64 (x86_64), linux-arm64 (aarch64), darwin-arm64 (arm64 macOS). See troubleshooting docs.

**IPC handler 注入位置**：在 `verify-auth.ts` (SSH) / `wsl-systemd-check.ts` 之後、`install-server-bundle.ts` 之前 — 新增 `detect-arch` step（`appliesTo: ['wsl-linux', 'docker-linux', 'ssh-linux', 'ssh-darwin']`）。SSH 場景下這個 step 為 no-op（重用 verify-auth 已偵測值）。

#### D.2 Tarball 選擇邏輯

純函數（可單元測試）：

```typescript
function tarballNameForArch(arch: 'linux-x64' | 'linux-arm64' | 'darwin-arm64', batVersion: string): string {
  return `bat-server-${arch}-v${batVersion}.tar.gz`
}

function tarballURL(arch: ..., batVersion: string, baseURL?: string): string {
  const base = baseURL ?? `https://github.com/anthropics/better-agent-terminal/releases/download/server-bundle-v${batVersion}`
  return `${base}/${tarballNameForArch(arch, batVersion)}`
}
```

**注意**：Server bundle GitHub Release tag 為 `server-bundle-v0.5.0`（spec §6 C-1 + workflow 已落地），**不是** `v0.5.0`（後者是 desktop release）。BAT runtime 需要知道兩個 tag namespace。

**Darwin-arm64 場景**：spec §1.3 / §4.3 限定「ssh-darwin」use case；Mac→SSH→Mac。少見但 BAT 已支援，distribution 同 path（GitHub Release 有此 tarball）。

#### D.3 ARM64 Linux native modules 完整性檢查

**T0283 TARGET_CONFIG['linux-arm64']** 列以下 native packages（build script line 56-75）：

| Package | 狀態 | 備註 |
|---------|------|------|
| `@lydell/node-pty` + `node-pty-linux-arm64` | ✅ 有 platform sub-package | T0283 verify-server-bundle 檢 sub-package 存在 |
| `@img/sharp` + `sharp-linux-arm64` + `sharp-libvips-linux-arm64` | ✅ 三件齊全 | sharp 拆主 package + 平台 binding + libvips |
| `better-sqlite3` | ⚠️ **無 platform sub-package**（與 node-pty 不同 pattern） | 仰賴 `node-gyp-build` 在 ubuntu-22.04-arm runner 上原生 rebuild。CI matrix 跑 `npm ci`（workflow line 43）+ `verify-native-modules.js`（line 46）→ 會在 runner 端做 native build |
| `@anthropic-ai/claude-code` + `claude-code-linux-arm64` | ✅ 有 platform sub-package | claude binary per arch |
| `@anthropic-ai/claude-agent-sdk` + `claude-agent-sdk-linux-arm64` | ✅ 有 platform sub-package | SDK binary per arch |

**潛在風險**：

1. **better-sqlite3 ARM64 native build**：CI runner `ubuntu-22.04-arm` 是 GitHub 2024 推出的原生 ARM runner（非 QEMU），native build 應該無問題。但若 runner 退役/不可用 fallback 到 QEMU，build time 會 +10 min（spec §2.3 已預期）。
2. **node binary**：`https://nodejs.org/dist/.../node-v24.X.Y-linux-arm64.tar.xz` 由 nodejs.org 官方 prebuilt。Node 24 ARM64 Linux prebuilt 從 v24.0 起就支援 → 無風險。
3. **glibc 下限 2.35（Ubuntu 22.04）**：spec §2.5 凍結。DGX Spark 預設 Ubuntu 24.04 LTS（glibc 2.39），符合。
4. **驗證未執行**：T0283 worktree 在 Windows host 跑 build → arm64 sub-package 缺（守則 7 預告 fail-fast；T0283 收尾標 PARTIAL/AC2/AC3）。**v1 release 真正的 arm64 完整性驗證 = CI matrix 第一次成功跑通**。

**建議補丁**：在 PLAN-031 拆單時開一張「驗證 arm64 tarball 在 DGX Spark 實機跑得起來」（dogfood QA 工單），對應 T0286 SSH e2e 但專注 ARM。

**手動檢查方式**（Worker 暫無法執行：CI 未跑）：使用者 `gh run list --workflow=build-server-bundle.yml` → 找 latest success run → `gh run download <id>` → 解壓 `dist-server/bat-server-linux-arm64-v0.4.1.tar.gz` → grep `node_modules/@lydell/node-pty-linux-arm64/` 等存在性。

---

### 5. Distribution 解耦策略（Phase E）

**E.1 同版號 ship 還是獨立版本？**

**推薦：同版號**（BAT v0.5.0 → server bundle v0.5.0），**但獨立 GitHub Release tag**。

理由：
- spec §2.4 `bundleVersion` metadata 已預設此 pattern（client 比對 server bundleVersion 用同 semver 邏輯）
- Debug 時 user report 「BAT 0.5.0 連 server 0.4.x」一目了然
- 拒絕「server bundle 自己一套版號」（如 PLAN-007 spec line 458 提的 `vX.Y.Z+server`）：**此寫法 server build matrix 與 desktop release 在 semver 之外建立耦合，反而難維護**。
- Tag 命名空間：desktop = `vX.Y.Z`，server bundle = `server-bundle-vX.Y.Z`，兩 tag 同 commit。Release notes 各自寫。

**Hotfix 場景**：server bundle hotfix 0.5.0 → 0.5.1，desktop 不動 → 只 push `server-bundle-v0.5.1` tag，desktop 仍是 v0.5.0；client 比對 `bundleVersion` 0.5.1 vs BAT 0.5.0 → patch 不同 → 透明（B.4.4 規則）。

**E.2 GitHub Release publish flow**

**現況**：T0283 的 `build-server-bundle.yml` 已有 release job（line 61-91），條件 `startsWith(github.ref, 'refs/tags/server-bundle-v')`，**已 publish 3 tarball + prerelease 標記**。**缺**：
1. 無 SHA256 manifest.json（B.4.2 推薦）
2. 無 release notes auto-generation（softprops/action-gh-release 預設行為依賴 `RELEASE.md` 或自動 generate）

**建議補強**（拆單範圍）：
- 在 `build` job 收尾印的 sha256 寫進每個 artifact 的 sidecar `*.sha256` 檔
- 在 `release` job 加一步：merge 三個 sidecar + tarball metadata → 產生 `manifest.json` → 連 tarball 一起 publish
- BAT runtime 先 `fetch manifest.json` → 對 user 揭示 size + version → fetch tarball

**單一 Release vs 雙 Release**：
- 單一：`v0.5.0` desktop release 內同時掛 desktop installers + server tarballs（softprops 接受 multi-source files）
- 雙：`v0.5.0`（desktop）+ `server-bundle-v0.5.0`（server tarball + manifest）— spec §6 C-1 解耦原則 + workflow 現況一致

**推薦：雙 Release**（沿用現況，最少改動 + 解耦）。

**E.3 既有 remote 升級策略**

**v1 推薦**：被動偵測 + UI 提示（不 auto-upgrade）

具體：
1. RemoteClient connect 後 `auth-result.metadata.bundleVersion` 進 profile cache
2. ProfilePanel 顯示「Server bundle: v0.4.0（current BAT: v0.5.0）— 升級可用」按鈕
3. 點擊 → 跑「upgrade-server-bundle」mini-wizard（subset of full wizard：detect arch → download new tarball → stop server → swap → start server → fingerprint 不變因 cert 不重產）
4. 自動偵測 + non-blocking toast：connect 完成後若版本不符顯示「server 版本舊」toast 一次（不每次連線都跳）

**v2 enhancement**：opt-in auto-upgrade（settings 旗標 `autoUpgradeServerBundle`），預設 off。

**B.4.3 提到的 BUG-059 教訓**：embedded claude 自動更新陷阱 — server bundle 升級必須 BAT 主動發起（user-initiated），絕對不能由 server 端自我更新。

**E.4 Backwards compat policy**

採 B.4.4 表格：
- **Major 一致 + minor 差距 1（N-1）**：toast warn，可連線 — 主流支援
- **Major 一致 + minor 差距 ≥2**：modal warn，建議升級，仍可連線
- **Major 不一致**：硬阻擋，要求升級
- **bundleVersion undefined（legacy）**：toast warn，可連線（fallback to IdentityTranslator pattern）

**Long-term**：server bundle 改版前在 client 加 deprecation warning（提前 1 minor 版本），讓既有 user 有時間升級。

---

### 6. 拆單建議表（Phase F）

依 T0313 範圍 §F 模板擴充。Sprint 2-5 共 **11 張工單**（含 1 張 spec 文件 + 6 impl + 4 qa/docs）。

| 工單號 | 標題 | 類型 | 預估 wall | Sizing | 依賴 | 平行 | 需塔台拍板 |
|--------|------|------|----------|--------|------|------|----------|
| **Sprint 2 — Distribution Infra**（installer baseline + GitHub Release 整合） |
| T0314 | Distribution spec freeze + arch normalize 純函數 + manifest schema | docs | 30-45 min | S | T0313 拍板 | ✅ Sprint 2 起點 | C-narrow vs C-full Mac 雙 tarball；雙 Release 命名空間（建議直走 worker 提案） |
| T0315 | Server bundle GitHub Release manifest.json 產生 + workflow 整合 | impl | 30-60 min | M | T0314 | ✅ 平行於 T0316/T0317 | - |
| T0316 | electron-builder extraResources 整合 baseline tarball（per-host arch matrix） | impl | 60-90 min | L | T0314；BUG-058 helper bundle scanner 已驗 | 平行於 T0315 | 拍板 Mac installer 雙 tarball 的 size 上限（建議 280 MB） |
| T0317 | SHA256 manifest 解析 + 校驗模組（renderer-side 純函數） | impl | 30-45 min | M | T0314 | ✅ 平行於 T0315/T0316 | - |
| **Sprint 3 — Runtime Download Flow**（網路 + arch detection） |
| T0318 | BAT runtime download module（fetch + progress + retry + local cache by SHA） | impl | 60-90 min | L | T0317 | ✅ 平行於 T0319 | rate limit hint 文案；fallback URL env 名稱（建議 `BAT_SERVER_BUNDLE_BASE_URL`） |
| T0319 | Arch detection IPC（WSL/Docker，SSH 重用 verify-auth） + normalize 純函數 | impl | 45-75 min | M | T0314（normalize 純函數） | ✅ 平行於 T0318 | - |
| T0320 | server-bundle-distributor 共用模組（baseline lookup → download fallback → SHA 校驗 → 解壓路徑回傳） | impl | 60-90 min | L | T0316/T0317/T0318/T0319 | ❌ 序列；blocks Sprint 4 | - |
| **Sprint 4 — Install-Bundle Step 統一改寫** |
| T0321 | WSL install-bundle step 改寫（消費 distributor + arch detection；移除「lands in T0282」placeholder） | impl | 30-45 min | S | T0320 | ✅ 三平台可平行 | - |
| T0322 | SSH install-bundle step 改寫（消費 distributor；保留 archHint 已有邏輯併入 distributor） | impl | 30-45 min | S | T0320 | ✅ | - |
| T0323 | Docker install-bundle step 改寫（image-based 模式不變；新增「自帶 image build pipeline」可選 path 用 distributor） | impl | 45-60 min | M | T0320 | ✅ | docker image-based 是否要支援 distributor fallback？（建議 v1 不做，保留 image 模式單純） |
| **Sprint 5 — E2E + Dogfood** |
| T0324 | DGX Spark 實機 e2e（Mac BAT × linux-arm64 server，含 download flow + offline cache hit） | qa | 60-90 min | M | T0321/T0322 | ❌ 需實機 | 是否要安排 user dogfood session 還是 worker 自動跑（建議 user dogfood，arm64 hardware 成本） |
| T0325 | Offline / 網路 fail / GitHub rate limit e2e + 三平台 install-bundle 自動測試 | qa | 45-75 min | M | T0321/T0322/T0323 | ✅ 平行於 T0324 | - |
| T0326 | 升級既有 server bundle UI（ProfilePanel 升級按鈕 + mini-wizard） | impl | 60-90 min | M | T0320；ProfilePanel C-7 重構（T0287） | ❌ 等 T0287 落地 | v1 是否包含此功能 — 若 v0.5.0 release 急 ship 可推到 v0.5.1（建議 v0.5.0 含） |
| T0327 | docs/server-bundle-distribution.md + CLAUDE.md「Packaging / Release 前置檢查」更新 | docs | 30-45 min | S | T0324/T0325 | ✅ 收尾平行 | - |

**總計**：14 張工單（1 docs + 9 impl + 3 qa + 1 docs；不含 T0313 自身）。

**平行性總結**：
- Sprint 2：T0315/T0316/T0317 三張平行（Worker 跑滿可 30-60 min wall）
- Sprint 3：T0318/T0319 平行 → T0320 序列收尾
- Sprint 4：T0321/T0322/T0323 三張全平行（Worker 集中執行）
- Sprint 5：T0324（實機）+ T0325（自動）平行 + T0326 序列等 T0287 + T0327 收尾

**總工程量估**（Worker wall time 估算，依 GP099 校準）：
- Sprint 2: ~150-240 min（4 張，平行可壓到 60-90 min wall）
- Sprint 3: ~165-255 min（3 張，平行可壓到 60-90 min）
- Sprint 4: ~105-150 min（3 張平行，~45-60 min wall）
- Sprint 5: ~225-345 min（4 張，部分平行；含實機 dogfood）
- **合計：~645-990 min wall（11-17 hr）**，等同 **2-3 工程日 Worker concentrated time**

**需塔台拍板的子問題**（彙整）：

1. **C-narrow vs C-full**（Worker 推薦 C-narrow + Mac 雙 tarball）— T0314 起點需此拍板
2. **雙 Release 命名空間**（Worker 推薦：sustain `vX.Y.Z` + `server-bundle-vX.Y.Z` 雙 tag，沿用 T0283 workflow 現況）— T0315
3. **Mac installer size 上限**（Worker 推薦 280 MB hard cap）— T0316
4. **fallback URL env 名稱**（Worker 推薦 `BAT_SERVER_BUNDLE_BASE_URL`）— T0318
5. **Docker distributor fallback**（Worker 推薦 v1 不做，保留 image 模式單純）— T0323
6. **DGX Spark dogfood：user vs worker**（Worker 推薦 user dogfood，硬體成本）— T0324
7. **「升級既有 server」UI 是否 v0.5.0 含**（Worker 推薦 v0.5.0 含，提升 dogfood 體驗）— T0326

### Worker 提問（如有）

**無**。Phase A-F 全展開後 6 段研究目標皆有確定答案，無 spec 歧義或檔案內容判斷不清的疑點需向使用者求解。塔台預判方案 C 的反饋空間留在「拍板項 #1」（C-narrow vs C-full），Worker 已給推薦 + 反駁理由。

### 完成註記

- **狀態**：DONE
- **Wall time**：~32 min（01:03 → 01:35 預期；落於 GP099 L sizing（60-120 min wall）下界以下，因 spec / T0283 / install-bundle 三平台 step 結構清晰，無需 deep dive 探索）
- **PARTIAL 與否**：Full DONE。6 段全填，無空話；所有 9 cell 矩陣有實證；推薦方案 C-narrow 帶具體理由 + 反駁塔台預判 C-full；拆單表 14 張含 sizing/依賴/平行性/拍板需求
- **需塔台拍板項數量**：7 項（見 Phase F 末段）
- **新增文件**：無（研究結論已壓進 T0313 回報區，未獨立成 spec；spec 凝練留待 T0314 第一張 impl 工單內生產 `_spec-server-bundle-distribution.md` — 屆時整合本工單回報 + 塔台拍板結果）
- **Commit**：`66d7437` `chore(research): T0313 PLAN-031 server bundle distribution research`
