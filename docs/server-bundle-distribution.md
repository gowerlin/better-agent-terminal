# BAT Server Bundle Distribution

> Server bundle = 跨環境 (WSL / SSH / Docker) 部署到 remote 的 BAT helper runtime + `@anthropic-ai/claude-code` CLI 套組。本文件給 contributor / advanced user / 私有部署管理員看；spec 凝練版見 `_ct-workorders/_spec-server-bundle-distribution.md`。

## 動機

PLAN-030 完工時 v0.4.1 WSL Setup Wizard 第 4 步「安裝 BAT 伺服器套件」必炸：

> Server bundle tarball not found in userData/bat-server-bundles. Release download flow lands in T0282.

Root cause：三平台 wizard 的 `install-bundle` step 留 placeholder throw；Build pipeline (T0283) 跑得通但 artifact 只進 GitHub Actions store，**未 publish 到 GitHub Release**，runtime 也無消費 artifact 的 code path。

**PLAN-031** 補完此 gap：installer 內建 baseline tarball + GitHub Release runtime fallback download + cache-by-SHA + 三平台統一 arch detection contract。閉環 BUG-071。

**D146 / T0547（0.6.1-pre.4 起）**：安裝檔**不再內建** baseline（每個安裝檔省 159–298 MiB）。第一次設定 WSL / SSH 遠端時從 GitHub Release 下載，下載後存進 cache 並附 `.sha256` sidecar，之後離線也能用；連不到 GitHub 的環境改用 wizard 的「匯入本機 tarball…」，或設 `BAT_SERVER_BUNDLE_BASE_URL`。D093 / D095 / D120 不變，D092 的「安裝檔內建 baseline」部分由 D146 取代。

## Distribution lookup（runtime 行為）

每次 wizard 執行 `install-bundle` step，按順序解析 tarball：

1. **Cache（自帶 sidecar）** — `userData/bat-server-bundles/bat-server-<target>-v<ver>.tar.gz` + `….tar.gz.sha256`
   - 以 cache 自己的 sidecar（sha256sum 格式 `<hex>  <filename>`）驗證，**不需要網路、也不需要 baseline**（T0547）
   - sidecar 在 tarball 進 cache 時寫入，來源一定已驗證過：下載（release manifest）、匯入（使用者提供的 `.sha256`）、baseline 複製（baseline manifest）
   - 與 sidecar 不符 → tarball 與 sidecar 一併刪除，往下走
   - T0547 前留下、沒有 sidecar 的 cache：有 baseline manifest 時以它驗證並補 sidecar；沒有時由下載路徑以 release manifest 驗證（命中則只抓 manifest、不重抓 tarball）並補 sidecar
2. **Baseline** — `resourcesPath/bat-server-baseline/`
   - D146 起官方安裝檔**沒有**這個目錄；這層只為 T0547 前的安裝檔與仍自行內建 baseline 的私有 fork 保留
   - 命中即複製到 cache（含 sidecar）+ verify SHA256；baseline 損毀仍 fail-closed（`baseline-corrupted`）
3. **Download** — GitHub Release（D146 起為首次設定的一般路徑）
   - 預設端點：`https://github.com/gowerlin/better-agent-terminal/releases/download/server-bundle-v<ver>/`（`<ver>` 去掉本機快照後綴，T0492）
   - 發佈來源（D120）：`pre-release.yml` / `release.yml` 在 desktop release step 成功後，於同一 job 把同 run 的
     `server-bundle-baseline` artifact（3 arch tarball + `.sha256` + `manifest.json`）發佈成 `server-bundle-v<ver>`
     prerelease，與 desktop release 同一 commit。`build-server-bundle.yml` 手動推 `server-bundle-v*` tag 的線保留為備援
   - 私有部署可改 `BAT_SERVER_BUNDLE_BASE_URL`（見下方）
   - 下載後 verify SHA256 + 寫入 cache + sidecar
   - 暫時性錯誤重試 3 次（500 / 1500 / 3000 ms）：HTTP 5xx 與連線錯誤（`ECONNREFUSED` / `ECONNRESET` / `ETIMEDOUT` / `ENOTFOUND` / `EAI_AGAIN` / `EPIPE` / `UND_ERR_SOCKET`）。連線錯誤碼沿 fetch 錯誤的 `cause` 鏈與 `AggregateError.errors` 取得（`code` → `errno` → 訊息字樣，T0548）；4xx、rate limit、SHA 不符、fetch 封鎖的連接埠（`bad port`）不重試
   - 失敗時錯誤訊息附上兩條出路（匯入本機 tarball 的檔名、`BAT_SERVER_BUNDLE_BASE_URL`），wizard 失敗畫面顯示三語說明與「匯入本機 tarball…」按鈕

