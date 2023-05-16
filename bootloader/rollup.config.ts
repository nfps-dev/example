import {microWeb} from '@nfps.dev/rollup-plugin-microweb';

import {defineConfig} from 'rollup';

export default defineConfig({
	input: 'bootloader/src/bootloader.ts',
	output: {
		format: 'iife',
		dir: 'dist',
		inlineDynamicImports: false,
	},
	plugins: [
		microWeb({
			include: 'bootloader/src/**/*.ts',
		}),
	],
});
