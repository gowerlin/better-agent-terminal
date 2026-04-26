# T0315 — Impl PLAN-031 Server bundle manifest.json 產生 + GitHub Release publish 整合

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0315 |
| 類型 | impl（CI workflow + build script 擴充，無 BAT runtime 改動） |
| 所屬 | PLAN-031 — Server Bundle Distribution / Sprint 2 |
| 狀態 | 📋 TODO |
| 建立時間 | 2026-04-27 01:35 (UTC+8) |
| 派發時間 | 2026-04-27 01:35 (UTC+8) |
| Sizing | M（estimate 30-60 min wall） |
| 依賴 | T0314 ✅（manifest schema + arch-normalize 純函數） |
| 平行 | T0316（electron-builder extraResources） + T0317（SHA256 renderer 校驗模組） |
| 後續 | T0318（runtime download module）— 需要 manifest.json 在 GitHub Release 才有實證 endpoint 可測 |
| 互動旗標 | `--mode yolo --no-interactive`（fire-and-forget；YOLO 鏈式派發中） |
| Renew 次數 | 0 |
| 工作目錄 | main repo（worktree on `feature/plan-007-remote-dev`？評估後決定；本工單預設 main repo，因為 PLAN-031 已不在 PLAN-007 worktree 範圍） |
| `affects_files` | `scripts/build-server-bundle.mjs`（擴 SHA256 sidecar 輸出） / `scripts/generate-server-bundle-manifest.mjs`（新建） / `.github/workflows/build-server-bundle.yml`（新增 manifest job + release job 整合） |

## 背景

T0314 已固化 manifest schema（`_spec-server-bundle-distribution.md` §9）。T0283 build-server-bundle workflow 已有 release job 條件 `startsWith(github.ref, 'refs/tags/server-bundle-v')`，會 publish 3 個 tarball + prerelease 標記，**但缺 manifest.json + SHA256 sidecar**。

本工單在現有 workflow 上補：
1. Build job 收尾把 sha256 從 stdout JSON 寫成 `*.sha256` sidecar 檔，跟 tarball 一起 upload artifact
2. 新增 `manifest` job（依賴 3 個 build job），下載所有 sidecar + tarball metadata，產生 `manifest.json`
3. Release job（已存在）擴 publish 範圍：3 tarball + 3 sidecar + 1 manifest.json（共 7 file）

## 塔台已拍板項（不要再問）

從 T0314 spec 已固化：

- Manifest schema：`schemaVersion: '1'` / `version` / `buildDate` / `tarballs: Record<arch, {filename, sha256, size}>`
- 3 arch：`linux-x64` / `linux-arm64` / `darwin-arm64`
- Release tag：`server-bundle-vX.Y.Z`（D093，雙 Release namespace）
- 不簽章（v1 不做 GPG，HTTPS + GitHub integrity 已足夠）

## 範圍（3 deliverable）

### Deliverable 1：`scripts/build-server-bundle.mjs` 擴 SHA256 sidecar

**目標**：build 完成後，除了 stdout 印 sha256 JSON，再額外寫 `<tarball>.sha256` 同目錄 sidecar 檔。

**格式**：標準 sha256sum 格式（單行）：

```
abc123def456...  bat-server-linux-x64-v0.5.0.tar.gz
```

**必要修改**：
1. Build script 已計算 sha256（從 stdout summary JSON）；在寫 stdout 之後新增 `fs.writeFileSync` 到 sidecar
2. Sidecar 檔名規則：`<tarball-filename>.sha256`，同目錄
3. 失敗處理：若 sidecar 寫失敗（permission / disk full），warn 但**不要 abort**（tarball 已 build 完，sidecar 是衍生）

**驗證**：
- 本機跑 `node scripts/build-server-bundle.mjs --target=linux-x64`（如果 worktree 環境支援）→ 確認產出 `bat-server-linux-x64-v*.tar.gz` + `bat-server-linux-x64-v*.tar.gz.sha256`
- 跑 `sha256sum -c bat-server-linux-x64-v*.tar.gz.sha256` → 必通過
- 若本機環境不支援（缺 native sub-package）→ T0283 已預告 fail-fast；本工單守則 7 預告：build 失敗時直接驗 script logic（dry run 路徑）

### Deliverable 2：`scripts/generate-server-bundle-manifest.mjs`（新建）

