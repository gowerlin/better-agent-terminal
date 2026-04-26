# PLAN-007 Release Checklist

> Release engineer pre-flight checklist for the PLAN-007 remote dev support
> milestone (target: v0.4.0). Covers all four execution environments
> (`local`, `wsl-linux`, `docker-linux`, `ssh-linux` / `ssh-darwin`) plus the
> profile schema migration and rollback chain that span them.
>
> Run this checklist on a clean machine for each release candidate. It
> deliberately mixes automated CI gates with manual real-environment checks
> because CI cannot guarantee WSL2, a reachable Docker daemon, or a remote
> SSH target.

## Pre-release verification (automated CI)

These items are gated by GitHub Actions. They must all be green before any
manual checks are attempted.

- [ ] **Desktop release workflow green** — `.github/workflows/pre-release.yml`
      passes on Windows, macOS (x64 + arm64 dmg), and Linux. Look for green
      checkmarks on every job in the matrix.
- [ ] **Server bundle workflow green** —
      `.github/workflows/build-server-bundle.yml` passes for the three
      platform matrix entries (`linux-x64`, `linux-arm64`, `darwin-arm64`).
      Each artifact is published as `bat-server-<platform>-v<version>.tar.gz`.
- [ ] **Native module verification green** — `scripts/verify-native-modules.js`
      passes on all three desktop platforms; `scripts/verify-server-bundle.js`
      passes on every server bundle artifact. Both run as fail-fast steps in
      their respective workflows.
- [ ] **Helper bundle verification green** — `scripts/verify-helper-bundle.js`
      passes (`npm run verify:helpers`). Confirms every `scripts/*.mjs`
      helper referenced by relative `.mjs` import is whitelisted in
      `package.json` `build.extraResources[].filter`.
- [ ] **All test suites green**:
  - [ ] Unit tests (`npm test`)
  - [ ] Contract tests (`tests/path-translator-*.test.ts`,
        `tests/wizard-rollback.test.ts`,
        `tests/wizard-rollback-cross.test.ts`)
  - [ ] Mock e2e tests (`tests/wsl-wizard-e2e.test.ts`,
        `tests/docker-wizard-e2e.test.ts`,
        `tests/ssh-wizard-e2e.test.ts`,
        `tests/ssh-flow-journeys.test.ts`)
  - [ ] Cross-deployment rollback tests (`tests/wizard-rollback.test.ts`,
        `tests/wizard-rollback-cross.test.ts`)

If any automated step fails, **stop**. Do not proceed to manual checks.

## Pre-release verification (manual)

CI cannot exercise real WSL, real Docker, or real SSH targets. Run these on
the platforms you support.

### WSL real e2e (Windows host)

Target: Windows 11 23H2 or newer + Ubuntu 22.04 (or other supported distro)
+ `systemd` enabled.

