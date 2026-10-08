import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'public/assets/'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      // С noUncheckedIndexedAccess `arr[i]!` в горячих циклах — осознанная идиома.
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    // systems/ и core/ — чистая логика: никакого Phaser и DOM (SPEC §3, §18)
    files: ['src/systems/**/*.ts', 'src/core/**/*.ts'],
    languageOptions: { globals: { ...globals.es2022 } },
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [{ name: 'phaser', message: 'systems/ и core/ не должны зависеть от Phaser.' }] },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'navigator'],
    },
  },
  {
    files: ['scripts/**/*.ts', 'tests/**/*.ts', '*.config.{js,ts}'],
    languageOptions: { globals: { ...globals.node } },
  },
  prettier,
);
