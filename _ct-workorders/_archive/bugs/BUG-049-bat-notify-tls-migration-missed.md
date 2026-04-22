# BUG-049 — bat-notify.mjs TLS 遷移漏修(BUG-046 姊妹 bug,T0202a/b 未同步到姊妹 script)

## 元資料
- **編號**:BUG-049
- **狀態**:CLOSED
- **嚴重度**:🟡 Medium
- **建立時間**:2026-04-19 10:50 (UTC+8)
- **關閉時間**:2026-04-19 11:05 (UTC+8)
- **發現來源**:第十 session 使用者詢問「T0203 Worker YOLO 通知為何塔台沒收到」→ 塔台翻 bat-scripts.log 定位
- **關聯**:BUG-046(已 CLOSED,本 BUG 為其姊妹 bug) · T0202a(close-reject 修復) · T0202b(TLS 升級) · T0205(`5f10e7e` TLS port 修復) · PLAN-020(yolo dogfood)
- **可重現**:100%(每次 Worker YOLO 自動通知皆 silent hang)(修復前)
- **workaround**:使用者手動貼「T#### 完成」字串到塔台 terminal(修復前)

## 修復與驗收(T0205, 2026-04-19 11:02)

✅ **CLOSED** — commit `5f10e7e`,bat-notify.mjs MinimalWS 升級到 TLS + close-reject。

**工具層驗證**(log chain):
```
03:00:21.821Z invoke  --target <tower> --submit "T0205 完成"
03:00:21.822Z parsed  ptyWrite:true submit:true
03:00:21.834Z send    channel:terminal:notify  result:ok
03:00:21.835Z send    channel:pty:write        result:ok appendedCR:true
03:00:21.836Z exit    code:0
```

**UX 端到端驗證**(使用者直接確認):
- Worker T0205 完成時 auto-submit「T0205 完成」→ 塔台 UI **自動顯示並送出**
- 使用者**未手動打字**,Tower session 收到 input 並進入下一輪處理
- PLAN-020 dogfood 以來**首次** YOLO 通知 end-to-end 跑通

**使用者洞察**(L 候選):
> 「bat-notify.mjs 其實是送到 input buffer 然後 \n 應該無法辨別是人類 input 還是 Worker 用程式送出」

此為設計上的優點(Worker 自動化與人類操作對 CLI 端不可區分,不需特殊 protocol),也是風險提示(無法在塔台端 audit 誰送的訊息,需依賴 source 欄位追蹤)。

## 歷史修正(L064 追加)

**BUG-043「Worker YOLO mode 偶發失效」複測正常 CLOSED 的真根因**很可能就是 BUG-049:
- 當時複測「正常」僅因某次通知**偶然成功**或使用者**無意間手動觸發**,本 bug 從未被真正消除
- 第八 session 疑心 BUG-046 副作用誤判,現在可確定 BUG-043 其實是 BUG-049 的早期徵兆
- 建議下次 *evolve 把此追溯加入 learnings(GP: 「偶發」症狀在未找到根因前不應 CLOSED,應 WONTFIX + 轉追蹤條目)

## 現象

YOLO 模式下 Worker 完成工單後呼叫 `bat-notify.mjs --submit "T#### 完成"`,**訊息從未抵達塔台 terminal**,使用者必須手動貼完成訊息才能觸發塔台派下一張。

### Log 證據(`bat-scripts.log`, T0203 Worker pid=5244)

```
02:36:18.990Z invoke    target=<tower-id> --submit "T0203 完成"
02:36:18.992Z parsed    ptyWrite:true, submit:true, messageLength:8
[silent hang — 無 connect-failed / no send event / no exit event]
```

比對 `bat-notify.mjs` 正常應打的 log(從 source code L442 `send` 與 L476 `exit code 0`):invoke 和 parsed 之後理應有 `send result:ok` + `exit code:0`,但完全缺漏 → process 卡在 MinimalWS 連線階段。

