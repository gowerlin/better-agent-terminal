# T0295 — Fix PLAN-007 build-server-bundle 安全強化（F-002 + F-003 合併修）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0295 |
| 類型 | fix（v0.4.0 release blocker） |
| Phase | PLAN-007 release prep — fix chain 第 2 張 |
| 狀態 | ✅ DONE 2026-04-26 — fix commit `4b5db1e`（~5 min wall, +35 net, 10/10 AC）;metadata drift 在 session 32 *sync 時補回 |
| 建立時間 | 2026-04-26 17:30 (UTC+8) |
| 派發時間 | （待派） |
| 完成時間 | （待） |
| Wall time | （待） |
| Sizing | M（GP099 校準後預期 wall 10-20 min — sha 邏輯重構 + SHASUMS 下載驗證 + 測試） |
| 依賴 | T0294 ✅、T0292 review F-002 + F-003 |
| 後續 | T0296（SSH argv 一致性） → T0297（launchd plist） → T0298（re-review） |
| 工作目錄 | **main repo**，branch **`release/v0.4.0`** |
| Renew 次數 | 0 |
| 互動旗標 | `--mode yolo --no-interactive`（fire-and-forget） |
| `affects_files` | `scripts/build-server-bundle.mjs`、`scripts/_bat-server-helpers.mjs`（可選，sha helper 重用）、`scripts/verify-server-bundle.js`（可能擴 SHASUMS check） |

## 目標

修復 T0292 兩個 Critical findings：

- **F-002**（README sha 不一致）：流程「tar → 算 sha → 寫 README → 再 tar」造成 README 內 sha 與實際 bundle sha 永遠不同
- **F-003**（Node binary 無 SHASUMS 驗證）：從 nodejs.org 下載 node binary 直接打包，無 checksum，CDN/DNS 攻擊面

## 範圍

### 修改 `scripts/build-server-bundle.mjs`

1. **F-002 修法**（採用 spec 推薦選項 1：不在 README 內寫 sha）
   - **原流程**：
     ```js
     // 第一次 tar
     const tarPath = await packTarball(stagingDir)
     const sha = await sha256File(tarPath)
     // 寫 sha 到 staging/README.md
     await fs.writeFile(path.join(stagingDir, 'README.md'), `... sha256: ${sha} ...`)
     // 第二次 tar（含修改後的 README）
     const finalTarPath = await packTarball(stagingDir)
     const finalSha = await sha256File(finalTarPath)  // 與 README 內 sha 不同！
     ```
   - **新流程**：
     ```js
     // README 不再寫 sha；改寫 build metadata（version / target / built-at）
     await fs.writeFile(path.join(stagingDir, 'README.md'), `bat-server bundle\n\nVersion: ${version}\nTarget: ${target}\nBuilt at: ${new Date().toISOString()}\nNode: ${nodeVersion}\n\nSee release notes for SHA-256 checksum.`)
     // 一次 tar，一次 sha
     const tarPath = await packTarball(stagingDir)
     const sha = await sha256File(tarPath)
     summary.sha256 = sha  // 真實 bundle sha
     ```
   - sha 透過 `summary.sha256` 回報給 caller（CI workflow 可寫到 GitHub Release body）
