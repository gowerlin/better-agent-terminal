# Server Bundle Distribution Spec (PLAN-031)

**Status**: ✅ Frozen for PLAN-031 Sprint 2 起點（T0314 落地）
**Date**: 2026-04-27
**Source workorders**: T0313 ✅（研究 + 7 拍板項 D092-D098）
**Decision authority**: T0314（spec 凝練 + arch normalize 純函數 + manifest schema）
**Audience**: Implementation worker(s) for PLAN-031 Sprint 2-5

> **約定**：本文件是 T0313 研究 + 塔台拍板的「凝練版」。設計分支理由詳見 T0313 回報區；本文件只記錄**最終結論 + 入口指標**。所有 commit hash 引用為 `main` branch 上的最新點。

---

## §1 範圍與動機

### 1.1 觸發事件（從 BUG-071）

PLAN-030 完工後使用者實機跑 v0.4.1 WSL Setup Wizard，第 4 步「安裝 BAT 伺服器套件」必炸：

> Server bundle tarball not found in userData/bat-server-bundles. Release download flow lands in T0282.

Root cause：三平台 wizard install-bundle step (`src/components/setup-wizard/steps/{wsl,ssh,docker}/install-server-bundle.ts`) 留 placeholder throw；T0283 ✅ build pipeline 跑得通但只進 GitHub Actions artifact store，**未 publish 到 GitHub Release**，BAT runtime 也無消費 artifact 的 code path。

### 1.2 v1 範圍

- **Distribution path**：Hybrid（installer 內建 baseline + GitHub Release runtime fallback download，D092 C-narrow + Mac 雙 tarball）
- **支援 arch**：linux-x64 / linux-arm64 / darwin-arm64（spec §1.3 排除 darwin-x64）
- **三平台 install-bundle step**（WSL / SSH / Docker）共享同一份 distribution 邏輯
- **Arch detection IPC**：WSL / SSH / Docker 三平台統一 contract（§3.4）
- **SHA256 manifest** 校驗（§3.3 / §9）
- **Local cache by SHA**（避免 GitHub rate limit；§8）
- **既有 remote 升級 server UI**（v0.5.0 含，D098；T0326 owner）

### 1.3 v1 排除

- ❌ Docker distributor fallback（D096，v1 保留 image-based 模式單純）
- ❌ Manifest GPG 簽章（v2，§5）
- ❌ Server bundle 自我 auto-update（沿用 wizard 升級 UI 手動觸發）
- ❌ BAT 自有 CDN（over-engineering，背離 reuse 既有 toolchain 哲學）
- ❌ Opt-in `GITHUB_TOKEN` 提升 rate limit（v2，§8）
- ❌ darwin-x64 server bundle（沿用 PLAN-007 §1.3 排除）

### 1.4 與既有 PLAN 關係

| PLAN | 關係 |
|------|------|
| PLAN-007（remote dev support） | 已 PLANNED → 部分 DONE。Distribution flow 從未交付，本 PLAN 補完。 |
| PLAN-018（Tailscale + cert pinning） | 已交付。本 PLAN 不影響 transport 層。 |
| PLAN-005（electron-builder 26 升級） | 已交付。本 PLAN 沿用 `extraResources` pattern 內建 baseline tarball。 |
| PLAN-027（Claude runtime router） | 已交付。Server bundle 內含 `@anthropic-ai/claude-code`，需沿用 `DISABLE_AUTOUPDATER=1` env 注入（§5）。 |

---

## §2 拍板決策

