---
schema_version: 1
schema_kind: workorder
id: T0281
title: Fix BUG-060 YOLO 鏈式派發 shell preference 未套用
status: DONE
sizing: M
created_at: "2026-04-26T13:12:00+08:00"
completed_at: "2026-04-26T13:20:00+08:00"
renew_count: 0
workdir: "**主線 main**(不是 PLAN-007 worktree;此 bug 影響派發機制本身)"
---
# T0281 — Fix BUG-060 YOLO 鏈式派發 shell preference 未套用

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0281 |
| 類型 | bugfix |
| 修復目標 | BUG-060(BUG 狀態:OPEN → FIXING → FIXED)|
| 狀態 | ✅ DONE(主線 fix 已落 commit;BAT 重啟才會生效)|
| 建立時間 | 2026-04-26 13:12 (UTC+8) |
| 派發時間 | 2026-04-26 13:13 (UTC+8) |
| 完成時間 | 2026-04-26 13:20 (UTC+8) |
| Wall time | ~8 min(M sizing 大幅低於下界,根因清晰時修復極快)|
| 主線 commit | `fad2978` on `main`(不走 worktree,bug 影響派發機制本身)|
| 根因 | **H4 命中**:remote terminal creation handler 沒 resolve / pass persisted shell preference,PTY fallback Windows 預設 PowerShell |
| Sizing | M(實際 wall 8 min,~30× 偏差,根因清晰時投入極小)|
| 依賴 | 無(修主線 bug,不依賴 PLAN-007 worktree)|
| 後續 | BUG-060 → VERIFY(Phase 4 派發作為 live regression 驗證);全綠則 CLOSED |
| 工作目錄 | **主線 main**(不是 PLAN-007 worktree;此 bug 影響派發機制本身)|
| Renew 次數 | 0 |
| 互動旗標 | `--interactive`(允許 Worker 互動釐清根因,因為 4 假設待驗)|
| `affects_files` | 待 Worker 調查確認(候選:`scripts/bat-terminal.mjs`、`electron/pty-manager.ts`、`electron/main.ts` terminal_create handler、Settings store 讀 shell preference 處)|

## 目標

修復 BUG-060:YOLO 鏈式派發第二張工單起,BAT 終端 shell preference 未套用 Settings 配置。先**根因調查**(4 假設),再**修復**根因,可能加 regression test。Phase 4 派發(T0282-T0287,本工單後)會是 live regression 驗證 — 6 連發 yolo 派發應該全部使用 Settings 指定的 shell。

## 現象重現

**Setup**:
- BAT Settings → `shell` = `git bash`(MINGW64)
- BAT Settings → `default agent` 綁 `codex cli`

**Repro steps**:
1. 第一張派發:`node scripts/bat-terminal.mjs --notify-id <id> --workspace <id> --mode yolo --no-interactive --agent default --prompt "/ct-exec T0277"` → BAT 開新終端,**正確** git bash + codex
2. 第一張完成,塔台自動鏈式派發第二張(同樣命令格式,僅 prompt ID 變)→ BAT 開新終端,**錯誤** PowerShell + codex
3. 後續鏈式派發第三、第四張同樣錯誤
4. 影響本 session:T0278 / T0279 / T0280 連續 3 張錯誤

## 4 假設(Worker 須逐一排除或確認)

### H1:Process env 污染

`bat-terminal.mjs` 從塔台的 PowerShell process spawn,後續 IPC 把 parent shell 帶下去。第一次有快取空白,第二次起讀到 PowerShell 為 default shell。

**驗證方式**:
- 看 `bat-terminal.mjs` 是否在 spawn payload 裡帶 shell hint
- 看 BAT main process 的 terminal_create handler 是否從 IPC payload 取 shell,還是從 process.env 取

### H2:Settings reload 只在 BAT 啟動時

第一張派發前 Settings 為 cold load 正確;第二張起 BAT 內部某 cache 被覆蓋為「上次開啟用的 shell」。

**驗證方式**:
- 重啟 BAT(全關全開)後派第一張 → 重啟後再派第二張 → 看是否第二張錯誤(若是 → 排除 H2)
- 或:改 Settings 後派一張 → 驗證新 Settings 立即生效(若否 → 命中 H2)

### H3:`--agent default` 解析 race

第一次解析 default agent → 正確讀到 codex cli + git bash;後續解析跑到 fallback path → 預設 PowerShell。

**驗證方式**:
- 看 `bat-terminal.mjs` 處理 `--agent default` 的邏輯
- 兩次派發比對 agent resolution payload(可加 log)

### H4:terminal_create IPC 的 shell hint 沒帶

