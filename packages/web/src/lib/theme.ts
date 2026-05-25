import type { CSSVariablesResolver, MantineColorShade, MantineColorsTuple, MantineThemeOverride } from '@mantine/core';
import { ActionIcon, Badge, Button, createTheme, Input, InputWrapper, Paper, Table } from '@mantine/core';

export type AppThemePackName = 'light' | 'dark';

type AppThemePalette = {
  primaryColor: string;
  primaryShade: MantineColorShade;
  black: string;
  white: string;
  colors: Record<string, MantineColorsTuple>;
};

type AppThemeTokens = {
  mantineDimmed: string;
  logoStroke: string;
  logoTopBar: string;
  logoLeftBlock: string;
  logoRightBlock: string;
  shellHeaderBg: string;
  shellPrimaryRailBg: string;
  shellSecondaryRailBg: string;
  shellTopSurfaceBg: string;
  shellMainBg: string;
  shellBorderColor: string;
  shellText: string;
  shellMutedText: string;
  shellDescriptionText: string;
  shellActiveBg: string;
  shellActiveHover: string;
  shellActiveText: string;
  shellControlBg: string;
  shellControlHover: string;
  shellControlBorder: string;
  shellControlBorderStrong: string;
  formSurfaceBg: string;
  formSectionBg: string;
  formSectionHeaderBg: string;
  formSectionBorder: string;
  formLabelColor: string;
  formDescriptionColor: string;
  formInputBg: string;
  formInputText: string;
  formInputPlaceholder: string;
  formInputBorder: string;
  formInputBorderHover: string;
  formInputBorderFocus: string;
  formInputReadonlyBg: string;
  formInputReadonlyBorder: string;
  formInputReadonlyText: string;
  formFieldEdited: string;
  formPreviewBg: string;
  selectionBg: string;
  selectionBorder: string;
  selectionRing: string;
  selectionText: string;
  brandPrimaryBg: string;
  brandPrimaryHover: string;
  brandPrimaryBorder: string;
  brandPrimaryText: string;
  tableBg: string;
  tableRowBg: string;
  tableRowHoverBg: string;
  tableHeaderBg: string;
  tableBorder: string;
  tableBorderStrong: string;
  tableText: string;
  tableHeaderText: string;
  tableLink: string;
  tableLinkHover: string;
};

type AppThemePack = {
  colorScheme: 'light' | 'dark';
  palette: AppThemePalette;
  tokens: AppThemeTokens;
};

const steelBlue: MantineColorsTuple = [
  '#e8eef5',
  '#d8e2ee',
  '#c8d6e7',
  '#b8cae0',
  '#a8bed9',
  '#8aaed4',
  '#7a9ec4',
  '#6a8eb4',
  '#5a7ea4',
  '#4a6e94',
];

const sageGreen: MantineColorsTuple = [
  '#e4f0e8',
  '#d4e8da',
  '#c4e0cc',
  '#b4d8be',
  '#a4d0b0',
  '#7db88a',
  '#6da87a',
  '#5d986a',
  '#4d885a',
  '#3d784a',
];

const copper: MantineColorsTuple = [
  '#f5ebe4',
  '#eee0d6',
  '#e7d5c8',
  '#e0caba',
  '#d9bfac',
  '#c48b6e',
  '#b47b5e',
  '#a46b4e',
  '#945b3e',
  '#844b2e',
];

const dustyRose: MantineColorsTuple = [
  '#f5e8e8',
  '#eed8d8',
  '#e7c8c8',
  '#e0b8b8',
  '#d9a8a8',
  '#c48b8b',
  '#b47b7b',
  '#a46b6b',
  '#945b5b',
  '#844b4b',
];

const slateBlue: MantineColorsTuple = [
  '#e4e8f0',
  '#d4dae8',
  '#c4cce0',
  '#b4bed8',
  '#a4b0d0',
  '#8a9bbd',
  '#7a8bad',
  '#6a7b9d',
  '#5a6b8d',
  '#4a5b7d',
];

const brickRed: MantineColorsTuple = [
  '#f5e4e4',
  '#eed4d4',
  '#e7c4c4',
  '#e0b4b4',
  '#d9a4a4',
  '#c47070',
  '#b46060',
  '#a45050',
  '#944040',
  '#843030',
];

