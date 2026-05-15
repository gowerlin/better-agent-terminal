---
schema_version: 1
schema_kind: workorder
id: T0314
title: Docs PLAN-031 Distribution spec freeze + arch normalize 純函數 + manifest schema
type: docs
status: DONE
sizing: S
started_at: "2026-04-27T01:25:00+08:00"
completed_at: "2026-04-27T01:32:00+08:00"
renew_count: 0
workdir: main repo（純 docs + 純函數）
---
# T0314 — Docs PLAN-031 Distribution spec freeze + arch normalize 純函數 + manifest schema

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0314 |
| 類型 | docs（spec 凍結 + 純函數設計，無 production runtime code） |
| 所屬 | PLAN-031 — Server Bundle Distribution / Sprint 2 起點 |
| 狀態 | ✅ DONE |
| 建立時間 | 2026-04-27 01:?? (UTC+8) |
| 派發時間 | 2026-04-27 01:?? (UTC+8) |
| 開始時間 | 2026-04-27 01:25 (UTC+8) |
| 完成時間 | 2026-04-27 01:32 (UTC+8) |
| Sizing | S（estimate 30-45 min wall；spec 凝練 + 純函數 + JSON schema） |
| 依賴 | T0313 ✅（研究結論 + 7 拍板項全結案） |
| 後續 | T0315 / T0316 / T0317 三張平行（Sprint 2 其餘） |
| 互動旗標 | `--mode ask --no-interactive`（spec 文件無歧義；如真需澄清以 PARTIAL 收尾標項） |
| Renew 次數 | 0 |
| 工作目錄 | main repo（純 docs + 純函數） |
| `affects_files` | `_ct-workorders/_spec-server-bundle-distribution.md`（新建） / `src/lib/arch-normalize.ts`（新建純函數 + 單元測試） / `src/lib/__tests__/arch-normalize.test.ts`（新建） |

## 背景

T0313 研究完成，塔台拍板 7 項決策（D092-D098）。本工單為 Sprint 2 起點，序列依賴後續工單，必須先固化以下三項才能讓 Sprint 2 其餘工單（T0315/T0316/T0317）平行展開：

1. **Spec 文件**：將 T0313 回報區的研究結論 + 塔台拍板凝練成獨立 spec
2. **Arch normalize 純函數**：T0319 (arch detection IPC) + T0322 (SSH step) 共用，先行落地讓兩張可平行
3. **Manifest schema**：T0315 (Release manifest publish) + T0317 (SHA256 校驗) 共用 contract

## 塔台已拍板項（不要再問）

| 編號 | 議題 | 決策 |
|------|------|------|
| D092 | C-narrow vs C-full | **C-narrow + Mac 雙 tarball**（darwin-arm64 + linux-x64） |
| D093 | Release tag 命名空間 | **雙 Release**（`vX.Y.Z` desktop + `server-bundle-vX.Y.Z` server，沿用 T0283） |
| D094 | Mac installer size 上限 | **280 MB hard cap**（超出觸發塔台復議） |
| D095 | Fallback URL env | `BAT_SERVER_BUNDLE_BASE_URL` |
| D096 | Docker distributor fallback | **v1 不做**（保留 image-based 模式單純） |
| D097 | DGX Spark dogfood | **user dogfood**（Sprint 5 才派 T0324，本工單不涉及） |
| D098 | 升級既有 server UI | **v0.5.0 含**（T0326 落地） |

## 範圍（3 deliverable）

### Deliverable 1：`_ct-workorders/_spec-server-bundle-distribution.md`

**結構**（必填段落）：

```
# Server Bundle Distribution Spec (PLAN-031)

## §1 範圍與動機（從 PLAN-031 / BUG-071 摘要）
## §2 拍板決策（D092-D098 表）
## §3 Distribution 流程
  §3.1 Installer baseline tarball（per-host arch matrix，從 D092）
  §3.2 Runtime download fallback（從 GitHub Release，從 D095）
  §3.3 SHA256 manifest 流程（fetch manifest → validate → fetch tarball → verify）
  §3.4 Arch detection（從 T0313 D.1 / D.2）
  §3.5 Local cache by SHA（避免 rate limit）
## §4 9-cell 支援矩陣（從 T0313 Phase C，凍結成 spec 表格）
## §5 Native modules 完整性（從 T0313 D.3，標 better-sqlite3 走 CI runner native rebuild 風險）
## §6 升級策略
  §6.1 同版號 ship 規則（D093）
  §6.2 既有 remote 升級 UI（D098，T0326 範圍預告）
  §6.3 跨版本相容矩陣（從 T0313 B.4.4）
## §7 私有部署（D095，env 命名空間）
## §8 GitHub Rate Limit mitigation（local cache + token opt-in v2）
## §9 Manifest JSON schema（引用 Deliverable 3）
## §10 Open questions（標明本 spec 未涵蓋、留 v2 處理項）
```

