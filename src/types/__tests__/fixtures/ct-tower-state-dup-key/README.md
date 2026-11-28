# CT 6.4.0-pre.2 duplicate-key samples (T0974)

CT 6.4.0-pre.2 (CT T0585, R6; CT BUG-006) makes `check-frontmatter.py` reject a frontmatter that repeats a
key (`duplicate-key`). These five files are CT's own "bad" samples, copied byte for byte from CT commit
`71b8406`, `BMad-Control-Tower-v6.4.0-pre.2/skills/control-tower/scripts/tests/fixtures/frontmatter/bad/`
(`cmp` identical). Do not edit them: replace them with new copies from CT when CT changes them.

| File | Repeated key | SHA-256 |
|---|---|---|
| `dup-key-top.md` | top-level `user_actions` | `7b03ee47988a96dd8f323b8643c8d34315356ea3eba8d3e71c8fd0552f05c015` |
| `dup-key-nested.md` | `next_ids.user` | `e6b379ebb0a2bfe468f502a5f0417a0974def7c7e88ecd4537955fa7cc744411` |
| `dup-key-item.md` | `id` inside one `awaiting_user` item | `4dd057d953dfa7f7d18c0a272a187bcd208bd99ed1f961adde4648bc86dd5ca8` |
| `dup-key-menu-open-flow.md` | `ids` inside a flow `menu_open` | `11ebabf1841d50b63916db19d20b1156b352848cedb25b429eca94c432454c40` |
| `dup-key-workorder.md` | `status` in a work order (not a tower-state) | `eb186cd1931f2265fda29c917490972959c113911ff63c84a76b877f002e0bdb` |

BAT reads a repeated key as "the whole file is invalid": js-yaml refuses the frontmatter, so
`parseTowerState` returns `no-summary`, `towerStateBatContract` null, `parseTowerStateInbox` null, and the work
order parser falls back to the legacy reader with an `invalid_frontmatter` warning. Read by
`src/lib/__tests__/tower-state-ct642-fixtures-t0974.test.ts`. The text is made up (no real project data).
