import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import hooks from 'eslint-plugin-react-hooks';
import a11y from 'eslint-plugin-jsx-a11y';

// Compose the React/TypeScript checks directly: the Next preset pulls in an
// unpatched braces dependency through fast-glob (GHSA-vfj7-8cjw-p6xm).
export default defineConfig([
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    ...react.configs.flat.recommended,
    settings: { react: { version: 'detect' } },
    rules: { ...react.configs.flat.recommended.rules, 'react/react-in-jsx-scope': 'off', 'react/prop-types': 'off', 'react/no-unescaped-entities': 'off' },
  },
  { files: ['**/*.{js,jsx,ts,tsx}'], ...hooks.configs.flat.recommended },
  { files: ['**/*.{js,jsx,ts,tsx}'], ...a11y.flatConfigs.recommended },
  globalIgnores(['.next/**', '.next-validation/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);
