# T0341 — PLAN-032 Sprint 5 audit: docs polish + visual snapshot 補完 + v0.4.2 release notes 草稿

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0341 |
| 標題 | PLAN-032 Sprint 5 收尾：DESIGN.md / spec / FIELDGUIDE 對齊 + 6 個 mapped error visual snapshots + v0.4.2 release notes 草稿（不 bump） |
| 類型 | audit + docs |
| 優先級 | 🟢 Low（PLAN-032 收尾票，無功能影響） |
| 狀態 | 🚧 IN_PROGRESS |
| 建立時間 | 2026-04-28 09:08 (UTC+8) |
| 開始時間 | 2026-04-28 09:20 (UTC+8) |
| 派發模式 | `--mode yolo --no-interactive` |
| 關聯 PLAN | PLAN-032（Sprint 5 收尾） |
| 關聯 spec | `_ct-workorders/_spec-wizard-error-ux.md` |
| 關聯研究 | T0328（拆單，原列為 T0340，本票實際使用 T0341 編號 — 因 T0339/T0340 皆順延） |
| 依賴 | T0338-T0340 全 ✅ |
| 預估時間 | 30-90 min（S/M） |
| Renew 次數 | 0 |
| affects_files | `src/components/setup-wizard/__tests__/SetupWizardShell.test.tsx`（補 5 個 visual snapshots 對齊 T0334 docker daemon 既有 1 個 = 共 6 個 mapped error panels）、`docs/design/wizard-error-ux.md`（最終對齊 spec + Sprint 2-4 落地實況）、`docs/design/bat-stepper-design-language.md`（必要時 cross-link）、`CHANGELOG.md`（新增 v0.4.2 release notes 草稿，**不**改 package.json 版號） |

## 編號註記

- T0328 拆單表原列「T0340 = Sprint 5 audit」，但 T0339（BUG-076 fix）+ T0340（Sprint 4 input rollout）順延後，本票編號為 **T0341**。
- PLAN-032 metadata 表將在本票 DONE 後由塔台統一同步全部編號順延說明。

## 背景

PLAN-032 已完成 Sprint 2 (5 工單)、Sprint 3 (3 工單)、Sprint 4 (1 工單)、Sprint 5 (T0338 整合測試 + T0339 BUG-076 fix)。本票是最後一張收尾，做三件事：

1. **docs polish**：spec 與實際落地對齊，DESIGN.md / FIELDGUIDE-mode 視覺規範補對齊，避免後人接手時 spec / impl drift
2. **visual snapshot 補完**：T0334 只補了 docker daemon 一個 SetupWizardShell render snapshot，剩 5 個 registry entries 也應該各補一個（鎖 visual regression）
3. **release notes 草稿**：把 PLAN-032 整 plan 的對外影響寫成 v0.4.2 candidate changelog，不 bump 版號（留 maintainer release engineering 流程）

**對齊決策**（Q1=B / Q2=A / Q3=A）：
- Q1=B：純文件 + visual snapshots，**不**做 WSL/Docker structured errorCode（T0340 P2 後續建議，留 PLAN-032 closed 後另開單）
- Q2=A：寫 v0.4.2 release notes 草稿，**不** `npm version` bump
- Q3=A：**不**含 e2e playwright（留將來新工單）

## 目標（驗收條件，工單級）

### AC-1：visual snapshot 補完（5 個 mapped error panel renders）

修改 `src/components/setup-wizard/__tests__/SetupWizardShell.test.tsx`（既有檔，T0334 已補 docker daemon 1 個 inline snapshot）：

新增 5 個 inline snapshot 案例，沿用 T0334 既有 pattern（mock failed step + render shell + `expect(container).toMatchInlineSnapshot(...)`）：

1. `wsl-linger-failure`（fixed-and-retry button）
2. `wsl-service-start-timeout`（skip recovery）
3. `wsl-not-installed`（open-link MSFT URL，T0339 修完後行為已對）
4. `ssh-permission-denied`（hidden-by-default detail mode + edit-config jump）
5. `ssh-configure-host-empty`（嚴格 action set，無 retry/skip）

