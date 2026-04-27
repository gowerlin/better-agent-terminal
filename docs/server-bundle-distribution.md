# BAT Server Bundle Distribution

> Server bundle = 跨環境 (WSL / SSH / Docker) 部署到 remote 的 BAT helper runtime + `@anthropic-ai/claude-code` CLI 套組。本文件給 contributor / advanced user / 私有部署管理員看；spec 凝練版見 `_ct-workorders/_spec-server-bundle-distribution.md`。

## 動機

PLAN-030 完工時 v0.4.1 WSL Setup Wizard 第 4 步「安裝 BAT 伺服器套件」必炸：

> Server bundle tarball not found in userData/bat-server-bundles. Release download flow lands in T0282.

Root cause：三平台 wizard 的 `install-bundle` step 留 placeholder throw；Build pipeline (T0283) 跑得通但 artifact 只進 GitHub Actions store，**未 publish 到 GitHub Release**，runtime 也無消費 artifact 的 code path。

**PLAN-031** 補完此 gap：installer 內建 baseline tarball + GitHub Release runtime fallback download + cache-by-SHA + 三平台統一 arch detection contract。閉環 BUG-071。

## Distribution 三層 lookup（runtime 行為）

每次 wizard 執行 `install-bundle` step，按順序解析 tarball：

1. **Cache** — `userData/bat-server-bundles/<sha256>.tar.gz`
   - 命中即直接用，無 IO 成本
   - cache key = manifest 上的 SHA256，避免版本污染
2. **Baseline** — `resourcesPath/bat-server-baseline/`
   - installer 內建（`extraResources`），離線可用
   - 命中即複製到 cache + verify SHA256
3. **Download** — GitHub Release fallback
   - 預設端點：`https://github.com/gowerlin/better-agent-terminal/releases/download/server-bundle-v<ver>/`
   - 私有部署可改 `BAT_SERVER_BUNDLE_BASE_URL`（見下方）
   - 下載後 verify SHA256 + 寫入 cache

實作入口：`electron/remote/server-bundle-distributor.ts`（D-1 三層 lookup）+ `electron/remote/server-bundle-download.ts`（D-3 download fallback + retry）。

## Per-host baseline matrix（C-narrow，D092）

每個 BAT host installer 只內建「最可能用得到」的 baseline，其餘 arch 走 download fallback：

| BAT host | 內建 tarball |
|----------|-------------|
| Windows × x64 | `linux-x64`（WSL 內預設 Ubuntu x64） |
| macOS × arm64 | `linux-x64` + `darwin-arm64`（雙 tarball；本機 SSH self-loop + WSL/SSH/Docker linux x64 server） |
| Linux × x64 | `linux-x64` |
| Linux × arm64 | `linux-arm64`（DGX Spark / Asahi 等少數場景） |

**邏輯**：90% 場景一個 baseline 命中；冷門 host × arch 組合 (e.g. macOS arm64 連 linux-arm64 remote) 走 download fallback，安裝會慢但不會 fail-closed。Mac 雙 tarball 是 D092 拍板項，因為 Mac 使用者頻繁 SSH 自家機器。

Build 時抓 baseline：`npm run fetch:baseline`（`prebuild` hook 自動串接）。

## Architecture detection（三平台統一）

三平台 install-bundle step 走相同 IPC contract，回傳 `RemoteHostArch` 之一（`linux-x64` / `linux-arm64` / `darwin-arm64` / `unsupported-arch`）：

| 平台 | 偵測方式 |
|------|---------|
| WSL | `execFile('wsl', ['-d', distro, '--', 'uname', '-m'])` → 經 `normalizeArch()` 純函數轉換 |
| SSH | 重用 verify-auth probe 結果（`profile.sshServerArch` 已在 setup wizard 早期 step 寫入） |
| Docker | image-based — 用 `docker inspect` 讀 image 的 `Architecture` field（D096，不走 distributor） |

`normalizeArch()` 純函數位於 `electron/remote/arch-normalize.ts`，純文字轉換無 IO，便於 unit test。

## SHA256 manifest schema

每個 server bundle release 帶一份 `manifest.json`，列出該版本所有 arch 的 tarball + SHA256。Schema 簡化版：

```json
{
  "version": "0.5.0",
  "publishedAt": "2026-04-27T11:00:00Z",
  "tarballs": {
    "linux-x64": {
      "filename": "bat-server-linux-x64-v0.5.0.tar.gz",
      "sha256": "abc123...",
      "size": 87654321
    },
    "linux-arm64": { ... },
    "darwin-arm64": { ... }
  }
}
```

完整 schema + 欄位語義見 spec `§9 Manifest schema`。

Manifest 落地實作：`electron/remote/server-bundle-manifest.ts`（解析）+ `scripts/_bat-build-manifest.mjs`（CI 端產出）。

## 私有部署 / fork

設 `BAT_SERVER_BUNDLE_BASE_URL` env，BAT runtime 會把它當作 download fallback 的 base URL：

```bash
# Linux / macOS
export BAT_SERVER_BUNDLE_BASE_URL=https://my.cdn.example.com/bat-server-bundles

# Windows pwsh
$env:BAT_SERVER_BUNDLE_BASE_URL = "https://my.cdn.example.com/bat-server-bundles"
```

