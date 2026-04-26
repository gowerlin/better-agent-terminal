# T0289 — Impl PLAN-007 Phase 5 Setup wizard rollback contract + cross-deployment test（落地 C-3 best-effort rollback）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0289 |
| 類型 | impl |
| Phase | PLAN-007 Phase 5（整合測試 + UX polish）第二張 |
| 狀態 | 📋 TODO |
| 建立時間 | 2026-04-26 16:00 (UTC+8) |
| 派發時間 | （待派） |
| 完成時間 | （待） |
| Wall time | （待） |
| Sizing | M（spec 估 4-8h；GP099 Phase 4-5 校準後預期 wall 15-25 min — rollback hook + 跨 3 deployment 測試） |
| 依賴 | T0276 ✅、T0280 ✅、T0287 ✅、T0288 ✅（Phase 5 ProfilePanel 重構） |
| 後續 | T0290 docs + release checklist、T0291 e2e smoke + migration verification |
| 工作目錄 | `../bat-plan-007`（worktree on `feature/plan-007-remote-dev`） |
| Renew 次數 | 0 |
| 互動旗標 | `--mode yolo --no-interactive`（fire-and-forget） |
| `affects_files` | `src/components/setup-wizard/wizard-runner.ts`（擴 rollback chain runtime）、`src/components/setup-wizard/steps/wsl/*.ts`（補 rollback fn）、`src/components/setup-wizard/steps/docker/*.ts`（補 rollback fn）、`src/components/setup-wizard/steps/ssh/*.ts`（補 rollback fn）、`tests/wizard-rollback.test.ts`（新建，cross-deployment）、`tests/wizard-rollback-cross.test.ts`（新建，3 environment 統一 contract） |

## 目標

落地 spec §6 RFC C-3 拍板：

> **C-3 拍板**：rollback 採 **best-effort，非 atomic transaction**。每個 wizard step **可選** 提供 `rollback()` function；wizard-runner 在某 step 失敗時，**反向**執行已完成 step 的 rollback；rollback 自身失敗只 log 不阻塞後續 rollback。

加 cross-deployment test 確保 WSL / Docker / SSH 三個 wizard flow 的 rollback chain 行為一致（systemd unit removed / launchd plist unloaded / docker container stopped / install path 清理 / profile 不寫入）。

## 範圍

### 修改

1. **`src/components/setup-wizard/wizard-runner.ts`**（worktree 既有）
   - 既有 `runWizard(steps, ctx)` 在 step `run()` throw 時 abort；本工單擴 **rollback chain**：
     ```ts
     async function runWizard(steps: WizardStep[], ctx: WizardContext): Promise<WizardResult> {
       const completedSteps: WizardStep[] = []
       try {
         for (const step of steps) {
           await step.run(ctx)
           completedSteps.push(step)
         }
         return { ok: true, ctx }
       } catch (err) {
         // best-effort reverse rollback
         for (const step of completedSteps.reverse()) {
           if (step.rollback) {
             try { await step.rollback(ctx) }
             catch (rollbackErr) { logger.warn('rollback failed', { stepId: step.id, rollbackErr }) }
           }
         }
         return { ok: false, ctx, error: err }
       }
     }
     ```
   - 重點：rollback 失敗**不**阻擋後續 rollback；error 累積於 ctx.rollbackErrors

2. **`src/components/setup-wizard/types.ts`**（既有，擴 WizardStep interface）
   - `WizardStep.rollback?: (ctx: WizardContext) => Promise<void>`（optional）

### 新增（補 rollback fn 到既有 step）

3. **WSL steps rollback**（`src/components/setup-wizard/steps/wsl/`）
   - `install-server-bundle.ts`：rollback 跑 `wsl -d <distro> -- rm -rf <installPath>`（best-effort，不存在亦 ok）
   - `write-systemd-unit.ts`：rollback 跑 `wsl -d <distro> -- systemctl --user disable bat-server && rm -f ~/.config/systemd/user/bat-server.service && systemctl --user daemon-reload`
   - 其他 step（detect-env / pick-distro / fingerprint / connect-test / write-profile）：**無需 rollback**（純 read 或 in-memory state）
4. **Docker steps rollback**（`src/components/setup-wizard/steps/docker/`）
   - `pick-container.ts`：若 wizard 期間 docker run 啟動了新容器，rollback 跑 `docker stop <name> && docker rm <name>`
   - `install-server-bundle.ts`：rollback 跑 `docker exec <container> rm -rf <installPath>`
   - 其他 step：無需
5. **SSH steps rollback**（`src/components/setup-wizard/steps/ssh/`）
   - `install-server-bundle.ts`：rollback 跑 `ssh user@host "rm -rf <installPath>"`
   - `start-server.ts`：rollback 依 `targetOS`：
     - linux：`ssh user@host "systemctl --user disable --now bat-server && rm -f ~/.config/systemd/user/bat-server.service && systemctl --user daemon-reload"`
     - darwin：`ssh user@host "launchctl unload ~/Library/LaunchAgents/com.bat-server.plist && rm -f ~/Library/LaunchAgents/com.bat-server.plist"`
   - 其他 step：無需

### 新增（測試）