合計 6 個 visual snapshots 覆蓋 `DEFAULT_WIZARD_ERROR_REGISTRY` 全 entries（T0334 docker daemon + 本票 5 個）。

### AC-2：docs/design/wizard-error-ux.md 對齊

讀 `docs/design/wizard-error-ux.md`（163 行，T0334 落地版），更新使其反映：

1. **Sprint 2-4 落地實況**：5 件套 framework + 三平台 BUG fix + Sprint 4 input-kind rollout
2. **Stepper status 完整對應**：含 `awaiting-input`（T0330 落地 + T0335 SSH reference + T0340 WSL/Docker rollout）
3. **ErrorMapper 6 個 registry entries**：列出當前 ship 的 entries + 各自 friendly message + recovery actions
4. **Recovery action union 7 kinds**：retry / fixed-and-retry / open-link / edit-config / skip / cancel / custom
5. **input-step contract 邊界**：包含 configure-mounts 採 native dialog 不過 requestChoice 的刻意 trade-off（T0340 偏離 spec 第 1 項）
6. **跨檔 cross-link**：與 `bat-stepper-design-language.md` 的 status / visual contract 雙向引用對齊

**禁止項**：不新增「未實作的設計」內容（如 form API、requestFolder helper 等屬未來討論）。

### AC-3：docs/design/bat-stepper-design-language.md cross-link 補強

讀 `bat-stepper-design-language.md`，確認：

1. § Status-視覺對應表 含 `awaiting-input`
2. cross-link 指向 `wizard-error-ux.md` 的 ErrorMapper / Recovery actions 章節
3. § Don't 反例若涉及錯誤 UX，補一條「不要在 input 等待期間 render 為 failed 狀態」

若已對齊：列入回報區「無需改動」。
若有偏差：本票範圍內修齊。

### AC-4：CHANGELOG.md v0.4.2 release notes 草稿

在 `CHANGELOG.md` 頂部新增 v0.4.2 candidate section（**不**改 package.json 版號）：

```markdown
## [Unreleased / v0.4.2 candidate]

### Setup Wizard UX Overhaul (PLAN-032)

#### Added
- Stepper `awaiting-input` status for input steps (no more "looks like an error" UX on first render)
- `WizardErrorMapper` framework — translates raw step errors into structured friendly messages
- `WizardPreflight` hook — proactive environment checks before step execution (Docker daemon, WSL service, etc.)
- `WizardRecoveryAction` discriminated union (7 kinds) — typed recovery flows in the wizard error panel
- 6 baseline error mappings (Docker daemon / WSL linger / WSL service / WSL not-installed / SSH permission denied / SSH host empty)
- ...

#### Fixed
- BUG-072: WSL systemd linger failure now shows actionable "I've enabled linger, retry" guidance
- BUG-073: Docker wizard daemon-not-running offers "Download Docker Desktop" link
- BUG-074: SSH configure-host first step no longer flashes failed before user input
- BUG-076: SetupWizardShell mapped error resolver no longer drops errorCode (impacted pure-errorCode entries like wsl-not-installed)

#### Changed
- 4 input-flavor wizard steps now consistently marked `kind: 'input'` (configure-host / pick-wsl-distro / pick-container / configure-mounts)
- ...

#### Tests
- 17 new unit tests covering input-kind contract (T0340)
- 16 integration tests covering transition matrix + 6 mapped error panel renders (T0338 + T0341)
- ...
```

格式參考既有 `CHANGELOG.md` 頂部 entry 風格（若不同，沿用既有格式）。**人話用詞**為主，不堆 PLAN-032 內部 jargon。

### AC-5：CI 全綠 + 不破 regression

- `npm run test:unit` 全綠（含本票新增的 5 個 visual snapshots）
- 既有 321 cases 不破

### AC-6：commit 範圍

- 單一 commit：`docs(setup-wizard): finalize PLAN-032 docs + visual snapshots + v0.4.2 release notes draft (T0341, Sprint 5)`

### AC-7：不擴大範圍

- 本票**不允許**：
  - 新增 WSL/Docker structured errorCode（Q1=B 排除）
  - 新增 ErrorMapper registry entries（Q1=B 排除）
  - `npm version` bump（Q2=A 排除）
  - 寫 e2e playwright tests（Q3=A 排除）
  - 修任何 production code（純 audit + docs）
