import {resolve} from 'path';

import {microWeb} from '@nfps.dev/rollup-plugin-microweb';
import {nfpModule, nfpxWindow} from '@nfps.dev/sdk';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import sveltePreprocess from 'svelte-preprocess';

import {defineConfig} from 'vite';

export default defineConfig(({mode}) => {
	const B_DEV = 'development' === mode;

	return {
		build: {
			outDir: resolve(__dirname, '../dist'),
			emptyOutDir: false,
			minify: !B_DEV,
			sourcemap: B_DEV? 'inline': false,
			target: ['es2022'],

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
				},
			}),

			// // nfp window imports
			// nfpxWindow({
			// 	id: 'app',
			// }),

			// // build svelte components
			// svelte({
			// 	compilerOptions: {
			// 		immutable: true,
			// 		css: 'injected',
			// 		cssHash: ({hash, css, name, filename}) => `sv${hash(css)}`,
			// 		// namespace: 'svg',
			// 	},
			// 	preprocess: sveltePreprocess({}),
			// }),

			// microWeb({
			// 	include: 'app/src/**/*.ts',
			// 	compilerOptions: {
			// 		sourceMap: B_DEV,
			// 	},
			// }),
		],
	};
});