6. **`tests/wizard-rollback.test.ts`** — wizard-runner rollback chain 單測
   - test1：3 steps 全 success → no rollback called
   - test2：step 2 fail → step 1 rollback called，step 3 不 run
   - test3：step 3 fail → step 1 + step 2 rollback called（reverse order）
   - test4：rollback 自身 throw → log warning，後續 rollback 仍跑
   - test5：step 無 rollback property → 略過該 step 但仍 reverse 跑其他有 rollback 的
   - test6：rollback 累積 errors 到 ctx.rollbackErrors
   - 至少 6 case
7. **`tests/wizard-rollback-cross.test.ts`** — cross-deployment uniform contract
   - test 設計：對 WSL / Docker / SSH 3 個 wizard flow，模擬「install-server-bundle 後失敗」場景，驗證 rollback chain 行為一致：
     - mock IPC 完成 install
     - 手動 throw error 在後續 step（如 connect-test）
     - assert：`ssh:rm-installPath` / `docker:rm-installPath` / `wsl:rm-installPath` 三者皆被觸發
     - assert：profile 未寫入（write-profile 為最後 step，前面 fail 不會跑到）
   - 設計：parametrized test 跑 3 個 environment 共用 fixture
   - 至少 3 case（每個 deployment 一個）

### Out of scope（不做）

- ❌ 不做 atomic transaction（C-3 拍板 best-effort）
- ❌ 不寫真 IPC，全 mock
- ❌ 不修 baseline BUG-061
- ❌ 不寫 rollback retry / exponential backoff（best-effort = 一次嘗試即放棄）
- ❌ 不擴展非 PLAN-007 wizard（如 BAT 既有 onboarding / first-run wizard 不在範圍）
- ❌ 不寫 user-facing rollback UI（rollback 在背景跑，wizard 主流程顯示原始 error；rollback 結果僅 log）
- ❌ 不寫 manual rollback trigger（v1 only auto-rollback on step failure；ProfilePanel 「刪除 profile」走另一條 cleanup chain，不在本工單範圍）

## 前置條件 / 參考文件

| 文件 | 用途 |
|------|------|
| `_ct-workorders/_spec-remote-dev-support-2026-04.md` §6 C-3 | rollback best-effort 拍板 + 各 deployment 行為對照 |
| `_ct-workorders/T0267-research-plan007-spec-consolidation.md` 320-326 | C-3 拍板 + 落地 spec |
| `src/components/setup-wizard/wizard-runner.ts`（worktree） | 既有 step orchestration |
| `src/components/setup-wizard/types.ts`（worktree） | WizardStep interface |
| `tests/__mocks__/electron-api.ts`（T0287/T0288） | mock electronAPI for cross-deployment test |

## AC（驗收條件）

| # | 條件 | 驗收方式 |
|---|------|---------|
| AC1 | `WizardStep.rollback` optional 欄位加進 types.ts | grep |
| AC2 | `wizard-runner.ts` 實作 reverse rollback chain，rollback fail 不阻塞後續 rollback | grep + test4 |
| AC3 | WSL `install-server-bundle` + `write-systemd-unit` 補 rollback fn | grep |
| AC4 | Docker `pick-container` + `install-server-bundle` 補 rollback fn | grep |
| AC5 | SSH `install-server-bundle` + `start-server` 補 rollback fn（含 systemd / launchd 雙路徑） | grep |
| AC6 | `tests/wizard-rollback.test.ts` 至少 6 case 全綠 | 跑指令 |
| AC7 | `tests/wizard-rollback-cross.test.ts` 至少 3 case（WSL/Docker/SSH 各一）全綠 | 跑指令 |
| AC8 | rollback 失敗 log warning（用既有 logger），不影響 wizard 整體結果 | grep + test4 |
| AC9 | 既有 wizard 測試（ssh-wizard-e2e / wsl-wizard-e2e / docker-wizard-e2e）全部仍綠（zero regression） | 跑既有 test |
| AC10 | TypeScript baseline error count drift ≤ +5（沿用 BUG-061 豁免規則） | 跑 tsc 計數 |

## 守則（嚴格）

1. **工作分支**：worktree `../bat-plan-007` 內 `feature/plan-007-remote-dev`。
2. **commit message**：`feat(wizard): T0289 rollback contract + cross-deployment test (C-3 落地)\n\n工單：T0289\n依賴：T0276 / T0280 / T0287 / T0288\n落地 RFC C-3 拍板（best-effort rollback chain）`
3. **工單檔不寫**：Worker 嚴禁修改主線 `_ct-workorders/T0289-*.md`。
4. **工具白名單**：Read / Edit / Write / Bash / Grep / Glob。
5. **emoji**：除測試輸出外禁用。
6. **best-effort 不 atomic**：rollback 失敗只 log，**禁止** throw 阻擋後續；rollback 順序為 reverse（後執行的先 rollback）。
7. **不真執行**：tests 全 mock，禁止真 spawn ssh / docker / wsl / systemctl。
8. **不修 baseline BUG-061**。
9. **rollback fn optional**：steps 不一定要有 rollback；無則 wizard-runner 略過（不 throw）。
10. **completion 判定**：10 AC 全過或 ≥ 8 → `T0289 完成`，否則 `T0289 部分完成：<AC# + 原因>`。

## 預期 wall

**15-25 min**（GP099 Phase 4-5 校準後；wizard-runner 是純函數擴展 + 各 step 加 rollback fn 為 small additions + 2 個 mock test 文件，主要工作為 rollback fn 命令字串設計 + cross-deployment fixture 抽象化）。

## 工單回報區

（Worker 完成後在此補回報；塔台會在收到「T0289 完成」訊息後從本檔讀回報區）