| 編號 | 議題 | 決策 | 理由 |
|------|------|------|------|
| D092 | C-narrow vs C-full | **C-narrow + Mac 雙 tarball**（darwin-arm64 + linux-x64） | DGX Spark 場景 Mac × linux-arm64 走 download 是合理 trade-off；C-full 增量 +180-270 MB 過大 |
| D093 | Release tag 命名空間 | **雙 Release**：desktop `vX.Y.Z` + server bundle `server-bundle-vX.Y.Z`（沿用 T0283） | 同 commit 但語義分離，user 一目了然 |
| D094 | Mac installer size 上限 | **280 MB hard cap**（超出觸發塔台復議） | NSIS 172 MB → Mac 雙 tarball 後 230-260 MB；保留 buffer |
| D095 | Fallback URL env | `BAT_SERVER_BUNDLE_BASE_URL` | 私有部署 / fork 完全繞開 GitHub |
| D096 | Docker distributor fallback | **v1 不做**（保留 image-based 模式單純） | Image-based 已透過 docker pull 解決 distribution，無需重複 |
| D097 | DGX Spark dogfood | **user dogfood**（Sprint 5 才派 T0324） | 本工單不涉及；驗收交給實機 SSH e2e |
| D098 | 升級既有 server UI | **v0.5.0 含**（T0326 落地） | 與 BAT 主版號同 ship，避免兩段 release |

> 拍板項追溯來源：T0313 回報區 + 塔台 Sprint 2 起點對齊。

---

## §3 Distribution 流程

### §3.1 Installer baseline tarball（per-host arch matrix）

從 D092 C-narrow + Mac 雙 tarball 規則凍結：

| BAT host       | 內建 tarball                              |
|----------------|-------------------------------------------|
| Win (x64)      | linux-x64                                 |
| Mac (arm64)    | linux-x64 + darwin-arm64                  |
| Linux (x64)    | linux-x64                                 |
| Linux (arm64)  | linux-arm64                               |

**Pattern**：electron-builder `extraResources` 在 `pre-release.yml` workflow 各 host job 注入 host-aligned tarball。Win/Linux installer 增量 +60-90 MB（單 tarball），Mac 增量 +120-180 MB（雙 tarball）。

**Wizard 行為**：先檢查 `app.getPath('userData')/bat-server-bundles/<filename>`；不存在時檢查 `extraResources` baseline；仍不存在才走 §3.2 runtime download。

**驗收 owner**：T0316（Electron-builder extraResources 整合）。

### §3.2 Runtime download fallback

從 GitHub Release（D095 fallback URL env 可覆蓋）：

1. 計算目標 arch（§3.4）
2. 解析 base URL：`process.env.BAT_SERVER_BUNDLE_BASE_URL` ?? `https://github.com/anthropics/better-agent-terminal/releases/download/server-bundle-v${version}`
3. Fetch manifest.json（~1KB；§3.3）
4. Lookup `tarballs[arch]` → 取得 filename / sha256 / size
5. 顯示「即將下載 84 MB」progress 預估（給 user）
6. Fetch tarball + 串流計算 SHA256 → 比對 manifest（§3.3）
7. 寫入 `userData/bat-server-bundles/<filename>` + `<filename>.sha256`（local cache，§3.5）

**驗收 owner**：T0318（download module）。

### §3.3 SHA256 manifest 流程

**Fetch order**：先 manifest（small）→ 揭露 size → 才 fetch tarball（large）。

**Verify**：
1. Manifest fetch 後驗 `schemaVersion === '1'`，否則 abort（forward-compat：未來改 schema 強制升 BAT）
2. Tarball fetch 用 streaming SHA256（避免整檔載入 memory；對 80 MB 級檔案有意義）
3. SHA256 比對失敗 → 刪除 tarball + 報 user「校驗失敗，可能 MITM 或下載損毀」+ retry 一次

**MITM mitigation**：v1 仰賴 GitHub Release HTTPS + GitHub-side integrity；manifest 簽章 v2 才考慮 GPG。

**驗收 owner**：T0317（SHA256 verify implementation）。

### §3.4 Arch detection

統一 IPC contract（從 T0313 D.1 凍結；純函數 normalize 已落地 `src/lib/arch-normalize.ts`）：

```typescript
window.electronAPI.remote.detectArch(profile: ProfileEntry): Promise<{
  ok: true
  arch: 'linux-x64' | 'linux-arm64' | 'darwin-arm64'
  rawUname: string
} | {
  ok: false
  error: string
  errorCode: 'unsupported-arch' | 'detect-failed' | 'remote-unreachable'
}>
```