**寫作守則**：
- 不重複 T0313 回報區的調查過程，只取結論
- 拍板項 D092-D098 必須引用編號（追溯性）
- 每個段落結尾標「驗收 owner 工單」（如 §3.1 → T0316，§3.4 → T0319）
- 風格與 `_spec-remote-dev-support-2026-04.md` 一致（中文 + 表格 + RFC-style 拍板區段）

### Deliverable 2：`src/lib/arch-normalize.ts` + 單元測試

**純函數簽章**（從 T0313 D.1 抄，固化為 v1 contract）：

```typescript
export type ServerBundleArch = 'linux-x64' | 'linux-arm64' | 'darwin-arm64'

export type TargetOS =
  | 'wsl-linux'
  | 'docker-linux'
  | 'ssh-linux'
  | 'ssh-darwin'
  | 'local'

/**
 * Normalize raw `uname -m` output to canonical ServerBundleArch.
 * Returns null if arch is not supported (caller should produce actionable error).
 *
 * Supported mappings:
 *   Linux target + (x86_64 | amd64) → linux-x64
 *   Linux target + (aarch64 | arm64) → linux-arm64
 *   Darwin target + (arm64 | aarch64) → darwin-arm64
 *   Anything else → null
 */
export function normalizeArch(rawUname: string, targetOS: TargetOS): ServerBundleArch | null

/**
 * Build canonical tarball filename for given arch + BAT version.
 * Pattern: bat-server-${arch}-v${version}.tar.gz
 */
export function tarballNameForArch(arch: ServerBundleArch, batVersion: string): string

/**
 * Build full GitHub Release URL for tarball.
 * Default base: https://github.com/anthropics/better-agent-terminal/releases/download/server-bundle-v${version}
 * Override via baseURL param (or env BAT_SERVER_BUNDLE_BASE_URL，但 env 解析在 caller 處理)
 */
export function tarballURL(arch: ServerBundleArch, batVersion: string, baseURL?: string): string
```

**單元測試最少覆蓋**：

| Case | Input | Expected |
|------|-------|----------|
| Linux x86_64 | `('x86_64', 'wsl-linux')` | `'linux-x64'` |
| Linux amd64 | `('amd64', 'docker-linux')` | `'linux-x64'` |
| Linux aarch64 | `('aarch64', 'ssh-linux')` | `'linux-arm64'` |
| Linux arm64 | `('arm64', 'wsl-linux')` | `'linux-arm64'` |
| Darwin arm64 | `('arm64', 'ssh-darwin')` | `'darwin-arm64'` |
| Darwin aarch64 | `('aarch64', 'ssh-darwin')` | `'darwin-arm64'` |
| Mixed-case 輸入 | `('X86_64', 'wsl-linux')` | `'linux-x64'`（normalize 含 toLowerCase） |
| Trailing whitespace | `('x86_64\n', 'wsl-linux')` | `'linux-x64'`（trim） |
| Unsupported arch (linux i686) | `('i686', 'wsl-linux')` | `null` |
| Unsupported arch (darwin x64，spec §1.3 排除) | `('x86_64', 'ssh-darwin')` | `null` |
| Linux on darwin target（cross-mismatch） | `('x86_64', 'ssh-darwin')` | `null` |
| Empty string | `('', 'wsl-linux')` | `null` |
| `tarballNameForArch` 各 arch | `('linux-x64', '0.5.0')` | `'bat-server-linux-x64-v0.5.0.tar.gz'` |
| `tarballURL` 預設 base | `('linux-arm64', '0.5.0')` | `'https://github.com/anthropics/better-agent-terminal/releases/download/server-bundle-v0.5.0/bat-server-linux-arm64-v0.5.0.tar.gz'` |
| `tarballURL` custom base | `('linux-x64', '0.5.0', 'https://example.com/bundles')` | `'https://example.com/bundles/bat-server-linux-x64-v0.5.0.tar.gz'` |
| `tarballURL` base trailing slash | `('linux-x64', '0.5.0', 'https://example.com/bundles/')` | 不可有雙 slash |

**測試框架**：vitest（PLAN-030 T0307b 已引入；`npm run test:unit` 應通過）

### Deliverable 3：Manifest JSON schema