**目的**：給 CI workflow `manifest` job 使用。讀取 download artifact dir，產出 manifest.json。

**CLI 介面**：

```bash
node scripts/generate-server-bundle-manifest.mjs \
  --input-dir <path>     # contains 3 tarballs + 3 sidecars
  --version <semver>     # e.g., 0.5.0
  --build-date <iso8601> # e.g., 2026-04-27T00:00:00Z
  --output <path>        # e.g., manifest.json
```

**實作邏輯**：
1. Glob `${input-dir}/bat-server-*-v${version}.tar.gz` → 取得 3 個 tarball path
2. 對每個 tarball：
   - 從檔名 parse arch（`bat-server-(linux-x64|linux-arm64|darwin-arm64)-v...`）
   - 讀對應 `.sha256` sidecar 檔，取 hash hex（split whitespace 取第一段）
   - `fs.statSync(tarball).size` 取 size in bytes
3. 若 3 個 arch 任一缺失 → exit 1 with clear message（如「Missing tarball for linux-arm64」）
4. 組成 `ServerBundleManifest` JSON 物件（schemaVersion: '1'，依 T0314 spec §9 schema）
5. `JSON.stringify(manifest, null, 2)` 寫到 `--output`
6. 印 stdout summary（`✓ Manifest generated: ${output}, ${tarballCount} tarballs, total ${totalSize} bytes`）

**錯誤訊息原則**：actionable（指出哪個檔案缺、哪個欄位錯），非 stack trace

**單元測試**：可選但建議——`scripts/__tests__/generate-server-bundle-manifest.test.mjs` 用 mock fs 跑 happy path + 1 個 tarball 缺失 case + sidecar 格式錯誤 case

### Deliverable 3：`.github/workflows/build-server-bundle.yml` workflow 整合

**修改現有 workflow**（T0283 已建立）：

#### 改 build matrix job

每個 build job（linux-x64 / linux-arm64 / darwin-arm64）的 `actions/upload-artifact@v4` 步驟：

- 從只 upload tarball → 改 upload tarball + sidecar（兩 file 同 artifact）
- artifact name 不變（`server-bundle-{target}`）

```yaml
- name: Upload artifact
  uses: actions/upload-artifact@v4
  with:
    name: server-bundle-${{ matrix.target }}
    path: |
      dist-server/bat-server-${{ matrix.target }}-v*.tar.gz
      dist-server/bat-server-${{ matrix.target }}-v*.tar.gz.sha256
```

#### 新增 `manifest` job

- 依賴 3 個 build job (`needs: [build-linux-x64, build-linux-arm64, build-darwin-arm64]`)
- runs-on: `ubuntu-22.04`（任何 platform 都可，純 node script）
- Steps：
  1. Checkout
  2. Setup node 24
  3. Download all artifact 到 `staging/`（`actions/download-artifact@v4` 不指定 name）
  4. 把 staging/ 內所有 `*.tar.gz` 與 `*.sha256` 平鋪到 `dist-server/`（`mv staging/*/* dist-server/`）
  5. 跑 `node scripts/generate-server-bundle-manifest.mjs --input-dir dist-server --version <ver> --build-date <iso> --output dist-server/manifest.json`
  6. 跑 `node scripts/verify-server-bundle.js`（既有，T0283 verify 全 3 platform tarball + hard exclude）
  7. Upload artifact `manifest`（含 manifest.json + 所有 tarball + sidecar）
  8. **Version 來源**：從 tarball 檔名 parse（`bat-server-linux-x64-v(.+).tar.gz` regex），不從 git tag（避免 tag mismatch 風險）；build-date 用 `date -u +%Y-%m-%dT%H:%M:%SZ`

#### 改 release job

- 依賴從 `needs: [build-*]` 改為 `needs: [manifest]`（序列化）
- `softprops/action-gh-release` 的 `files` 列：
  ```yaml
  files: |
    dist-server/bat-server-linux-x64-v*.tar.gz
    dist-server/bat-server-linux-x64-v*.tar.gz.sha256
    dist-server/bat-server-linux-arm64-v*.tar.gz
    dist-server/bat-server-linux-arm64-v*.tar.gz.sha256
    dist-server/bat-server-darwin-arm64-v*.tar.gz
    dist-server/bat-server-darwin-arm64-v*.tar.gz.sha256
    dist-server/manifest.json
  ```
