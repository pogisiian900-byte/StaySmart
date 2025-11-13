module.exports = {
  env: {
    es6: true,
    node: true,  // This should enable Node.js globals
  },
  extends: [
    'eslint:recommended',
    'google',
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'script',  // Change from 'module' to 'script' for CommonJS
  },
  rules: {
    'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    'require-jsdoc': 'off',
    'max-len': ['error', { 'code': 120 }],
    'no-undef': 'off', // Node.js globals are available
  },
  globals: {
    'process': 'readonly',
    'require': 'readonly',
    'module': 'readonly',
    'exports': 'readonly',
    'Buffer': 'readonly',
    '__dirname': 'readonly',
    '__filename': 'readonly',
    'console': 'readonly',
    'context': 'readonly',  // Add this for Firebase Functions
  },
};