**三平台 dispatch**（main process `electron/handlers/remote-arch-detect.ts`，新建）：

| targetOS | 實作 |
|----------|------|
| `wsl-linux` | `wsl -d <distro> -- uname -m` → trim → `normalizeArch()` |
| `ssh-linux` / `ssh-darwin` | **重用 `ssh:probe-auth`** 已抓的 `serverArch`（避免重打 SSH connection）；ctx 沒值才補打 `ssh ... uname -m` |
| `docker-linux` | `docker exec <container> uname -m` → trim → `normalizeArch()` |
| `local` | n/a — local 不需 server bundle distribution |

**Normalize 規則**：見 `src/lib/arch-normalize.ts::normalizeArch()`。純函數，已單元測試（26 case 全綠）。

**Wizard step 注入位置**：在 `verify-auth` (SSH) / `wsl-systemd-check` 之後、`install-server-bundle` 之前，新增 `detect-arch` step（`appliesTo: ['wsl-linux', 'docker-linux', 'ssh-linux', 'ssh-darwin']`）。SSH 場景下這個 step 為 no-op（重用 verify-auth 已偵測值）。

**不認識的 arch**（normalizeArch 回 null）→ IPC 回 `{ ok: false, errorCode: 'unsupported-arch' }`，wizard 顯示：

> Server architecture `<rawUname>` is not supported. Supported: linux-x64 (x86_64), linux-arm64 (aarch64), darwin-arm64 (arm64 macOS). See troubleshooting docs.

**驗收 owner**：T0319（Arch detection IPC handler）+ T0322（SSH install-bundle step 消費）。

### §3.5 Local cache by SHA

避免 GitHub rate limit + 重複下載：

- Cache 路徑：`app.getPath('userData')/bat-server-bundles/`
- 命名：`bat-server-${arch}-v${version}.tar.gz` + 同名 `.sha256` sidecar
- Hit 規則：filename + sha256 都對才 hit；sha256 不符視為 cache miss（重新 download）
- 沒有 LRU eviction（v1 簡單）；v2 可加「保留最近 3 版」邏輯
- Cache 命中時跳過 §3.2 download（manifest 仍 fetch，確保 SHA256 來源 fresh）

**驗收 owner**：T0318（download module 內建 cache）。

---

## §4 9-cell 支援矩陣

從 T0313 Phase C 凍結（BAT host × Server arch）：

| BAT host \ Server arch | linux-x64 | linux-arm64 | darwin-arm64 |
|------------------------|-----------|-------------|--------------|
| **Windows (x64)**      | ✅ 支援（WSL2 / SSH / Docker Desktop linux/amd64） | 🚧 v1 納入（Win → DGX Spark SSH，少見但通用 SSH path） | ❌ 不支援（use case <1%；保留通用可走但不主推） |
| **macOS (arm64)**      | ✅ 支援（Mac → SSH Linux x64 / Docker Desktop linux/amd64 emulation） | ✅ 支援（**DGX Spark 主場景**；Mac → SSH ARM Linux） | ✅ 支援（Mac↔Mac SSH；Mac mini studio NAS） |
| **Linux (x64 / arm64)**| ✅ 支援（Linux → local / SSH / Docker） | ✅ 支援（Linux arm64 desktop 含 Asahi；DGX Spark） | 🚧 v1 納入（Linux → Mac SSH，企業 build farm） |

**矩陣總結**：
- **6 格 ✅ 支援**
- **2 格 🚧 v1 納入**（Win → linux-arm64、Linux → darwin-arm64；走通用 SSH path 不需特殊 code）
- **1 格 ❌ 不支援**（Win → darwin-arm64；保留可走但不主推）

**Distribution 含義**：9 格 client side 取得 tarball 邏輯**完全相同**（`download` from GitHub Release / installer baseline），差異只在 arch detection 結果挑哪個 tarball。1 個共用模組（`electron/server-bundle-distributor.ts`）服務 WSL + SSH + Docker。

