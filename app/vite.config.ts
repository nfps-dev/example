import { microWeb } from '@nfps.dev/rollup-plugin-microweb';
import {resolve} from 'path';
import {defineConfig} from 'vite';

export default defineConfig({
	build: {
		outDir: resolve(__dirname, '../dist'),

		lib: {
			entry: resolve(__dirname, 'src/main.ts'),
			name: 'app',
			formats: ['iife'],
		},

		rollupOptions: {
			output: {
				entryFileNames: 'app.js',
			},
		},
	},

	plugins: [
		microWeb({
			include: 'app/src/**/*.ts',
		}),
	],
});
