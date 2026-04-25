# T0267-research-plan007-spec-consolidation

## 元資料
- **工單編號**：T0267
- **任務名稱**：PLAN-007 — 4 環境 spec 彙整 + cross-cutting risk 統整 + PLANNED 升級拍板 + 實作工單藍圖
- **狀態**：DONE
- **建立時間**：2026-04-25 23:15 (UTC+8)
- **開始時間**：2026-04-25 23:15 (UTC+8)
- **完成時間**：2026-04-25 23:25 (UTC+8)
- **類型**：research + docs（讀工單回報 + 寫 spec 整合文件 + 寫拆解建議；**不寫 production code、不重構**）
- **互動模式**：enabled（D-SSH-6 命名、cross-cutting RFC、實作工單拆解有設計分支）
- **Renew 次數**：0
- **預估 wall time**：60-120 min（硬性止損 3 小時）
- **預估 context cost**：高（讀 6 張前序工單回報區 + 寫整合 spec doc + 規劃 5-10 張實作工單藍圖）
- **關聯**：
  - 母 PLAN：PLAN-007（💡 IDEA → ✅ PLANNED 拍板候選）
  - 前序：T0260 / T0261 / T0262 / T0263 / T0264 / T0265 / T0266 全部 ✅ DONE
  - EXP：EXP-HEADLESS-001 ✅ CONCLUDED（已驗 server-side 可行性）
  - 後序：PLAN-007 升 PLANNED 後第一張實作工單（建議 WSL 路徑，依本工單藍圖）
- **affects_files**：
  - `_ct-workorders/T0267-*.md`（自身回報，主要寫入目標）
  - `_ct-workorders/_spec-remote-dev-support-2026-04.md`（**新建** spec 整合文件 — 例外允許，按 F-24 研究/spec 文件命名慣例）

---

## 背景與本工單目的

PLAN-007 4 環境 research 全部完成：

| 工單 | 範圍 | 結論狀態 |
|------|------|----------|
| T0260 scoping | 4 環境拆單 + topology 矩陣 | ✅ |
| T0261 EXP-HEADLESS-001 spike | server-side headless 可行性錨定 | ✅ CONCLUDED |
| T0262 server-side spec | 7 節（headless entry / cert / token / multi-client / heartbeat / bind / TLS error） | ✅ |
| T0263 WSL research | 7 節（啟動 / loopback / path / PTY env / WSL1 / packaging / UX） | ✅ |
| T0264 共通抽象 | 6 節（targetOS / PathTranslator / bundle / auth-result / glibc / wizard） | ✅ |
| T0265 Docker research | 8 節（base image / mount / lifecycle / docker host / multi-arch / compose / UX / 安全） | ✅ |
| T0266 SSH research | 9 節（auth / 上傳 / matrix / 啟動 / tunnel / path / UX / 斷線 / 安全） | ✅ |

T0266 已浮出 7 個 cross-cutting risks 與 8 個 RFC。本工單為 PLAN-007 PLANNED 升級的**拍板工單**。

---

## 任務目標

### 1. 彙整 spec doc 落地

**新建** `_ct-workorders/_spec-remote-dev-support-2026-04.md`，整合 6 張 research 結論為單一 spec。**這是本工單唯一允許寫入的非工單檔案**（按 F-24 研究/spec 文件命名慣例）。

**結構建議**（每節 5-15 段，整檔目標 800-1500 行）：

