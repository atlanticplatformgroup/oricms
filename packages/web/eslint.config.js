import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

const workspacePrimitiveGuard = [
  'error',
  {
    selector: "JSXOpeningElement[name.name='button']",
    message: 'Use Mantine Button or shared workspace primitives instead of raw <button>.',
  },
  {
    selector: "JSXOpeningElement[name.name='select']",
    message: 'Use Mantine Select or shared workspace primitives instead of raw <select>.',
  },
  {
    selector: "JSXOpeningElement[name.name='textarea']",
    message: 'Use Mantine Textarea or shared workspace primitives instead of raw <textarea>.',
  },
  {
    selector: "JSXOpeningElement[name.name='input']",
    message: 'Use Mantine input primitives or shared workspace primitives instead of raw <input>.',
  },
];

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
          allowExportNames: [
            'ROLE_OPTIONS',
            'matchesView',
            'getTableFieldSortText',
            'createFieldRegistry',
            'fieldRegistry',
            'extendFieldRegistry',
            'workspaceShellChromeStyles',
            'useToast',
            'useCollectionManagerContext',
            'useEditorContext',
            'useEntryHistoryContext',
            'useSchemaEditorContext',
            'useWorkspaceRouterContext',
          ],
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/components/workspace/settings/**/*.{ts,tsx}', 'src/components/workspace/builds/**/*.{ts,tsx}'],
    rules: {
      // Guardrail for standardized controls on migrated settings/runtime panels.
      'no-restricted-syntax': workspacePrimitiveGuard,
    },
  },
  {
    files: [
      'src/components/auth/LoginPage.tsx',
      'src/components/error/WorkspaceFeatureBoundary.tsx',
      'src/components/onboarding/InstanceSetup.tsx',
      'src/components/workspace/BuildsWorkspace.tsx',
      'src/components/workspace/CollectionsWorkspace.tsx',
      'src/components/workspace/MembersWorkspace.tsx',
      'src/components/workspace/SchemasWorkspace.tsx',
      'src/components/workspace/SettingsWorkspace.tsx',
      'src/components/workspace/WorkspaceShellLayout.tsx',
    ],
    rules: {
      // Guardrail for auth, onboarding, and workspace shell surfaces that should stay on the current UI baseline.
      'no-restricted-syntax': workspacePrimitiveGuard,
    },
  },
);
