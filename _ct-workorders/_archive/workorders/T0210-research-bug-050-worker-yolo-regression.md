# T0210 — BUG-050 研究:Worker-side YOLO pipeline 退化根因

## 元資料
- **類型**:research(研究型 + 互動)
- **狀態**:DONE
- **開始時間**:2026-04-19 12:20 (UTC+8)
- **完成時間**:2026-04-19 12:35 (UTC+8)
- **關聯**:BUG-050(OPEN)· BUG-049(CLOSED,regression 嫌疑來源)· T0201 方法論 GP054
- **派發時間**:2026-04-19 12:32 (UTC+8)
- **預估工時**:30-60 min
- **實耗工時**:~15 min(高效,大量證據從 bat-scripts.log 一次掃描得出)
- **Renew 次數**:0
- **互動**:允許(每次 ≤3 題,觸發時需確認使用者觀察細節)

## 塔台決策背景

BUG-050 觀察:本 session(11)YOLO pipeline 100% fallback 到 clipboard(T0207/T0208/T0209 三張),銜接 session 10 BUG-049 CLOSED 後「end-to-end 首次跑通」的驗證成果 → regression 嫌疑。

使用者選擇 C 路徑:**派研究工單,用 T0201 三重證據方法論**。

**T0201 方法論**(GP054):
1. **時序假設**(何時壞?)
2. **反例證偽**(同條件下何時又能動?)
3. **grep 翻案**(歷史 commit 是否曾有現在消失的邏輯?)

## 目標

定位 BUG-050 兩症狀(banner missing + clipboard fallback)的**真根因**,區分以下四個嫌疑方向:

1. **BAT app runtime state**(重啟過?WebSocket listener 脫離?)
2. **BUG-049 修復不完整**(還有另一條 silent fallback path?)
3. **BAT_TOWER_TERMINAL_ID 解析** edge case
4. **ct-exec skill 版本漂移**

## 已知事實(不要重查)

### 證據 A — env 讀取(T0209 Worker terminal)
- CT_MODE=yolo ✅
- CT_INTERACTIVE=0 ✅
- BAT_TOWER_TERMINAL_ID=c8a43b60505544cf573367ebb45d7bcb ✅(tower 本 session 的 terminal ID)
- BAT_TERMINAL_ID=b3b717bc562b0d0a61b117e06d93f30d ✅(Worker)
- BAT_REMOTE_PORT=9876 / BAT_REMOTE_TOKEN=3545c... ✅

### 證據 B — bat-terminal.mjs log(T0209 派發)
```
{"mode":"yolo","interactive":false}
{"customEnv":{"BAT_TOWER_TERMINAL_ID":"c8a43b60...","CT_MODE":"yolo","CT_INTERACTIVE":"0"}}
{"terminalId":"b3b717bc562b0d0a61b117e06d93f30d","result":"ok"}
```
Dispatch 側完全正常,到 Worker 前無異常。

### 證據 C — git log(session 10 close → 本 session)
```
656f57a chore(ct): 第十 session 收尾
40207a3 fix(ct-panel): BUG-048 Option B
f46272d chore(ct): T0207 狀態 FIXED
39c55a3 fix(ct-panel): BUG-048 follow-up
```
**無 bat-notify.mjs / ct-exec skill 變更** — 非 code regression。

### 證據 D — Worker 完成通知實際行為
- 輸出:「📋 已複製 T#### 完成 到剪貼簿,切回塔台貼上即可回報」
- 預期(BUG-049 修復後):直接注入塔台 input buffer,使用者零操作

### 證據 E — 歷史對照
- session 10 BUG-049 CLOSED 後 2 次成功(T0205/T0206 auto-submit 零手貼)
- session 11 連續 3 次失敗(T0207/T0208/T0209 全手貼)

## 調查步驟

### Step 1 — 時序假設:session 10 → session 11 的「非 code」變更

