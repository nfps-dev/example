import {resolve} from 'path';

import {nfpModule} from '@nfps.dev/sdk';

import {defineConfig, type Plugin} from 'vite';

export default defineConfig(({mode}) => {
	const B_DEV = 'development' === mode;

	return {
		build: {
			outDir: resolve(__dirname, '../dist'),
			emptyOutDir: false,
			minify: !B_DEV,
			sourcemap: B_DEV? 'inline': false,
			target: ['esnext'],

			lib: {
				entry: resolve(__dirname, 'src/main.ts'),
				name: 'app',
				formats: ['iife'],
			},

			rollupOptions: {
				output: {
					entryFileNames: `app${B_DEV? '.dev': ''}.js`,
				},
			},
		},

		plugins: [
			nfpModule({
				id: 'app',
				include: 'app/src/**/*.ts',
				compilerOptions: {
					sourceMap: false,
					module: 'esnext',
				},
				svelte: {},
			}) as Plugin[],
		],
	};
});