**寫進 spec §9，不獨立檔案**。內容：

```typescript
// 對應 server-bundle release 的 manifest.json
interface ServerBundleManifest {
  /** Spec version，固定 "1" 直到 schema 改版 */
  schemaVersion: '1'

  /** Server bundle 版本（與 BAT version 同 semver；spec D093） */
  version: string

  /** ISO 8601 build timestamp（從 CI run） */
  buildDate: string

  /** Per-target tarball metadata */
  tarballs: Record<ServerBundleArch, {
    /** 例：bat-server-linux-x64-v0.5.0.tar.gz */
    filename: string
    /** SHA256 hex（小寫，64 字元） */
    sha256: string
    /** 解壓前 tarball size in bytes */
    size: number
  }>
}
```

**JSON example**（spec §9 收尾示範）：

```json
{
  "schemaVersion": "1",
  "version": "0.5.0",
  "buildDate": "2026-04-27T00:00:00Z",
  "tarballs": {
    "linux-x64":    { "filename": "bat-server-linux-x64-v0.5.0.tar.gz",    "sha256": "abc123...", "size": 87654321 },
    "linux-arm64":  { "filename": "bat-server-linux-arm64-v0.5.0.tar.gz",  "sha256": "def456...", "size": 84567890 },
    "darwin-arm64": { "filename": "bat-server-darwin-arm64-v0.5.0.tar.gz", "sha256": "ghi789...", "size": 86543210 }
  }
}
```

**Caller 用法 contract**（spec §9 收尾）：
1. BAT runtime fetch `${RELEASE_BASE}/manifest.json` 先（~1KB）
2. 驗 `schemaVersion === '1'`，否則 abort
3. 對 detected arch lookup `tarballs[arch]`
4. 顯示 size 給使用者（progress 預估）
5. fetch tarball → 串流計算 SHA256 → 比對 manifest

## 範圍排除（不在本工單）

- ❌ 不寫 manifest 產生 logic（T0315 範圍）
- ❌ 不寫 SHA256 校驗實作（T0317 範圍）
- ❌ 不寫 download module（T0318 範圍）
- ❌ 不寫 IPC handler（T0319 範圍）
- ❌ 不改 `package.json` extraResources（T0316 範圍）
- ❌ 不改 install-bundle steps（Sprint 4 範圍）

## 驗收條件

- AC-1：`_ct-workorders/_spec-server-bundle-distribution.md` 存在，§1-§10 全填，含 D092-D098 引用
- AC-2：`src/lib/arch-normalize.ts` 存在，三函數簽章與本工單一致
- AC-3：`src/lib/__tests__/arch-normalize.test.ts` 存在，最少 16 case 全綠（`npm run test:unit` 通過）
- AC-4：spec §9 含完整 JSON schema 定義 + example + caller contract
- AC-5：spec §3.1（installer baseline matrix）必須對應 D092 C-narrow + Mac 雙 tarball 規則：

```
| BAT host       | 內建 tarball                              |
|----------------|-------------------------------------------|
| Win (x64)      | linux-x64                                 |
| Mac (arm64)    | linux-x64 + darwin-arm64                  |
| Linux (x64)    | linux-x64                                 |
| Linux (arm64)  | linux-arm64                               |
```

- AC-6：spec §6.3 跨版本相容矩陣引用 T0313 B.4.4 表格
- AC-7：commit 訊息走 `chore(spec): T0314 - PLAN-031 distribution spec freeze + arch normalize`

## Worker 守則

1. **不要重新調研**：T0313 回報已有結論，本工單只負責凝練 + 純函數。如發現 T0313 結論有矛盾，標 PARTIAL 並列出矛盾項給塔台
2. **純函數紀律**：`arch-normalize.ts` 不可有 side effects（不能讀 env、不能 fetch、不能寫 file）；只接 input 回 output
3. **Test 紀律**：vitest 測試必須跑通（`npm run test:unit`），測試 case ≥16
4. **Spec 風格**：跟 `_spec-remote-dev-support-2026-04.md` 對齊（中文標題 + 表格 + RFC-style）
5. **Commit 紀律**：兩 commit 拆開比較乾淨：
   - commit 1: `chore(spec): T0314 - PLAN-031 distribution spec freeze`
   - commit 2: `chore(types): T0314 - arch-normalize utility + unit tests`
6. **`affects_files` 確認**：完工前確認 metadata `affects_files` 與實際新增 / 修改檔案一致
7. **記憶覆寫**：本工單**沒有** `memory_overrides` 欄位 — 沿用所有現行 GP 規則 + 學習紀錄

