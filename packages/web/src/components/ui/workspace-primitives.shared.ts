export const WORKSPACE_STATUS_COLUMN_WIDTH = 152;
export const WORKSPACE_TIMESTAMP_COLUMN_WIDTH = 188;
export const WORKSPACE_HEADER_ACTIONS_RAIL_INSET = 'var(--mantine-spacing-sm)';
export const WORKSPACE_TABLE_CONTENT_RAIL_INSET = '16px';
export const WORKSPACE_HEADER_ACTION_SIZE = 'input-sm';
export const WORKSPACE_SIDEBAR_CONTENT_INSET = 'var(--mantine-spacing-md)';
export const WORKSPACE_SIDEBAR_TOGGLE_SLOT = 32;
export const WORKSPACE_SIDEBAR_ROW_RADIUS = 'var(--mantine-radius-md)';
export const WORKSPACE_TRANSITION_FAST = '120ms ease';
export const WORKSPACE_TRANSITION_BG = `background-color ${WORKSPACE_TRANSITION_FAST}`;
export const WORKSPACE_TRANSITION_COLOR = `color ${WORKSPACE_TRANSITION_FAST}`;
export const WORKSPACE_TRANSITION_BORDER = `border-color ${WORKSPACE_TRANSITION_FAST}`;
export const WORKSPACE_TRANSITION_SHADOW = `box-shadow ${WORKSPACE_TRANSITION_FAST}`;
export const WORKSPACE_SHELL_HEADER_BG = 'var(--ori-shell-header-bg)';
export const WORKSPACE_SHELL_PRIMARY_RAIL_BG = 'var(--ori-shell-primary-rail-bg)';
export const WORKSPACE_SHELL_SECONDARY_RAIL_BG = 'var(--ori-shell-secondary-rail-bg)';
export const WORKSPACE_SHELL_TOP_SURFACE_BG = 'var(--ori-shell-top-surface-bg)';
export const WORKSPACE_SHELL_MAIN_BG = 'var(--ori-shell-main-bg)';
export const WORKSPACE_SHELL_BORDER_COLOR = 'var(--ori-shell-border-color)';
export const WORKSPACE_SHELL_TEXT = 'var(--ori-shell-text)';
export const WORKSPACE_SHELL_MUTED_TEXT = 'var(--ori-shell-muted-text)';
export const WORKSPACE_SHELL_DESCRIPTION_TEXT = 'var(--ori-shell-description-text)';
export const WORKSPACE_SHELL_ACTIVE_BG = 'var(--ori-shell-active-bg)';
export const WORKSPACE_SHELL_ACTIVE_HOVER = 'var(--ori-shell-active-hover)';
export const WORKSPACE_SHELL_ACTIVE_TEXT = 'var(--ori-shell-active-text)';
export const WORKSPACE_SHELL_CONTROL_BG = 'var(--ori-shell-control-bg)';
export const WORKSPACE_SHELL_CONTROL_HOVER = 'var(--ori-shell-control-hover)';
export const WORKSPACE_SHELL_CONTROL_BORDER = 'var(--ori-shell-control-border)';
export const WORKSPACE_FORM_SURFACE_BG = 'var(--ori-form-surface-bg)';
export const WORKSPACE_FORM_SECTION_BORDER = 'var(--ori-form-section-border)';
export const WORKSPACE_FORM_LABEL_COLOR = 'var(--ori-form-label-color)';
export const WORKSPACE_FORM_DESCRIPTION_COLOR = 'var(--ori-form-description-color)';
export const WORKSPACE_FORM_PREVIEW_BG = 'var(--ori-form-preview-bg)';

export const workspaceShellChromeStyles = {
  headerBackground: WORKSPACE_SHELL_HEADER_BG,
  primaryRailBackground: WORKSPACE_SHELL_PRIMARY_RAIL_BG,
  secondaryRailBackground: WORKSPACE_SHELL_SECONDARY_RAIL_BG,
  topSurfaceBackground: WORKSPACE_SHELL_TOP_SURFACE_BG,
  mainBackground: WORKSPACE_SHELL_MAIN_BG,
  borderColor: WORKSPACE_SHELL_BORDER_COLOR,
  textColor: WORKSPACE_SHELL_TEXT,
  mutedTextColor: WORKSPACE_SHELL_MUTED_TEXT,
  activeBackground: WORKSPACE_SHELL_ACTIVE_BG,
  activeHoverBackground: WORKSPACE_SHELL_ACTIVE_HOVER,
  activeTextColor: WORKSPACE_SHELL_ACTIVE_TEXT,
  controlBackground: WORKSPACE_SHELL_CONTROL_BG,
  controlHoverBackground: WORKSPACE_SHELL_CONTROL_HOVER,
  controlBorderColor: WORKSPACE_SHELL_CONTROL_BORDER,
} as const;
