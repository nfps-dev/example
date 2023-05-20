/**
 * This script is only used in the development environment. It's purpose is to emulate the boot process
 * offline instead of forcing you, the developer, to perform an actual boot every time you reload.
 */
import type {HttpsUrl, SecretBech32} from '@solar-republic/neutrino';

import {oda} from '@blake.regalia/belt';

import {create_svg, ls_get_json, ls_get_str, ls_set_json, ls_set_str, qsa} from '@nfps.dev/runtime';
import {SecretContract, query_contract_infer} from '@solar-republic/neutrino';


import {dm_root} from './common';

// show onlyscripts
qsa(dm_root, '.onlyscript').map(dm_elmt => dm_elmt.classList.remove('onlyscript'));

// env vars
const h_env = process.env;

// wait for document to load
addEventListener('load', async() => {
	const sa_contract = h_env['NFP_SELF_CONTRACT'] as SecretBech32;
	const p_lcd = h_env['NFP_WEB_LCDS']?.split(',')[0] as HttpsUrl;

	// save reusable globals
	oda(window, {
		// boot info
		loc: [h_env['NFP_SELF_CHAIN'], sa_contract, h_env['NFP_SELF_TOKEN']],
		lcd: p_lcd,
		qp: null,
		vk: h_env['NFP_VIEWING_KEY'],
		sc: await SecretContract(p_lcd, sa_contract),

		// reserved
		toa: '',

		// override inject function to link locally instead
		load(si_lib: string) {
			return create_svg('script', {
				href: `./${si_lib.replace(/\.js$/, '.dev.js')}`,
			});
		},

		// runtime functions
		lsgs: ls_get_str,
		lsss: ls_set_str,
		lsgj: ls_get_json,
		lssj: ls_set_json,

		// neutrino functions
		qci: query_contract_infer,
	});

	// inject the app
	dm_root.append(create_svg('script', {
		href: './app.dev.js',
	}));

	// hide banner
	qsa(dm_root, '#default div')[0].style.display = 'none';
});
