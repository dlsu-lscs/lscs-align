import baseConfig from '@align/config/eslint';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const config = [...baseConfig, ...nextVitals, ...nextTs];

export default config;
