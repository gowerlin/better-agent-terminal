# T0164-research-upstream-sync-v2.1.42-plus

## 元資料
- **工單編號**：T0164
- **任務名稱**：研究：評估 upstream `tony1223/better-agent-terminal` v2.1.42+ 同步可行性
- **狀態**：DONE
- **類型**：research
- **互動模式**：enabled
- **Renew 次數**：0
- **建立時間**：2026-04-18 06:49 (UTC+8)
- **開始時間**：2026-04-18 06:51 (UTC+8)
- **完成時間**：2026-04-18 07:08 (UTC+8)
- **預估 context cost**：中（~15-25% window，視 diff 規模）
- **關聯**：延續 PLAN-010（已歸檔）— v2.1.3 → v2.1.42 同步

## 研究目標

評估 upstream `tony1223/better-agent-terminal` 自 `lastSyncCommit` (8d23e6e, 2026-04-16) 之後的新 commit，沿用 PLAN-010 的分類方法（**cherry-pick / 移植 / skip**），產出研究報告供使用者決策是否開實作 PLAN。

## 已知資訊

| 項目 | 值 |
|------|---|
| Upstream repo | `https://github.com/tony1223/better-agent-terminal` (TonyQ) |
| Fork repo | `https://github.com/gowerlin/better-agent-terminal` |
| Last sync commit | `8d23e6e7632d665383d965ca6fb5bc08b7dbb6d8` (2026-04-16) |
| Last sync note | PLAN-010：188 commits 分析完成。Phase 1 cherry-pick 4/21，Phase 2 移植 Cache History UI + /abort，Phase 3-4 skip |
| Current fork version | `2.1.42-pre.2` (version.json) |
| Upstream 新 tags（已 fetch） | v2.1.42, v2.1.43, v2.1.44, v2.1.45, v2.1.46-pre.1 |
| Upstream 新 commit 數 | 13（`git log 8d23e6e..upstream/main`） |

**Fork 專屬偏離**（同步時需避開，避免誤判衝突）：
- `CLAUDE.md`（fork 專屬規範）
- `_ct-workorders/`（Control Tower 工單庫，fork 專屬）
- `.github/workflows/pre-release.yml`（含 mac universal → dual-arch 改動、x64ArchFiles CI 修補歷程）
- `package.json` 中 fork 專屬依賴與 `mac.target.arch` 設定
- Electron/electron-builder/vite 已先於 upstream 升級（Electron 41 / builder 26 / vite 7）— 見本日 PLAN-016/005/003

## 調查範圍

### 主要輸入
1. `git log --oneline 8d23e6e..upstream/main`（13 個新 commit）
2. `git log --oneline 8d23e6e..upstream/main --stat`（檔案變更規模）
3. Upstream release notes（v2.1.42 → v2.1.46-pre.1）
4. `version.json` 的 `lastSyncCommit` 比較基準

### 排除範圍
- Fork 專屬檔案（見「Fork 專屬偏離」清單）
- 已在 fork 側完成的升級（electron 41 / builder 26 / vite 7）— 若 upstream 有類似嘗試則標註「fork 已搶先」
- 已在 PLAN-010 分析過的 188 commits（不重新分析）

## 研究指引

### 分類標準（延續 PLAN-010）

| 類別 | 判準 |
|------|------|
| **cherry-pick** | Bug fix / 小功能 / 通用改善，fork 未有、無架構衝突 |
| **移植（port）** | 功能值得但 upstream 實作與 fork 衝突，需要重寫或適配 |
| **skip** | fork 已有 / fork 搶先 / 方向不合 / 架構衝突無法調和 |

### 評估維度

每個 commit 至少提供：
1. **類別**：cherry-pick / 移植 / skip
2. **摘要**：一句話描述 commit 做了什麼
3. **判準**：為什麼分到這類
4. **衝突風險**：低 / 中 / 高（若 cherry-pick）
5. **預估工時**：若需實作（cherry-pick <0.5h / 移植 0.5-4h）

### 推薦方向

報告最後需給出：
- 總體建議：值得同步 / 部分同步 / 全部 skip
- 若部分同步：分 Phase 建議（延續 PLAN-010 Phase 結構）
- 優先順序：High / Medium / Low（按 fork 受益程度）

## 互動規則

- Worker 可主動向使用者提問以縮小範圍（`research_max_questions: 3`）
- 每個問題提供選項 + 「其他：________」兜底
- 互動紀錄寫入回報區

**預期可能提問**：
- 某 commit 涉及架構變更，要不要深入分析？（使用者決定深度）
- 某 commit 與 fork 已有做法衝突，偏好哪種？（使用者決定方向）
- 是否需要產出詳細 diff 對照表？（控制報告規模）

## 產出

### 主要產出
報告檔案：`_ct-workorders/_report-upstream-sync-v2.1.42-plus.md`