**驗收 owner**：T0318（distributor 模組） + T0320 / T0321 / T0322（三平台 install-bundle step 消費）。

---

## §5 Native modules 完整性

Server bundle 含以下 native packages（T0283 TARGET_CONFIG）：

| Package | linux-x64 / linux-arm64 / darwin-arm64 | 備註 |
|---------|----------------------------------------|------|
| `@lydell/node-pty` + `node-pty-<arch>` | ✅ 三平台 sub-package 齊全 | T0283 verify-server-bundle 檢 sub-package |
| `@img/sharp` + `sharp-<arch>` + `sharp-libvips-<arch>` | ✅ 三件齊全 | sharp 拆主 + binding + libvips |
| `better-sqlite3` | ⚠️ **無 platform sub-package**，仰賴 `node-gyp-build` 在 runner 端 native rebuild | CI matrix 跑 `npm ci` + `verify-native-modules.js` → runner 端 native build。**ARM64 走 ubuntu-22.04-arm runner**（GitHub 2024 推出原生 ARM runner，非 QEMU） |
| `@anthropic-ai/claude-code` + `claude-code-<arch>` | ✅ 三平台 sub-package | claude binary per arch |
| `@anthropic-ai/claude-agent-sdk` + `claude-agent-sdk-<arch>` | ✅ 三平台 sub-package | SDK binary per arch |

**潛在風險**：
1. `better-sqlite3` ARM64 native build 仰賴 `ubuntu-22.04-arm` runner；若 runner 退役 fallback QEMU build time +10 min（已預期）
2. `glibc 下限 2.35`（Ubuntu 22.04）凍結；DGX Spark 預設 Ubuntu 24.04 LTS（glibc 2.39）符合
3. **驗證未執行**：T0283 worktree 在 Windows host 跑 build → arm64 sub-package 缺（fail-fast；T0283 收尾標 PARTIAL）。**v1 release 真正的 arm64 完整性驗證 = CI matrix 第一次成功跑通**

**Auto-update 風險（從 BUG-059 教訓）**：Server bundle 啟動 spawn `claude` subprocess 時，**必須沿用 BAT 主程序的 `DISABLE_AUTOUPDATER=1` env 注入**（CLAUDE.md「Embedded claude auto-update 停用」段；`pty-manager.ts` 三處 + `claude-agent-manager.ts`）。對應到 server bundle：`bat-server.mjs` / `headless-entry.ts` 的子行程 spawn 處要同步注入。

**驗收 owner**：T0323（server bundle env 注入 + native modules verify）。

---

## §6 升級策略

### §6.1 同版號 ship 規則（D093）

- BAT v0.5.0 → server bundle v0.5.0（同 commit，**獨立 tag**）
- Tag 命名空間：desktop `vX.Y.Z` / server bundle `server-bundle-vX.Y.Z`
- Release notes 各自寫
- **拒絕**：server bundle 自己一套版號（如 `vX.Y.Z+server`） — semver 之外建立耦合，反而難維護

### §6.2 既有 remote 升級 UI（D098 / T0326 owner）

v0.5.0 含「升級既有 server」按鈕：
- ProfilePanel 對 remote profile 顯示 server `bundleVersion`（從 `auth-result.serverPlatform` 拿，spec §2.4）
- 偵測到 server bundleVersion < client version → 顯示「升級 server bundle」按鈕
- 點擊觸發 wizard 「Upgrade server bundle」flow（重用 §3 distribution path，target = 該 profile）

**驗收 owner**：T0326（profile UI + upgrade trigger）。

### §6.3 跨版本相容矩陣

從 T0313 B.4.4 凍結（client BAT version vs server `bundleVersion`，用 `auth-result.serverPlatform` metadata 判斷）：

