import type {RollupOptions} from 'rollup';

import {microWeb} from '@nfps.dev/rollup-plugin-microweb';

import {defineConfig} from 'rollup';

export default defineConfig([
	'bootloader.ts',
	'_autoboot.ts',
].map(sr_file => ({
	input: `bootloader/src/${sr_file}`,
	output: {
		format: 'iife',
		dir: 'dist',
		entryFileNames: `[name]${'development' === process.env['NODE_ENV']? '.dev': ''}.js`,
		inlineDynamicImports: false,
	},
	plugins: [
		microWeb({
			include: 'bootloader/src/**/*.ts',
			compilerOptions: {
				sourceMap: false,
			},
		}),
	],
} as RollupOptions)));