## 根因(直接套用 BUG-046 結論)

`bat-notify.mjs` 和 `bat-terminal.mjs` 各自實作自己的 `MinimalWS`(零依賴原則,L246-400 互相 duplicate),T0202a/b 修復 BUG-046 時**只修了 `bat-terminal.mjs`,漏改姊妹 script**。

### 修復對照表

| 項目 | `bat-terminal.mjs`(已修) | `bat-notify.mjs`(未修) |
|------|--------------------------|-------------------------|
| TLS import | L21 `import { connect as tlsConnect } from 'tls'` | ❌ L32 `import { createConnection } from 'net'` |
| Connect call | L282 `tlsConnect({...})` | ❌ L266 `createConnection({host, port}, ...)` |
| T0202a close-reject | ✅ L326-335 `connect-closed-before-upgrade` | ❌ 無 |
| T0202a error reason | ✅ L448-452 `preUpgradeClose` 區分 | ❌ 無 |

### 為何 BUG-046 修復時沒發現

- BUG-046 現象由 BAT worker dispatch silent fail 觸發,症狀明確指向 bat-terminal.mjs
- Worker YOLO 通知失敗的症狀(silent hang)被當時還有的 dispatcher bug 先擋下:
  - T0202b 之前:Worker 根本啟動不了(dispatcher TLS 問題)
  - T0202b 之後:Worker 能啟動,但 notify 又打不到 → 本 BUG 終於浮現
- T0202a/b 工單範圍明確寫「dispatcher / bat-terminal.mjs」,沒 grep 姊妹 scripts

## 預期 vs 實際

| 情境 | 預期 | 實際 |
|------|------|------|
| Worker 完成後呼叫 bat-notify | PTY write + submit `\r` → 塔台 UI 顯示「T#### 完成」並自動送出 | bat-notify silent hang,訊息從未抵達 |
| bat-notify log 結尾 | `send result:ok` + `exit code:0` | 無結尾事件,process 卡住或 orphaned |
| 塔台收到通知 | 自動派下一張工單 | 沒反應,使用者必須手動貼訊息 |

## 處理方向

**Option A — 直接 port BUG-046 修復**(推薦):
- 把 `bat-terminal.mjs` 的 MinimalWS TLS 部分(L21, L282, L326-335, L448-452)一對一 mirror 到 `bat-notify.mjs`
- 驗證:YOLO Worker 完成後通知能在塔台 terminal 顯示 + 自動送出
- 預估:5-15 min(trivial,純 copy-paste + 驗證)

**Option B — 抽出共用 MinimalWS module**:
- 把 MinimalWS 從兩個 script 抽到 `scripts/_bat-minimal-ws.mjs`
- 消除 duplication 風險,未來維護只改一處
- 預估:30-60 min,範圍較大但根治

**Option C — 先 workaround,BUG 標 WONTFIX**:
- 不修,使用者持續手動貼訊息
- 不推薦:YOLO 模式核心機制失效,PLAN-020 dogfood 失去意義

## 建議下一步

派 **T0205** 走 Option A(Trivial 修復,BUG-049 本輪閉環)。

Option B 可開 PLAN-023「MinimalWS 共用化」另行追蹤,避免本次修復範圍擴大。

## 備註

- **時序觀察**:BUG-046 CLOSED → YOLO 派發鏈「解鎖」→ 但實際上 Worker notify 這段**從來沒跑通過**,第九 session 「yolo 派發鏈解鎖」的描述僅指 dispatcher 面向,現在才發現 notify 面向仍殘缺
- **歷史可能解釋**:第八 session 前 BUG-043「Worker YOLO mode 偶發失效」複測正常後 CLOSED,疑為 BUG-046 副作用誤判 — 但其實 BUG-049 本 bug 一直都在,只是表現形式被使用者當成「偶發」
- **YOLO dogfood 意外收穫**:若非 YOLO 模式強迫 Worker notify,這個 bug 可能持續更久不被發現
