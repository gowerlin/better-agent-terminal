# Release

> 從 CLAUDE.md「Release」節搬出（T0595）。本檔為該節完整原文；CLAUDE.md 該節保留用途、必守規則、唯一實作位置與本檔連結。

> 以下依 `.github/workflows/*.yml` 實際內容核對（2026-09-02，CP-T0362）。行號皆指該 workflow 檔本身；
> 與 `_ct-workorders/_local-rules.md`「Release 流程實況」同源。

| 線 | workflow | 觸發 | tag 從哪來 |
|----|----------|------|-----------|
| 正式版 | `release.yml` | `on: push: tags: ['v*']`（:3-6） | 本機 `git tag vX.Y.Z && git push origin vX.Y.Z`；CI 由 `GITHUB_REF` 反解版號（:15-23） |
| 預覽版 | `pre-release.yml` | **`workflow_dispatch` only**（:3-9）—— push tag **不會**觸發它 | 不 push tag；tag 由 release step 的 `tag_name` 建立（:252-257） |

預覽版發布指令：

```bash
gh workflow run pre-release.yml -R gowerlin/better-agent-terminal -f version=X.Y.Z-pre.N
```

- 🔴 **`gh` 一律帶 `-R gowerlin/better-agent-terminal`**：本 repo 有 3 個 remote（`origin`=gowerlin / `upstream`=tony1223 / `scandnavik`），`gh` 預設解析到 **upstream**。不帶 `-R` 時唯讀操作報 404，寫入操作（`gh release create` / `gh pr create`）則是打到別人的 repo。
- 只 build、不發布（T0783 / D223）：`desktop-build.yml`（`workflow_dispatch` only，輸入 `ref` / `version`，預設 `0.0.0-exp.<run number>`）在任一分支 / commit 打三平台安裝檔，只上傳 workflow artifact（7 天）。🔴 **不是發版線**：不建 tag、GitHub Release、`server-bundle-v*`，不部署 Pages，不動 Homebrew / Chocolatey，`permissions: contents: read`；版號不得用 `X.Y.Z-pre.N`。試做分支用它，不要拿 `pre-release.yml` 試做。細節見 [packaging-release-checks.md](packaging-release-checks.md)「只 build、不發布的桌面 workflow」。
- 🔴 **`-f version=` 不可留空**：留空會走自動遞增 —— `git tag -l 'v*' --sort=-v:refname | head -n1` → patch +1 → 找未使用的 `-pre.N`（`pre-release.yml:34-55`）。本 repo 有 **257 個 `v*` tag**，橫跨 `v0.x`（本 fork 主線）/ `v2.2.x` / `v4.0.x` 三條版本線，`-v:refname` 排序第一名是 **`v4.0.3-pre.1`**，留空即產出 `4.0.4-pre.1`，與主線完全脫節。判版方式：取**本 fork 主線（`v0.x`）**最新 tag 遞增，不要信排序第一名。

# 正式版 workflow 與 pre-release 的差異、Apple secret 有無的行為（T0945）

`release.yml` 的建置步驟與 `pre-release.yml` 相同，只有下列地方刻意不同；其餘一律照 `pre-release.yml`，由 `scripts/__tests__/release-workflow-alignment.test.mjs` 逐 step 比對守住（改其中一個 workflow 的 build / release 步驟時兩邊一起改，否則 `test:unit` 失敗）：

| 項目 | `release.yml` | `pre-release.yml` |
|---|---|---|
| 觸發 | push `v*` tag | `workflow_dispatch`（`version` 輸入） |
| 版號 | 從 `GITHUB_REF` 去掉 `refs/tags/`、`v`（`v0.8.0` → `0.8.0`）；`build-version.js` 的 `VERSION` 用 `needs.prepare.outputs.tag` | 輸入值或自動遞增；`VERSION` 用 `v${{ needs.prepare.outputs.version }}`（兩者值相同） |
| GitHub Release step | `Create Release`：tag 是推上來的那個，名稱預設為 tag，`prerelease: contains(github.ref, '-pre')` | `Create Pre-Release`：由 step 以 `tag_name` / `target_commitish` 建 tag，名稱 `<tag> (Pre-Release)`，恆 `prerelease: true` |
| Homebrew tap / Chocolatey | opt-in（見下節） | 沒有 |
| macOS 簽章 | 見下表 | 沒有（ad-hoc 簽章、未公證） |

macOS 簽章依 repo secret `APPLE_CERTIFICATE_P12` 是否存在（build job 的 `env.HAS_APPLE_CERT`，只記 `true` / `false`、不含值；step 的 `if:` 不能直接讀 `secrets`）：

| | 沒有 `APPLE_CERTIFICATE_P12`（本 fork 目前） | 有 |
|---|---|---|
| `Import Code Signing Certificate`（keychain 匯入，另用 `APPLE_CERTIFICATE_PASSWORD`） | 略過 | 執行 |
| `Verify Apple notarization credentials` | 略過 | 執行（`notarytool history`，失敗不擋） |
| 打包 | `Package for macOS`：與 `pre-release.yml` 同一個 step，不帶任何 `APPLE_*` env → ad-hoc 簽章、electron-builder 跳過公證 | `Package for macOS (signed, notarized)`：帶 `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID`，以 `package.json` `build.mac.identity` 簽章並公證（T0945 前的行為） |