- [ ] Confirm `wsl -l -v` shows the target distro as version `2`.
- [ ] Confirm `/etc/wsl.conf` contains `[boot]` and `systemd=true`.
- [ ] Confirm `%UserProfile%\.wslconfig` uses `networkingMode=mirrored` (or
      document NAT mode if you're testing the fallback path).
- [ ] Open **Add WSL Profile** wizard → run all nine steps without rollback.
- [ ] Confirm `bat-server.service` is active inside WSL
      (`systemctl --user status bat-server.service`).
- [ ] Confirm BAT stores a profile with `targetOS: wsl-linux` and the correct
      `wslDistro`.
- [ ] Restart the BAT window; reconnect to the saved profile succeeds without
      the wizard.
- [ ] Disconnect from WSL (`wsl --shutdown`); reconnect from BAT triggers
      the auto-reconnect loop and recovers within ~30 seconds.

### Docker real e2e (Docker Desktop or colima)

Target: Docker Desktop on Windows or macOS, **or** Docker Engine on Linux,
with a running daemon.

- [ ] `npm run build:docker-image` succeeds; image size below 300 MB.
- [ ] `npm run verify:docker-image` succeeds.
- [ ] **Wizard mode A** (attach to existing BAT-ready container) reaches
      `done` without rollback.
- [ ] **Wizard mode B** (create fresh managed container with bind mounts and
      `--restart unless-stopped`) reaches `done` without rollback.
- [ ] Confirm BAT stores a profile with `targetOS: docker-linux` and the
      expected mount metadata.
- [ ] `docker restart <container-name>` → BAT auto-reconnects and `/health`
      reports healthy.
- [ ] Stop the container (`docker stop`); confirm BAT surfaces the
      disconnect modal. Restart the container (`docker start`) and confirm
      reconnect succeeds with the same token.

### SSH real e2e (multiple server targets)

Target: at least one happy-path server per supported architecture, plus one
cross-OS journey from a Windows client.

- [ ] **linux-x64** target — happy path: `configure-ssh-host` → `verify-ssh-auth`
      → `install-server-bundle` (single `tar | ssh` round trip) → `start-server`
      (systemd user unit) → `fetch-fingerprint` → `connect-test` →
      `write-profile` → `done`.
- [ ] **linux-arm64** target — same as above; verify the wizard picks the
      `linux-arm64` tarball based on `uname -sm` output captured in
      `verify-ssh-auth`.
- [ ] **darwin-arm64** target — same as above; verify launchd plist is
      installed at `~/Library/LaunchAgents/com.bat-server.plist` with
      `RunAtLoad=true` and `KeepAlive.Crashed=true`.
- [ ] **Cross-OS journey (Windows client → linux server)** — must run from a
      Windows BAT client to a real linux-x64 SSH server. Verify that a chat
      attachment with `C:\Users\alice\file.txt` is converted to the matching
      POSIX path on the server side via `SshPathTranslator`. This is a
      **mandatory** real e2e item; mock tests cannot exercise the
      Windows-host filesystem layer.
- [ ] **Permission-denied recovery** — start with no key configured for the
      target, hit the modal, point at an existing key, click Retry; wizard
      reaches `done`.
- [ ] **Tunnel disconnect recovery** — kill the SSH tunnel mid-session
      (`pkill ssh` on the client side); confirm `SshTunnel` reconnects with
      exponential backoff (1s → 2s → 4s → 8s → 16s); after 5 consecutive
      failures the BAT UI raises the reconnect modal.
- [ ] **Uninstall** — run the four-step uninstall in the SSH guide; verify
      `systemctl --user list-unit-files | grep bat-server` (linux) or
      `launchctl list | grep com.bat-server` (darwin) returns nothing.

### Migration verification (legacy remote profile)

Legacy profiles (created before PLAN-007) must continue to load without
error and surface a clear migration path.

- [ ] Load a legacy remote profile (no `targetOS` field). BAT does not
      crash, does not auto-rewrite the profile, and connects through
      `IdentityTranslator`.
- [ ] ProfilePanel shows an inline hint suggesting the user re-run the
      matching wizard to populate `targetOS`.
- [ ] Re-run the wizard for that profile. The `write-profile` step fills in
      `targetOS` and any per-env metadata (`wslDistro`, container info,
      `serverHome`).
- [ ] Re-load the profile after wizard completion. Hint disappears; path
      translation now uses the env-specific translator.

### Profile schema migration (load-time auto-fill)

- [ ] Load a `type: 'local'` profile that lacks `targetOS`. On load, BAT
      auto-fills `targetOS: 'local'` (no UI hint, no user action required).
- [ ] Load a `type: 'remote'` profile that lacks `targetOS`. BAT leaves
      `targetOS: undefined` and routes through `IdentityTranslator`; the
      ProfilePanel inline hint is shown.
- [ ] Confirm no profile schema migration writes back to disk on load
      (writes happen only when the user edits the profile via the wizard or
      the ProfilePanel).

### Rollback contract verification

- [ ] **WSL** — force a wizard step to fail (e.g. block port 9876 before
      `start-server`). Confirm the rollback chain runs in reverse, the
      install directory under `~/.local/bat-server` is removed, no systemd
      unit file lingers, and **no profile is persisted**.
- [ ] **Docker** — force `verify-docker-image` to fail (e.g. delete the
      built image between build and verify). Confirm rollback removes any
      partially created container and no profile is persisted.
- [ ] **SSH** — force `start-server` to fail (e.g. block the bound port on
      the server). Confirm rollback removes the systemd unit (or launchd
      plist) and the install directory; no profile is persisted.
- [ ] **Cross-deployment** — confirm `tests/wizard-rollback-cross.test.ts`
      coverage matches the manual scenarios above (the suite mocks IPC; the
      manual run is the production-truth check).

## Release prep

After both automated and manual verification are green, prepare the release.

- [ ] **Bump version** in synchronized locations:
  - `package.json` `version`
  - `electron/version-info.ts` (and any other version constants surfaced in
    the about dialog)
  - Confirm `npm run build:release` writes the same version into the NSIS
    installer / dmg / zip artifacts.
- [ ] **CHANGELOG** — promote the `[Unreleased]` section to `[0.4.0]` with
      the release date. Move the four sub-sections (Added / Changed / Fixed /
      Known issues) under the new heading. Leave a fresh empty
      `[Unreleased]` block at the top.
- [ ] **Tag + push** to trigger GitHub Actions:
      ```bash
      git tag v0.4.0
      git push origin v0.4.0
      ```
      For a pre-release candidate, use `v0.4.0-pre.N` instead; GitHub
      Actions auto-marks the release as Pre-release and skips the Homebrew
      tap update.
- [ ] **Artifact verification** — wait for all CI jobs to publish artifacts;
      then download and inspect:
  - [ ] Windows NSIS installer (`.exe`) + zip
  - [ ] macOS dmg — both `x64` and `arm64` (the build is intentionally **not**
        universal; see `CLAUDE.md` D057)
  - [ ] Linux AppImage
  - [ ] Server bundles for `linux-x64`, `linux-arm64`, `darwin-arm64`
  - Confirm each artifact unpacks cleanly and the version string matches.
- [ ] **Homebrew tap update** — if this is a non-prerelease, confirm the tap
      auto-update workflow ran. If it failed, run it manually.

## Post-release smoke

After publishing the release, run a real-user smoke test before announcing.

- [ ] Uninstall any existing BAT install on a clean test machine.
- [ ] Install from the published artifact (NSIS / dmg / AppImage).
- [ ] Open the app; the about dialog shows the new version.
- [ ] Open the **Add WSL Profile** wizard (or matching wizard for the test
      machine's OS); reach `done` without rollback.
- [ ] Dispatch a small workorder via the Control Tower; confirm Worker
      receives it, runs end-to-end, and returns a completion message.
- [ ] Open the GitHub release page; proofread the auto-generated release
      notes against the CHANGELOG entry. Edit if anything reads poorly.

## Sign-off

```text
Release: v_______
Release engineer: _______
Release date: _______ (UTC+8)
Platforms verified manually:
  [ ] Windows 11 + WSL2
  [ ] macOS arm64 (Apple Silicon)
  [ ] macOS x64 (Intel) — optional, if you still ship x64 dmg
  [ ] Linux (Ubuntu 22.04 LTS or equivalent)
  [ ] SSH cross-OS (Windows client → linux server) — REQUIRED
  [ ] SSH darwin-arm64 server — required if shipping darwin-arm64 server bundle
  [ ] Docker Desktop (Windows or macOS) — required if Docker workflow is in scope
Notes / known issues at release time:
  - _______________
Sign-off: ______________________  Date: __________
```

Once signed off, post the release notes to the team channel and close the
release tracking issue.
