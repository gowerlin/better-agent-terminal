---
schema_version: 1
schema_kind: workorder
id: T0945
title: "正式版 workflow `release.yml` 對齊 `pre-release.yml`：沒有 Apple 簽章 secret 時略過簽章步驟、補 Windows cleanup 與 native module 檢查（發 `v0.8.0` 前）"
type: fix
status: PENDING
repo: better-agent-terminal
priority: P1
sizing: S
created_at: "2026-11-27T19:26:03+08:00"
updated_at: "2026-11-27T19:26:03+08:00"
target_version: "0.8.0"
depends_on: []
related:
  - "D423；使用者 2026-11-27：「0.8.0 正式版」。本 fork 從未跑過 `release.yml`（`gh run list --workflow release.yml` 為空），repo 沒有任何 Actions secret；最後一個正式版 tag 是 `v0.5.8`"
affects_files:
  - _ct-workorders/T0945-release-workflow-align-for-080.md
  - .github/workflows/release.yml
  - scripts/__tests__/
  - docs/agent-guide/release.md
  - docs/agent-guide/packaging-release-checks.md
memory_overrides:
  - "🔴 分支：只在 `ct/T0945` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。🔴 不得 push tag、不得 `gh workflow run`、不得建 release（發版由塔台做）。"
  - "🔴 問題：`release.yml`（push `v*` tag 觸發）與 `pre-release.yml`（`workflow_dispatch`，`v0.8.0-pre.1`–`pre.9` 都成功）已經分岔。塔台比對 step 名稱看到：① release 的 mac job 有「Import Code Signing Certificate」（`secrets.APPLE_CERTIFICATE_P12` 以 base64 解碼後 `security import`）與「Verify Apple notarization credentials」，`Package for macOS` 帶 `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID`；本 repo 沒有這些 secret，空檔案的 `security import` 必定失敗 → mac build 失敗 → `release` job 不跑（tag 已推、沒有 release）。② pre-release 有「Windows cleanup (avoid EPERM locks)」與「Verify required native modules present」（`node scripts/verify-native-modules.js`），release 沒有。"
  - "🔴 規格：讓 `release.yml` 在**沒有** Apple secret 時，mac 打包與 `pre-release.yml` 行為相同（不匯入憑證、不驗證 notarization、`Package for macOS` 不帶空的 `APPLE_*` env），**有** secret 時維持現有簽章 / notarize 行為。做法：step 不能直接在 `if:` 讀 secrets → 用 job 或 step 層 env（例 `HAS_MAC_CERT: ${{ secrets.APPLE_CERTIFICATE_P12 != '' }}`）再以 `if: env.HAS_MAC_CERT == 'true'` 判斷，或等效寫法；`Package for macOS` 拆成有 / 無 secret 兩個互斥 step 或等效。補上 ② 的兩個 step（位置、內容與 `pre-release.yml` 相同）。"
  - "🔴 全文比對：逐段比對兩個 workflow 的 build / verify / release 步驟（不只 step 名稱），列出所有差異並分成「刻意不同」（觸發方式、從 tag 解版號、`prerelease: contains(github.ref, '-pre')`、release 名稱、Homebrew / Chocolatey opt-in、tag 由 push 而來）與「漂移」；漂移一律照 `pre-release.yml` 對齊。差異表寫進回報區。🔴 不改 `pre-release.yml`、`tests.yml`、`desktop-build.yml`；不改 Homebrew / Chocolatey 的 opt-in 條件；不改版號解析（`v0.8.0` → `0.8.0`）；`server-bundle-v<版號>` 發佈 step 保留。"
  - "🔴 驗證：YAML 解析（兩個 workflow 都能解析）；能取得 actionlint 就跑（例 `go run` / 下載官方 binary 到 scratchpad；取不到就寫明）；若加了 source guard 測試（建議：`scripts/__tests__/` 一支測試讀兩個 workflow，斷言 release 的 mac 簽章步驟有 secret 條件、兩邊都有 verify-native-modules / Windows cleanup），worktree `npm ci` 後 `npm run test:unit` 在 head 第一次完整執行全綠（附數字）。無法實跑 workflow：在回報區寫「發 `v0.8.0` 時塔台要看的 step」。"
  - "🔴 文件：`docs/agent-guide/release.md` 補一段「正式版 workflow 與 pre-release 的差異、Apple secret 有無的行為」（T0945）；CLAUDE.md「Release」節不用改，除非必守規則改變。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：程式、註解、測試資料、回報區不寫真名、客戶名、外部專案名、家目錄路徑，不寫 secret 值。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
---

# T0945 — `release.yml` 對齊，準備發 `v0.8.0`

## 背景

使用者決定下一版發 `0.8.0` 正式版。正式版走 `release.yml`（push `v0.8.0` tag 觸發），但本 fork 從未跑過它；它的 macOS 步驟需要 Apple 簽章 secret，repo 沒有設定，照現況推 tag 會讓 macOS 打包失敗、整個發版不產生 release。另有兩個 pre-release 已有、release 沒有的檢查步驟。

## 範圍

- 沒有 Apple secret 時略過簽章 / notarization（與 pre-release 相同），有 secret 時照舊。
- 補 Windows cleanup、verify-native-modules。
- 兩個 workflow 全文比對，漂移照 pre-release 對齊；差異表寫回報區。

## 不做

- 不推 tag、不跑 workflow、不建 release；不改 pre-release / tests / desktop-build；不改 Homebrew / Chocolatey 條件。

## 驗收

- [ ] 沒有 secret 時 mac 步驟與 pre-release 相同；有 secret 時行為不變
- [ ] Windows cleanup、verify-native-modules 已補
- [ ] 差異表（刻意 / 漂移）
- [ ] YAML 解析＋ actionlint（可取得時）；新增測試時 `npm run test:unit` 全綠
- [ ] docs/agent-guide/release.md 補段落

---

## 回報區

（Worker 填寫）
