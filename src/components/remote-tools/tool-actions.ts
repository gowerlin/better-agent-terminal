/**
 * T0410 (PLAN-037 D): which action a tools-panel row offers.
 *
 * Commands always come from `buildInstallPlan()` / `buildUpdatePlan()` (T0409), which read only
 * the enum fields of the env. Nothing here passes a report string (`path`, `version`, ...) on.
 */

import {
  buildInstallPlan,
  buildUpdatePlan,
  isInstallPlan,
  type InstallPlan,
  type RecipeEnv,
  type UnsupportedReason,
} from '../../lib/remote-tools/recipes'
import type { RemoteToolReport, RemoteToolsReport } from '../../types/remote-tools'

export type ToolAction =
  | { kind: 'none' }
  | {
      kind: 'install'
      plan: InstallPlan
      /** install.sh recipe on a host without a usable curl (the recipe does not bring its own). */
      blockedByCurl: boolean
      /** T0555: node is already installed but not by nvm; this adds nvm's LTS next to it. */
      alongside?: boolean
    }
  | {
      kind: 'update'
      plan: InstallPlan
      /** claude below `HEALTHY_MIN`: newer models are rejected by the service. */
      emphasized: boolean
    }
  | { kind: 'unsupported'; reason: UnsupportedReason; docsUrl?: string }

/** Statuses where the tool is not usable from the login shell and an install would fix it. */
const NEEDS_INSTALL: ReadonlySet<RemoteToolReport['status']> = new Set(['missing', 'interop-only'])

/** Whether `curl` can run from the login shell (any other status means the install.sh recipes fail). */
export function isCurlUsable(report: RemoteToolsReport): boolean {
  return report.tools.find((tool) => tool.id === 'curl')?.status === 'ok'
}

/**
 * T0555: a runnable node. nvm's → "Update" to the newest LTS; any other (apt / dnf / brew) →
 * "Install LTS with nvm" next to it (the system node is never removed). Hosts without a recipe
 * (Alpine) show nothing for an installed node rather than an unsupported notice.
 */
function installedNodeAction(tool: RemoteToolReport, env: RecipeEnv, curlUsable: boolean): ToolAction {
  if (tool.nvmManaged) {
    const result = buildUpdatePlan('node', env)
    return isInstallPlan(result) ? { kind: 'update', plan: result, emphasized: false } : { kind: 'none' }
  }
  const result = buildInstallPlan('node', env)
  if (!isInstallPlan(result)) return { kind: 'none' }
  return { kind: 'install', plan: result, blockedByCurl: !curlUsable, alongside: true }
}

export function toolAction(tool: RemoteToolReport, env: RecipeEnv, curlUsable: boolean): ToolAction {
  if (tool.id === 'node' && tool.status === 'ok') return installedNodeAction(tool, env, curlUsable)
  if (tool.id === 'claude' && (tool.status === 'ok' || tool.status === 'too-old')) {
    const result = buildUpdatePlan('claude', env)
    return isInstallPlan(result)
      ? { kind: 'update', plan: result, emphasized: tool.status === 'too-old' }
      : { kind: 'unsupported', reason: result.unsupported, docsUrl: result.docsUrl }
  }
  if (!NEEDS_INSTALL.has(tool.status)) return { kind: 'none' }

  const result = buildInstallPlan(tool.id, env)
  if (!isInstallPlan(result)) return { kind: 'unsupported', reason: result.unsupported, docsUrl: result.docsUrl }
  // On apk the recipe installs curl itself as a prerequisite (T0409 `scriptPlan`).
  const blockedByCurl = !!result.scriptUrl && !curlUsable && env.pkgManager !== 'apk'
  return { kind: 'install', plan: result, blockedByCurl }
}
