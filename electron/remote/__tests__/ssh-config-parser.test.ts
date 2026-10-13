// @vitest-environment node
/**
 * T0505: an alias becomes the whole ssh target (`ssh -- <alias>`), so
 * `listSshHosts` only offers names that pass the target whitelist. ~/.ssh/config
 * is mocked; no real file is read.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { readFileMock } = vi.hoisted(() => ({ readFileMock: vi.fn() }))

vi.mock('fs/promises', () => ({ readFile: readFileMock }))

import { isUsableSshAlias, listSshHosts } from '../ssh-config-parser'

beforeEach(() => {
  readFileMock.mockReset()
})

describe('listSshHosts (T0505)', () => {
  it('lists connectable aliases and drops patterns / unusable names', async () => {
    readFileMock.mockResolvedValue([
      'Host devbox build-01.example',
      '  HostName 10.0.0.5',
      '  User deploy',
      'Host *.internal !bastion dev?',
      'host -oProxyCommand=calc',
      'Host devbox',
      'Host "quoted name"',
      '',
    ].join('\r\n'))
    expect(await listSshHosts()).toEqual(['devbox', 'build-01.example'])
  })

  it('returns [] when ~/.ssh/config is missing', async () => {
    readFileMock.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }))
    expect(await listSshHosts()).toEqual([])
  })

  it.each([
    ['devbox', true],
    ['build-01.example.com', true],
    ['a_b', true],
    ['-oProxyCommand=calc', false],
    ['!bastion', false],
    ['dev*', false],
    ['root@devbox', false],
    ['fe80::1', false],
    ['', false],
  ])('isUsableSshAlias(%j) → %s', (alias, usable) => {
    expect(isUsableSshAlias(alias)).toBe(usable)
  })
})
