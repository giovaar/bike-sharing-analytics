import tseslint from 'typescript-eslint';

export default [
  { ignores: ['dist/**', '.npm-cache/**', 'node_modules/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['tests/**/*.mjs'],
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
  },
];