```
# PLAN-007 — Remote Dev Support Spec

## 1. Vision & Scope
   - 框架翻轉：BAT terminal client/server 拆分,server 跨環境部署
   - 4 環境覆蓋：local-host (BAT-remote 強化) / wsl-linux / docker-linux / ssh-linux + ssh-darwin
   - Out of scope:Windows 跨機 SSH server / WSL1 / iOS / Android

## 2. Cross-environment Architecture(共通)
   2.1 targetOS profile schema(取自 T0264 §1)
   2.2 PathTranslator interface + 5 實作(IdentityTranslator, WslPathTranslator, DockerPathTranslator, SshPathTranslator)
   2.3 Linux x64/arm64 + darwin arm64 server bundle pipeline(取自 T0264 §3 + T0266 §3 修正)
   2.4 auth-result.serverPlatform + AuthResultMetadata(取自 T0264 §4)
   2.5 Native module 相容性 baseline(glibc 2.35,whisper hard exclude,內嵌 node 24.x)
   2.6 Setup wizard framework(WizardStep + 共通 7 步驟 + per-env hook)

## 3. Server-side hardening(取自 T0262 7 節)
   3.1 createHeadlessServer factory contract
   3.2 Token persistence 跨平台
   3.3 Cert renewal 24h interval + setSecureContext 熱換
   3.4 Token rotation dual-windowing(5min grace)
   3.5 Multi-client session 隔離(per-connection-as-session)
   3.6 Heartbeat 雙向 timeout(client-driven)
   3.7 bind-interface 5 選項 + TLS error 細化(9 分類)

## 4. Per-environment Specs
   4.1 WSL2 deployment(T0263 7 節摘要 + 修正)
   4.2 Docker deployment(T0265 8 節摘要 + 修正)
   4.3 SSH deployment(T0266 9 節摘要 + 修正)

## 5. Cross-cutting Risks & Mitigation(T0266 §C 7 條 + 本工單補)
   5.1 Server bundle CI matrix 爆炸(5 artifact,30 min CI)
   5.2 Profile schema migration tax
   5.3 Wizard step rollback baseline(本工單拍板)
   5.4 Runtime router 跨環境 claude 版本 mismatch
   5.5 Path translation 盲區(symlink / submodule)
   5.6 Whisper exclude 驗證機制
   5.7 ProfilePanel UI 跨環境一致性

## 6. Open Decisions(D-SSH-1 ~ D-SSH-8 + 共通 cross-cutting RFC)
   - 列出本工單拍板的決策 + 理由

## 7. MVP Roadmap & 工單拆解
   - Phase 1:Cross-env 共通框架(5-7d)
   - Phase 2:WSL deployment(3-4d,風險最低)
   - Phase 3:Docker deployment(5-6d)
   - Phase 4:SSH deployment(6-8d,跨 OS matrix 最複雜)
   - Phase 5:整合測試 + UX polish(3-5d)
   合計 22-30 工程日(含風險係數 30-40d)

## 8. Implementation Backlog(本工單藍圖,T0268+ 工單預備)
   - 列出每 Phase 的子工單建議(編號 / 範圍 / sizing / 依賴)

## 9. Future Enhancements(明示排除 v1)
   - Multi-arch arm64 docker
   - Docker compose template
   - 跨 host docker over TCP/SSH
   - Jump host 顯式 UI
   - Server-side voice(whisper)
   - Apple Silicon native arm64 docker
   - Windows OpenSSH server
```

**寫法規則**：
- 不重抄 research 工單原文（spec doc 是「凝練版」，每節 5-15 段，不要 1000 行）
- 引用 source 工單 + commit hash（如「詳見 T0263 §3 commit `afb34a0`」）
- 結論段優先（每節開頭給結論 + bullet points），論證放後
- 程式碼範例僅留 interface / type 定義（不重抄 implementation）
- 表格 / mermaid 用於跨環境對比

### 2. Cross-cutting RFC 拍板

T0266 §C 列了 7 個 cross-cutting risks，本工單需要拍板：

| RFC | 議題 | 候選 | 本工單需要決定 |
|-----|------|------|---------------|
| **C-1** | CI matrix 切割 | desktop release pipeline / 獨立 server bundle workflow | 拍板 |
| **C-2** | Profile schema migration | 被動（load 時自動補 'local'）/ 主動（UI 提示） | 拍板 |
| **C-3** | Wizard step rollback baseline | best-effort / 強制 atomic / 跳過 | 拍板（含 5 種 deployment 各自的 rollback 行為） |
| **C-4** | Claude runtime cross-env 相容 | 強版本一致 / 警告 only / 阻擋連線 | 拍板 |
| **C-5** | Path translator contract test | 跨環境共通 test suite / 各 env 自測 | 拍板（建議 + 列入 implementation backlog） |
| **C-6** | Whisper exclude 驗證 | CI 自動 grep / 手動 release checklist | 拍板 |
| **C-7** | ProfilePanel UI 跨環境一致性 | 共用 component / 各 env 獨立 component | 拍板 |
| **D-SSH-6** | Translator 命名（T0266 提出修正） | `SshLinuxPathTranslator`（原 T0264）/ `SshPathTranslator`（T0266 建議） | 拍板（影響 §2.2） |

