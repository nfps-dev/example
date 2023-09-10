import type {NfpxExports} from './env';
import type {HttpsUrl, SecretBech32} from '@solar-republic/neutrino';

import {create_svg, create_html, ls_write, ls_write_b64, ls_read_b64} from '@nfps.dev/runtime';
import {Wallet, gen_sk, exec_contract} from '@solar-republic/neutrino';

import {
	A_TOKEN_LOCATION,
	G_QUERY_PERMIT,
	K_CONTRACT,
	P_LCD,
	SH_VIEWING_KEY,
	P_COMC_HOST,
	ls_read,
	nfp_tags,
	nfp_attr,
} from 'nfpx:bootloader';

import App from './App.svelte';

const dm_root = document.documentElement;

// read rpc data from nfp
const dm_web = nfp_tags('web')?.[0];
const A_RPCS = dm_web? nfp_attr(dm_web, 'rpcs')?.split(',') as HttpsUrl[]: [];
const A_COMCS = ((dm_web? nfp_attr(dm_web, 'comcs')?.split(','): null) || [P_COMC_HOST]) as [HttpsUrl, ...HttpsUrl[]];

// create ui to allow user to play/pause animations
const dm_pause = create_html('button', {
	style: 'position:absolute;top:40em;left:22em;background:#333;color:#ce3',
}, [
	'Pause',
]);

const dm_app = create_html('div', {
	id: 'app',
});

const dm_foreign = create_svg('foreignObject', {
	width: '100%',
	height: '100%',
	x: '0',
	y: '0',
}, [
	dm_app,
	// create_html('div', {}, [
	// 	dm_pause,
	// ]),
]);

dm_root.append(dm_foreign);

dm_pause.onclick = () => {
	dm_pause.textContent = dm_root.classList.toggle('paused')? 'Resume': 'Pause';
};

const si_storage_token_owner_addr = 'toa:'+A_TOKEN_LOCATION.join(':');

// fetch token owner address
const SA_OWNER = ls_read(si_storage_token_owner_addr) as SecretBech32
	|| ls_write<SecretBech32>(si_storage_token_owner_addr, prompt('Please enter the account address that owns this token') || '');

// const SA_OWNER = await idb_read<SecretBech32>(si_storage_token_owner_addr)
// 	|| await idb_write(si_storage_token_owner_addr, prompt('Please enter ...'));



(async() => {
	// get or create private key
	const atu8_sk = ls_read_b64('sk') || gen_sk();

	// create wallet
	const k_wallet = await Wallet(atu8_sk, A_TOKEN_LOCATION[0], P_LCD, A_RPCS[0]);

	// save to local storage
	ls_write_b64('sk', atu8_sk);
	console.log(`Hot wallet address: ${k_wallet.addr}`);

	// dynamic export before importing libs (which depend on these exports)
	exportNfpx({
		K_WALLET: k_wallet,
	});

	// load the storage library before launching 'App.svelte'
	await import('nfpx:storage', {
		contract: K_CONTRACT,
		location: A_TOKEN_LOCATION,
		auth: G_QUERY_PERMIT || [SH_VIEWING_KEY, SA_OWNER],
		query: {
			tag: '1.x',
		},
	});

	// launch the app
	new App({
		target: dm_app,
	});
})();


export {
	A_RPCS,
	A_COMCS,
	SA_OWNER,
	exec_contract,
	dm_root,
	dm_foreign,
};

export default interface Default extends NfpxExports {
	merge: string;
}
