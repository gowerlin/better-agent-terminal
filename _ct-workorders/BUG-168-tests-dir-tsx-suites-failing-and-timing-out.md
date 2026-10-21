---
schema_version: 1
schema_kind: bug
id: BUG-168
title: "tests/ 底下不在 test:unit 的 tsx／node:test 測試：8 檔失敗（29 項）、9 檔逾時；package.json 2 組 script 指向不存在的檔案"
status: OPEN
severity: medium
reproducibility: always
created_at: "2026-10-21T20:15:54+0800"
updated_at: "2026-10-21T20:15:54+0800"
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
| 嚴重度 | 🟡 medium（暫定：多數可能只是測試過時，但 SSH／WSL 的 systemd 相關失敗可能藏著遠端設定的真回歸，分類前先當 medium） |
| 可重現 | 一定 |
| **狀態** | 📂 OPEN（T0679 研究分類中） |
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
