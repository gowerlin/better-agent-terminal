# 多 remote profile 同時連線（PLAN-039）

> 從 CLAUDE.md「多 remote profile 同時連線（PLAN-039）」節搬出（T0595）。本檔為該節完整原文；CLAUDE.md 該節保留用途、必守規則、唯一實作位置與本檔連結。

`main.ts` 以 `RemoteConnectionRegistry`（T0462 模組、T0463 接線、T0464 生命週期）取代單一 `remoteClient` 槽位：`Map<profileId, entry>`，每個 profile 一把 mutex（同 profile 的 connect / pin 變更 / release 串行，不同 profile 並行）。

- **路由**：proxied IPC 以 sender 綁定的 profile（detached 視窗用父視窗的）查自己的 entry；無 live 連線 → 拒絕（`no-client` / `reconnecting`），不 fallback 本機。`'other-profile'` 已移除（T0463）。每個 client 的事件只送 `getWindowsForProfile(profileId)`；本機來源事件（本機 PTY 輸出、Claude emit、`system:resume`）仍送所有視窗，renderer 以 id 過濾
- **生命週期**：最後一個視窗關閉後寬限 `IDLE_GRACE_MS = 15 s`，到期在 mutex 內重算仍無視窗才斷；縮到 tray 的 hidden 視窗算 live（`collectProfileWindows()`）；連上但沒建出視窗 → `FIRST_WINDOW_GRACE_MS = 60 s`；quit 全量 `disconnectAll` 等 ≤ 2 s（`DISCONNECT_ALL_TIMEOUT_MS`）。常數皆無注入點，測試不得為縮短等待改產品常數
- **上限 `MAX_CONCURRENT_REMOTE_PROFILES = 8`**（含連線中 / 重連中；`remote:test-connection` / `remote:list-profiles` 的暫時 client 不計）：第 9 個 → main 端原生對話框（`showRemoteProfileFailureDialog`，`reason: 'limit'`，三語）、`openProfileWindows` 回 `error: 'remote-limit'`、`remote:connect` 回 `errorCode: 'remote-limit'`，**不擠掉既有連線**
- **同 target 兩 profile**：允許 + `logger.warn`（見上方雙 Enter 限制）；SSH 動態本機埠 bind 失敗換埠重試一次、固定 `tunnelLocalPort` 重複 warn（T0465）
- **驗證**：單元 / 整合見 `electron/remote/__tests__/remote-connection-*.test.ts`；e2e `e2e/plan039-multi-remote.spec.ts`（T0466）起兩個 isolated 實例互為 server（P → A 自身、Q → B），驗雙視窗 connected、`pty:create` 落在正確 server、第 9 個被拒、關 P 15 s 後才斷且 Q 不受影響、釋放後名額回收；單獨跑 `npx playwright test e2e/plan039-multi-remote.spec.ts`（需先 `npx vite build`，約 25 s）。P 是 loopback 到 A 自身，故 P 的 PTY 是 A 本機 PTY、會經本機廣播送到 A 所有視窗（含 Q 視窗）——spec 只斷言「B 上的 PTY 輸出不進 P 視窗」這個方向
- **實機驗收**（WSL + SSH，AI 無法代驗）步驟見 `docs/remote-dev-overview.md`「Several remote profiles at once (PLAN-039)」
- **失敗對話框三語（T0491）**：main 端 remote profile 失敗對話框（`unreachable` / `trust` / `protocol` / `limit`）全部依設定語言三語化（`electron/remote/remote-profile-error.ts` `getRemoteProfileFailureStrings` / `getRemoteProfileLimitStrings`，與 `src/locales/*.json` `remoteProfileFailure.*` / `remoteProfileLimit.*` 由單元測試保持一致）；原始錯誤文字逐字附在 detail。
- **profile index 序列化（T0509）**：`profiles/index.json` 的讀改寫全部經 `electron/profile-manager.ts` 的 `withIndexLock()` 佇列（模組層，比照 T0491 `WindowRegistry`），`ProfileManager` 每個方法都把 `ensureInitialized()` → 修改 → `writeIndex()` 放在同一個單元（讀取也排隊）。🔴 鎖內程式碼不得呼叫 `ProfileManager` 公開方法（佇列不可重入，會等自己）；新增方法時建立邏輯用 `addProfileEntry()`。`writeIndex` 的 rename 對 `EPERM` / `EBUSY` / `EACCES` 依 `INDEX_RENAME_RETRY_DELAYS_MS`（25–800 ms，重試 6 次、共 7 次嘗試）重試，用盡即拋錯。修正 plan039 e2e M3 在完整回歸組合下的 `EPERM … rename index.json.tmp -> index.json`。驗證：`electron/__tests__/profile-index-serialization.test.ts`。
