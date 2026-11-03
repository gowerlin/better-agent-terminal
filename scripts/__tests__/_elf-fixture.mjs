// T0800 / BUG-204 test helper (not a test file): a minimal ELF shared object with a dynamic section,
// written by hand so scripts/linux-whisper-runpath.cjs can be tested on any host without a toolchain.
// One PT_LOAD covering the whole file (vaddr = BASE + offset) and one PT_DYNAMIC; the string table sits
// between the program headers and the dynamic array.

const BASE = 0x10000
const DT = { NULL: 0, NEEDED: 1, STRTAB: 5, STRSZ: 10, SONAME: 14, RPATH: 15, RUNPATH: 29 }

/**
 * @param {{ needed?: string[], soname?: string|null, runpath?: string|null, rpath?: string|null,
 *           machine?: number, is64?: boolean, littleEndian?: boolean, dynamic?: boolean }} opts
 * @returns {Buffer}
 */
export function makeElfSharedObject({
  needed = [], soname = null, runpath = null, rpath = null,
  machine = 0x3e, is64 = true, littleEndian = true, dynamic = true,
} = {}) {
  const ehsize = is64 ? 64 : 52
  const phentsize = is64 ? 56 : 32
  const phnum = dynamic ? 2 : 1
  const phoff = ehsize

  const strings = [Buffer.from([0])]
  let strLen = 1
  const addString = (s) => {
    const at = strLen
    const b = Buffer.from(`${s}\0`, 'utf8')
    strings.push(b)
    strLen += b.length
    return at
  }
  const entries = []
  for (const n of needed) entries.push([DT.NEEDED, addString(n)])
  if (soname !== null) entries.push([DT.SONAME, addString(soname)])
  if (rpath !== null) entries.push([DT.RPATH, addString(rpath)])
  if (runpath !== null) entries.push([DT.RUNPATH, addString(runpath)])
  const strtab = Buffer.concat(strings)

  const strOff = phoff + phentsize * phnum
  const dynOff = Math.ceil((strOff + strtab.length) / 8) * 8
  entries.push([DT.STRTAB, BASE + strOff], [DT.STRSZ, strtab.length], [DT.NULL, 0])
  const dynEntSize = is64 ? 16 : 8
  const total = dynamic ? dynOff + entries.length * dynEntSize : strOff
  const buf = Buffer.alloc(total)

  const w16 = (v, o) => (littleEndian ? buf.writeUInt16LE(v, o) : buf.writeUInt16BE(v, o))
  const w32 = (v, o) => (littleEndian ? buf.writeUInt32LE(v, o) : buf.writeUInt32BE(v, o))
  const w64 = (v, o) => (littleEndian ? buf.writeBigUInt64LE(BigInt(v), o) : buf.writeBigUInt64BE(BigInt(v), o))
  const word = is64 ? w64 : w32

  buf.writeUInt32BE(0x7f454c46, 0)
  buf[4] = is64 ? 2 : 1
  buf[5] = littleEndian ? 1 : 2
  buf[6] = 1
  w16(3, 16) // ET_DYN
  w16(machine, 18)
  w32(1, 20)
  if (is64) {
    w64(phoff, 0x20)
    w16(ehsize, 0x34)
    w16(phentsize, 0x36)
    w16(phnum, 0x38)
  } else {
    w32(phoff, 0x1c)
    w16(ehsize, 0x28)
    w16(phentsize, 0x2a)
    w16(phnum, 0x2c)
  }

  const phdr = (i, type, offset, filesz) => {
    const p = phoff + i * phentsize
    w32(type, p)
    if (is64) {
      w32(6, p + 4)
      w64(offset, p + 8)
      w64(BASE + offset, p + 16)
      w64(BASE + offset, p + 24)
      w64(filesz, p + 32)
      w64(filesz, p + 40)
      w64(8, p + 48)
    } else {
      w32(offset, p + 4)
      w32(BASE + offset, p + 8)
      w32(BASE + offset, p + 12)
      w32(filesz, p + 16)
      w32(filesz, p + 20)
      w32(6, p + 24)
      w32(4, p + 28)
    }
  }
  phdr(0, 1, 0, total) // PT_LOAD: the whole file
  if (dynamic) phdr(1, 2, dynOff, entries.length * dynEntSize) // PT_DYNAMIC

  strtab.copy(buf, strOff)
  if (dynamic) {
    entries.forEach(([tag, val], i) => {
      const o = dynOff + i * dynEntSize
      word(tag, o)
      word(val, o + dynEntSize / 2)
    })
  }
  return buf
}

/**
 * The whisper `dist/linux-x64` set as upstream v1.1.0 links it (bundled NEEDED chain), with `runpath`
 * on every file: `{ <file name>: Buffer }`.
 */
export function whisperLinuxFiles(runpath = '$ORIGIN', machine = 0x3e) {
  const so = (needed, soname) => makeElfSharedObject({ needed, soname, runpath, machine })
  const libwhisper = so(['libggml.so', 'libggml-base.so', 'libstdc++.so.6', 'libc.so.6'], 'libwhisper.so.1')
  return {
    'whisper.node': so(['libwhisper.so.1', 'libstdc++.so.6', 'libc.so.6'], 'addon.node.node'),
    'libwhisper.so': libwhisper,
    'libwhisper.so.1': libwhisper,
    'libwhisper.so.1.7.6': libwhisper,
    'libggml.so': so(['libggml-cpu.so', 'libggml-vulkan.so', 'libggml-base.so', 'libc.so.6'], 'libggml.so'),
    'libggml-base.so': so(['libc.so.6'], 'libggml-base.so'),
    'libggml-cpu.so': so(['libggml-base.so', 'libgomp.so.1', 'libc.so.6'], 'libggml-cpu.so'),
    'libggml-vulkan.so': so(['libggml-base.so', 'libvulkan.so.1', 'libc.so.6'], 'libggml-vulkan.so'),
    'vulkan-shaders-gen': makeElfSharedObject({ needed: ['libc.so.6'], runpath: '/home/runner/build', machine }),
  }
}
