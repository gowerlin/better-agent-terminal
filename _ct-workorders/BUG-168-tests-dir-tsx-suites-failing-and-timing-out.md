---
schema_version: 1
schema_kind: bug
id: BUG-168
title: "tests/ 底下不在 test:unit 的 tsx／node:test 測試：8 檔失敗（29 項）、9 檔逾時；package.json 2 組 script 指向不存在的檔案"
status: FIXING
severity: low
reproducibility: always
created_at: "2026-10-21T20:15:54+0800"
updated_at: "2026-10-21T20:29:46+0800"
impact:
  - tests
  - remote-ssh
  - remote-wsl
  - remote-docker
  - wizard
links:
  discovered_in: "T0678 盤點（2026-10-21，只跑不修）"
  related: [BUG-167, T0678, T0679]
---

# BUG-168 — tests/ 底下沒被跑到的測試有失敗與逾時

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（T0679：29 項失敗與 9 個逾時全部是測試過時，沒有產品回歸；原暫定 medium） |
| 可重現 | 一定 |
| **狀態** | ⏳ FIXING（D177）：G2 T0680 `21ce7b79`、G3 T0681 `eaf8c168`、G4 T0682 `5bd04ef4`、CI 第一步 T0683 `a35c4ce3` 皆 DONE（原 29 項失敗與 9 個逾時已全部處理）。剩：ubuntu 試跑與 21 項 Windows 限定測試改跨平台、`test:legacy` 與失效 script 清理（含 G1）、`test:unit` 擋版 |
| 回報者 | T0678 Worker（盤點） |

## 現象

`vite.config.ts` 的 `test.include` 對 `tests/` 只收 5 個 `.mjs`，其餘 41 個可執行測試不在 `npm run test:unit`，CI 也沒跑。T0678 逐一用各自的跑法（`npx tsx <file>` 或 `npx tsx --test <file>`，每檔上限 180 s）執行：24 檔全過，其餘如下。

**有失敗（8 檔，29 項）**

| 檔案 | 通過 / 失敗 | 失敗項目 |
|---|---|---|
| `auth-result-metadata.test.ts` | 5 / 1 | RemoteClient catches pending translator implementations and falls back to Identity |
| `claude-runtime-router.test.ts` | 6 / 5 | T-R1、T-R3、T-R4、T-R5、T-R6 |
| `docker-flow.test.ts` | 2 / 1 | createDockerWizardContext seeds Docker-specific state（期望 9876，實際 undefined） |
| `profile-card.test.ts` | 9 / 4 | DockerDetails mount table、ProfileCard 匯出形式、per-env badge label、SshDetails ssh-linux vs ssh-darwin |
| `ssh-bundle-uploader.test.ts` | 2 / 6 | test1–test4、test5c、test5d |
| `ssh-start-server.test.ts` | 14 / 5 | test1–test4、test8（systemd unit／launchd plist 內容與 ssh 執行順序） |
| `wsl-detect.test.ts` | 9 / 1 | installBundle() rejects relative tarball paths before spawning WSL |
| `wsl-systemd.test.ts` | 3 / 6 | enableLinger ×2、renderSystemdUnit ×2、startService daemon-reload、writeUnit 經 wsl tee stdin |

**逾時（9 檔，180 s 內未完成）**：`docker-flow-journeys`、`docker-wizard-e2e`、`docker-wizard-runner`、`ssh-flow-journeys`、`ssh-wizard-e2e`、`wizard-rollback-cross`、`wizard-runner`（第 1 項通過、第 2 項卡住）、`wsl-flow-journeys`、`wsl-wizard-e2e`。看起來都卡在 `WizardRunner` 的某個步驟。

**失效 script**：`package.json` 的 `test:claude-ctrl-o`（`tests/test-claude-ctrl-o.js`）與 `diagnose:ctrl-o*`（`tests/diagnose-ctrl-o.js`）指向的檔案不存在。

## 塔台初判（推論，待 T0679 證實）

- 多數可能和 BUG-167 一樣是測試沒跟上：遠端安裝腳本共用化與乾淨覆蓋（T0552／T0554）、精靈流程改版、Claude runtime router（PLAN-027）之後，產品行為照工單改了，測試沒改。
- SSH 的 systemd unit／launchd plist 內容、WSL 的 linger 與 unit 寫入，若是測試期望才對，就是遠端設定的真回歸，影響使用者。
- 逾時可能是 mock 沒回應精靈新加的步驟，也可能是測試真的去等外部程序。

## 修正方向

- T0679（研究）：逐項分類「測試過時／產品回歸／測試本身壞／無法判定」，逾時找出卡在哪一步，失效 script 查出檔案何時被刪；提出分組的修正工單與納入 CI 的建議。
- 結論出來後再開修正單；產品回歸各自開單，不和測試過時混在一起。

## 研究結論（T0679，2026-10-21）

- **29 項失敗全部是 (A) 測試過時，沒有產品回歸 (B)**。產品照工單改了，測試沒跟上：WSL translator 已實作（T0273）、內嵌 claude 存在檢查（T0475）、Docker 不預設 port（T0649）、Profile 元件加 i18n hook（T0506／T0652）、安裝根目錄必須絕對路徑（T0552）、systemd unit 改用 `--port` 參數與 `enable` + `restart`（T0511）、linger 先 `id -un`、啟動判定改「穩定 3 秒」（T0378／T0382）。其中 SSH systemd 的舊期望（`BAT_REMOTE_PORT` 環境變數）**本身就是當年的 bug**（T0511 修掉），WSL 的舊測試資料（`~` 路徑的 unit）就是 BUG-087 的錯誤 unit。
- **9 個逾時同一個原因**：共用 mock 少了後來新增的 IPC（`resolveHome`、`pickServerPort`、`update.getVersion`、SSH 驗證 tunnel），步驟失敗後精靈停在「等使用者選重試／略過／取消」，測試沒有人按，所以卡住。沒有真的計時器、子程序或外部服務。補完 mock 後 Docker 三檔全過；WSL／SSH 還要補 i18n 初始化與 tunnel mock；`wizard-rollback-cross` 的 wsl 那項有 1 個斷言要用正確 mock 重跑才能判定（D）。
- **失效 script 有 3 組 5 個**（多一組 `test:file-drag`，檔案從沒 commit 過），建議全刪。
- **CI 完全沒跑 `npm run test:unit`**：四個 workflow 只有 typecheck，vitest 的 322 檔、5,664 項也不在 CI（塔台已確認）。
- 旁支：`electron/__tests__/pty-manager-helper-env.test.ts` 兩項斷言沒先清 `BAT_HELPER_LOG_DIR`，shell 有設這個變數時會失敗（測試隔離問題）；`wsl-systemd.ts` 解析使用者失敗時用 `error.message` 而不是 `describeError`（診斷資訊小缺口，不是回歸）。
- 建議分組（T0679 回報區有完整表）：G1 刪失效 script（XS）、G2 單元測試跟上產品（S；profile-card 搬到 vitest + RTL 則 M）、G3 SSH／WSL 舊測試與 vitest 版去重（S–M）、G4 精靈 mock 補齊並加防卡死（M，可拆 Docker／WSL／SSH）、G5 納入 CI（短期新增 `test:legacy` + 在 CI 跑 `test:unit`，長期收斂到 vitest）。
