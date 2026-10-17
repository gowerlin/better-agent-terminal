// PLAN-047 M1 / T0582: secrets masked out of terminal:read-output.
import { describe, expect, it } from 'vitest'
import { redactTerminalSecrets } from '../terminal-output-redaction'

// Built at run time so no literal secret-looking string sits in the source.
const b64 = (n: number, seed = 'Ab3') => (seed.repeat(Math.ceil(n / seed.length))).slice(0, n)
const BATCAP = 'batcap.' + b64(43, 'xY9_')
const SERVER_TOKEN = b64(43, 'Qw7-')

describe('redactTerminalSecrets', () => {
  it('leaves plain output alone', () => {
    const text = 'PS C:\\work> npm test\n  ✓ 12 passed\ncommit 0123456789abcdef0123456789abcdef01234567\n'
    expect(redactTerminalSecrets(text)).toEqual({ text, count: 0 })
  })

  it('masks a batcap. capability (also inside an env dump)', () => {
    const r = redactTerminalSecrets(`token is ${BATCAP} ok`)
    expect(r.text).toBe('token is [REDACTED:batcap] ok')
    expect(r.count).toBe(1)
    const env = redactTerminalSecrets(`BAT_REMOTE_TOKEN=${BATCAP}\nBAT_REMOTE_PORT=9876`)
    expect(env.text).toBe('BAT_REMOTE_TOKEN=[REDACTED:batcap]\nBAT_REMOTE_PORT=9876')
    expect(env.count).toBe(1)
  })

  it('masks a known secret literally, and the 43-char server token form', () => {
    const literal = 'abcdef0123456789abcdef0123456789'
    expect(redactTerminalSecrets(`x ${literal} y`, [literal]).text).toBe('x [REDACTED:server-token] y')
    expect(redactTerminalSecrets(`x ${SERVER_TOKEN} y`).text).toBe('x [REDACTED:server-token] y')
    // a short known secret is never matched literally (it would mask too much)
    expect(redactTerminalSecrets('abc abc', ['abc']).text).toBe('abc abc')
    // all lower case / no digit: not the server token form
    const word = 'a'.repeat(43)
    expect(redactTerminalSecrets(word).count).toBe(0)
  })

  it('masks sk- / GitHub / AWS keys', () => {
    const sk = 'sk-ant-api03-' + b64(40)
    const ghp = 'ghp_' + b64(36, 'Zz9')
    const pat = 'github_pat_' + b64(30, 'Kk1_')
    const aws = 'AKIA' + 'ABCDEFGHIJ234567'
    const r = redactTerminalSecrets(`a ${sk}\nb ${ghp}\nc ${pat}\nd ${aws}\n`)
    expect(r.text).toBe('a [REDACTED:sk]\nb [REDACTED:github]\nc [REDACTED:github]\nd [REDACTED:aws]\n')
    expect(r.count).toBe(4)
  })

  it('masks Authorization header values and Bearer tokens', () => {
    const r = redactTerminalSecrets(`> Authorization: Bearer ${b64(30)}\n< x-id: 1\ncurl -H "Bearer ${b64(24, 'Lm2')}"`)
    expect(r.text).toBe('> Authorization: [REDACTED:authorization]\n< x-id: 1\ncurl -H "Bearer [REDACTED:bearer]"')
    expect(r.count).toBe(2)
  })

  it('masks a PEM private key block, unterminated, and one whose BEGIN came earlier', () => {
    const body = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASC\nBKcwggSjAgEAAoIBAQC7\n'
    const pem = `-----BEGIN RSA PRIVATE KEY-----\n${body}-----END RSA PRIVATE KEY-----`
    expect(redactTerminalSecrets(`before\n${pem}\nafter`).text).toBe('before\n[REDACTED:pem]\nafter')
    expect(redactTerminalSecrets(`before\n-----BEGIN PRIVATE KEY-----\n${body}`).text).toBe('before\n[REDACTED:pem]')
    expect(redactTerminalSecrets(`${body}-----END PRIVATE KEY-----\nafter`).text).toBe('[REDACTED:pem]\nafter')
    // a public key / certificate is not a secret
    const cert = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----'
    expect(redactTerminalSecrets(cert).count).toBe(0)
  })

  it('masks NAME=value for secret-ish names', () => {
    const r = redactTerminalSecrets('GH_TOKEN=abc123xyz\nDB_PASSWORD: "hunter22"\nOPENAI_API_KEY=k\nPATH=/usr/bin')
    expect(r.text).toBe('GH_TOKEN=[REDACTED:secret-env]\nDB_PASSWORD: [REDACTED:secret-env]\nOPENAI_API_KEY=[REDACTED:secret-env]\nPATH=/usr/bin')
    expect(r.count).toBe(3)
  })

  it('does not count an already masked value twice', () => {
    const r = redactTerminalSecrets(`GITHUB_TOKEN=${'ghp_' + b64(36)}`)
    expect(r.text).toBe('GITHUB_TOKEN=[REDACTED:github]')
    expect(r.count).toBe(1)
  })

  it('masks a prefixed token cut off at the end of the text, whatever its length', () => {
    expect(redactTerminalSecrets('BAT_REMOTE_TOKEN=batcap.ab').text).toBe('BAT_REMOTE_TOKEN=[REDACTED:batcap]')
    expect(redactTerminalSecrets('key sk-ab').text).toBe('key [REDACTED:sk]')
    expect(redactTerminalSecrets('ghp_x').text).toBe('[REDACTED:github]')
    // not at the end: a short one is not a token
    expect(redactTerminalSecrets('batcap.ab and more').count).toBe(0)
  })
})
