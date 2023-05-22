import {nfpModule} from '@nfps.dev/sdk';
import {defineConfig} from 'rollup';

export default defineConfig({
	input: `bootloader/src/bootloader.ts`,
	output: {
		format: 'iife',
		dir: 'dist',
		entryFileNames: `[name]${'development' === process.env['NFP_ENV']? '.dev': ''}.js`,
		inlineDynamicImports: false,
	},
	plugins: [
		nfpModule({
			id: 'bootloader',
			include: 'bootloader/src/**/*.ts',
			compilerOptions: {
				sourceMap: false,
			},
		}),
	],
});