| Client BAT version vs server bundleVersion | 行為 |
|------------------------------------------|------|
| 完全一致 | ✅ 透明 |
| Same major.minor，patch 不同（e.g., 0.5.0 vs 0.5.1） | ✅ 透明（patch 視為 hotfix 安全） |
| Major 一致，minor 不同（e.g., 0.5.x vs 0.4.x） | ⚠️ 非阻斷 toast「server bundle X.Y, client A.B — 部分功能可能不一致；建議升級 server」+ 可連線 |
| Major 不同（e.g., 1.0 vs 0.5） | ❌ 阻擋連線 + modal「不相容，請升級 server」 |
| `bundleVersion` undefined（legacy） | 同 major.minor 不同：toast 警告，可連線 |

**Protocol version handshake**：`bundleVersion` 已是 protocol version 代理；不另設 `protocolVersion` 欄位。

**驗收 owner**：T0326（client 相容性比對 + UI）。

---

## §7 私有部署（D095）

**Env 命名空間**：`BAT_SERVER_BUNDLE_BASE_URL`

**用途**：覆蓋 §3.2 default base URL，完全繞開 GitHub Release。適用：
- Fork 維護者（自有 server bundle release）
- 企業 air-gapped 環境（內網 mirror）
- 開發者本機測試（指向 local file server）

**規則**：
- env 設定 → installer baseline 仍可用（不受影響）；只影響 §3.2 runtime download URL
- env 必須指向「資料夾 base」，路徑下需有 `manifest.json` + 三 tarball
- 路徑可有 trailing slash（純函數 `tarballURL()` 已處理；見 `src/lib/arch-normalize.ts`）
- Wizard 不暴露此 env 為 UI 選項（v1 power-user only）；可在 docs 標明

**驗收 owner**：T0318（download module 讀 env） + T0319（IPC 不讀 env，純函數 caller 處理）。

---

## §8 GitHub Rate Limit mitigation

**威脅**：anonymous 60 req/hr per IP；release artifact download 算 unauthenticated request。Wizard 跑 5 次 = 5 次 download；dogfood 場景每小時可達 20-30 次。

**Mitigation 階梯**：

| 階段 | 措施 | 範圍 |
|------|------|------|
| v1（必做） | Local cache by SHA256（§3.5）— 同 SHA 已下載過則 skip | T0318 |
| v1（必做） | Error message 含 rate limit hint（提示 user 改 token 或等待） | T0318 |
| v1（必做） | 私有部署 `BAT_SERVER_BUNDLE_BASE_URL`（§7）完全繞開 GitHub | T0318 |
| v2 | Opt-in `GITHUB_TOKEN` env / settings UI 提升限額（5000 req/hr） | 待後續 PLAN |
| 拒絕 | BAT 自有 CDN — over-engineering，背離 reuse 既有 toolchain 哲學 | — |

**驗收 owner**：T0318。

---

## §9 Manifest JSON schema

### TypeScript interface（v1，schemaVersion = "1"）

```typescript
// 對應 server-bundle release 的 manifest.json
import type { ServerBundleArch } from '../src/lib/arch-normalize'

interface ServerBundleManifest {
  /** Spec version，固定 "1" 直到 schema 改版 */
  schemaVersion: '1'

  /** Server bundle 版本（與 BAT version 同 semver；spec D093） */
  version: string

  /** ISO 8601 build timestamp（從 CI run） */
  buildDate: string

  /** Per-target tarball metadata */
  tarballs: Record<ServerBundleArch, {
    /** 例：bat-server-linux-x64-v0.5.0.tar.gz */
    filename: string
    /** SHA256 hex（小寫，64 字元） */
    sha256: string
    /** 解壓前 tarball size in bytes */
    size: number
  }>
}
```

### JSON example

```json
{
  "schemaVersion": "1",
  "version": "0.5.0",
  "buildDate": "2026-04-27T00:00:00Z",
  "tarballs": {
    "linux-x64":    { "filename": "bat-server-linux-x64-v0.5.0.tar.gz",    "sha256": "abc123...", "size": 87654321 },
    "linux-arm64":  { "filename": "bat-server-linux-arm64-v0.5.0.tar.gz",  "sha256": "def456...", "size": 84567890 },
    "darwin-arm64": { "filename": "bat-server-darwin-arm64-v0.5.0.tar.gz", "sha256": "ghi789...", "size": 86543210 }
  }
}
```