## Worker 回報區（Worker 填寫）

### 1. Deliverable 1（spec 文件）摘要

`_ct-workorders/_spec-server-bundle-distribution.md`，380 行。

- §1-§10 全段落落地，附錄列 Sprint 1-5 工單對應表（T0313/T0314/T0315/T0316/T0317/T0318/T0319/T0320/T0321/T0322/T0323/T0324/T0325/T0326）
- 拍板項 D092-D098 全部以表格引用，§2 集中陳列；個別段落（§3.1/§3.2/§4/§6.1/§6.2/§7）內文也對應引用
- §3.1 baseline matrix 與 AC-5 表完全一致（C-narrow + Mac 雙 tarball）
- §6.3 跨版本相容矩陣引用 T0313 B.4.4 並照搬 5 列規則
- §10 Open questions 8 項（含 v1 拒絕 / v2 候選 / 未涵蓋議題），未發現需要塔台補拍板的歧義
- 風格對齊 `_spec-remote-dev-support-2026-04.md`（中文標題 + 表格 + RFC-style 拍板區段 + 「驗收 owner 工單」標註）

### 2. Deliverable 2（arch-normalize.ts）摘要

`src/lib/arch-normalize.ts`，103 行（含 JSDoc）。

- 三函數簽章與工單一致：`normalizeArch` / `tarballNameForArch` / `tarballURL`
- 額外 export：`DEFAULT_RELEASE_BASE_URL` 常數（純值，無 env read），`ServerBundleArch` / `TargetOS` type
- 純函數紀律：無 env read、無 fetch、無 file IO；`tarballURL` 的 baseURL 由 caller 從 env 解析後傳入
- Tricky case 處理：trim + toLowerCase 一次完成；`local` target 一律回 null（distribution 不適用）；`tarballURL` 處理 trailing slash 避免 `//bat-server`

### 3. Deliverable 3（manifest schema）摘要

寫進 spec §9，未獨立檔案（依工單規範）。

- TypeScript interface 31 行（含 JSDoc）；引用 `ServerBundleArch` 從 `src/lib/arch-normalize` import
- JSON example 12 行（schemaVersion / version / buildDate / tarballs × 3）；以 `JSON.parse` 心智驗證為合法 JSON（"abc123..." 等為合法 string，僅是 placeholder）
- Caller contract 5 步驟條列（fetch manifest → 驗 schemaVersion → lookup arch → 顯示 size → 串流 SHA256 比對）
- 簽章策略：v1 不簽（GitHub HTTPS + integrity），v2 GPG 候選

### 4. 單元測試結果

```
$ npm run test:unit -- src/lib/__tests__/arch-normalize.test.ts
 Test Files  1 passed (1)
      Tests  26 passed (26)
   Duration  1.11s

$ npm run test:unit  # 全套（含先前 PLAN-030 SetupWizardShell 等）
 Test Files  4 passed (4)
      Tests  73 passed (73)
   Duration  2.07s
```

26 case 覆蓋 ≥ 工單最少 16 case 要求；無 regression（既有 47 case 全綠）。

Case 分組：
- Linux targets × 4（x86_64 / amd64 / aarch64 / arm64 對 wsl-linux/docker-linux/ssh-linux）
- Darwin targets × 2（arm64 / aarch64 對 ssh-darwin）
- Input normalization × 3（mixed-case / trailing whitespace / 雙側 whitespace）
- Unsupported × 7（i686 / darwin-x64 / linux-on-darwin cross-mismatch / empty / whitespace-only / local target / riscv64）
- `tarballNameForArch` × 4（三 arch + pre-release version 格式）
- `tarballURL` × 4（預設 base / custom base / trailing slash / D093 tag namespace 驗證）
- 型別 smoke × 2（ServerBundleArch / TargetOS exhaustive 確認）

### 5. PARTIAL / 矛盾項（如有）

無。T0313 研究結論一致，凝練過程未發現矛盾。

### 完成註記

- commit 1（spec）：`2a6c27a` `chore(spec): T0314 - PLAN-031 distribution spec freeze`
- commit 2（types + tests）：`aeb7413` `chore(types): T0314 - arch-normalize utility + unit tests`
- wall time：~7 分鐘（01:25 - 01:32 UTC+8）；遠低於 sizing S（30-45 min）estimate，主因為 T0313 研究結論已詳實，凝練成本低
- 狀態：Full DONE（AC-1 ~ AC-7 全達成）
- `affects_files` 與實際新增檔案一致（spec doc + arch-normalize.ts + test）
