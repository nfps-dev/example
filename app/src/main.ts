import type {SecretBech32} from '@solar-republic/neutrino';

import {base64_to_buffer} from '@blake.regalia/belt';
import {create_svg, create_html, ls_write, load_script} from '@nfps.dev/runtime';
import {safe_json, Wallet, gen_sk} from '@solar-republic/neutrino';

// import App from './app.svelte';

import type {} from '../../applibs/src/interface';

import {
	A_TOKEN_LOCATION,
	G_QUERY_PERMIT,
	K_CONTRACT,
	P_LCD,
	SH_VIEWING_KEY,
	ls_read,
} from 'nfpx:bootloader';

const dm_root = document.documentElement;

// create ui to allow user to play/pause animations
const dm_pause = create_html('button', {
	style: 'position:absolute;top:40em;left:22em;background:#333;color:#ce3',
}, [
	'Pause',
]);

dm_root.append(create_svg('foreignObject', {
	width: '100%',
	height: '100%',
	x: '0',
	y: '0',
}, [
	create_html('div', {}, [
		dm_pause,
	]),
]));

dm_pause.onclick = () => {
	dm_pause.textContent = dm_root.classList.toggle('paused')? 'Resume': 'Pause';
};

const si_storage_token_owner_addr = 'toa:'+A_TOKEN_LOCATION.join(':');

// fetch token owner address
const SA_OWNER = ls_read(si_storage_token_owner_addr) as SecretBech32
	|| ls_write<SecretBech32>(si_storage_token_owner_addr, prompt('Please enter the account address that owns this token') || '');

(async() => {
	// get or create private key
	const sh_sk = ls_read('sk');
	const atu8_sk = sh_sk? base64_to_buffer(sh_sk): gen_sk();

	// create wallet
	const k_wallet = Wallet(atu8_sk, A_TOKEN_LOCATION[0], P_LCD);

	// fetch library
	const dm_script = await load_script('storage.js', {
		tag: '1.x',
	}, K_CONTRACT, A_TOKEN_LOCATION, G_QUERY_PERMIT || [SH_VIEWING_KEY, SA_OWNER]);

	// request succeded
	if(dm_script) {
		// wait for script to load before calling its functions
		dm_script.onload = async() => {
			// read from token
			const g_read = await readOwner(['test']);
			console.log(g_read);

			// // load app
			// new App({
			// 	target: document.documentElement,
			// 	props: {
			// 		k_wallet,
			// 		k_contract: sc,
			// 	},
			// });
		};

		// inject library
		dm_root.append(dm_script);
	}
})();

export {
	SA_OWNER,
};
