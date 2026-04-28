import { describe, it, expect } from 'vitest'
import {
  extractFrontmatterBlock,
  parseFrontmatterYaml,
  detectStatusDrift,
  normalizeStatusForCompare,
  type CtWorkorderFrontmatterV1,
} from '../../utils/ct-frontmatter'

describe('extractFrontmatterBlock', () => {
  it('returns null raw when no frontmatter present', () => {
    const r = extractFrontmatterBlock('# T0001 — title\n\nbody')
    expect(r.raw).toBeNull()
    expect(r.body).toBe('# T0001 — title\n\nbody')
  })

  it('extracts simple frontmatter and trims the delimiter', () => {
    const content = '---\nschema_version: 1\nschema_kind: workorder\nid: T0001\n---\n# T0001\n'
    const r = extractFrontmatterBlock(content)
    expect(r.raw).toContain('schema_version: 1')
    expect(r.body).toBe('# T0001\n')
  })

  it('handles CRLF line endings', () => {
    const content = '---\r\nschema_version: 1\r\nschema_kind: workorder\r\nid: T0001\r\n---\r\nbody'
    const r = extractFrontmatterBlock(content)
    expect(r.raw).toContain('schema_version: 1')
    expect(r.body).toBe('body')
  })

  it('returns null when --- only appears mid-document', () => {
    const r = extractFrontmatterBlock('# header\n\n---\nfoo: bar\n---\n')
    expect(r.raw).toBeNull()
  })
})

describe('parseFrontmatterYaml', () => {
  it('accepts valid v1 frontmatter', () => {
    const raw = 'schema_version: 1\nschema_kind: workorder\nid: T0001\nstatus: DONE'
    const r = parseFrontmatterYaml<CtWorkorderFrontmatterV1>(raw, 'workorder')
    expect(r.warning).toBeNull()
    expect(r.data?.id).toBe('T0001')
    expect(r.data?.status).toBe('DONE')
  })

  it('rejects schema_version != 1', () => {
    const raw = 'schema_version: 2\nschema_kind: workorder\nid: T0001'
    const r = parseFrontmatterYaml(raw, 'workorder')
    expect(r.data).toBeNull()
    expect(r.warning?.kind).toBe('invalid_frontmatter')
    expect(r.warning?.field).toBe('schema_version')
  })

  it('rejects mismatched schema_kind', () => {
    const raw = 'schema_version: 1\nschema_kind: bug\nid: T0001'
    const r = parseFrontmatterYaml(raw, 'workorder')
    expect(r.data).toBeNull()
    expect(r.warning?.field).toBe('schema_kind')
  })

  it('rejects missing id', () => {
    const raw = 'schema_version: 1\nschema_kind: workorder'
    const r = parseFrontmatterYaml(raw, 'workorder')
    expect(r.data).toBeNull()
    expect(r.warning?.field).toBe('id')
  })

  it('rejects malformed YAML', () => {
    const raw = 'schema_version: 1\nschema_kind: workorder\n  bad indent: [unclosed'
    const r = parseFrontmatterYaml(raw, 'workorder')
    expect(r.data).toBeNull()
    expect(r.warning?.kind).toBe('invalid_frontmatter')
  })

  it('rejects array root', () => {
    const r = parseFrontmatterYaml('- schema_version: 1', 'workorder')
    expect(r.data).toBeNull()
  })
})

describe('normalizeStatusForCompare', () => {
  it('strips emoji prefix', () => {
    expect(normalizeStatusForCompare('✅ DONE')).toBe('DONE')
    expect(normalizeStatusForCompare('🔄 IN_PROGRESS')).toBe('IN_PROGRESS')
  })

  it('uppercases', () => {
    expect(normalizeStatusForCompare('done')).toBe('DONE')
  })

  it('trims trailing parenthetical', () => {
    expect(normalizeStatusForCompare('DONE (備注)')).toBe('DONE')
  })

  it('returns empty string for null/undefined', () => {
    expect(normalizeStatusForCompare(undefined)).toBe('')
    expect(normalizeStatusForCompare(null)).toBe('')
  })
})

describe('detectStatusDrift', () => {
  it('returns null when both normalize equal', () => {
    expect(detectStatusDrift('DONE', '✅ DONE')).toBeNull()
  })

  it('detects mismatch and includes both raw values', () => {
    const w = detectStatusDrift('IN_PROGRESS', '📋 PENDING')
    expect(w).not.toBeNull()
    expect(w?.kind).toBe('metadata_drift')
    expect(w?.frontmatter_value).toBe('IN_PROGRESS')
    expect(w?.body_value).toBe('📋 PENDING')
  })

  it('returns null when one side is empty', () => {
    expect(detectStatusDrift('DONE', undefined)).toBeNull()
    expect(detectStatusDrift(undefined, 'DONE')).toBeNull()
  })
})