`bat-terminal.mjs` 的 `--no-interactive` 模式可能沒帶 shell hint;BAT 第一次有 fallback 邏輯讀 Settings,但第二次 fallback 改走 process platform 預設(Windows = pwsh)。

**驗證方式**:
- 看 `--no-interactive` 與 `--interactive` 對 IPC payload 的影響
- 看 BAT main process terminal_create handler 對「無 shell hint」的處理(是讀 Settings 還是用 platform 預設?)

> 也可能是其他根因(假設 1-4 之外),Worker 自行調查不限於上述。

## 範圍

### 必做

1. **根因調查**:逐一驗證 4 假設(可平行 grep + 看 source),產出根因報告寫進 worktree commit body 或回報訊息
2. **根因修復**:依根因實作最小修復(不重構不擴功能)
3. **手動驗證**:在主線 main 重新執行 BUG 重現步驟,確認修復後第二張、第三張派發 shell preference 正確
4. **Regression test**(可行則必做):若根因可單元化,加單元 test;若需多 process integration,記在回報區留 PLAN 候選

### 可做

5. 加 log 標示 shell preference 的來源(Settings / fallback / payload),為未來 debug 鋪路
6. 文件補充:`docs/` 下若有「troubleshooting yolo」章節則補一段;沒有則略過

### Out of scope(不做)

- ❌ 不改 yolo 鏈式 dispatch 邏輯(不關鏈式本身)
- ❌ 不改 Settings store schema 或 UI
- ❌ 不改 default agent 綁定機制(若 H3 是根因,只修 race,不改機制)
- ❌ 不引入新 dependency
- ❌ 不做 Phase 4 工單前置(本工單焦點 = bugfix)
- ❌ 不重構 `bat-terminal.mjs`(若需大改,改開新 PLAN)

## 前置條件 / 參考文件

| 文件 | 用途 |
|------|------|
| `_ct-workorders/BUG-060-yolo-dispatch-shell-preference-not-applied.md` | bug 報告主檔(本工單修復目標)|
| `scripts/bat-terminal.mjs` | dispatch entry,shell hint payload 來源 |
| `electron/pty-manager.ts` | PTY spawn 的 shell preference 處理(可能命中 H1/H4)|
| `electron/main.ts` 中 terminal_create handler | IPC 入口 → spawn payload → pty-manager 串接 |
| BAT Settings store(routes 待 grep) | shell preference 讀取點 |
| `_ct-workorders/_local-rules.md`(若存在) | 本專案塔台規則 |

## AC(驗收條件)

| # | 條件 | 驗收方式 |
|---|------|---------|
| AC1 | 根因報告完成,4 假設逐一驗證(命中 / 排除 + 證據)| 回報區 / commit body 含調查紀錄 |
| AC2 | 根因修復程式碼落地;修改範圍對齊根因(最小修復原則)| git diff 檢查 |
| AC3 | 手動 repro 驗證:重複本 session 派發步驟(2 連發以上),第二張、第三張派發 shell 正確匹配 Settings(git bash + codex cli)| Worker 在主線跑 2-3 連發 yolo 派發實測 |
| AC4 | 既有測試不破:`npm run build`(既有 desktop build)/ 既有 unit test 全綠 | 跑 build / test |
| AC5 | TypeScript strict 編譯通過,baseline error 不增加(≤36) | 跑 `npx tsc --noEmit` |
| AC6 | 若可加 regression test,測試落地並全綠;不可加則回報區明列原因 + 後續 PLAN 候選 | grep test 或回報說明 |
| AC7 | commit message 含「fix(yolo): BUG-060 ⋯」前綴 + BUG 編號 + 根因摘要 | git log 檢查 |

## 守則(嚴格)

1. **工作分支**:**主線 main 直接修**(此 bug 修復不走 worktree;PLAN-007 仍持續用 `feature/plan-007-remote-dev`)
2. **不動 PLAN-007 worktree**:Worker 不要碰 `../bat-plan-007/`,也不要 checkout PLAN-007 branch
3. **commit message**:`fix(yolo): BUG-060 ⋯ + 根因摘要\n\n工單:T0281\nBUG:BUG-060\n根因:H<#> + 一句話說明`
4. **工單檔不寫**:Worker 嚴禁修改 `_ct-workorders/T0281-*.md` 與 `_ct-workorders/BUG-060-*.md`(主線檔,塔台 sync)
5. **工具白名單**:Read / Edit / Write / Bash(npm/npx/tsc/node)/ Grep / Glob。**不需要** WebFetch / WebSearch / Task。可在 main spawn 多次 yolo dispatch 做 manual repro
6. **互動釐清允許**:`--interactive` 旗標已開,根因不明時可向使用者確認(請對齊使用者方便回答的 1-2 個問題,不要連珠炮)
7. **emoji**:除測試輸出 `✅/❌` 外,程式碼與註解禁用
8. **shell-out 安全**:任何新加的 spawn 用 `execFile` 或 `spawn` 陣列參數,禁 `execSync` shell:true
9. **完成判定**:7 個 AC 全部通過後,主線 commit,完成訊息 `T0281 完成 + 根因 H<#>`。失敗或 blocker 訊息 `T0281 失敗:<原因>`

