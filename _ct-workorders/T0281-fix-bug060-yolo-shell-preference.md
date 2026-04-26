# T0281 — Fix BUG-060 YOLO 鏈式派發 shell preference 未套用

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0281 |
| 類型 | bugfix |
| 修復目標 | BUG-060(BUG 狀態:OPEN → FIXING)|
| 狀態 | 📋 TODO |
| 建立時間 | 2026-04-26 13:12 (UTC+8) |
| Sizing | M(投入根因調查 + 修復;若調查超過 30 min 視為偏複雜,需回報待塔台決策)|
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

(尚無)

---

## 塔台補充(Renew #N)

(尚無)

---