預期 endpoint 結構（與官方 GitHub Release 對齊）：

```
$BASE_URL/manifest.json
$BASE_URL/bat-server-linux-x64-v0.5.0.tar.gz
$BASE_URL/bat-server-linux-x64-v0.5.0.tar.gz.sha256
$BASE_URL/bat-server-darwin-arm64-v0.5.0.tar.gz
$BASE_URL/bat-server-darwin-arm64-v0.5.0.tar.gz.sha256
...
```

實作入口：`electron/remote/server-bundle-download.ts` 的 `resolveBaseUrl()`。env 未設時 fallback 到 GitHub Release 預設。

決策依據：D095（PLAN-031 spec §2 拍板項）。

## GitHub Rate Limit 處理

Anonymous GitHub API 預設 60 req/hr/IP。BAT 在 download fallback 時會：

- **靜默吃 cache**：cache 命中完全不打 GitHub，避免 rate-limit 壓力
- **Rate-limited 訊號**：response header `X-RateLimit-Remaining: 0` + `X-RateLimit-Reset: <epoch>` → BAT 顯示 actionable msg：
  > GitHub API rate-limited. Reset at <local time>. Set `GITHUB_TOKEN` env to raise limit to 5000 req/hr.
- **重試策略**：exponential backoff 至 reset time，最多 3 次

`GITHUB_TOKEN` 提升 rate limit 至 5000 req/hr 是 spec §8 v2 候選項，目前 runtime 預讀 env 但未對外宣傳；fork / 私有部署可自行注入。

## DGX Spark / ARM64 Linux 特別說明

DGX Spark / Asahi Linux 等 arm64 Linux 場景：

- **Remote 端 arch=linux-arm64**：走 download fallback（C-narrow 預設 host installer 不內建 linux-arm64 baseline）
- **BAT host=Linux arm64**：installer 內建 linux-arm64 baseline（matrix 第 4 行）；DGX Spark 直接 ssh 自家 / 同集群另一台 arm64 box 即離線可用
- **Build 端**：`npm run fetch:baseline` 在 host=linux-arm64 時抓 linux-arm64 tarball 到 `dist-baseline/`

DGX Spark dogfood 由 user 親跑（D097）；T0324 工單收集實機數據。

## 升級既有 server bundle（v0.5.0+）

v0.5.0 起 ProfilePanel 將提供「Upgrade server bundle」按鈕（T0326 範疇，D098 拍板）：

- 觸發 distributor 重新跑三層 lookup
- 強制 re-download（bypass cache）
- verify SHA256 後寫回 cache + 重啟 remote server

T0326 owner 範圍，本文件僅預告。

## 排錯

| 症狀 | 可能原因 | 解法 |
|------|---------|------|
| `Server bundle tarball not found` | dist-baseline 缺檔（dev 環境） | `npm run fetch:baseline` |
| `Server bundle tarball not found`（installed BAT） | installer baseline 損毀 | 重跑 BAT installer |
| `SHA256 mismatch` | tarball 被截斷 / cache 污染 | 刪 `userData/bat-server-bundles/`，重跑 wizard |
| `rate-limited` | GitHub API quota 用罄 | 等 reset 或設 `GITHUB_TOKEN` env |
| `unsupported-arch` | remote 的 `uname -m` 落在 Supported Servers 矩陣外 | 確認 remote 為 x86_64 / aarch64 / darwin-arm64；其他 arch 不在 v1 範圍 |
| `BAT_SERVER_BUNDLE_BASE_URL` 設了但仍打 GitHub | env 注入時機晚於 BAT 啟動 | 確認 env 在 launch BAT 前 export，或寫到 shell rc 後重啟 |

## 相關工單與決策

- **PLAN-031** Server Bundle Distribution（本文件主軸）
  - **拍板項**：D092 (C-narrow + Mac 雙 tarball) / D093 (雙 Release tag namespace) / D094 (Mac 280 MB cap) / D095 (`BAT_SERVER_BUNDLE_BASE_URL`) / D096 (Docker 不走 distributor) / D097 (DGX Spark dogfood) / D098 (v0.5.0 升級 UI)
  - **研究**：T0313（7 拍板項輸出）
  - **Spec**：T0314（凝練版，凍結於 `_ct-workorders/_spec-server-bundle-distribution.md`）
  - **實作 + 測試**：T0315-T0323（11 commits）+ T0325（187 unit + integration tests + e2e skeleton）
  - **Dogfood**：T0324（user 親跑）
  - **後續**：T0326（v0.5.0 升級 server UI）
- **BUG-071** Server bundle 安裝 wizard 撞 placeholder（PLAN-031 結案後 CLOSE）
- **PLAN-007** Remote dev support（distribution flow 補完入口；見 [Remote Dev Overview](remote-dev-overview.md)）
- **PLAN-027** Claude runtime selection（server bundle 內含 `@anthropic-ai/claude-code`，沿用 `DISABLE_AUTOUPDATER=1` env 注入）

完整 spec：`_ct-workorders/_spec-server-bundle-distribution.md`（含 §3 三層 lookup 細節 / §6 build pipeline / §7 IPC contracts / §8 cache + rate limit / §9 manifest schema 完整版）。
