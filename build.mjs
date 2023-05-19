import fs from 'node:fs';
import zlib from 'node:zlib';

import {build} from '@nfps.dev/sdk';
import * as dotenv from 'dotenv';
import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';

// load environment variables
dotenv.config();
const h_env = process.env;

const {
	NFP_SELF_CHAIN: si_chain,
	NFP_SELF_CONTRACT: sa_contract,
	NFP_SELF_TOKEN: si_token,
	NODE_ENV: SI_NODE_ENV,
} = h_env;

const B_DEV = 'development' === SI_NODE_ENV;

const h_argv = yargs(hideBin(process.argv))
	.scriptName('build').usage('$0 [flags]')
	.option('a', {
		alias: 'autoboot',
		describe: 'omits the actual bootloader and loads the local app directly (development MUST be enabled)',
		default: false,
		type: 'boolean',
	})
	.option('o', {
		alias: 'output',
		describe: 'output file',
		default: './dist/nfp.svg',
	})
	.option('l', {
		alias: 'link',
		describe: 'link to stylesheets and scripts instead of inlining during development',
		default: false,
		type: 'boolean',
	})
	.alias('v', 'version').alias('h', 'help').help().argv;

// make sure autoboot is only used in development mode
if(h_argv.autoboot && !B_DEV) {
	throw new Error(`Option '-a' can only be used when NODE_ENV=development`);
}

const sx_out = await build({
	source: fs.readFileSync('./media/template.svg'),

	metadata: {
		web: {
			lcds: h_env['NFP_WEB_LCDS']?.split(','),
			comcs: h_env['NFP_WEB_COMCS']?.split(','),
		},
		self: {
			chain: si_chain,
			contract: sa_contract,
			token: si_token,
		},
	},

	macros: {
		// inline global stylesheet
		global_style: ({create}) => [
			// depending on environment
			B_DEV && h_argv.link
				// development: link to css file
				? create.svg('style', {}, [
					`@import url(../media/global.css);`,
				])
				// testing/production: inline css
				: create.svg('style', {}, [
					fs.readFileSync('./media/global.css'),
				]),
		],

		// creates a link to a hosted sandbox container
		launch_sandbox: ({create, body}) => [
			create.html('a', {
				href: `https://nfps.dev/sandbox?${new URLSearchParams({
					chain: si_chain,
					contract: sa_contract,
					token: si_token,
				})}`,
			}, [
				create.html('button', {}, body ?? ['Launch in browser']),
			]),
		],
	},


	closeDocument({document, create}) {
		const dm_root = document.documentElement;

		// inject content
		dm_root.append(...h_argv.autoboot
			// autoboot mode: omit bootloader and use autoboot script instead
			? [
				// autoboot (should inject app once it's completed any async bootup tasks)
				create.svg('script', {
					href: './_autoboot.dev.js'
				}),
			]
			// use bootloader
			: [
				// bootloader; depending on environment
				B_DEV && h_argv.link
					// development: link to bootloader for better debugging experience in browser
					? create.svg('script', {
						href: './bootloader.dev.js'
					})
					// testing/production: inline script
					: create.svg('script', {}, [
						fs.readFileSync(`./dist/bootloader${B_DEV? '.dev': ''}.js`, 'utf8'),
					]),

				// fetch latest app from chain
				create.nfp('script', {
					src: 'app.js?tag=latest',
				}),
			]
		);
	},
});

fs.writeFileSync(h_argv.output, sx_out);
fs.copyFileSync('./media/preview.html', './dist/preview.html');

// compress
if(!B_DEV) {
	const atu8_compressed = zlib.gzipSync(sx_out);
	fs.writeFileSync(h_argv.output+'.gz', atu8_compressed);
	console.log(`Optimized SVG size:   ${sx_out.length} bytes`)
	console.log(`Compressed file size: ${atu8_compressed.byteLength} bytes`);
}