### Caller 用法 contract

1. BAT runtime fetch `${RELEASE_BASE}/manifest.json` 先（~1KB）
2. 驗 `schemaVersion === '1'`，否則 abort（forward-compat：未來改 schema 強制升 BAT）
3. 對 detected arch lookup `tarballs[arch]`
4. 顯示 `size` 給使用者（progress 預估）
5. fetch tarball → 串流計算 SHA256 → 比對 manifest（mitigate MITM + 損毀）

### 簽章

- v1：**不簽**（GitHub Release artifact 已有 HTTPS + GitHub-side integrity）
- v2：可考慮 GPG 簽 manifest.json（待 v2 PLAN 評估）

**驗收 owner**：T0315（CI 產出 manifest）+ T0317（runtime SHA256 verify）+ T0318（runtime fetch / parse）。

---

## §10 Open questions（v1 未涵蓋，留 v2 處理）

| 編號 | 議題 | v2 候選 |
|------|------|---------|
| Q-1 | Manifest GPG 簽章 | v2 PLAN 評估（GitHub Release 已有 HTTPS，v1 風險可接受） |
| Q-2 | Opt-in `GITHUB_TOKEN` 提升 rate limit | v2（需 settings UI + token storage 安全考量） |
| Q-3 | Server bundle 自我 auto-update | **拒絕**（沿用 wizard 升級 UI 手動觸發；BUG-059 教訓） |
| Q-4 | Cross-arch 完全 offline（Mac → linux-arm64） | C-narrow 接受 trade-off；DGX Spark 高頻 SSH 不會 offline |
| Q-5 | Docker distributor fallback（D096 v1 不做） | v2 評估（image-based 已解決 distribution，需求驗證） |
| Q-6 | LRU cache eviction（§3.5） | v2（v1 簡單保留全部；磁碟壓力出現再做） |
| Q-7 | Linux desktop user share | <5%（spec §1.2），但 BAT 已支援 Linux build；無 distribution 風險 |
| Q-8 | macOS post-install quarantine（`xattr -d`） | T0285 已處理 desktop；server bundle 同樣 pattern，T0322 確認 |

---

## 附錄：Sprint 工單對應

| Sprint | 工單 | 範圍 | Spec 段落 |
|--------|------|------|-----------|
| 1（research） | T0313 ✅ | 研究 + 拍板 | 全部來源 |
| 2（spec freeze + infra） | **T0314 ✅**（本文件） | spec + arch normalize + manifest schema | §1-§10 |
| 2 | T0315 | CI 產出 manifest + GitHub Release publish | §3.3 / §6.1 / §9 |
| 2 | T0316 | electron-builder extraResources 整合 baseline | §3.1 |
| 2 | T0317 | SHA256 校驗實作 | §3.3 |
| 3 | T0318 | Runtime download module（含 cache + rate limit hint） | §3.2 / §3.5 / §8 |
| 3 | T0319 | Arch detection IPC 三平台 dispatch | §3.4 |
| 4 | T0320 | WSL install-bundle step 改寫 | §3 / §4 |
| 4 | T0321 | Docker install-bundle step 改寫 | §3 / §4 |
| 4 | T0322 | SSH install-bundle step 改寫（消費 arch detection） | §3 / §4 |
| 4 | T0323 | Server bundle env 注入 + native modules verify | §5 |
| 5 | T0324 | DGX Spark dogfood（user 實機驗收） | §4 / §5 |
| 5 | T0325 | Offline / 網路 fail 場景驗收 | §3.5 / §8 |
| 5 | T0326 | 既有 remote 升級 server UI + 相容性比對 | §6 |

---

**版本歷程**：
- 2026-04-27 — T0314 初版凍結（Sprint 2 起點）