實作入口：`electron/remote/server-bundle-distributor.ts`（lookup）+ `electron/remote/server-bundle-cache.ts`（sidecar / cache 驗證）+ `electron/remote/server-bundle-download.ts`（download + retry）+ `electron/remote/server-bundle-import.ts`（匯入）。

## 匯入本機 tarball（離線 / 內網，T0547）

WSL / SSH wizard 的「安裝 BAT 伺服器套件」下載失敗時（`download-failed` / `no-source-available`），失敗畫面提供 **匯入本機 tarball…**：

1. 從可上網的機器取得 `server-bundle-v<ver>` release 的 `bat-server-<target>-v<ver>.tar.gz` 與同名 `.sha256`（或在 repo 跑 `npm run fetch:baseline -- --host-os … --host-arch …` 抓到 `dist-baseline/`），以任何方式複製過來
2. 按「匯入本機 tarball…」選 tarball；`.sha256` 在同目錄就自動使用，否則會再請你選
3. BAT 檢查檔名（白名單 regex：`bat-server-(linux-x64|linux-arm64|darwin-arm64)-v<semver>.tar.gz`）、target 與版號必須等於這次設定需要的值，再邊複製邊算 SHA-256，與 sidecar 相符才放進 cache（`bat-server-bundles/`，與下載後格式相同），然後自動重試該步驟（命中 cache）
4. 失敗原因（檔名不符、target / 版號不符、缺 `.sha256`、`.sha256` 屬於別的檔、SHA 不符、讀取 / 寫入失敗）以三語顯示，cache 不會留下未驗證的檔案

Docker 不經 distributor（image 內建 `/opt/bat-server`，D096），沒有這個按鈕。

## Per-host baseline matrix（C-narrow，D092；D146 起安裝檔不再內建）

> 歷史紀錄：以下是 T0547 前安裝檔內建的 baseline。D146 起安裝檔不內建任何 baseline，`npm run fetch:baseline` 仍保留給手動 / 測試（e2e real-remote env 腳本、離線匯入時準備檔案）使用，build 不再呼叫。
>
> e2e real-remote 工具（`t0514-env.mjs` / `t0515-wizard-env.mjs` / `t0520-env.mjs`、`pre5-ssh-alias` / `pre6-wizard-acceptance` / `pre7-acceptance` spec）的 tarball 來源（T0548，`e2e/real-remote/baseline-source.mjs`）：明確目錄（`--baseline-dir` / `BAT_E2E_PRE5_SSH_BUNDLE_DIR` / `BAT_E2E_BASELINE_DIR`）→ repo 的 `dist-baseline/` → userData `bat-server-bundles` cache（有 `.sha256` sidecar 者）→ T0547 前安裝版的 `resources/bat-server-baseline`；都找不到時提示 `npm run fetch:baseline`。

每個 BAT host installer 只內建「最可能用得到」的 baseline，其餘 arch 走 download fallback：

| BAT host | 內建 tarball |
|----------|-------------|
| Windows × x64 | `linux-x64`（WSL 內預設 Ubuntu x64） |
| macOS × arm64 | `linux-x64` + `darwin-arm64`（雙 tarball；本機 SSH self-loop + WSL/SSH/Docker linux x64 server） |
| Linux × x64 | `linux-x64` |
| Linux × arm64 | `linux-arm64`（DGX Spark / Asahi 等少數場景） |

**邏輯**：90% 場景一個 baseline 命中；冷門 host × arch 組合 (e.g. macOS arm64 連 linux-arm64 remote) 走 download fallback，安裝會慢但不會 fail-closed。Mac 雙 tarball 是 D092 拍板項，因為 Mac 使用者頻繁 SSH 自家機器。