**輸出**：每個 RFC 一段 100-200 字（決策 + 理由 + 實作影響）。

### 3. 實作工單藍圖（T0268+ 編號預留）

PLAN-007 升 PLANNED 後，**逐 Phase 拆解實作工單**。本工單**只給藍圖**（每張工單 4-8 行範圍細則），實際工單由塔台 PLANNED 後逐張開（避免一次寫太多在 backlog 腐化）。

藍圖格式：

```
T0268: <標題>
- Phase: 1 (cross-env 共通框架)
- 範圍: <條列 3-6 項>
- Sizing: M (4-8h)
- 依賴: 無 (Phase 1 第一張)
- AC 重點: <2-3 條>
```

**藍圖數量目標**：每 Phase 3-5 張，5 Phase 共 ~15-25 張。**不寫完整工單檔**，只寫藍圖卡。

### 4. PLAN-007 PLANNED 升級檢核表

PLAN-007 升 PLANNED 前必須完成：

- [ ] T0260-T0266 所有 research 工單 ✅ DONE（已達成）
- [ ] EXP-HEADLESS-001 ✅ CONCLUDED（已達成）
- [ ] spec doc `_spec-remote-dev-support-2026-04.md` 落地（本工單交付）
- [ ] Cross-cutting RFC 拍板（本工單交付）
- [ ] 實作 backlog 藍圖（本工單交付）
- [ ] 工程量總估與風險係數（T0266 已給：22-30 → 30-40 工程日）
- [ ] 開放決策清單（本工單彙整）
- [ ] PLAN-007 元資料更新：`💡 IDEA → 📋 PLANNED`，註明拍板依據（本工單編號 + spec doc commit hash）

**輸出**：勾選清單，每項註明證據連結（commit hash / 工單檔位置）。

---

## 執行步驟

### Step 1：環境快照
```bash
git status
git log --oneline -10
```

### Step 2：讀 6 張前序工單回報區
**重點讀**「Spec 草稿」+「給塔台的下一步建議」段：
- T0260（scoping 拆單建議卡）
- T0261（EXP-HEADLESS-001 spike CONCLUDED 結論記錄）
- T0262（server-side spec 7 節）
- T0263（WSL spec 7 節 + W1-W6 sprint）
- T0264（共通抽象 6 節）
- T0265（Docker spec 8 節 + 3 個 EXP child）
- T0266（SSH spec 9 節 + S1-S8 切片 + RFC + cross-cutting）

### Step 3：寫 spec doc 整合
**新建** `_ct-workorders/_spec-remote-dev-support-2026-04.md`，按上方「任務目標 1」結構寫。**目標 800-1500 行**，避免重抄但結論完整。

### Step 4：拍板 8 個 RFC（C-1~C-7 + D-SSH-6）
寫到本工單回報區 + spec doc §6。

### Step 5：寫實作工單藍圖
寫到本工單回報區 + spec doc §8。**~15-25 張藍圖卡**。

### Step 6：PLANNED 升級檢核表
本工單回報區。

### Step 7：填寫回報區 + commit
**兩個 commit**：
1. spec doc 落地：`docs(spec): PLAN-007 4-env remote dev support spec consolidated`
2. 工單元資料 + 回報：`chore(workorder): T0267 PLAN-007 spec consolidation done — PLAN ready to PLANNED`

---

## AC（acceptance criteria）

- **AC1**：spec doc `_spec-remote-dev-support-2026-04.md` 落地（含 9 節結構，800-1500 行）
- **AC2**：8 個 RFC（C-1~C-7 + D-SSH-6）全部拍板，每個含 100-200 字理由
- **AC3**：實作工單藍圖完成（15-25 張，每張 4-8 行範圍細則 + sizing + 依賴）
- **AC4**：PLAN-007 PLANNED 升級檢核表完成（每項證據連結）
- **AC5**：給塔台的下一步建議（PLANNED 後第一張實作工單該派哪一張）
- **AC6**：working tree 在工單結束時 vs 起點 byte-identical（**例外**：本工單回報區 + spec doc 新建，其餘 byte-identical）

---

## 嚴格禁止

