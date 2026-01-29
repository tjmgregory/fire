import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import cleanup from 'rollup-plugin-cleanup';
import { copyFileSync } from 'fs';

export default {
  input: 'src/apps-script/triggers/onEditTrigger.ts',
  output: {
    file: 'dist/Code.js',
    format: 'iife',
    name: 'Fire',
    // Expose trigger functions to global scope for Apps Script
    footer: `
// Expose trigger functions to global scope for Apps Script
var onEdit = Fire.onEdit;
var installOnEditTrigger = Fire.installOnEditTrigger;
var uninstallOnEditTrigger = Fire.uninstallOnEditTrigger;
var loadActiveCategories = Fire.loadActiveCategories;
`
  },
  plugins: [
    resolve(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false,
      outDir: undefined,
      // Override module setting for rollup compatibility
      module: 'ESNext'
    }),
    cleanup({
      comments: 'none',
      extensions: ['ts']
    }),
    // Copy appsscript.json to dist
    {
      name: 'copy-appsscript',
      writeBundle() {
        copyFileSync('src/apps-script/appsscript.json', 'dist/appsscript.json');
      }
    }
  ]
};
