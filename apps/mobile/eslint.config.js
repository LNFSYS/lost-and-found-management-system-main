// https://docs.expo.dev/guides/using-eslint/
const path = require('node:path');
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
    settings: {
      'import/resolver': {
        typescript: {
          project: path.resolve(__dirname, 'tsconfig.json'),
        },
        node: true,
      },
    },
  },
]);