- ❌ 寫入除本工單回報區 + `_spec-remote-dev-support-2026-04.md` 以外的任何檔案
- ❌ 修改任何 source code / `package.json` / config 檔
- ❌ 直接修改 PLAN-007.md 元資料（PLANNED 升級由**塔台**在收到本工單後自行操作）
- ❌ 直接草擬 T0268+ 完整工單檔（只寫藍圖卡）
- ❌ 跑 `npm install` / `npm run build`
- ❌ 跨工單決策（→ 回塔台）

---

## 互動模式提示

**enabled**。預期可能的提問場景：

1. 「C-1 CI matrix：desktop release pipeline 還是獨立 workflow？」— 影響 release 路徑
2. 「C-3 rollback baseline：best-effort / atomic / 跳過？」— 影響 wizard 失敗 UX
3. 「C-7 ProfilePanel UI：共用 component / 各 env 獨立？」— 影響 UI 工程量
4. 「D-SSH-6：translator 命名要不要在 spec doc 改成 SshPathTranslator？」— 影響 §2.2
5. 「實作工單藍圖：第一張派 WSL S1 還是 cross-env P1？」— 影響執行序
6. 「spec doc 是否需要含 mermaid 流程圖？」— 影響長度與可讀性

每次提問上限 3 題。能自己拍板的逕行決定 + 寫回報。

---

## 失敗 / PARTIAL 處理

任一觸發：
- 時間止損（>3h 仍未完成 spec doc + RFC + 藍圖）
- 發現前序工單結論之間有根本性衝突（如 T0264 §1 schema 與 T0266 §6 path translator 命名互斥）
- 任 3 個以上 RFC 需要 spike 才能拍板

→ 工單狀態填 **PARTIAL**，已寫的部分保留。觸發 yolo 斷點 B，塔台 pause。

---

## 回報

### 互動紀錄

無主動向使用者提問。所有設計分支以「決策 + 理由」型式逕行拍板（依 research workorder「能自己拍板的逕行決定」原則）。8 個 RFC（C-1~C-7 + D-SSH-6）全部封閉，無懸而未決。若 PLAN-007 PM 階段對 C-1（CI matrix workflow 切割）/ C-3（rollback 強度）/ C-7（UI 統一程度）有不同偏好，可透過 renew 調整 spec doc。

### Step 1 — 環境快照

- 起始時間：2026-04-25 23:15 (UTC+8)
- branch：main
- 起點 HEAD：`88daa06` (T0266 metadata DONE)
- working tree：乾淨（僅本工單檔 untracked，符合 AC6）

### Step 2 — 6 張前序工單彙整摘要

| 工單 | 重點結論 | 待整合議題（已封閉於本 spec） |
|------|---------|------------------------------|
| **T0260** scoping | 4 環境拆單 + topology 矩陣（local/wsl/docker/ssh）；Win SSH server / WSL1 / iOS 排除 | 拆單範圍由 T0261-T0264 細化 → §1.2 / §1.3 |
| **T0261** EXP-HEADLESS-001 | secrets-strategy refactor 證 server-side headless 可行；`app.*` 依賴可在 spike worktree 拆出 | factory pattern 取代 process-singleton → §3.1 |
| **T0262** server-side hardening | 7 節：headless factory / token persist / cert renewal 24h / token rotation 5min grace / per-conn-as-session / heartbeat 雙向 / bind 5 選項 + TLS 9 分類 | 全部凍結為 §3 內容 |
| **T0263** WSL deployment | 7 節：systemd unit + hint UX / mirrored 預設 / 純字串 path translation / WSL2 only / glibc 2.35 / packaging 手動+wizard / 8-step UX | 凍結 §4.1；純字串 winToWsl/wslToWin → §2.2 入口 |
| **T0264** cross-env abstractions | 6 節：targetOS schema / PathTranslator interface / esbuild bundle pipeline / serverPlatform metadata / native compat / wizard framework | 凍結 §2 全節；D-SSH-6 修正 translator 命名 |
| **T0265** Docker deployment | 8 節：bookworm-slim / 顯式 mount / 模式 A+B lifecycle / docker CLI / linux/amd64 only v1 / compose 排除 / wizard 細節 / 安全 | 凍結 §4.2 |
| **T0266** SSH deployment | 9 節：系統 ssh / ssh+tar 上傳 / 3 platform matrix / systemd+launchd / SSH local port forward 預設 / 單一 SshPathTranslator / wizard / 斷線恢復 / 安全；外加 7 cross-cutting risks + 8 RFCs | 凍結 §4.3；§5 7 個 cross-cutting + §6 RFC 拍板 |

