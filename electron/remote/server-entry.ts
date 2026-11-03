export {
  createHeadlessServer,
  getHeadlessBundleVersion,
  loadOrGenerateToken,
  type HeadlessHandlerRegistration,
  type HeadlessServer,
  type HeadlessServerInfo,
  type HeadlessServerOptions,
} from './headless-entry'
export type { HandlerContext as RemoteHandlerContext } from './handler-registry'
export { resolveDefaultDataDir } from './dataDir'
// PLAN-057 / T0755: called by scripts/bat-server.mjs before createHeadlessServer
export { applyHeadlessLoginShellPath } from './headless-login-path'
// BUG-206 / T0807: called by scripts/bat-server.mjs first thing in main(), before anything spawns
export { installChildProcessFdGuard } from '../child-process-fd-guard'