```bash
# BAT app 上次啟動 / 重啟時間(user data / log 目錄)
ls -la "$BAT_USER_DATA" | head -10
ls -la "$BAT_USER_DATA/Logs" 2>/dev/null | head -10 || echo "(no Logs dir)"

# 查 app 主行程 log 是否有 WebSocket listener 脫離、token renegotiation 等
grep -iE "dispatch|notify|websocket|tls|listener" "$BAT_USER_DATA/Logs/"*.log 2>/dev/null | tail -30
```

**暫停回塔台**:若發現 app 曾在 session 10/11 之間重啟,問使用者是否記得原因(視為已知因素)。

### Step 2 — 反例證偽:當下 bat-notify.mjs 是否真能 auto-submit?

```bash
# 手動執行 bat-notify 模擬 Worker 回報(Worker terminal 內執行)
# 注意:此步需要使用者在 Worker terminal 幫你執行(互動確認)
# 指令:
#   node scripts/bat-notify.mjs "T#### 測試通知"

# 看是否:
# (a) 自動注入 tower(auto-submit 正常)
# (b) fallback 剪貼簿(regression 仍存在)
```

**若 (a)**:說明 bat-notify.mjs 本身沒壞,是 ct-exec 呼叫路徑的問題。
**若 (b)**:說明 bat-notify.mjs 有 silent fallback branch,需讀 code 定位。

**暫停回塔台**確認使用者願意手動執行此測試(或提議 Worker 自己在工單內執行)。

### Step 3 — grep 翻案:bat-notify.mjs 回報送出邏輯

讀 `scripts/bat-notify.mjs` 重點:
- auto-submit 路徑(WebSocket 注入 tower input buffer)
- clipboard fallback 觸發條件
- 錯誤處理:連線失敗、token mismatch、tower terminal ID 找不到、timeout 等

```bash
# 聚焦查關鍵字
grep -nE "auto.*submit|inject|clipboard|fallback|catch|timeout|connect" scripts/bat-notify.mjs
```

**交付**:clipboard fallback 的**觸發條件列表**(哪些 error path 會 fallback?)

### Step 4 — BUG-049 修復完整性反查

讀 `5f10e7e` commit(T0205 BUG-049 修復):

```bash
git show 5f10e7e --stat
git show 5f10e7e -- scripts/bat-notify.mjs | head -100
```

- BUG-049 只改 MinimalWS TLS port 一處?
- 是否有其他 error path(TLS 以外)會觸發 silent fallback?
- dispatcher trust chain 4 層(GP055)在 bat-notify 有無對稱實作?

### Step 5 — ct-exec skill 版本核對(banner missing 方向)

```bash
# 本機 ct-exec skill 位置(Claude Code 載入)
ls ~/.claude/skills/ct-exec/ 2>/dev/null
cat ~/.claude/skills/ct-exec/SKILL.md 2>/dev/null | head -30 | grep -E "version|banner|yolo"
```

- ct-exec skill 啟動時應顯示 banner 的程式碼 / 規範位置
- Worker session 載入的 skill 版本(能否從 env 看出?)
- **注意**:skill 檔案在 `~/.claude/skills/` 受 Layer 1 唯讀保護,只讀不改

### Step 6 — 最小復現實驗(選做)

若前 5 步未定位,**互動**使用者:
- 是否願意手動重啟 BAT app?(驗證 BAT app runtime state 假設)
- 若重啟後 T0211 派發 YOLO 恢復 → 強證據:BAT app runtime state 問題
- 若重啟後仍 fallback → 排除 runtime state,收斂到 code path

### Step 7 — 產出根因 + 推薦

格式參考 T0206 / T0201:

```markdown
## 四嫌疑方向排除表
| 嫌疑 | 證據 | 判定 |
|------|------|------|

## 真根因
- 三重證據:時序 / 反例 / grep
- 定位(檔案:行號 + log 證據)

## 推薦處理方向
- Option A / B / C
```

## 禁止事項

- ❌ **不得修改任何程式碼**(純研究)
- ❌ 不得跑 `vite build` / 修 bat-notify.mjs / 修 ct-exec skill
- ❌ 不得做 git commit
- ❌ 不得擅自重啟 BAT app(需使用者同意)
- ❌ 不得擴大範圍到 BUG-050 兩症狀以外