- 不改 `prerelease: true` flag（v1 維持 prerelease 標記，等 dogfood 通過再升 stable）
- Tag 命名空間維持 `server-bundle-v*`（D093）

## 驗收條件

- AC-1：`scripts/build-server-bundle.mjs` 修改後 build 流程仍跑通；產出含 `*.tar.gz` + `*.tar.gz.sha256`
- AC-2：sidecar 格式為標準 `sha256sum` 單行（hash + 雙空格 + filename + LF）
- AC-3：`scripts/generate-server-bundle-manifest.mjs` 存在；CLI 介面與本工單一致
- AC-4：對 mock input dir（含 3 tarball + 3 sidecar）跑 generator → 產出合法 JSON 符合 T0314 spec §9 schema
- AC-5：對缺失 tarball / 缺失 sidecar / sidecar 格式錯誤 → 三類錯誤都 exit 1 with actionable message
- AC-6：`.github/workflows/build-server-bundle.yml` 修改後仍是合法 YAML（`yamllint` 或 `actionlint` 跑通）
- AC-7：workflow 改動含 (a) build job upload sidecar (b) 新增 manifest job (c) release job 改依賴 + files
- AC-8：commit 訊息走 `chore(ci): T0315 - <段落>` 格式（建議拆 2 commit：build script + manifest generator / workflow 整合）
- AC-9：本機測試：對 fake `dist-server/` （手動建 3 個 dummy tar.gz + sidecar）跑 manifest generator → 確認輸出符合 schema

## 範圍排除（不在本工單）

- ❌ 不改 BAT renderer / electron / src/（純 CI/build script 範圍）
- ❌ 不簽章 manifest（v1 不做，spec §9 已決議）
- ❌ 不改 desktop release workflow `.github/workflows/pre-release.yml`（spec §6 C-1 解耦原則）
- ❌ 不實作 SHA256 校驗 renderer 模組（T0317 範圍）
- ❌ 不實作 download module（T0318 範圍）
- ❌ 不實際 push tag 觸發 release（CI dry-run 即可，真實 release 等 v0.5.0 時做）

## Worker 守則

1. **CI 不可實際觸發**：本工單修改 workflow 後**不可** push tag `server-bundle-v*` 觸發實際 release publish；改完只 commit + push branch，等 v0.5.0 release 時自然觸發
2. **本機驗證優先**：在改 workflow 前，先確認 `generate-server-bundle-manifest.mjs` 對 mock input 跑通（AC-9）；workflow 改動以 yaml 合法性為主
3. **保守 build script 修改**：T0283 已落地的 build script 邏輯是 release-critical；只新增 sidecar 寫入 logic，不重構既有
4. **失敗處理**：sidecar 寫失敗用 `console.warn` 不 throw（AC 規定）；manifest generator 缺檔則 hard-fail（AC-5 規定）
5. **Version 來源紀律**：manifest job 從**tarball 檔名 parse version**，不從 git tag（避免 tag-only push 場景或 tag rename 時 mismatch）
6. **Workflow 安全**：保留現有 fail-fast 路徑（`verify-native-modules.js` / `verify-server-bundle.js`）；新增的 manifest job 失敗也要讓 release job 跳過
7. **Build 環境限制（沿用 T0283 守則 7）**：worktree 在 Windows 跑 `--target=linux-arm64` / `--target=darwin-arm64` 會缺 native sub-package fail-fast；只跑 linux-x64 即可，arm64/darwin 改動由 CI matrix 自然驗
8. **記憶覆寫**：本工單**沒有** `memory_overrides` 欄位 — 沿用所有現行 GP 規則 + 學習紀錄

## Worker 回報區（Worker 填寫）

### 1. build-server-bundle.mjs 修改摘要

（待填：sidecar 寫入位置、行數、失敗處理寫法）

### 2. generate-server-bundle-manifest.mjs 摘要

（待填：總行數、CLI parse 方式、JSON output 是否符合 schema）

### 3. workflow yaml 修改摘要

（待填：build job upload 變動、manifest job 設計、release job files 列表）

### 4. 本機驗證結果

（待填：AC-9 mock input dir 跑通輸出；如果 sha256 sidecar AC-1 在 worktree 跑得起來也附）

### 5. PARTIAL / 矛盾項（如有）

（待填）

### 完成註記

（待填：commit hashes / wall time / Full DONE）
