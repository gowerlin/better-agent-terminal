// PLAN-007 T0288 — Pure unit tests for ProfileCard / ProfileCardDetails dispatcher (RFC C-7).
//
// react-test-renderer is intentionally NOT a project dependency (workorder
// constraint #9: no new deps). Component bodies are exercised via direct
// function invocation and React element type inspection — no DOM rendering
// required.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  ProfileCard,
  ProfileCardDetails,
  LocalDetails,
  WslDetails,
  DockerDetails,
  SshDetails,
  RemoteLegacyDetails,
  selectDetailsVariant,
} from '../src/components/profiles'
import type { ProfileEntry } from '../src/components/profiles'

function mk(partial: Partial<ProfileEntry> = {}): ProfileEntry {
  return {
    id: partial.id ?? 'p1',
    name: partial.name ?? 'Test Profile',
    type: partial.type ?? 'local',
    createdAt: partial.createdAt ?? Date.now(),
    updatedAt: partial.updatedAt ?? Date.now(),
    ...partial,
  } as ProfileEntry
}

// --- AC2: dispatcher logic ---

test('selectDetailsVariant routes local profile to "local"', () => {
  assert.equal(selectDetailsVariant(mk({ type: 'local' })), 'local')
})

test('selectDetailsVariant routes wsl-linux to "wsl"', () => {
  assert.equal(
    selectDetailsVariant(mk({ type: 'remote', targetOS: 'wsl-linux', wslDistro: 'Ubuntu' })),
    'wsl',
  )
})

test('selectDetailsVariant routes docker-linux to "docker"', () => {
  assert.equal(
    selectDetailsVariant(mk({ type: 'remote', targetOS: 'docker-linux', dockerContainer: 'bat' })),
    'docker',
  )
})

test('selectDetailsVariant routes ssh-linux to "ssh-linux" and ssh-darwin to "ssh-darwin"', () => {
  assert.equal(selectDetailsVariant(mk({ type: 'remote', targetOS: 'ssh-linux' })), 'ssh-linux')
  assert.equal(selectDetailsVariant(mk({ type: 'remote', targetOS: 'ssh-darwin' })), 'ssh-darwin')
})

// --- AC2/AC3 corollary: legacy fallback ---

test('selectDetailsVariant routes remote without targetOS to "remote-legacy"', () => {
  assert.equal(selectDetailsVariant(mk({ type: 'remote' })), 'remote-legacy')
})

test('selectDetailsVariant routes remote with unknown targetOS to "remote-legacy"', () => {
  // Force a value outside the union to model legacy persisted profiles or
  // forward-compat schema additions.
  const exotic = mk({ type: 'remote' }) as ProfileEntry & { targetOS: string }
  exotic.targetOS = 'beos'
  assert.equal(selectDetailsVariant(exotic as ProfileEntry), 'remote-legacy')
})

// --- AC2: ProfileCardDetails routes to the right component ---

function dispatchType(profile: ProfileEntry): unknown {
  // ProfileCardDetails is a function component; calling it directly yields the
  // React element it would return. We inspect element.type to verify routing.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = (ProfileCardDetails as unknown as (p: { profile: ProfileEntry }) => any)({ profile })
  return element.type
}

test('ProfileCardDetails dispatches to LocalDetails / WslDetails / DockerDetails', () => {
  assert.equal(dispatchType(mk({ type: 'local' })), LocalDetails)
  assert.equal(dispatchType(mk({ type: 'remote', targetOS: 'wsl-linux' })), WslDetails)
  assert.equal(dispatchType(mk({ type: 'remote', targetOS: 'docker-linux' })), DockerDetails)
})

test('ProfileCardDetails dispatches to SshDetails for both ssh-linux and ssh-darwin', () => {
  assert.equal(dispatchType(mk({ type: 'remote', targetOS: 'ssh-linux' })), SshDetails)
  assert.equal(dispatchType(mk({ type: 'remote', targetOS: 'ssh-darwin' })), SshDetails)
})