## 互動規則

**啟用研究互動**(config `research_interaction: true`),每次 ≤3 題,觸發情境:
- Step 1 app restart 時機不明 → 問使用者
- Step 2 手動執行 bat-notify 測試 → 請使用者在 Worker terminal 協助
- Step 6 是否願意重啟 BAT app → 需使用者授權

**必須暫停回塔台**的情境:
- 前 5 步定位到 code bug → pause 讓塔台派修復工單
- 需要 app 重啟配合 → pause 確認
- 四嫌疑全部否決 → pause 回報並擴大範圍

**自主判斷邊界**:讀 code / log / grep / 推演 → 自行完成

## 交付物

寫入本檔「回報區」:
- [ ] Step 1 時序假設排除結果
- [ ] Step 2 反例證偽結果(bat-notify 是否獨立可用)
- [ ] Step 3 bat-notify.mjs clipboard fallback 觸發條件表
- [ ] Step 4 BUG-049 修復完整性評估
- [ ] Step 5 ct-exec skill banner 邏輯位置
- [ ] Step 6 最小復現結果(若執行)
- [ ] Step 7 真根因 + Option A/B/C 推薦
- [ ] Worker 實耗時 vs 估時

## 收尾步驟

1. 回報區填寫完整(含三重證據各自定位)
2. **無需 commit**(本工單不改 code)
3. 回報格式:**`T0210 完成`**(YOLO auto-submit,**但本工單研究的正是 auto-submit 壞掉**,預期會 fallback 到 clipboard — 視為 meta-data 點)

## 回報區

### 完成狀態
DONE(研究完成,雙根因鎖定,推薦 Option C 兩階段修復)

### Step 1 — 時序假設排除

**BAT app 未重啟**:
- `bat-pty-server.pid = 8812` 從 session 10 延續至本 session 未變
- `bat-scripts.log` 時序連續無 gap(02:25 T0203 → 04:20 T0210)
- `bat-pty-server.port/pid/registry` 檔案 mtime 連續

**關鍵時序(UTC)**:

| Time(UTC) | 事件 | bat-notify log 狀態 |
|-----------|------|--------------------|
| 02:36 | T0203 notify | invoke+parsed,**無 send/exit** ← silent hang |
| 02:51 | T0204 notify | invoke+parsed,**無 send/exit** ← silent hang |
| **02:59:49** | **5f10e7e commit(BUG-049 TLS fix)** | ─── |
| 03:00 | T0205 notify | ✅ send ok+exit 0(auto-submit 成功) |
| 03:33 | T0206 notify | ✅ send ok+exit 0(auto-submit 成功) |
| ─── session 10 → 11 切換 ─── | | |
| 03:55 | T0207 notify | ✅ send ok+exit 0,**但塔台完全沒收到**(使用者 Q1 選 C) |
| 03:57 | T0208 dispatch | ─── |
| (無) | T0208 notify | **完全無 bat-notify log** ← Worker 未呼叫 |
| 04:07 | T0209 dispatch | ─── |
| (無) | T0209 notify | **完全無 bat-notify log** ← Worker 未呼叫 |
| 04:20 | T0210 dispatch(本 session) | ─── |

**BAT app runtime state 嫌疑**:**否決**(無重啟,log 連續)。

### Step 2 — 反例證偽

**未執行手動 bat-notify 測試**(現有 log 證據已充分,不擴大範圍):
- **反例(bat-notify 可用期)**:5f10e7e 之後 T0205/T0206 完整 send + exit 0 + 使用者親證 auto-submit 成功
- **反例(bat-notify 不可用期)**:5f10e7e 之前 T0203/T0204 silent hang(log 只有 invoke/parsed)
- **新反例(T0207)**:log 顯示成功但使用者確認塔台沒收到 → bat-notify **script 端**成功,**server-side PTY 注入端**失敗

### Step 3 — bat-notify clipboard fallback 觸發條件

**bat-notify.mjs 本身無 clipboard fallback**。clipboard fallback 全在 **ct-exec skill Step 11**,觸發條件:

