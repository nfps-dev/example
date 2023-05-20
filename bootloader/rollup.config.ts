import type {RollupOptions} from 'rollup';

import {microWeb} from '@nfps.dev/rollup-plugin-microweb';

import replace from '@rollup/plugin-replace';
import * as dotenv from 'dotenv';
import {defineConfig} from 'rollup';

dotenv.config();

const h_env_safe = Object.fromEntries(Object.entries(process.env).filter(([si_key]) => si_key.startsWith('NFP_')));

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
		// for the autoboot config
		...sr_file.startsWith('_autoboot')? [
			replace({
				values: {
					'process.env': '('+JSON.stringify(h_env_safe)+')',
				},
			}),
		]: [],

		microWeb({
			include: 'bootloader/src/**/*.ts',
			compilerOptions: {
				sourceMap: false,
			},
		}),
	],
} as RollupOptions)));
