import fs from 'node:fs';

import {build} from '@nfps.dev/sdk';

// load environment variables
import * as dotenv from 'dotenv';
dotenv.config();
const h_env = process.env;

const sx_out = build({
	source: fs.readFileSync('./media/template.svg'),

	metadata: {
		web: {
			lcds: h_env['NFP_WEB_LCDS']?.split(','),
			comcs: h_env['NFP_WEB_COMCS']?.split(','),
		},
		self: {
			chain: h_env['NFP_SELF_CHAIN'],
			contract: h_env['NFP_SELF_CONTRACT'],
			token: h_env['NFP_SELF_TOKEN'],
		},
	},

	postProcess({document, create}) {
		// inject content
		document.documentElement.append(
			// bootloader
			create.svg('script', {
				type: 'application/ecmascript',
			}, [
				fs.readFileSync('./dist/bootloader.js', 'utf8'),
			]),

			// main application entrypoint
			create.nfp('script', {
				src: 'app.js?tag=latest',
			}),
		);
	},
});

fs.writeFileSync('./dist/nfp.svg', sx_out);