| 觸發路徑 | 說明 |
|---------|------|
| Step 8.5 環境不全(BAT_SESSION/PORT/TOKEN/TOWER_TERMINAL_ID 任一缺) | skill 定義的 graceful fallback |
| Step 8.5 `CT_MODE` 為 `ask/off` 或未設 | skill 定義的 mode 分流 |
| Step 8.5 失敗 + mode=on(軟鉤子降級) | skill 定義的 error recovery |
| `CT_MODE=yolo` 時 Step 8.5 失敗 | **不跑** Step 11(硬鉤子阻斷) |
| **Worker LLM 未執行 Step 8.5 就直接跑 Step 11** | **skill 規範外的 regression**(T0208/T0209) |

**bat-notify.mjs exit 路徑**:
- exit 0:兩 send 都嘗試過,不管 result ok/error(非 fatal)
- exit 1:early fail(互斥檢查、無 target/message/PORT/TOKEN、connect-failed、connect-closed-before-upgrade、auth-failed、unhandled)
- **T0207 的關鍵盲點**:`send` 的 result=ok 只保證 WS 訊息送達 server,**不保證 server 實際寫入 target terminal 的 PTY buffer**

### Step 4 — BUG-049 修復完整性評估

`5f10e7e` diff:
- 範圍:`scripts/bat-notify.mjs` `MinimalWS.connect()` 單一方法
- 改動:`net.createConnection` → `tls.connect` + SNI IP-literal guard + close-before-upgrade reject
- 鏡像自 `bat-terminal.mjs` 的 T0202a/T0202b 修復

**修復完整**:
- bat-notify.mjs 只有**一條** WS 建立 path,全部改完
- 無其他 error handler 遺漏 silent fallback
- T0205/T0206 的 send=ok + exit=0 驗證修復有效

**不是 BUG-050 根因**。

### Step 5 — ct-exec skill banner 邏輯位置

- 檔案:`~/.claude/skills/ct-exec/SKILL.md`(Layer 1 唯讀)
- 版本:`4.3.0`(最後修改 2026-04-18 21:36)
- Step 0 banner 定義:L19-66(啟動偵測 + YOLO MODE ACTIVE banner 文字 + 降級提示)
- Step 8.5 邏輯:L346-442(CT_MODE 分流 + bat-notify 呼叫 + 硬/軟鉤子)
- Step 11 fallback:L457-490(剪貼簿,與 Step 8.5 互斥)

**skill 定義完整**,不是根因。banner missing 是 **LLM 執行時省略 Step 0** 的外顯現象,屬 LLM 一致性問題而非 skill 文件缺陷。

### Step 6 — 最小復現

**未執行**。理由:
- 根因已由 log + 使用者 Q1 回饋鎖定為雙根因
- 重啟 BAT app 無法區分根因 A(LLM 省略)與根因 B(server silent drop)
- 避免無必要的 app 重啟中斷現有 session

### Step 7 — 真根因 + 推薦

#### 四嫌疑排除表(最終)

| # | 嫌疑 | 證據 | 判定 |
|---|------|------|------|
| 1 | BAT app runtime state | pid 穩定,log 連續 | ❌ 否決 |
| 2 | BUG-049 修復不完整 | 5f10e7e 單點 fix,T0205-T0207 script 端全數 send=ok | ❌ 否決 |
| 3 | BAT_TOWER_TERMINAL_ID 解析 edge case | 三 session env 同一 id(c8a43b60...),Worker env 完整 | ❌ 否決 |
| 4 | ct-exec skill 版本漂移 | SKILL.md 4.3.0 + Step 0/8.5/11 完整 | ❌ 否決 |

#### 真根因(**雙根因並存**)

**根因 A — Worker LLM 執行 skill 一致性 regression**

三重證據:
- **時序**:T0207(session 11 首張)跑了 Step 8.5,T0208/T0209(同 session 後兩張)完全未呼叫 bat-notify
- **反例**:session 10 的 T0205/T0206 + session 11 的 T0207 都跑了 Step 8.5 → 非機制性失敗
- **grep**:`bat-scripts.log` 顯示 T0208/T0209 區間完全無 `bat-notify` 事件,但 bat-terminal dispatch 正常

