import type {RollupOptions} from 'rollup';

import {microWeb} from '@nfps.dev/rollup-plugin-microweb';

import {defineConfig} from 'rollup';

export default defineConfig([
	'storage',
].map(sr_lib => ({
	input: `applibs/src/${sr_lib}/main.ts`,
	output: {
		format: 'iife',
		dir: 'dist',
		entryFileNames: `${sr_lib}${'development' === process.env['NODE_ENV']? '.dev': ''}.js`,
		inlineDynamicImports: false,
	},
	plugins: [
		microWeb({
			include: [
				`applibs/src/${sr_lib}/**/*.ts`,
				'bootloader/src/global.ts',
			],
			compilerOptions: {
				sourceMap: false,
				declaration: false,
			},
		}),
	],
} as RollupOptions)));