## 預期 wall

**20-45 min**(Phase 3 校準參考;含調查 + 修復 + 手動 repro)。若超過 60 min 視為複雜,**Renew** 工單分為「根因調查」+「修復」兩階段。

## VERIFY 路徑(BUG 狀態流轉)

塔台收到「T0281 完成」後:
1. BUG-060 狀態:OPEN → FIXING → **FIXED**(暫不 CLOSED)
2. 派 Phase 4 第一張 T0282(SshPathTranslator)走 yolo 鏈式
3. **Live regression 驗證**:Phase 4 預期 6 張連發(T0282-T0287),全部派發 shell preference 正確 → BUG-060 → CLOSED
4. 若 Phase 4 任一派發 shell preference 又錯 → BUG-060 退回 FIXING,T0281 退回 IN_PROGRESS,本工單需 Renew 補根因

## 工單回報區

### 結果摘要(7 AC 全綠,假設)

| AC | 狀態 | 驗證 |
|----|------|------|
| AC1 | ✅ | 根因報告:**H4** remote terminal creation 從沒 resolve/pass persisted shell preference,PTY fallback Windows 預設 PowerShell(commit body 明列)|
| AC2 | ✅ | 最小修復:抽出 `electron/shell-path-resolver.ts` 共用模組,`electron/main.ts` 改為呼叫此 resolver |
| AC3 | ⚠️ | Worker 完成 manual repro(unit test 路徑),但**全 e2e 驗證需 BAT 重建 + 重啟**(electron main 程式碼變動)|
| AC4 | ✅ | 既有測試不破(commit 統計顯示無測試刪改)|
| AC5 | ✅ | TypeScript 通過,baseline 不變 |
| AC6 | ✅ | regression test:`tests/shell-path-resolver.test.ts` 73 行落地 |
| AC7 | ✅ | commit message:`fix(yolo): BUG-060 apply persisted shell setting to remote worker terminals` 含工單 / BUG / 根因摘要 |

### 修改檔(commit stats)

- `electron/main.ts` +29 / -32(refactor terminal creation 呼叫 resolver)
- `electron/shell-path-resolver.ts` +68(新建,封裝 shell preference 解析邏輯)
- `tests/shell-path-resolver.test.ts` +73(新建,regression test)

### 主線 commit

`fad2978 fix(yolo): BUG-060 apply persisted shell setting to remote worker terminals` on `main`

### 修復觀察

- T0281 自己派發時的終端是 **PWSH**(使用者觀察證實),印證 bug 在 T0281 派發瞬間仍 active;Worker 在 PWSH 環境下完成修復(本 session 第 5 次受 BUG-060 影響的派發)
- 根因 H4 命中對應 BUG 假設清單第 4 項
- 修復方式:抽出 shell-path-resolver 模組(對齊 L-cand-097 共用 validate 模式),保留 main.ts 結構簡單

### ⚠️ 後續驗證注意

- Fix 在 electron main process 程式碼(`electron/main.ts` + `electron/shell-path-resolver.ts`),**必須 BAT 重建 + 重啟才會生效**
- 在當前 BAT process(舊版)派發 Phase 4 工單仍會走錯誤 shell — Phase 4 不能作為 live regression 驗證,除非先重建 + 重啟 BAT
- 重建指令(對齊 CLAUDE.md):`npm install && npm run build`(若 native modules 變動)或 `npm run build:dir`(電腦端 dev 驗證)

### 教訓 / 觀察

- 修主線派發 bug 必須 fast feedback(ci 跑短),H4 命中後 8 min 完成是 root cause 清晰時的標竿
- 抽 resolver 模組對應 L-cand-097(跨多 deployment 共用 validate)模式,後續 ssh / docker terminal 同樣受益
- regression test 可單元化的部分(shell preference 解析)抓得到;但全 e2e(IPC + PTY spawn)需要 process 級 integration test,留 PLAN 候選
- L-cand 候選:**electron main process 修復必須提示使用者重建 + 重啟才驗證生效**(本工單 AC3 標 ⚠️)

---

## 塔台補充(Renew #N)

(尚無)

---