- 若 visual snapshot 跑出來發現 production bug → PAUSE 報塔台（與 T0338 AC-5 規則一致）

## 實作順序建議

1. AC-1 補 5 個 visual snapshots（最重要，鎖 regression）
2. AC-5 跑全測確認綠
3. AC-2 wizard-error-ux.md 對齊（讀完 spec + 各工單回報區寫對齊內容）
4. AC-3 stepper-design-language.md cross-link
5. AC-4 CHANGELOG release notes 草稿
6. AC-6 single commit

## 風險與緩解

| 風險 | 影響 | 緩解 |
|------|------|------|
| visual snapshot diff 太大不易讀 | Low | 沿用 T0334 inline snapshot pattern；若某個 panel render 太冗，考慮 `toMatchSnapshot` 外部檔 |
| 既有 SetupWizardShell.test.tsx 測試與新 snapshots 重疊 | Low | T0334 + T0339 已驗證 SetupWizardShell 行為，本票 snapshot 純 visual，不重測邏輯 |
| docs/design/wizard-error-ux.md 改動範圍大失控 | Medium | AC-2 只列 6 個對齊重點，超出範圍 PAUSE |
| CHANGELOG 既有格式有專案慣例 | Low | 先讀檔頭 1-2 個 entry 對齊風格 |

## 自檢清單（Worker 完成前必跑）

1. [ ] AC-1 5 個新 visual snapshots 通過
2. [ ] AC-2 wizard-error-ux.md 6 點對齊完成
3. [ ] AC-3 stepper-design-language.md cross-link 補齊
4. [ ] AC-4 CHANGELOG v0.4.2 草稿完成（無 npm version bump）
5. [ ] AC-5 `npm run test:unit` 全綠（總時間：__ s）
6. [ ] AC-6 單一 commit
7. [ ] AC-7 範圍守住（無 errorCode 擴展、無版號 bump、無 e2e、無 production code 改動）

## YOLO 模式 — 下一張工單建議

**PLAN-032 收尾後**：
- 三 BUG smoke（BUG-072/073/074）由使用者親跑
- v0.4.2 release engineering（npm version bump + tag + push）由 maintainer 流程
- T0340 後續建議的 WSL/Docker structured errorCode + ErrorMapper entries 可獨立開 PLAN（非阻塞）

完成後塔台會：
- 把 PLAN-032 狀態 IN_PROGRESS → DONE（pending 三 BUG smoke 結果）
- 觸發 *sync 重建索引

---

## 回報區（Worker 填寫）

> 完成時段請填寫以下區段，塔台據此進度更新 PLAN-032 metadata + 收工。

### 實作摘要

（描述 5 個 snapshots + docs 對齊範圍 + CHANGELOG 草稿）

### Visual snapshot 覆蓋表

| # | Registry id | 平台 | snapshot 重點 |
|---|-------------|------|-------------|
| 1 | docker-daemon-unavailable | docker | T0334 既有 |
| 2 | wsl-linger-failure | wsl | |
| 3 | wsl-service-start-timeout | wsl | |
| 4 | wsl-not-installed | wsl | |
| 5 | ssh-permission-denied | ssh | |
| 6 | ssh-configure-host-empty | ssh | |

### docs 對齊報告

- `wizard-error-ux.md`：（變動行數 + 主要更新點）
- `bat-stepper-design-language.md`：（變動行數 / 「無需改動」）

### CHANGELOG draft 行數

（新增區段行數）

### 偏離 spec 的決策

（若有，列出並說明理由；若無填「無」）

### 自檢結果

- [ ] AC-1 5 snapshots
- [ ] AC-2 wizard-error-ux.md
- [ ] AC-3 stepper-design-language.md
- [ ] AC-4 CHANGELOG draft
- [ ] AC-5 `npm run test:unit` 全綠（總時間：__ s）
- [ ] AC-6 單一 commit
- [ ] AC-7 範圍守住

### Renew 歷程

無

### 後續建議

（如執行中發現需獨立開單的 follow-up，列在這裡）

### Commit hash

`<填入>`