### Step 3 — spec doc 落地

- 路徑：`_ct-workorders/_spec-remote-dev-support-2026-04.md`
- 行數：832（落在 800-1500 目標區間 ✅）
- 9 節結構覆蓋情況：

| 節 | 狀態 | 內容 |
|----|------|------|
| §1 Vision & Scope | ✅ | 框架翻轉 / 4 環境矩陣 / out-of-scope 9 項 / PLAN 關係 |
| §2 Cross-environment Architecture | ✅ | 6 子節（schema / translator / bundle pipeline / metadata / native compat / wizard） |
| §3 Server-side hardening | ✅ | 7 子節（factory / token / cert / rotation / session / heartbeat / bind+TLS） |
| §4 Per-environment Specs | ✅ | WSL / Docker / SSH 三節摘要 + D-SSH-6 修正 |
| §5 Cross-cutting Risks | ✅ | 7 條（含 mitigation） |
| §6 Open Decisions (RFCs) | ✅ | 8 個 RFC 全部拍板（每個 100-200 字決策 + 理由 + 實作影響） |
| §7 MVP Roadmap | ✅ | 5 Phase + 工程日估算 + 派單建議 |
| §8 Implementation Backlog | ✅ | 23 張藍圖卡（T0268-T0290） |
| §9 Future Enhancements | ✅ | 17 項 future / lasting exclusion |

- commit hash：`f1934f9`（`docs(spec): PLAN-007 4-env remote dev support spec consolidated`）

### Step 4 — Cross-cutting RFC 拍板

#### C-1 CI matrix 切割

**決策**：獨立 server-bundle workflow（與 desktop release 解耦）。

**理由**：5 種 artifact（linux-x64 / linux-arm64 / darwin-arm64 / docker image / wsl 共用 linux-x64）併入 desktop release 會把 release time 從 ~15 拉到 ~30 min（QEMU build linux-arm64 是主要拖累 +10 min），且 server bundle bug 不該阻塞 desktop release（兩者 cadence 可不同）。

**實作影響**：新建 `.github/workflows/server-bundle.yml`，3 個 matrix job 並行；tag push 同時觸發 desktop pre-release.yml 與 server-bundle.yml；release notes 內合併兩 artifact set。落地工單 T0282。

#### C-2 Profile schema migration

**決策**：被動 migration + UI 提示雙軌。

**理由**：強制 migration（load 時即補 targetOS）對 legacy remote 容易誤判（不知補 wsl 還是 ssh），靜默誤判 = silent failure；純 UI 提示又讓使用者繼續用 IdentityTranslator 直到主動編輯。雙軌：local 自動補（`'local'` 明確），remote 留 undefined 走 IdentityTranslator + UI inline prompt。

**實作影響**：`profile-manager.ts` load 加 hook；ProfilePanel 編輯 legacy remote 時 inline 提示。第一張實作 PLAN（T0268）含 migration unit test 三場景。

#### C-3 Wizard step rollback baseline

**決策**：best-effort + step-level explicit rollback（強制 atomic 排除）。

**理由**：強制 atomic 等於要求 wizard 內建 transaction；對 docker run / ssh+tar 等不可 rollback 副作用是 over-engineering。Best-effort：每 step 自帶可選 `rollback()`，runner 失敗時反向跑；rollback 自身 fail 只 log 不阻塞。Per-deployment 行為見 spec §6 C-3 表。

**實作影響**：每張實作工單 AC 加「rollback step 實作 + 失敗測試通過」。T0288 統一驗 cross-deployment rollback contract。

#### C-4 Claude runtime cross-env 相容

**決策**：警告 only（不強版本一致）。

**理由**：強版本一致鎖使用者於 BAT release 節奏，違反 D027 哲學；完全不檢查在 server claude < 2.0 時 silent break。中間道：< 2.0 阻擋（不相容硬下限），同 major.minor 透明，其他 toast 警告。

**實作影響**：`auth-result` 收 metadata 後 client 比對 `claudeVersion`：parse 失敗 / undefined → 警告但允許；< 2.0.0 → 阻擋 + modal；major.minor 不同 → toast；同 → 透明。落地工單 T0270。