- T0945 前 keychain 匯入沒有條件：沒有 secret 時解碼出空檔、`security import` 失敗 → mac build 失敗 → `release` job 不跑（tag 已推、沒有 GitHub Release、沒有 `server-bundle-v<版號>`）。本 fork 在 `v0.8.0` 前從未跑過 `release.yml`。
- T0945 同時補上 `pre-release.yml` 已有的 `Windows cleanup (avoid EPERM locks)` 與 `Verify required native modules present`，並把三個 upload step、`Display downloaded files` 的名稱對齊、移除 `release` job 內沒人用的 `Extract version from tag`（`choco` job 自己那份保留）。
- 發正式版時看的 step：mac job 應顯示兩個簽章 step 與 `Package for macOS (signed, notarized)` 為 skipped、`Package for macOS` 執行；Windows job 有 `Windows cleanup` 與 `Verify required native modules present`；`release` job 的 `Create Release`（`prerelease` 為 false）與 `Create server bundle release` 都成功；`Update Homebrew tap` 與 `choco` job 為 skipped。

# prerelease 標記與下游發佈

| 行為 | `release.yml`（正式版線） | `pre-release.yml`（預覽版線） |
|------|--------------------------|------------------------------|
| GitHub Release `prerelease` | `contains(github.ref, '-pre')` —— tag 含 `-pre` 才標 Pre-release（:267） | **恆為 `true`**（:277） |
| Homebrew tap | **opt-in，預設跳過**（D137）：repo variable `HOMEBREW_TAP_REPO`（tap repo `owner/name`）有值**且** tag **不含** `-pre` 時才 `repository-dispatch` 到該 repo，需 secret `TAP_GITHUB_TOKEN`（:298-308）。T0476 前寫死上游 `tonyq-org/homebrew-tap` | **完全沒有此 step** |
| Chocolatey push | **opt-in，預設跳過**（D137）：repo variable `CHOCOLATEY_PUBLISH == 'true'` **且** tag **不含** `-pre` 時才跑 `choco` job，需 secret `CHOCO_API_KEY`（:310-369）。chocolatey.org 上 package id `better-agent-terminal` 的 owner 為上游；T0476 已移除過期的日期 gate | 無 |
| `server-bundle-v<版號>` release（D120） | 恆發佈、恆 `prerelease: true`（:277-296，接在 desktop release step 後、Homebrew 前） | 恆發佈、恆 `prerelease: true`（:285-304） |

⇒ 走 `release.yml` 打 `v0.5.9-pre.1` 這種 tag 一樣會被標成 Pre-release 且不動 Homebrew / Chocolatey；正式版 tag 在未設定上述 repo variable 時同樣不動這兩個下游通道；但預覽版的建議路徑仍是 `pre-release.yml`（免 push tag、版號可控）。

# Server bundle 是獨立 tag 線

`build-server-bundle.yml` 有**三個**觸發條件（:3-9）：`workflow_dispatch`、push 到 `feature/plan-007-remote-dev` 分支、以及 `server-bundle-v*` tag。但其 release job 另有 `if: startsWith(github.ref, 'refs/tags/server-bundle-v')` 閘門（:133），⇒ **只有 tag 那條會真的發佈**，分支 push 僅建置不發佈。產出恆 `prerelease: true`（:160）。此即上方「Server bundle baseline（PLAN-031）」節所指的獨立線。

注意「解耦」的精確意思：`release.yml` / `pre-release.yml` 內各自另有 `server-bundle` job（`release.yml:25-70`）在 desktop 發布時就地重建 bundle（D146 / T0547 前也打進安裝檔；之後只供 `Create server bundle release` 發佈）。解耦指的是 **baseline tarball 的獨立發佈線**，不是 desktop 流程完全不碰 server bundle。

**自 D120（T0365）起，desktop 線也會發佈 `server-bundle-v<版號>`**：`release.yml` / `pre-release.yml` 的 `release` job 在 desktop release step 成功後，接一個 `Create server bundle release` step，把同 run 的 `server-bundle-baseline` artifact（3 arch × `.tar.gz` + `.sha256` + `manifest.json`）以 `server-bundle-v${{ needs.prepare.outputs.version }}` 發成 prerelease，target 為 `github.sha`（與 desktop release 同 commit）。build 失敗時 `release` job 不會跑，不會留下孤兒 server-bundle release。D146 起安裝檔不內建 baseline，這個 release 是 wizard 首次下載的唯一官方來源，**不可省略**；`release` job 因此 `needs` `server-bundle-manifest`（T0547）。runtime 下載的預設來源為 `gowerlin/better-agent-terminal`。
- 該 tag 由 `GITHUB_TOKEN` 建立，依 GitHub 規則**不會**再觸發 `build-server-bundle.yml` 的 `server-bundle-v*` tag 觸發條件，不會重複建置。
- `build-server-bundle.yml` 手動推 tag 線**保留為備援**（例如 desktop run 的 server bundle step 失敗需補發）。同一版號不要兩條線都發。