T0547 前 build 時抓 baseline：`npm run fetch:baseline`（`prebuild` hook 自動串接）。D146 起 `prebuild` 已移除，`verify-helper-bundle.js` 反過來擋任何 baseline `extraResources`，`verify-packaged-native.js` 擋打包產物內的 `resources/bat-server-baseline`。

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

- **Remote 端 arch=linux-arm64**：與其他 target 相同，首次設定下載 `bat-server-linux-arm64-v<ver>.tar.gz`（D146 起沒有任何 host 內建 baseline）；離線則匯入本機 tarball
- **BAT host=Linux arm64**：T0547 前 installer 內建 linux-arm64 baseline（matrix 第 4 行）；D146 起同樣改為下載 / 匯入，下載或匯入一次後 cache 可離線重用
- **準備離線檔案**：`npm run fetch:baseline -- --host-os linux --host-arch arm64` 抓 linux-arm64 tarball + sidecar 到 `dist-baseline/`

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
| `[download-failed] … Import a local tarball instead …` | 連不到 GitHub（離線 / 內網 / proxy）或該版號沒有 `server-bundle-v<ver>` release | wizard 失敗畫面按「匯入本機 tarball…」，或設 `BAT_SERVER_BUNDLE_BASE_URL` 後重啟 BAT |
| 匯入時 `version-mismatch` / `arch-mismatch` | 選到別的版號或 target 的 tarball | 取對應 `server-bundle-v<目前 BAT 版號>` 的該 target 檔案 |
| 匯入時 `sha-mismatch` | tarball 複製不完整 / 被改 / `.sha256` 不是同一次發佈的 | 重新取得 tarball 與 `.sha256` |
| `baseline-corrupted` | T0547 前的安裝檔 / 自帶 baseline 的 fork，其 baseline 損毀 | 重跑 BAT installer |
| `SHA256 mismatch` | tarball 被截斷 / cache 污染 | 刪 `userData/bat-server-bundles/`，重跑 wizard（cache 與 sidecar 不符時 BAT 也會自行刪除重抓） |
| `rate-limited` | GitHub API quota 用罄 | 等 reset 或設 `GITHUB_TOKEN` env |
| `unsupported-arch` | remote 的 `uname -m` 落在 Supported Servers 矩陣外 | 確認 remote 為 x86_64 / aarch64 / darwin-arm64；其他 arch 不在 v1 範圍 |
| `BAT_SERVER_BUNDLE_BASE_URL` 設了但仍打 GitHub | env 注入時機晚於 BAT 啟動 | 確認 env 在 launch BAT 前 export，或寫到 shell rc 後重啟 |

## 相關工單與決策

- **PLAN-031** Server Bundle Distribution（本文件主軸）
  - **拍板項**：D092 (C-narrow + Mac 雙 tarball；「安裝檔內建 baseline」由 D146 推翻) / D146 (安裝檔不內建 baseline，隨需下載 + 匯入，T0547) / D093 (雙 Release tag namespace) / D094 (Mac 280 MB cap) / D095 (`BAT_SERVER_BUNDLE_BASE_URL`) / D096 (Docker 不走 distributor) / D097 (DGX Spark dogfood) / D098 (v0.5.0 升級 UI)
  - **研究**：T0313（7 拍板項輸出）
  - **Spec**：T0314（凝練版，凍結於 `_ct-workorders/_spec-server-bundle-distribution.md`）
  - **實作 + 測試**：T0315-T0323（11 commits）+ T0325（187 unit + integration tests + e2e skeleton）
  - **Dogfood**：T0324（user 親跑）
  - **後續**：T0326（v0.5.0 升級 server UI）
- **BUG-071** Server bundle 安裝 wizard 撞 placeholder（PLAN-031 結案後 CLOSE）
- **PLAN-007** Remote dev support（distribution flow 補完入口；見 [Remote Dev Overview](remote-dev-overview.md)）
- **PLAN-027** Claude runtime selection（server bundle 內含 `@anthropic-ai/claude-code`，沿用 `DISABLE_AUTOUPDATER=1` env 注入）

完整 spec：`_ct-workorders/_spec-server-bundle-distribution.md`（含 §3 三層 lookup 細節 / §6 build pipeline / §7 IPC contracts / §8 cache + rate limit / §9 manifest schema 完整版）。