#### C-5 Path translator contract test

**決策**：跨環境共通 test suite（一套 fixtures，4 種 translator 各自必過）。

**理由**：4 個 translator 各自寫 test 易 drift；共通 suite 強制 design parity，新 translator 必加 fixtures，誰漏 case 立刻紅。

**實作影響**：建立 `electron/remote/__tests__/path-translator.contract.test.ts`，`describe.each([Identity, Wsl, Docker, Ssh])` + 10+ shared fixtures（round-trip / owns 一致性 / non-owned pass-through / trailing slash）。每張 translator 工單（T0269/T0273/T0277/T0281）AC 含「contract test 全綠 + 至少 2 個 unique-to-this-translator test」。

#### C-6 Whisper exclude 驗證

**決策**：CI 自動 grep + release checklist 雙保險。

**理由**：純 CI 自動易在 build script 變動時 silent skip；純 manual checklist 在 release 多時被略過。雙軌：CI fail-fast + checklist 顯式追蹤。

**實作影響**：
1. 新增 `scripts/verify-server-bundle.js`：解壓 tarball → grep `whisper` substring → 存在即 abort（仿 `verify-native-modules.js` / `verify-helper-bundle.js`）
2. server-bundle workflow 在 upload-artifact 前跑 verify
3. `CLAUDE.md` 「Packaging / Release 前置檢查」段加 server bundle 驗證項
4. 落地工單 T0271（baseline）+ T0289（release checklist）

#### C-7 ProfilePanel UI 跨環境一致性

**決策**：共用骨架 + per-env slot。

**理由**：純獨立 component 在 4 種 profile 切換時視覺斷裂；強統一介面對 SSH host alias / Docker mount table / WSL distro 列表這類 env-unique 資訊難容納。組合：共用 `<ProfileCard>` 處理通用欄位；per-env `<ProfileCardDetails>` slot 接特化 component。

**實作影響**：新增 `src/components/profiles/ProfileCard.tsx` + `ProfileCardDetails.tsx` dispatcher + `details/{Wsl,Docker,Ssh,Local}Details.tsx`；ProfilePanel 重構為「列卡片 + 點開展開」，舊 inline form 改 modal；共用樣式 token / icon / status badge。落地工單 T0287。

#### D-SSH-6 Translator 命名

**決策**：改名 `SshPathTranslator`（取代 T0264 §1 預留的 `SshLinuxPathTranslator`）。

**理由**：T0266 §6 證 ssh-linux 與 ssh-darwin 翻譯邏輯只差 `serverHome` constructor 參數（`/home/x` vs `/Users/x`），共用一個 class 即可。`targetOS` 仍保留 `ssh-linux | ssh-darwin` 兩值（discriminator 仍需，影響 wizard step / metadata UI）。

**實作影響**：T0264 §1.2 spec 已在本 spec doc §2.2 註解修正；`createTranslator(profile)` switch 兩 case fall-through `case 'ssh-linux': case 'ssh-darwin': return new SshPathTranslator(...)`。不新增 `SshDarwinPathTranslator`。落地工單 T0281。

### Step 5 — 實作工單藍圖

詳見 spec doc §8（共 23 張藍圖卡）。摘要：

#### Phase 1: Cross-env 共通框架（5 張，5-7d）

- T0268 targetOS profile schema + migration（M, 4-8h，無依賴）
- T0269 PathTranslator interface + IdentityTranslator + contract test scaffold（M，依 T0268）
- T0270 RemoteClient middleware + auth-result metadata 擴充（L, 8-16h，依 T0269）
- T0271 Server bundle pipeline (linux-x64 baseline)（L，無依賴，可與 T0268-T0270 並行）
- T0272 createHeadlessServer factory（L，依 T0271）

#### Phase 2: WSL deployment（4 張，3-4d）

- T0273 WslPathTranslator + wsl-path 純函數整合（M，依 T0269/T0270）
- T0274 WSL setup wizard steps 1-4 + UI shell（L，依 T0271）
- T0275 WSL setup wizard steps 5-7 + systemd unit（M，依 T0274/T0272）
- T0276 WSL e2e + 3 user journeys（M，依 T0275）

#### Phase 3: Docker deployment（4 張，5-6d）

