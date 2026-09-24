// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const architectureRules = {
  controllers: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['typeorm', 'typeorm/*'],
            message:
              'Controllers handle HTTP only. Database access belongs in repositories.',
          },
          {
            group: ['@nestjs/typeorm'],
            message:
              'Controllers handle HTTP only. Database access belongs in repositories.',
          },
          {
            group: ['**/*.repository', '**/*.repository.ts'],
            message:
              'Controllers must delegate to services, not repositories.',
          },
        ],
      },
    ],
  },
  services: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['typeorm', 'typeorm/*'],
            message:
              'Services contain business logic only. Use repository classes for database access.',
          },
          {
            group: ['@nestjs/typeorm'],
            message:
              'Services contain business logic only. Use repository classes for database access.',
          },
        ],
      },
    ],
  },
  repositories: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['**/*.service', '**/*.service.ts'],
            message: 'Repositories must not import services.',
          },
          {
            group: ['**/*.controller', '**/*.controller.ts'],
            message: 'Repositories must not import controllers.',
          },
        ],
      },
    ],
  },
};

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'dist/**', 'scripts/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
  {
    files: ['**/*.controller.ts'],
    rules: architectureRules.controllers,
  },
  {
    files: ['**/*.service.ts'],
    rules: architectureRules.services,
  },
  {
    files: ['**/*.repository.ts'],
    rules: architectureRules.repositories,
  },
);
