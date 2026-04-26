# T0290 — Impl PLAN-007 Phase 5 Documentation + Release Checklist 更新

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0290 |
| 類型 | impl（docs only，無 production runtime code） |
| Phase | PLAN-007 Phase 5（整合測試 + UX polish）第三張 |
| 狀態 | 📋 TODO |
| 建立時間 | 2026-04-26 16:15 (UTC+8) |
| 派發時間 | （待派） |
| 完成時間 | （待） |
| Wall time | （待） |
| Sizing | M（spec 估 4-8h；GP099 Phase 4-5 校準後預期 wall 15-30 min — 純 docs 工作） |
| 依賴 | T0276（WSL e2e + docs/wsl-deployment.md ✅）、T0280（Docker e2e + docs/docker-deployment.md ✅）、T0287（SSH e2e + docs/ssh-deployment.md ✅）、T0288（C-7 ProfilePanel）、T0289（rollback contract） |
| 後續 | T0291 e2e smoke + migration verification（Phase 5 收尾） |
| 工作目錄 | `../bat-plan-007`（worktree on `feature/plan-007-remote-dev`） |
| Renew 次數 | 0 |
| 互動旗標 | `--mode yolo --no-interactive`（fire-and-forget） |
| `affects_files` | `docs/plan-007-release-checklist.md`（新建）、`docs/remote-dev-overview.md`（新建，跨 4 environment 統一入口）、`docs/wsl-deployment.md`（既有，更新）、`docs/docker-deployment.md`（既有，更新）、`docs/ssh-deployment.md`（既有，更新）、`CHANGELOG.md`（unreleased section）、`README.md`（mention remote dev support） |

## 目標

PLAN-007 Phase 5 docs 收尾：

1. 整合 3 個 deployment 文件（WSL / Docker / SSH）為統一入口
2. 寫 release checklist（給 release engineer 用）涵蓋 4 environment 的 pre-flight 驗收
3. 補 unreleased CHANGELOG（v0.4.0 候選）
4. README 加 remote dev support 簡介 + 連結到細節文件

## 範圍

### 新增

1. **`docs/remote-dev-overview.md`** — 跨 environment 統一入口（150-300 行）
   - 章節：
     - **What is BAT remote dev support**：BAT terminal client 在 host 跑，agent 透過 client/server 拆分在不同環境執行（local / WSL / Docker / SSH-linux / SSH-darwin）
     - **Comparison table**：4 environment 對照（Setup time / Dependencies / Network 需求 / Best for）
     - **Choosing your deployment**：決策樹引導（先看本機 OS → 看 server 位置 → 看 NAT → 看 user 偏好）
     - **Common concepts**：targetOS schema / PathTranslator / wss + cert pinning / setup wizard / rollback chain
     - **Troubleshooting cross-cutting**：connection lost / fingerprint mismatch / profile schema migration
     - **Links**：→ wsl-deployment.md / docker-deployment.md / ssh-deployment.md
   - 對齊 spec doc structure（避免重複，主要做交叉索引）
2. **`docs/plan-007-release-checklist.md`** — release engineer pre-flight checklist（200-400 行）
   - 章節：
     - **Pre-release verification（automated CI）**：
       - desktop release workflow 通過（pre-release.yml）
       - server bundle workflow 通過（build-server-bundle.yml，3 platform matrix）
       - Native module verification（`verify-native-modules.js` + `verify-server-bundle.js` 全綠）
       - Helper bundle verification（`verify-helper-bundle.js`）
       - All test green：unit + contract + e2e mock + cross-deployment rollback
     - **Pre-release verification（manual）**：
       - **WSL real e2e**：Win 11 23H2+ + Ubuntu 22.04 + systemd → wizard 9 step + 連線 + 斷線重連
       - **Docker real e2e**：Docker Desktop / colima → wizard + 連線 + container restart
       - **SSH real e2e**：linux-x64 / linux-arm64 / darwin-arm64 server 各一輪 happy path + 1 cross-OS（Win client → linux server）
       - **Migration verification**：legacy remote profile（pre-PLAN-007）載入時不誤判 + UI inline 提示 + 編輯後正確補 targetOS
       - **Profile schema migration**：load 時 type='local' 自動補 targetOS='local'；type='remote' 留 undefined 走 IdentityTranslator
       - **rollback contract**：故意 fail wizard 中段 step → 驗證 install path cleanup + profile 未寫入
     - **Release prep**：
       - bump version（`package.json` + `electron/version-info.ts` 等同步點）
       - CHANGELOG 整理 unreleased → v0.4.0
       - tag + push trigger GitHub Actions
       - artifact verification（NSIS / dmg / zip / server-bundle 三 platform）
       - Homebrew tap 更新（若是非 prerelease）
     - **Post-release smoke**：
       - 使用者實機重裝 + 開 wizard + 連線 + 派工單
       - GitHub release notes 校對
   - **Sign-off** template
3. **`CHANGELOG.md`** unreleased section 更新
   - **Added**：
     - PLAN-007 Phase 1-5 完整實作（local / WSL / Docker / SSH 四環境）
     - SSH deployment（key-based auth + tunnel mode + linux/darwin server matrix）
     - Setup wizard rollback contract（best-effort，C-3 落地）
     - ProfileCard UI（C-7 落地）
     - Server bundle CI workflow（獨立於 desktop release）
   - **Changed**：
     - ProfilePanel 重構為列卡片 + per-env details slot
     - PathTranslator framework（IdentityTranslator + 4 個 env-specific translator）
     - RemoteClient middleware 加 ssh tunnel chain hook
   - **Fixed**：
     - BUG-060（YOLO 鏈式 shell preference）— session 31 fix `fad2978`
   - **Known issues**：
     - BUG-061（CodexAgentPanel.tsx baseline tsc errors，dev-only，不影響 runtime）