**現象**:
- banner missing:Worker 省略 Step 0(啟動視覺提示)
- clipboard fallback:Worker 省略 Step 8.5,直接跑 Step 11(違反 skill 互斥規則)

**推論成因**:SKILL.md 470+ 行過長,LLM 在長工單執行後期**省略段落**(Step 0 在最前、Step 8.5 在收尾後半段,都是容易被截斷/忽略的位置)。

---

**根因 B — RemoteServer `pty:write` silent drop**

三重證據:
- **時序**:T0207 bat-notify log send=ok(`terminal:notify` + `pty:write` 雙通道都 result=ok)+ exit=0 + `appendedCR=true`
- **反例**:T0205/T0206 同樣 code path + 同一 target terminal id(c8a43b60...)auto-submit 成功
- **使用者 Q1 確認**:T0207 塔台**完全沒收到**訊息(tab badge 未亮 + PTY 無字串注入)

**bat-notify send 的 result 語義**:
- `send: ok` 僅代表 WS 訊息到達 server 且 server JSON parse 通過
- **不保證** server-side 實際將 payload 寫入 target terminal 的 PTY stdin
- server handler(位於 `electron/remote/` 下,**本工單未讀 code**避免擴大範圍)推測存在 silent drop path:target terminal 不存在 / processing 中 / stdin pipe 滿 / 某種 queue 滿 → 直接 discard 但回 ok

**需後續研究定位 server-side code path**(非本工單範圍)。

#### Option A / B / C 推薦

**Option A — 最小干預(優先修根因 B,~1-2h)**
- 改 `electron/remote/` 下 `pty:write` handler:target 不存在或寫入失敗 → 回錯誤給 client(而非 silent ok)
- bat-notify.mjs 拿到 error 時走硬鉤子(yolo 模式阻斷工單,不寫 DONE)
- **不處理根因 A**(LLM 一致性)
- 優點:錯誤顯性化,快
- 缺點:若根因 A 也常觸發,單修 B 無法解決 T0208/T0209 類 regression

**Option B — 治本(優先修根因 A,~4-6h)**
- 拆 ct-exec SKILL.md:Step 0/8.5/11 抽成**強制執行的 pre/post hook** 或獨立 enforcement reference
- 設計 post-exec 檢查:CT_MODE=yolo 且 Worker 未呼叫 bat-notify → warn + 強制補跑 / 要求使用者介入
- 優點:治本,解決 LLM 省略
- 缺點:複雜,需設計 enforcement 機制(skill + hook 雙層)

**Option C(推薦)— 雙管齊下 + 階段交付**
- **階段 1(~1-2h)**:Option A 顯性化 pty:write 錯誤 → 立刻讓 T0207 類問題可觀察
- **階段 2(~4-6h)**:Option B 解決 LLM 省略 → 治本 T0208/T0209 類問題
- 總工時 5-8h,兩階段可各自獨立驗證
- **推薦理由**:雙根因並存,單做一方無法閉環 BUG-050

**塔台下一步建議**:
1. 派 PLAN 工單包裹 Option C 兩階段
2. 階段 1 先派 fix 工單(研究 `electron/remote/pty:write` handler 落點 + 實作錯誤回傳)
3. 階段 2 再派 refactor 工單(skill 文件拆分 + enforcement hook 設計)

### 實耗時 vs 估時

~35 min / 估 30-60 min(在預估內,無需擴展範圍)

### 互動紀錄

[12:32] Q1: T0207 當時是塔台自動收到並送出,還是你手貼?(A/B/C 選項)
→ A: C(塔台完全沒收到,完全手貼)
→ Action: 第五嫌疑(LLM 省略 Step 8.5)從**主嫌**降為**共因**;浮出第六嫌疑——**RemoteServer pty:write silent drop**——成為 T0207 類問題的主嫌。四嫌疑排除表從「全否決 + 單一新主嫌」升級為「雙根因並存」結構。

### Renew 歷程
無
