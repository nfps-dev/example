import type {RollupOptions} from 'rollup';

import {nfpModule} from '@nfps.dev/sdk';
import {defineConfig} from 'rollup';

export default defineConfig([
	'storage',
].map(sr_lib => ({
	input: `applibs/src/${sr_lib}/main.ts`,
	output: {
		format: 'iife',
		dir: 'dist',
		entryFileNames: `${sr_lib}${'development' === process.env['NFP_ENV']? '.dev': ''}.js`,
		inlineDynamicImports: false,
	},
	plugins: [
		nfpModule({
			id: sr_lib,
			include: [
				`applibs/src/${sr_lib}/**/*.ts`,
			],
			compilerOptions: {
				sourceMap: false,
				// declaration: false,
			},
		}),
	],
} as RollupOptions)));
