import { WorkspaceMain } from '../../ui/WorkspacePrimitives';
import { BranchMappingsSection, ConfiguredEnvironmentsSection } from './environments-settings-support';
import type { EnvironmentSettingsViewProps } from './types';

export function EnvironmentsSettingsView({
  environments,
  environmentOptions,
  defaultEnvironmentId,
  environmentsDirty,
  savePending,
  readOnly = false,
  validation,
  onAddEnvironment,
  onSave,
  onDefaultEnvironmentChange,
  onDeleteEnvironment,
  onUpdateEnvironment,
  mappingsLoading,
  mappingsError,
  mappings,
  newMapping,
  createPending,
  updatePending,
  deletePending,
  canCreateMapping,
  onNewMappingChange,
  onCreateMapping,
  onUpdateMapping,
  onDeleteMapping,
}: EnvironmentSettingsViewProps) {
  const hasValidationIssues = Object.keys(validation).length > 0;

  return (
    <WorkspaceMain>
      <ConfiguredEnvironmentsSection
        environments={environments}
        environmentOptions={environmentOptions}
        defaultEnvironmentId={defaultEnvironmentId}
        environmentsDirty={environmentsDirty}
        savePending={savePending}
        readOnly={readOnly}
        validation={validation}
        onAddEnvironment={onAddEnvironment}
        onSave={onSave}
        onDefaultEnvironmentChange={onDefaultEnvironmentChange}
        onDeleteEnvironment={onDeleteEnvironment}
        onUpdateEnvironment={onUpdateEnvironment}
        mappingsLoading={mappingsLoading}
        mappingsError={mappingsError}
        mappings={mappings}
        newMapping={newMapping}
        createPending={createPending}
        updatePending={updatePending}
        deletePending={deletePending}
        canCreateMapping={canCreateMapping}
        onNewMappingChange={onNewMappingChange}
        onCreateMapping={onCreateMapping}
        onUpdateMapping={onUpdateMapping}
        onDeleteMapping={onDeleteMapping}
        hasValidationIssues={hasValidationIssues}
      />
      <BranchMappingsSection
        environments={environments}
        environmentOptions={environmentOptions}
        defaultEnvironmentId={defaultEnvironmentId}
        environmentsDirty={environmentsDirty}
        savePending={savePending}
        readOnly={readOnly}
        validation={validation}
        onAddEnvironment={onAddEnvironment}
        onSave={onSave}
        onDefaultEnvironmentChange={onDefaultEnvironmentChange}
        onDeleteEnvironment={onDeleteEnvironment}
        onUpdateEnvironment={onUpdateEnvironment}
        mappingsLoading={mappingsLoading}
        mappingsError={mappingsError}
        mappings={mappings}
        newMapping={newMapping}
        createPending={createPending}
        updatePending={updatePending}
        deletePending={deletePending}
        canCreateMapping={canCreateMapping}
        onNewMappingChange={onNewMappingChange}
        onCreateMapping={onCreateMapping}
        onUpdateMapping={onUpdateMapping}
        onDeleteMapping={onDeleteMapping}
      />
    </WorkspaceMain>
  );
}
