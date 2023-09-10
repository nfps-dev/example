import {nfpModule} from '@nfps.dev/sdk';
import {defineConfig, type Plugin} from 'rollup';

export default defineConfig({
	input: `bootloader/src/bootloader.ts`,
	output: {
		format: 'iife',
		dir: 'dist',
		entryFileNames: `[name]${'development' === process.env['NFP_ENV']? '.dev': ''}.js`,

		// in case any imported libraries use dynamic imports, they will not work in the nfp
		// unless inlined with the bundle. set to false if you never expect the conditions
		// to be met in which an imported package would attempt a dynamic import
		inlineDynamicImports: true,
	},
	plugins: [
		nfpModule({
			id: 'bootloader',
			injectNfpModuleSystem: true,
			include: 'bootloader/src/**/*.ts',
			compilerOptions: {
				sourceMap: false,
			},
		}) as unknown as Plugin,
	],
});