### 修改

4. **`docs/wsl-deployment.md`**（既有，T0276 產出）
   - 補章節：「rollback chain」（指向 wizard-runner rollback contract）
   - 補章節：「ProfilePanel 中編輯 WSL profile」（C-7 ProfileCard 入口指引）
   - 加 cross-link to remote-dev-overview.md
5. **`docs/docker-deployment.md`**（既有，T0280 產出）
   - 同上補 rollback / ProfilePanel / cross-link
6. **`docs/ssh-deployment.md`**（既有，T0287 產出）
   - 同上補 rollback / ProfilePanel / cross-link
7. **`README.md`**
   - 在「Features」section 加「Remote dev support — work with WSL / Docker / SSH (Linux/macOS) servers from a single BAT instance」
   - 連結到 `docs/remote-dev-overview.md`

### Out of scope（不做）

- ❌ 不寫 i18n 翻譯（英文主，繁中標 future）
- ❌ 不寫教學 video / GIF（純文字 docs）
- ❌ 不擴 docs/_meta.json（VitePress 結構，Phase 5+ 之後再整合）
- ❌ 不動實際 release script / CI workflow（純 docs）
- ❌ 不真跑 release（本工單只寫 checklist 不執行）
- ❌ 不修 baseline BUG-061（純 docs 不會碰到）

## 前置條件 / 參考文件

| 文件 | 用途 |
|------|------|
| `docs/wsl-deployment.md`（worktree T0276） | 既有 WSL docs 基底 + 章節結構參考 |
| `docs/docker-deployment.md`（worktree T0280） | 既有 Docker docs 基底 |
| `docs/ssh-deployment.md`（worktree T0287） | 既有 SSH docs 基底 |
| `_ct-workorders/_spec-remote-dev-support-2026-04.md` | spec 全文（用於 cross-cutting 概念章節） |
| `CHANGELOG.md`（worktree） | 既有 changelog 結構 + format 慣例 |
| `README.md`（worktree） | 既有 README structure |

## AC（驗收條件）

| # | 條件 | 驗收方式 |
|---|------|---------|
| AC1 | `docs/remote-dev-overview.md` 存在，含 6 個必要章節（What / Comparison / Choosing / Common concepts / Troubleshooting / Links）；150-300 行 | grep + wc -l |
| AC2 | `docs/plan-007-release-checklist.md` 存在，含 4 個必要章節（Pre-release CI / Pre-release manual / Release prep / Post-release smoke）+ Sign-off template；200-400 行 | grep + wc -l |
| AC3 | `CHANGELOG.md` unreleased section 含 4 個 sub-section（Added / Changed / Fixed / Known issues），記載 BUG-060 fix + BUG-061 known | grep |
| AC4 | 3 個既有 deployment docs（wsl/docker/ssh）皆補「rollback chain」+ 「ProfilePanel 編輯」+ cross-link 章節 | grep 3 個檔 |
| AC5 | `README.md` 含 「Remote dev support」 feature 條目 + 連結到 remote-dev-overview.md | grep |
| AC6 | Comparison table 完整：4 environment × 至少 4 dimension（Setup time / Dependencies / Network / Best for） | grep |
| AC7 | Decision tree 引導：選擇 deployment 的 4 級判斷（OS → server location → NAT → preference） | grep |
| AC8 | release checklist 涵蓋 SSH 跨 OS matrix 的 cross-OS journey（Win client → linux server）作為 manual e2e 必跑項 | grep |
| AC9 | docs 內 markdown link 全部有效（內部連結指向實際 file，不是死連結） | grep + 視覺 review |
| AC10 | TypeScript 不受影響（純 docs）；既有 test 全綠（zero regression） | 跑 `npm test` 確認 |

## 守則（嚴格）

1. **工作分支**：worktree `../bat-plan-007` 內 `feature/plan-007-remote-dev`。
2. **commit message**：`docs(plan-007): T0290 release checklist + remote-dev-overview + 3 env docs cross-link\n\n工單：T0290\n依賴：T0276 / T0280 / T0287 / T0288 / T0289`
3. **工單檔不寫**：Worker 嚴禁修改主線 `_ct-workorders/T0290-*.md`。
4. **工具白名單**：Read / Edit / Write / Bash（git/grep/wc）/ Grep / Glob。
5. **emoji**：除既有 docs 沿用的 ⏳ ✓ ✗ 外禁用。
6. **不重複既有 docs**：remote-dev-overview 為交叉索引型，**不**重抄 WSL/Docker/SSH 細節，連結到既有 docs。
7. **Markdown 風格一致**：沿用既有 docs 的 heading level / table syntax / code block 慣例（grep 既有 file 規格）。
8. **CHANGELOG format**：沿用既有 changelog conventions（Keep a Changelog 1.1.0 風格 if 既有用，or BAT 自有風格）。
9. **不動 source code**：純 docs only，不修 .ts / .tsx 任何檔（README.md 例外，但僅 wording change 不動 build instruction）。
10. **completion 判定**：10 AC 全過或 ≥ 8 → `T0290 完成`，否則 `T0290 部分完成：<AC# + 原因>`。

## 預期 wall

**15-30 min**（GP099 Phase 4-5 校準後；3 個既有 docs 補章節 + 2 個新 docs 寫作 + CHANGELOG/README 微調，純文字工作）。

## 工單回報區

（Worker 完成後在此補回報；塔台會在收到「T0290 完成」訊息後從本檔讀回報區）