2. **F-003 修法**（補 SHASUMS 驗證）
   - 在 `provisionNodeBinary(target)` 內：
     ```js
     async function provisionNodeBinary(target, nodeVersion) {
       const tarballName = nodeTarballName(target, nodeVersion)
       const baseUrl = `https://nodejs.org/dist/v${nodeVersion}`

       // 1. 下載 SHASUMS256.txt
       const shasumsUrl = `${baseUrl}/SHASUMS256.txt`
       const shasumsText = await fetchText(shasumsUrl)

       // 2. parse 期望 sha
       const line = shasumsText.split('\n').find(l => l.endsWith(`  ${tarballName}`))
       if (!line) throw new Error(`SHASUMS missing entry for ${tarballName}`)
       const expectedSha = line.split(/\s+/)[0]
       if (!/^[a-f0-9]{64}$/.test(expectedSha)) {
         throw new Error(`SHASUMS line malformed for ${tarballName}: ${line}`)
       }

       // 3. 下載 tarball + 算 sha
       const archivePath = path.join(cacheDir, tarballName)
       await downloadFile(`${baseUrl}/${tarballName}`, archivePath)
       const actualSha = await sha256File(archivePath)

       // 4. 比對
       if (actualSha !== expectedSha) {
         throw new Error(
           `Node binary checksum mismatch for ${tarballName}:\n` +
           `  expected: ${expectedSha}\n` +
           `  actual:   ${actualSha}`
         )
       }

       // 5. 解壓 + 拷貝（與既有邏輯相同）
       ...
     }
     ```
   - **GPG 簽章驗證 v1 暫不做**（SHASUMS 已是大幅安全提升；GPG 留 v0.4.1）

### 新增測試（如可能）

3. **`tests/build-server-bundle.test.ts`**（新建，可選）
   - 用 mock fetch 模擬 SHASUMS256.txt
   - test1：sha match → 正常
   - test2：sha mismatch → throw
   - test3：SHASUMS 缺對應 entry → throw
   - test4：malformed SHASUMS line → throw
   - **若 test infra 過於複雜（real fetch / fs cache），可改為「retrofit 後手動跑 build:server-bundle:linux-x64 + 觀察 console」 manual 驗證 + 在 commit message 標明**

### Out of scope（不做）

- ❌ 不引入 GPG 簽章驗證（v0.4.1 patch）
- ❌ 不修 baseline BUG-061
- ❌ 不擴展 v0.4.1 backlog
- ❌ 不改 `verify-server-bundle.js` 整體結構（只在必要時加 SHASUMS-related check）
- ❌ 不動 native module 複製邏輯（與 F-002/F-003 無關）
- ❌ 不重寫 packTarball / fetchText / sha256File / downloadFile 既有 helpers

## 前置條件 / 參考文件

| 文件 | 用途 |
|------|------|
| `_ct-workorders/T0292-review-report.md` F-002 + F-003 | Critical 詳情 + 建議修法 + 複現步驟 |
| `scripts/build-server-bundle.mjs` 現況 | provisionNodeBinary + packBundle 既有實作 |
| `scripts/_bat-server-helpers.mjs` 現況 | downloadFile / sha256File / fetchText 等 helper |
| `scripts/verify-server-bundle.js` 現況 | 既有 verify pipeline |

## AC（驗收條件）

| # | 條件 | 驗收方式 |
|---|------|---------|
| AC1 | F-002 修：README 內**不再含** sha256 字串；只含 version / target / built-at / node 等 build metadata | grep + 跑 build 觀察輸出 |
| AC2 | bundle sha 一致：`tar tzvf bundle | grep README` 後解出的 README 不含 sha；`sha256sum bundle` = summary.sha256 回報值 | 手動驗證 + commit body 記錄 |
| AC3 | F-003 修：`provisionNodeBinary` 下載 SHASUMS256.txt + 比對；mismatch → throw 明確錯誤訊息 | grep + 跑指令 |
| AC4 | SHASUMS missing entry / malformed line → throw（不 silent fall through） | grep |
| AC5 | error message 含「expected / actual / tarball name」三項資訊（debugging friendly） | grep |
| AC6 | 既有 `npm run build:server-bundle:linux-x64` 仍能成功跑通（未破 happy path） | 跑指令 |
| AC7 | summary.sha256 回報的是真實 bundle sha（與 `sha256sum dist-server/*.tar.gz` 一致） | 跑指令比對 |
| AC8 | TypeScript baseline error count drift = 0（純 .mjs 改動） | 跑 tsc 確認 |
| AC9 | git diff stat：scripts/ 受影響檔 ≤ 100 lines net add | 計算 |
| AC10 | 新建 test（若有）全綠；或 commit body 記錄手動驗證步驟 | 跑指令 / 視覺 review |

## 守則（嚴格）

1. **工作分支**：main repo cwd，**`release/v0.4.0`** branch
2. **commit message**：`fix(build): T0295 build-server-bundle SHA consistency + Node SHASUMS verification (F-002 + F-003)\n\n工單：T0295\n依賴：T0292 F-002 + F-003\n修：(1) README 不再寫 sha 避免循環；(2) Node binary SHASUMS256.txt 驗證`
3. **工單檔不寫**：Worker 嚴禁修改主線 `_ct-workorders/T0295-*.md`
4. **工具白名單**：Read / Edit / Write / Bash（npm/npx/node/git/sha256sum/tar）/ Grep / Glob
5. **emoji**：除錯誤輸出外禁用
6. **fail-fast**：所有 SHASUMS 異常 throw，**不**降級為 warn（攻擊面）
7. **不引入新 dep**：fetch / sha256 用 Node 內建（`https` / `crypto`）
8. **零 regression**：既有 build 流程不破，3 個 platform target（linux-x64/arm64/darwin-arm64）皆應仍可 build
9. **GPG 留 v0.4.1**：本工單不做 GPG 簽章驗證
10. **completion 判定**：10 AC 全過或 ≥ 8 → `T0295 完成`

## 預期 wall

**10-20 min**（GP099 校準後；F-002 是邏輯重組（不寫 sha 到 README）相對簡單；F-003 是新增 SHASUMS 下載 + 解析 + 驗證 ~30 行；測試可選）

## 工單回報區

（Worker 完成後在此補回報；塔台會在收到「T0295 完成」訊息後從本檔讀回報區）
