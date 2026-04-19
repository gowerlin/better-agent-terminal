// Shared FileEntry type for FS IPC responses (PLAN-023 階段 3).
// `pathKey` is the canonical lookup key derived from `path` — see utils/filePathKey.toPathKey.
// Always populated at the renderer/IPC boundary (preload.ts) so consumers can compare
// entries via `a.pathKey === b.pathKey` without re-normalizing.

export interface FileEntry {
  name: string
  path: string
  pathKey: string
  isDirectory: boolean
}

export type RawFileEntry = Omit<FileEntry, 'pathKey'>