test('ProfileCardDetails falls back to RemoteLegacyDetails when no targetOS', () => {
  assert.equal(dispatchType(mk({ type: 'remote' })), RemoteLegacyDetails)
})

// --- AC3/AC5: per-env details components return distinct testid markers ---

function detailsTestId(profile: ProfileEntry): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detailsElement = (ProfileCardDetails as unknown as (p: { profile: ProfileEntry }) => any)({ profile })
  // detailsElement is the wrapper element (LocalDetails / WslDetails / ...);
  // calling its `.type` as a function gives us its rendered <dl/>.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inner = (detailsElement.type as (p: { profile: ProfileEntry }) => any)({ profile })
  return inner.props['data-testid']
}

test('SshDetails differentiates ssh-linux vs ssh-darwin via service badge testid', () => {
  assert.equal(
    detailsTestId(mk({ type: 'remote', targetOS: 'ssh-linux' })),
    'profile-details-ssh-linux',
  )
  assert.equal(
    detailsTestId(mk({ type: 'remote', targetOS: 'ssh-darwin' })),
    'profile-details-ssh-darwin',
  )
})

test('DockerDetails renders mount table when dockerMounts metadata is present', () => {
  const profile = mk({ type: 'remote', targetOS: 'docker-linux' }) as ProfileEntry & {
    dockerMounts: Array<{ host: string; container: string }>
  }
  profile.dockerMounts = [
    { host: '/host/a', container: '/container/a' },
    { host: '/host/b', container: '/container/b' },
  ]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inner = (DockerDetails as unknown as (p: { profile: ProfileEntry }) => any)({
    profile: profile as ProfileEntry,
  })
  // Walk children to find the mount table testid. inner.props.children is an
  // array of rows; we serialize to JSON-ish and check for the marker string.
  const stringified = JSON.stringify(inner, (_k, v) =>
    typeof v === 'function' ? v.name : v,
  )
  assert.match(stringified, /docker-mount-table/)
  assert.match(stringified, /\/host\/a/)
  assert.match(stringified, /\/container\/b/)
})

// --- AC1/AC9: ProfileCard surface checks ---

test('ProfileCard is exported as a function component with documented prop names', () => {
  assert.equal(typeof ProfileCard, 'function')
  // The function expects an object — invoke with stub callbacks to ensure no
  // synchronous explosion (which would catch e.g. accidentally calling props
  // during render).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = (ProfileCard as unknown as (p: any) => any)({
    profile: mk({ type: 'local' }),
    isActive: true,
    isRunning: false,
    isExpanded: false,
    onToggleExpand: () => {},
    onSwitch: () => {},
  })
  assert.ok(element, 'ProfileCard should return a React element')
  assert.ok(element.props, 'rendered element should expose props')
})

test('ProfileCard renders the per-env badge label for known variants', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const render = (profile: ProfileEntry): any =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ProfileCard as unknown as (p: any) => any)({
      profile,
      isActive: false,
      isRunning: false,
      isExpanded: true,
      onToggleExpand: () => {},
      onSwitch: () => {},
    })
  const labels = [
    [mk({ type: 'local' }), 'Local'],
    [mk({ type: 'remote', targetOS: 'wsl-linux' }), 'WSL'],
    [mk({ type: 'remote', targetOS: 'docker-linux' }), 'Docker'],
    [mk({ type: 'remote', targetOS: 'ssh-linux' }), 'SSH (Linux)'],
    [mk({ type: 'remote', targetOS: 'ssh-darwin' }), 'SSH (macOS)'],
    [mk({ type: 'remote' }), 'Remote'],
  ] as const
  for (const [profile, expected] of labels) {
    const stringified = JSON.stringify(render(profile), (_k, v) =>
      typeof v === 'function' ? v.name : v,
    )
    assert.match(stringified, new RegExp(expected.replace(/[()]/g, '\\$&')))
  }
})