const warmAmber: MantineColorsTuple = [
  '#f5f0e4',
  '#eee8d4',
  '#e7e0c4',
  '#e0d8b4',
  '#d9d0a4',
  '#d4b86a',
  '#c4a85a',
  '#b4984a',
  '#a4883a',
  '#94782a',
];

const coolGray: MantineColorsTuple = [
  '#e8e9ec',
  '#d8d9dc',
  '#c8c9cc',
  '#b8b9bc',
  '#a8a9ac',
  '#8a92a3',
  '#7a8293',
  '#6a7283',
  '#5a6273',
  '#4a5263',
];

const charcoalSlate: MantineColorsTuple = [
  '#d0d4dc',
  '#b8bcc4',
  '#a0a4ac',
  '#888c94',
  '#70747c',
  '#4a5262',
  '#3a4252',
  '#2a3242',
  '#1a2232',
  '#0a1212',
];

const themePacks: Record<AppThemePackName, AppThemePack> = {
  light: {
    colorScheme: 'light',
    palette: {
      primaryColor: 'blue',
      primaryShade: 6,
      black: '#172033',
      white: '#ffffff',
      colors: {
        blue: steelBlue,
        cyan: steelBlue,
        green: sageGreen,
        teal: sageGreen,
        orange: copper,
        pink: dustyRose,
        purple: slateBlue,
        red: brickRed,
        yellow: warmAmber,
        gray: coolGray,
        slate: charcoalSlate,
      },
    },
    tokens: {
      mantineDimmed: '#667085',
      logoStroke: '#3158c9',
      logoTopBar: '#2454d6',
      logoLeftBlock: '#172033',
      logoRightBlock: '#5f6f85',
      shellHeaderBg: '#ffffff',
      shellPrimaryRailBg: '#172033',
      shellSecondaryRailBg: '#f3f6fb',
      shellTopSurfaceBg: '#ffffff',
      shellMainBg: '#f7f8fb',
      shellBorderColor: '#d9e2ec',
      shellText: '#172033',
      shellMutedText: '#5f6f85',
      shellDescriptionText: '#667085',
      shellActiveBg: 'rgba(49, 88, 201, 0.10)',
      shellActiveHover: 'rgba(49, 88, 201, 0.15)',
      shellActiveText: '#2454d6',
      shellControlBg: '#ffffff',
      shellControlHover: '#eef3fb',
      shellControlBorder: '#d9e2ec',
      shellControlBorderStrong: '#b8c4d4',
      formSurfaceBg: '#ffffff',
      formSectionBg: '#ffffff',
      formSectionHeaderBg: '#f3f6fb',
      formSectionBorder: '#d9e2ec',
      formLabelColor: '#172033',
      formDescriptionColor: '#667085',
      formInputBg: '#ffffff',
      formInputText: '#172033',
      formInputPlaceholder: '#98a2b3',
      formInputBorder: '#cbd5e1',
      formInputBorderHover: '#94a3b8',
      formInputBorderFocus: '#3158c9',
      formInputReadonlyBg: '#f3f6fb',
      formInputReadonlyBorder: '#d9e2ec',
      formInputReadonlyText: '#667085',
      formFieldEdited: '#b45309',
      formPreviewBg: '#f8fafc',
      selectionBg: '#e9efff',
      selectionBorder: '#3158c9',
      selectionRing: 'rgba(49, 88, 201, 0.18)',
      selectionText: '#172033',
      brandPrimaryBg: '#2454d6',
      brandPrimaryHover: '#1d4ed8',
      brandPrimaryBorder: '#2454d6',
      brandPrimaryText: '#ffffff',
      tableBg: '#ffffff',
      tableRowBg: '#ffffff',
      tableRowHoverBg: '#f3f6fb',
      tableHeaderBg: '#f8fafc',
      tableBorder: '#e2e8f0',
      tableBorderStrong: '#cbd5e1',
      tableText: '#172033',
      tableHeaderText: '#475467',
      tableLink: '#2454d6',
      tableLinkHover: '#1d4ed8',
    },
  },
  dark: {
    colorScheme: 'dark',
    palette: {
      primaryColor: 'blue',
      primaryShade: 5,
      black: '#1a1c22',
      white: '#e8e9ec',
      colors: {
        blue: steelBlue,
        cyan: steelBlue,
        green: sageGreen,
        teal: sageGreen,
        orange: copper,
        pink: dustyRose,
        purple: slateBlue,
        red: brickRed,
        yellow: warmAmber,
        gray: coolGray,
        slate: charcoalSlate,
      },
    },
    tokens: {
      mantineDimmed: '#8a92a3',
      logoStroke: '#8aaed4',
      logoTopBar: '#6b8cae',
      logoLeftBlock: '#c5cdd9',
      logoRightBlock: '#7a9abd',
      shellHeaderBg: '#1e2028',
      shellPrimaryRailBg: '#1e2028',
      shellSecondaryRailBg: '#22252d',
      shellTopSurfaceBg: '#2a2d36',
      shellMainBg: '#252830',
      shellBorderColor: '#3a3f4a',
      shellText: '#e8e9ec',
      shellMutedText: '#8a92a3',
      shellDescriptionText: '#a0a8b8',
      shellActiveBg: 'rgba(107, 140, 174, 0.12)',
      shellActiveHover: 'rgba(107, 140, 174, 0.18)',
      shellActiveText: '#8aaed4',
      shellControlBg: '#2a2d36',
      shellControlHover: '#323642',
      shellControlBorder: '#3a3f4a',
      shellControlBorderStrong: '#4a5a72',
      formSurfaceBg: '#282b34',
      formSectionBg: '#282b34',
      formSectionHeaderBg: '#2d3039',
      formSectionBorder: '#3a3f4a',
      formLabelColor: '#e8e9ec',
      formDescriptionColor: '#9aa3b3',
      formInputBg: '#1e2128',
      formInputText: '#e8e9ec',
      formInputPlaceholder: '#6a7280',
      formInputBorder: '#3a3f4a',
      formInputBorderHover: '#4a5a72',
      formInputBorderFocus: '#6b8cae',
      formInputReadonlyBg: '#1e2128',
      formInputReadonlyBorder: '#3a3f4a',
      formInputReadonlyText: '#8a92a3',
      formFieldEdited: '#c48b6e',
      formPreviewBg: '#22252d',
      selectionBg: '#3a3f4a',
      selectionBorder: '#6b8cae',
      selectionRing: 'rgba(107, 140, 174, 0.22)',
      selectionText: '#e8e9ec',
      brandPrimaryBg: '#6b8cae',
      brandPrimaryHover: '#7a9abd',
      brandPrimaryBorder: '#6b8cae',
      brandPrimaryText: '#1a1c22',
      tableBg: '#282b34',
      tableRowBg: '#282b34',
      tableRowHoverBg: '#2d3039',
      tableHeaderBg: '#1e2128',
      tableBorder: '#3a3f4a',
      tableBorderStrong: '#4a5262',
      tableText: '#d0d4dc',
      tableHeaderText: '#a0a8b8',
      tableLink: '#8aaed4',
      tableLinkHover: '#a8c4e4',
    },
  },
};

