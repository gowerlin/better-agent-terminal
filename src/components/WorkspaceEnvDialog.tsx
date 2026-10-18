import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Workspace, EnvVariable } from '../types'
import { AgentPresetId, getAgentPreset, getVisiblePresets } from '../types/agent-presets'
import { settingsStore } from '../stores/settings-store'
import {
    hasWorkspaceArgsOverride,
    resolveEffectiveAgentArgs,
    resolveEffectiveDefaultAgent,
    type AgentLaunchSource,
} from '../lib/agent-launch-settings'
import { EnvVarEditor } from './EnvVarEditor'
import { ModalOverlay } from './common/ModalOverlay'

interface WorkspaceEnvDialogProps {
    workspace: Workspace
    onAdd: (envVar: EnvVariable) => void
    onRemove: (key: string) => void
    onUpdate: (key: string, updates: Partial<EnvVariable>) => void
    onClose: () => void
    /** PLAN-040 / T0529: undefined = follow the global Settings default agent. */
    onSetDefaultAgent?: (agent: AgentPresetId | undefined) => void
    /** T0529: a string (empty included) overrides the global args of the preset; undefined = follow Settings. */
    onSetAgentArg?: (presetId: string, args: string | undefined) => void
    /**
     * T0529 / D142: detached windows only show the values — `workspace:save` from a detached
     * window merges its terminal list only, so an edit there would never reach the main window.
     */
    readOnly?: boolean
}

function agentLabel(agentId: string): string {
    const preset = getAgentPreset(agentId)
    return preset ? `${preset.icon} ${preset.name}` : agentId
}

/** Workspace Settings (T0529): default agent, agent launch arguments, environment variables. */
export function WorkspaceEnvDialog({
    workspace,
    onAdd,
    onRemove,
    onUpdate,
    onClose,
    onSetDefaultAgent,
    onSetAgentArg,
    readOnly = false,
}: Readonly<WorkspaceEnvDialogProps>) {
    const { t } = useTranslation()
    const [settings, setSettings] = useState(settingsStore.getSettings())
    useEffect(() => settingsStore.subscribe(() => setSettings(settingsStore.getSettings())), [])

    const presets = getVisiblePresets().filter(p => p.id !== 'none')
    const globalDefault = resolveEffectiveDefaultAgent(null, settings)
    const effectiveDefault = resolveEffectiveDefaultAgent(workspace, settings)
    const sourceText = (source: AgentLaunchSource) => t(`workspaceSettings.source.${source}`)
    const canEdit = !readOnly

    return (
        <ModalOverlay className="dialog-overlay" onEscape={onClose}>
            <div className="workspace-env-dialog workspace-settings-dialog" onClick={e => e.stopPropagation()}>
                <div className="dialog-header">
                    <h2>{t('workspaceSettings.title')}</h2>
                    <span className="dialog-subtitle">{workspace.alias || workspace.name}</span>
                    <button className="dialog-close-btn" aria-label={t('common.close')} onClick={onClose}>×</button>
                </div>
                <div className="dialog-content">
                    {readOnly && (
                        <p className="workspace-settings-readonly" role="note">
                            {t('workspaceSettings.detachedReadOnly')}
                        </p>
                    )}

                    <section className="workspace-settings-section" data-testid="workspace-settings-agent">
                        <h3>{t('workspaceSettings.agentSection')}</h3>
                        <label className="workspace-settings-label" htmlFor="workspace-default-agent">
                            {t('workspaceSettings.defaultAgent')}
                        </label>
                        <select
                            id="workspace-default-agent"
                            value={typeof workspace.defaultAgent === 'string' ? workspace.defaultAgent : ''}
                            disabled={!canEdit}
                            onChange={e => onSetDefaultAgent?.(e.target.value ? e.target.value as AgentPresetId : undefined)}
                        >
                            <option value="">
                                {t('workspaceSettings.followGlobal', { agent: agentLabel(globalDefault.agent) })}
                            </option>
                            {presets.map(preset => (
                                <option key={preset.id} value={preset.id}>
                                    {preset.icon} {preset.name}
                                </option>
                            ))}
                        </select>
                        <p className="workspace-settings-effective" data-testid="workspace-effective-agent">
                            {t('workspaceSettings.effectiveAgent', {
                                agent: agentLabel(effectiveDefault.agent),
                                source: sourceText(effectiveDefault.source),
                            })}
                        </p>

                        <label className="workspace-settings-label">{t('workspaceSettings.launchArgs')}</label>
                        <p className="env-dialog-hint">{t('workspaceSettings.launchArgsHint')}</p>
                        <div className="workspace-args-list">
                            {presets.map(preset => {
                                const overridden = hasWorkspaceArgsOverride(workspace, preset.id)
                                const globalArgs = resolveEffectiveAgentArgs(null, settings, preset.id).args
                                const effective = resolveEffectiveAgentArgs(workspace, settings, preset.id)
                                return (
                                    <div key={preset.id} className="workspace-args-row" data-preset={preset.id}>
                                        <span className="workspace-args-name" style={{ color: preset.color }}>
                                            {preset.icon} {preset.name}
                                        </span>
                                        <label className="workspace-args-override" title={t('workspaceSettings.overrideHint')}>
                                            <input
                                                type="checkbox"
                                                checked={overridden}
                                                disabled={!canEdit}
                                                onChange={e => onSetAgentArg?.(preset.id, e.target.checked ? globalArgs : undefined)}
                                            />
                                            {t('workspaceSettings.override')}
                                        </label>
                                        <input
                                            type="text"
                                            className={`workspace-args-input${overridden ? '' : ' inherited'}`}
                                            value={overridden ? (workspace.agentCustomArgs?.[preset.id] ?? '') : globalArgs}
                                            readOnly={!overridden || !canEdit}
                                            disabled={!canEdit}
                                            placeholder={overridden ? t('workspaceSettings.emptyOverride') : t('workspaceSettings.globalNone')}
                                            onChange={e => onSetAgentArg?.(preset.id, e.target.value)}
                                            title={t('workspaceSettings.effectiveArgs', {
                                                args: effective.args || t('workspaceSettings.noArgs'),
                                                source: sourceText(effective.source),
                                            })}
                                        />
                                        <span className={`workspace-args-source source-${effective.source}`}>
                                            {sourceText(effective.source)}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </section>

                    <section className="workspace-settings-section">
                        <h3>{t('envVars.title')}</h3>
                        <p className="env-dialog-hint">
                            {t('envVars.workspaceHint')}
                        </p>
                        {readOnly ? (
                            <div className="env-var-list">
                                {(workspace.envVars || []).length === 0 ? (
                                    <div className="env-var-empty">{t('envVars.noEnvVars')}</div>
                                ) : (
                                    (workspace.envVars || []).map(envVar => (
                                        <div key={envVar.key} className={`workspace-env-readonly${envVar.enabled ? '' : ' disabled'}`}>
                                            <code>{envVar.key}</code>=<code>{envVar.value}</code>
                                        </div>
                                    ))
                                )}
                            </div>
                        ) : (
                            <EnvVarEditor
                                envVars={workspace.envVars || []}
                                onAdd={onAdd}
                                onRemove={onRemove}
                                onUpdate={onUpdate}
                            />
                        )}
                    </section>
                </div>
            </div>
        </ModalOverlay>
    )
}
