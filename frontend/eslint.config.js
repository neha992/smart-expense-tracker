import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
globalIgnores([
  'dist/**',
  'src-backup-before-lint-fix/**',
  '**/lint-before-final-fix-*/**',
  '**/lint-repair-backup-*/**',
  '**/lint-backup-*/**',
]),
{
files: ['**/*.{js,jsx}'],
extends: [
js.configs.recommended,
reactHooks.configs.flat.recommended,
reactRefresh.configs.vite,
],
languageOptions: {
globals: globals.browser,
parserOptions: { ecmaFeatures: { jsx: true } },
},
},
])