export const DEFAULT_APP_THEME_PACK: AppThemePackName = 'light';

function getThemePack(name: AppThemePackName) {
  return themePacks[name];
}

function createComponentOverrides(): MantineThemeOverride['components'] {
  return {
    Input: Input.extend({
      defaultProps: {
        size: 'md',
        radius: 'md',
      },
      styles: {
        input: {
          backgroundColor: 'var(--ori-form-input-bg)',
          borderColor: 'var(--ori-form-input-border)',
          color: 'var(--ori-form-input-text)',
          transition: 'border-color 120ms ease, box-shadow 120ms ease, background-color 120ms ease',
        },
      },
    }),
    InputWrapper: InputWrapper.extend({
      styles: {
        label: {
          fontWeight: 600,
          fontSize: 'var(--mantine-font-size-sm)',
          color: 'var(--ori-form-label-color)',
          marginBottom: 6,
        },
        description: {
          color: 'var(--ori-form-description-color)',
          fontSize: 'var(--mantine-font-size-xs)',
          lineHeight: 1.45,
        },
        error: {
          fontSize: 'var(--mantine-font-size-xs)',
          marginTop: 6,
        },
      },
    }),
    Button: Button.extend({
      defaultProps: {
        radius: 'md',
      },
      styles: (_theme, props) => {
        const variant = props.variant ?? 'filled';
        const color = props.color ?? 'blue';

        let variantStyles: Record<string, string> = {};

        if (variant === 'default') {
          variantStyles = color === 'red'
            ? {
                backgroundColor: 'rgba(196, 112, 112, 0.08)',
                borderColor: 'rgba(196, 112, 112, 0.28)',
                color: 'var(--ori-form-label-color)',
                boxShadow: 'none',
              }
            : {
                backgroundColor: 'var(--ori-shell-control-bg)',
                borderColor: 'var(--ori-shell-control-border)',
                color: 'var(--ori-shell-text)',
                boxShadow: 'none',
              };
        } else if (variant === 'subtle') {
          variantStyles = {
            color: 'var(--ori-shell-muted-text)',
          };
        } else if (variant === 'filled') {
          variantStyles = {
            backgroundColor: 'var(--ori-brand-primary-bg)',
            borderColor: 'var(--ori-brand-primary-border)',
            color: 'var(--ori-brand-primary-text)',
            boxShadow: 'none',
          };
        }

        return {
          root: {
            fontWeight: 600,
            letterSpacing: '0.005em',
            transition: 'background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease, color 120ms ease',
            ...variantStyles,
          },
          section: {
            color: 'inherit',
          },
        };
      },
    }),
    ActionIcon: ActionIcon.extend({
      defaultProps: {
        radius: 'md',
      },
      styles: (_theme, props) => {
        const variant = props.variant ?? 'filled';
        let variantStyles: Record<string, string> = {};

        if (variant === 'default') {
          variantStyles = {
            backgroundColor: 'var(--ori-shell-control-bg)',
            borderColor: 'var(--ori-shell-control-border)',
            color: 'var(--ori-shell-muted-text)',
          };
        } else if (variant === 'subtle') {
          variantStyles = {
            color: 'var(--ori-shell-muted-text)',
          };
        } else if (variant === 'light') {
          variantStyles = {
            backgroundColor: 'var(--ori-shell-active-bg)',
            color: 'var(--ori-shell-active-text)',
          };
        }

        return {
          root: {
            transition: 'background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease, color 120ms ease',
            ...variantStyles,
          },
        };
      },
    }),
    Badge: Badge.extend({
      defaultProps: {
        radius: 'xl',
      },
      styles: {
        root: {
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        },
      },
    }),
    Paper: Paper.extend({
      styles: (_theme, props) => ({
        root: props.withBorder
          ? {
              backgroundColor: 'var(--ori-form-surface-bg)',
              borderColor: 'var(--ori-form-section-border)',
            }
          : {},
      }),
    }),
    Table: Table.extend({
      defaultProps: {
        highlightOnHover: true,
        withTableBorder: true,
        verticalSpacing: 'md',
        horizontalSpacing: 'lg',
      },
      styles: {
        table: {
          backgroundColor: 'var(--ori-table-bg)',
          borderColor: 'var(--ori-table-border)',
        },
        thead: {
          backgroundColor: 'var(--ori-table-header-bg)',
        },
        tbody: {
          backgroundColor: 'var(--ori-table-row-bg)',
        },
        tr: {
          backgroundColor: 'var(--ori-table-row-bg)',
          transition: 'background-color 120ms ease',
        },
        th: {
          backgroundColor: 'var(--ori-table-header-bg)',
          color: 'var(--ori-table-header-text)',
          borderBottom: '1px solid var(--ori-table-border-strong)',
          borderTop: 'none',
          fontSize: 'var(--mantine-font-size-sm)',
          fontWeight: 600,
          letterSpacing: '0.01em',
          paddingTop: 12,
          paddingBottom: 12,
        },
        td: {
          color: 'var(--ori-table-text)',
          borderTop: '1px solid var(--ori-table-border)',
          paddingTop: 14,
          paddingBottom: 14,
          verticalAlign: 'middle',
        },
      },
    }),
  };
}

