// T0858 — test fixture for the Windows PTY holder (scripts/pty-holder.cjs).
//
// A real holder carries the pinned ~90 MB node.exe, which tests cannot fabricate. This fixture swaps the pin of one
// arch for a tiny hand-written PE image, in this process only (`useFakeHolderNode` returns the restore function),
// and writes a fake but self-consistent `<resources>/pty-holder/` with the real manifest code.
//
// Required with `node --require <this file>` and BAT_TEST_FAKE_PTY_HOLDER_NODE=1, it swaps the x64 pin at load: the
// CLI tests of scripts/verify-packaged-native.js use that. Product code never reads this file or the variable.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const holder = require('../pty-holder.cjs');

const PE_MACHINES = { x64: 0x8664, arm64: 0xaa64 };

/** Minimal PE image: MZ, e_lfanew = 0x40, "PE\0\0", Machine. */
function fakePe(machine, filler = 'fake-node') {
  const buf = Buffer.alloc(512);
  buf.write('MZ', 0, 'latin1');
  buf.writeUInt32LE(0x40, 0x3c);
  buf.writeUInt32LE(0x00004550, 0x40);
  buf.writeUInt16LE(machine, 0x44);
  buf.write(filler, 0x100, 'latin1');
  return buf;
}

function fakeNodeExe(arch = 'x64') {
  return fakePe(PE_MACHINES[arch], `fake-node-${arch}`);
}

/** T0859: stands in for Node's 157 KB LICENSE (the pin is swapped together with node.exe). */
function fakeNodeLicense() {
  return Buffer.from('Node.js is licensed for use as follows: (fake, T0859 test fixture)\n', 'utf8');
}

/** Swaps the pin of `arch` (and the Node LICENSE pin) for fakeNodeExe(arch) / fakeNodeLicense(); returns the restore function. */
function useFakeHolderNode(arch = 'x64') {
  const original = holder.PTY_HOLDER_NODE.binaries[arch];
  const originalLicense = holder.PTY_HOLDER_NODE.license;
  const exe = fakeNodeExe(arch);
  const license = fakeNodeLicense();
  holder.PTY_HOLDER_NODE.binaries[arch] = {
    path: original.path,
    size: exe.length,
    sha256: crypto.createHash('sha256').update(exe).digest('hex'),
  };
  holder.PTY_HOLDER_NODE.license = { size: license.length, sha256: crypto.createHash('sha256').update(license).digest('hex') };
  return () => {
    holder.PTY_HOLDER_NODE.binaries[arch] = original;
    holder.PTY_HOLDER_NODE.license = originalLicense;
  };
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

/**
 * The app files the holder is assembled from (`<resources>/app.asar.unpacked/…`): terminal-server.js requiring only
 * node builtins and @lydell/node-pty, the node-pty JS package (plus a .d.ts / README that must not be copied), and
 * the win32 native package (plus a .pdb that must not be copied).
 */
function writeFakeAppFiles(resources, arch = 'x64', { serverSource } = {}) {
  const unpacked = path.join(resources, 'app.asar.unpacked');
  write(path.join(unpacked, 'dist-electron', 'terminal-server.js'), serverSource ?? '"use strict";\nconst net = require("net");\nconst fs = require("node:fs");\nconst pty = require("@lydell/node-pty");\nconst x = require("./terminal-server/protocol");\n');
  const pty = path.join(unpacked, 'node_modules', '@lydell', 'node-pty');
  write(path.join(pty, 'package.json'), '{"name":"@lydell/node-pty","main":"./index.js"}\n');
  write(path.join(pty, 'LICENSE'), 'MIT\n');
  write(path.join(pty, 'index.js'), 'module.exports = {}\n');
  write(path.join(pty, 'conpty_console_list_agent.js'), '// agent\n');
  write(path.join(pty, 'worker', 'conoutSocketWorker.js'), '// worker\n');
  write(path.join(pty, 'node-pty.d.ts'), 'export {}\n');
  write(path.join(pty, 'README.md'), '# readme\n');
  const native = path.join(unpacked, 'node_modules', '@lydell', `node-pty-win32-${arch}`);
  write(path.join(native, 'package.json'), `{"name":"@lydell/node-pty-win32-${arch}"}\n`);
  write(path.join(native, 'conpty.node'), fakePe(PE_MACHINES[arch], 'conpty'));
  write(path.join(native, 'conpty_console_list.node'), fakePe(PE_MACHINES[arch], 'list'));
  write(path.join(native, 'conpty.pdb'), 'pdb');
}

/**
 * Writes `<resources>/pty-holder/` as the afterPack hook would, from fake app files and a fake node.exe. The caller
 * must have swapped the pin (useFakeHolderNode) for the result to pass ptyHolderProblems.
 */
function writeFakeHolder(resources, arch = 'x64') {
  writeFakeAppFiles(resources, arch);
  const exe = path.join(resources, '..', `fake-node-${arch}.exe`);
  write(exe, fakeNodeExe(arch));
  const license = path.join(resources, '..', 'fake-node-LICENSE');
  write(license, fakeNodeLicense());
  const result = holder.assemblePtyHolder(resources, arch, exe, license);
  fs.rmSync(exe, { force: true });
  fs.rmSync(license, { force: true });
  return result;
}

if (process.env.BAT_TEST_FAKE_PTY_HOLDER_NODE === '1') useFakeHolderNode('x64');

module.exports = { PE_MACHINES, fakePe, fakeNodeExe, fakeNodeLicense, useFakeHolderNode, writeFakeAppFiles, writeFakeHolder };
