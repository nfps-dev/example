import {resolve} from 'path';

import {microWeb} from '@nfps.dev/rollup-plugin-microweb';
import {defineConfig} from 'vite';

export default defineConfig(({mode}) => {
	const B_DEV = 'development' === mode;

	return {
		build: {
			outDir: resolve(__dirname, '../dist'),
			emptyOutDir: false,
			minify: !B_DEV,
			sourcemap: B_DEV? 'inline': false,

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
			microWeb({
				include: 'app/src/**/*.ts',
				compilerOptions: {
					sourceMap: B_DEV,
				},
			}),
		],
	};
});