- T0277 DockerPathTranslator (production-grade)（M，依 T0269）
- T0278 Docker base image + Dockerfile + multi-arch baseline（M，依 T0271）
- T0279 Docker setup wizard (lifecycle + configure-mounts)（L，依 T0277/T0278）
- T0280 Docker e2e + lifecycle scenarios（M，依 T0279）

#### Phase 4: SSH deployment（6 張，6-8d）

- T0281 SshPathTranslator + ssh-config alias parser（M，依 T0269）
- T0282 Server bundle pipeline (linux-arm64 + darwin-arm64) + 獨立 workflow（L，依 T0271）
- T0283 SshTunnel class + reconnect 整合（L，依 T0270）
- T0284 SSH setup wizard (configure-ssh-host + verify-ssh-auth + 上傳)（L，依 T0282/T0283）
- T0285 systemd unit + launchd plist（M，依 T0284）
- T0286 SSH e2e + cross-OS matrix（L，依 T0285）

#### Phase 5: 整合測試 + UX polish（4 張，3-5d）

- T0287 ProfilePanel UI 重構（C-7 落地）（L，依 T0276/T0280/T0286）
- T0288 Setup wizard rollback contract + cross-deployment test（M，依 T0276/T0280/T0286）
- T0289 Documentation + release checklist 更新（M，依 T0287/T0288）
- T0290 End-to-end smoke test + migration verification（M，依 T0287/T0288/T0289）

**合計**：23 張藍圖（Phase 1: 5 / Phase 2: 4 / Phase 3: 4 / Phase 4: 6 / Phase 5: 4）。22-30 工程日 → 含風險係數 30-40d。

### Step 6 — PLAN-007 PLANNED 升級檢核表

- [✅] T0260-T0266 所有 research 工單 DONE — 證據：commit log `88daa06` (T0266) → `53bd102` (T0262) 連續 5 對 metadata commits
- [✅] EXP-HEADLESS-001 ✅ CONCLUDED — 證據：T0261 spike 工單已歸檔，secrets-strategy factory pattern 已驗證
- [✅] spec doc `_spec-remote-dev-support-2026-04.md` 落地 — 證據：commit `f1934f9`，832 行
- [✅] Cross-cutting RFC 拍板（C-1 ~ C-7 + D-SSH-6 共 8 個） — 證據：spec §6 + 本回報 Step 4
- [✅] 實作 backlog 藍圖（23 張，T0268-T0290） — 證據：spec §8 + 本回報 Step 5
- [✅] 工程量總估與風險係數（22-30 → 30-40 工程日） — 證據：spec §7 + T0266 §E
- [✅] 開放決策清單彙整（8 個 RFC 全部 closed） — 證據：spec §6 全部標 ✅
- [⏳] PLAN-007 元資料更新（💡 IDEA → 📋 PLANNED）— **塔台執行**（本工單嚴格禁止修改 PLAN-007.md 元資料；註明拍板依據：T0267 + spec commit `f1934f9`）

### 給塔台的下一步建議

#### A. PLANNED 後第一張實作工單建議

**派 T0268（targetOS profile schema + migration）**。

理由：
1. **完全無依賴**（Phase 1 第一張），可立即啟動，不需等任何前置條件
2. **風險最低**：純 schema 擴充 + migration 邏輯，無 deployment 環境依賴，本機可全部驗
3. **解鎖 critical path**：T0269（PathTranslator）/ T0270（RemoteClient middleware）/ T0273-T0290 全部 transitively 依賴 T0268 的 schema
4. **快速驗收**：M sizing（4-8h），可在一個工作天內 DONE，立刻啟動 Phase 1 後續

**派單序列建議**：T0268 → T0269（並 T0271 並行）→ T0270（並 T0272 並行）→ Phase 1 收尾後立刻派 **T0273（WSL）+ T0274** 試水溫，避免 bigbang Phase 2-4 才暴露 §2 抽象漏洞。

#### B. 是否還有 spike 候選未浮現

**有兩個建議候選 spike，不阻擋 PLANNED**（可在 Phase 1-2 過程中視情況開）：