報告結構建議：
```
# Upstream Sync Report: v2.1.42+ (T0164)

## 總覽
- 新 commit 數 / tag 跨度 / 檔案變更規模
- 總體建議（值得同步 / 部分同步 / 全部 skip）

## 分類摘要
- cherry-pick: N 個
- 移植: N 個
- skip: N 個（含理由分類）

## 逐 commit 分析
| SHA | Tag | 類別 | 摘要 | 判準 | 風險 | 工時 |

## 建議 Phase（若值得同步）
- Phase 1: cherry-pick 清單（快速安全）
- Phase 2: 移植清單（需要對應工單）
- Phase 3: skip 清單 + 理由留存

## 下一步選項
- [A] 開 PLAN-### 執行完整同步
- [B] 只 cherry-pick Phase 1（快速收益）
- [C] 本輪 skip 全部（延後再議）
```

### 回報區要求
- 調查結論必須可決策（「值得同步」「部分同步」「全部 skip」三擇一 + 理由）
- 建議方向必須附優缺點 + 推薦
- 建議下一步必須三選一（開實作 PLAN / 繼續研究 / 放棄）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 互動紀錄
> [06:55] Q: 提第 1 輪 3 題（Q1 = #7 remote 資安加固處理方式 / Q2 = #10 perf 優化深度 / Q3 = 報告規模）→ A: Q1=A（列 Phase 2 移植、獨立開 PLAN）, Q2=B/C（不實作，仍需出報告列拆分方案）, Q3=B（詳細報告含 diff 預覽）→ Action: 依選項產出詳細報告 `_report-upstream-sync-v2.1.42-plus.md`
> [07:06] Q: 使用者主動補充 → A: 「還要先升級 claude agent sdk 以支援 opus 4.7, upstream v2.1.46-pre.1」→ Action: 於報告 Phase 1 C1.1 新增「關鍵執行順序」子段，明確規定 ①-⑨ 步驟（SDK/CLI 升級必須在 Opus 4.7 builtin 加入之前，否則會 model-not-supported）並釐清 v2.1.46-pre.1 的 SDK/CLI 版本實際來自 v2.1.45（`9c3daf8`）

### 調查結論

**結論：值得部分同步**

13 個新 commit（扣除 2 個 merge 後實質 11 個）分類結果：
- **cherry-pick 3 包**（Phase 1）：Opus 4.7 + SDK/CLI 2.1.111 + EFFORT_LEVELS + xhigh（合併 `357b868`+`9c3daf8`）、remote workspace:load + profile 身份修復（`0bc3bc1`）
- **移植 1 包**（Phase 2，獨立 PLAN-###）：remote TLS + fingerprint pinning + path sandbox + brute-force 防護（`3a0af80`+`5d9f486`，16 檔 +1288/-285）
- **skip 4 包**（Phase 3）：
  - `e74e29c`：fork WorkerPanel 是 supervisor 模式（110 行），與 upstream Procfile 多進程架構完全不同，不適用
  - `b3032ce`：fork 無 `electron/account-manager.ts`，不適用
  - `458d14e`：perf 優化於 BAT 客製化環境（supervisor / worker panel / 內部終端路由）有 regression 風險，使用者決定不實作；報告保留 B 拆分方案（c snippet-db → d TerminalPanel → b markdown cache → a PTY coalesce，由低到高風險）供未來重審
  - `92c4dec`：與 `e74e29c` 同源（WorkerPanel 架構差異），不適用

**Phase 1 總工時約 2h**，Phase 2 獨立 PLAN 約 6-10h。

### 建議方向
- [A] Phase 1 cherry-pick 2 包 + 同時開 PLAN-018 規劃 Phase 2：**2h 內可完成 Phase 1**，Phase 2 排下週；Opus 4.7 可立即在 BAT 內使用；remote 資安加固分開進度不阻塞。
- [B] 只做 C1.1（Opus 4.7 + SDK/CLI 升級），C1.2 待 remote 測試環境準備好：最小風險，但 remote 連線 bug 繼續存在。
- [C] 放棄本輪同步：本週已完成 PLAN-016/005/003 多項升級、context 飽和；但 Opus 4.7 無法立即在 BAT 內使用。
- [D] 先做 Phase 2 再回頭 Phase 1：remote 是 P0 資安，但 Phase 2 工時 6-10h 不適合本週。
- **推薦**：**[A]** — T0165（Phase 1 ~2h）當天可完成，PLAN-018（Phase 2）排下週。Phase 3 skip 理由已記錄，日後 upstream 再改動可回看本報告。

### 建議下一步
- [x] 開實作工單（建議方案：T0165 執行 Phase 1 cherry-pick，2h）＋ 開 PLAN-018 規劃 Phase 2 remote 資安加固（6-10h，排下週）
- [ ] 繼續研究（Renew，新方向：...）
- [ ] 放棄（原因：...）

### Renew 歷程
無（研究過程中使用者補充 1 次執行順序要求，已併入互動紀錄，未觸發正式 Renew 機制）

### 遭遇問題
無

### sprint-status.yaml 已更新
不適用（本工單為研究型，不影響 sprint 狀態）

### 回報時間
2026-04-18 07:08 (UTC+8)

### Commit
`72b8123` - docs(ct): T0164 upstream v2.1.42+ sync research report