function createCssVariableMap(tokens: AppThemeTokens) {
  return {
    '--mantine-color-dimmed': tokens.mantineDimmed,
    '--ori-logo-stroke': tokens.logoStroke,
    '--ori-logo-top-bar': tokens.logoTopBar,
    '--ori-logo-left-block': tokens.logoLeftBlock,
    '--ori-logo-right-block': tokens.logoRightBlock,
    '--ori-shell-header-bg': tokens.shellHeaderBg,
    '--ori-shell-primary-rail-bg': tokens.shellPrimaryRailBg,
    '--ori-shell-secondary-rail-bg': tokens.shellSecondaryRailBg,
    '--ori-shell-top-surface-bg': tokens.shellTopSurfaceBg,
    '--ori-shell-main-bg': tokens.shellMainBg,
    '--ori-shell-border-color': tokens.shellBorderColor,
    '--ori-shell-text': tokens.shellText,
    '--ori-shell-muted-text': tokens.shellMutedText,
    '--ori-shell-description-text': tokens.shellDescriptionText,
    '--ori-shell-active-bg': tokens.shellActiveBg,
    '--ori-shell-active-hover': tokens.shellActiveHover,
    '--ori-shell-active-text': tokens.shellActiveText,
    '--ori-shell-control-bg': tokens.shellControlBg,
    '--ori-shell-control-hover': tokens.shellControlHover,
    '--ori-shell-control-border': tokens.shellControlBorder,
    '--ori-shell-control-border-strong': tokens.shellControlBorderStrong,
    '--ori-form-surface-bg': tokens.formSurfaceBg,
    '--ori-form-section-bg': tokens.formSectionBg,
    '--ori-form-section-header-bg': tokens.formSectionHeaderBg,
    '--ori-form-section-border': tokens.formSectionBorder,
    '--ori-form-label-color': tokens.formLabelColor,
    '--ori-form-description-color': tokens.formDescriptionColor,
    '--ori-form-input-bg': tokens.formInputBg,
    '--ori-form-input-text': tokens.formInputText,
    '--ori-form-input-placeholder': tokens.formInputPlaceholder,
    '--ori-form-input-border': tokens.formInputBorder,
    '--ori-form-input-border-hover': tokens.formInputBorderHover,
    '--ori-form-input-border-focus': tokens.formInputBorderFocus,
    '--ori-form-input-readonly-bg': tokens.formInputReadonlyBg,
    '--ori-form-input-readonly-border': tokens.formInputReadonlyBorder,
    '--ori-form-input-readonly-text': tokens.formInputReadonlyText,
    '--ori-form-field-edited': tokens.formFieldEdited,
    '--ori-form-preview-bg': tokens.formPreviewBg,
    '--ori-selection-bg': tokens.selectionBg,
    '--ori-selection-border': tokens.selectionBorder,
    '--ori-selection-ring': tokens.selectionRing,
    '--ori-selection-text': tokens.selectionText,
    '--ori-brand-primary-bg': tokens.brandPrimaryBg,
    '--ori-brand-primary-hover': tokens.brandPrimaryHover,
    '--ori-brand-primary-border': tokens.brandPrimaryBorder,
    '--ori-brand-primary-text': tokens.brandPrimaryText,
    '--ori-table-bg': tokens.tableBg,
    '--ori-table-row-bg': tokens.tableRowBg,
    '--ori-table-row-hover-bg': tokens.tableRowHoverBg,
    '--ori-table-header-bg': tokens.tableHeaderBg,
    '--ori-table-border': tokens.tableBorder,
    '--ori-table-border-strong': tokens.tableBorderStrong,
    '--ori-table-text': tokens.tableText,
    '--ori-table-header-text': tokens.tableHeaderText,
    '--ori-table-link': tokens.tableLink,
    '--ori-table-link-hover': tokens.tableLinkHover,
  };
}

export function createAppTheme(packName: AppThemePackName = DEFAULT_APP_THEME_PACK) {
  const pack = getThemePack(packName);

  return createTheme({
    ...pack.palette,
    components: createComponentOverrides(),
  });
}

export function createAppCssVariablesResolver(packName: AppThemePackName = DEFAULT_APP_THEME_PACK): CSSVariablesResolver {
  const pack = getThemePack(packName);
  const variables = createCssVariableMap(pack.tokens);

  return () => ({
    variables,
    light: {},
    dark: {},
  });
}

export function getAppThemeColorScheme(packName: AppThemePackName = DEFAULT_APP_THEME_PACK) {
  return getThemePack(packName).colorScheme;
}

export const appTheme = createAppTheme();
export const appCssVariablesResolver = createAppCssVariablesResolver();