1. **EXP-NODE-SEA-001**：esbuild + Node 24 SEA / pkg 對 native module 的相容性（T0264 §3 fallback path 假設 SEA 可能在某 native module 遇阻）。Spike 預估 1-2 d，建議 T0271 開始實作前先試（避免 build pipeline 卡 fallback strategy A）。
2. **EXP-WSL-MIRRORED-001**：WSL2 mirrored mode 在多 distro 並行情境下的 port conflict 行為（T0263 §2 假設兩 distro 同 port 9876 共存無問題，但 mirrored mode 共用 NIC，未實測）。Spike 預估 0.5 d，建議 T0274 啟動前驗。

#### C. 風險提醒

1. **CI build time 增長**：Phase 4 落地 server-bundle workflow 後 release 流程多一條並行 pipeline，需監控總 release time（特別是 macos-14 runner 排隊時間）。建議 T0282 落地後 3 個 release 內紀錄 workflow duration。
2. **Profile schema migration 漏網**：legacy BAT remote profile（PLAN-018 時期建立）在 T0268 落地後仍能用 IdentityTranslator 連線，但跨 OS path 操作會 silent fail。**強烈建議 T0268 unit test 必須涵蓋「legacy remote 連 wsl-linux server」場景**，並在 T0276 e2e 補一個「未升級 legacy profile + 新 wsl server」cross-test。
3. **darwin-arm64 server bundle 簽章**：Apple Silicon 解壓後 quarantine 處理 v1 走 `xattr -d com.apple.quarantine` 一次性清理。若使用者裝了較新 macOS 嚴格 SIP，可能行為變化。建議 T0285 落地時準備 fallback「請使用者進 System Settings 允許」UX。
4. **claude version mismatch toast 過於頻繁**：C-4 決策警告 only，但若 BAT 內嵌 claude 升級節奏快（每月小版本），server 端 claude 不更新即每連線一次顯示 toast。建議 T0270 落地時 toast 帶 dismiss 期效（同 server fingerprint pinning，每 server instance dismiss 7d）。

#### D. 與其他 PLAN 的相依關係

| PLAN | 關係 | 影響 |
|------|------|------|
| **PLAN-005** (electron-builder 26 升級) | 已交付，無回溯影響 | server-bundle pipeline 沿用同樣 npm ci / verify scripts，不衝突 |
| **PLAN-018** (Tailscale + cert pinning) | 已交付，本 PLAN 沿用 | wss + token + TOFU 不變；server-side 改 selfsigned 流程需驗 D-SSH-2 |
| **PLAN-027** (Claude runtime router) | 已交付，相依 | C-4 cross-env claude version 警告依賴 router 的 system-vs-embedded 偵測；T0270 落地時需驗 metadata 帶 `claudeVersion` 欄位 |
| **PLAN-016** (Electron 41 / Node 24) | 已交付，硬相依 | server bundle 內嵌 Node 24.x prebuilt 必須對齊 Electron 41 ABI 145；Phase 1 之外無回溯影響 |
| **PLAN-XXX** (Server-side voice，未開) | 排除 | F5 / C-6 hard exclude；若未來開新 PLAN，需另立 server bundle 變體 |

無 blocking 相依。可立即 PLANNED 並啟動 T0268。

### 收尾 commit
- spec doc commit: `f1934f9`（`docs(spec): PLAN-007 4-env remote dev support spec consolidated`）
- 工單 metadata commit: 待本工單 metadata 更新後產生


### Step 4 — Cross-cutting RFC 拍板

#### C-1 CI matrix 切割
（決策 + 理由 + 實作影響）

#### C-2 Profile schema migration
#### C-3 Wizard step rollback baseline
#### C-4 Claude runtime cross-env 相容
#### C-5 Path translator contract test
#### C-6 Whisper exclude 驗證
#### C-7 ProfilePanel UI 跨環境一致性
#### D-SSH-6 Translator 命名

### Step 5 — 實作工單藍圖

#### Phase 1: Cross-env 共通框架
（3-5 張藍圖卡）

#### Phase 2: WSL deployment
#### Phase 3: Docker deployment
#### Phase 4: SSH deployment
#### Phase 5: 整合測試 + UX polish

### Step 6 — PLAN-007 PLANNED 升級檢核表
（勾選 + 證據連結）

### 給塔台的下一步建議
- PLANNED 後第一張實作工單應派哪一張（理由）
- 是否還有 spike 候選未浮現
- 風險提醒
- 與其他 PLAN（PLAN-018 等）的相依關係

### 收尾 commit
- spec doc commit:
- 工單 metadata commit:
