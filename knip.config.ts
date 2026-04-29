import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: ['src/app/main.tsx', 'src/app/initApp.ts'],
  project: ['src/**/*.{ts,tsx}'],
  ignore: [
    'src/app/mfe/**',
    'src/**/__tests__/**',
  ],
  ignoreDependencies: [
    '@cyberfabric/cli',
    '@cyberfabric/screensets',
    '@module-federation/vite',
    '@j178/prek',
    'autoprefixer',
    'postcss',
    'postcss-load-config',
  ],
  vite: true,
  eslint: true,
};

export default config;
