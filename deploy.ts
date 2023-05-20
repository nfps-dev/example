import type {Uint128} from '@blake.regalia/belt';


import {readFile} from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import zlib from 'node:zlib';

import {oderac, base64_to_buffer, buffer_to_base64, hex_to_buffer, buffer_to_hex} from '@blake.regalia/belt';
import {
	format_query,
	query_contract,
	type HttpsUrl,
	type SecretBech32,
} from '@solar-republic/neutrino';


import {
	gen_sk,
	sk_to_pk,
	pubkey_to_bech32,
	Wallet,
	SecretContract,
	query_contract_infer,
	exec_contract,
	sign_query_permit,
} from '@solar-republic/neutrino';

// load environment variables
import * as dotenv from 'dotenv';
dotenv.config();
const h_env = process.env;

// polyfil crypto for older node versions
if(!globalThis.crypto) globalThis.crypto = (await import('node:crypto')).webcrypto;

// load private key
const sh_sk = h_env['NFP_WALLET_PRIVATE_KEY'];

// no private key found, generate a new one
if(!sh_sk) {
	const atu8_sk = gen_sk();
	const sb16_sk_gen = buffer_to_hex(atu8_sk);
	const sa_gen = await pubkey_to_bech32(sk_to_pk(atu8_sk));
	console.log(`No private key found; here is a new account you can use for testing...\n  NFP_OWNER="${sa_gen}"\n  NFP_WALLET_PRIVATE_KEY="${sb16_sk_gen}"`);
	process.exit(0);
}

// user-friendly output
const print = (s_header: string, h_fields: object) => console.log(s_header+'\n'+oderac(h_fields, (si_key, s_label) => `  ${si_key}: ${s_label}`).join('\n')+'\n');

// destructure env vars
const {
	NFP_SELF_CHAIN: si_chain,
	NFP_WEB_LCDS: s_lcds,
	NFP_SELF_CONTRACT: sa_contract,
} = h_env;

// decode private key
let atu8_sk;
if(64 === sh_sk.length) atu8_sk = hex_to_buffer(sh_sk);
else atu8_sk = atu8_sk = base64_to_buffer(sh_sk);

const p_lcd = s_lcds?.split(',')[0] as HttpsUrl;

// create wallet
const k_wallet = await Wallet(atu8_sk, si_chain!, p_lcd);

// connect to the contract
const k_contract = await SecretContract(p_lcd, sa_contract as SecretBech32);

// // sign permit
// const g_permit = await sign_query_permit(k_wallet, 'test', [sa_contract], ['balance', 'owner']);

// await query_contract_infer(k_contract, 'num_tokens', {});

// await set_vk(process.env['NFP_VIEWING_KEY']!);

// await storage_owner_put();

// await upload_script('dist/app.js');
// await upload_script('dist/storage.js', ['1.x', 'latest']);

(async() => {
	// await mint();
	await set_vk('test123');
	// await storage_owner_put();
	// await upload_script('dist/app.js');
	// await upload_script('dist/storage.js', ['1.x', 'latest']);
})();

// mint
async function mint() {
	console.log(...await exec_contract(k_contract, k_wallet, {
		mint_nft: {
			token_id: '1',
			public_metadata: {
				token_uri: 'test-public',
			},
			private_metadata: {
				token_uri: 'test-private',
			},
		},
	}, [['6000', 'uscrt']], `${60000n}`));
}

// set viewing key
async function set_vk(sh_vk: string) {
	const g_msg = {
		set_viewing_key: {
			key: sh_vk,
		},
	};

	print('Executing contract', {
		contract: k_contract.addr,
		from: k_wallet.addr,
		message: JSON.stringify(g_msg),
	});

	console.log(...await exec_contract(k_contract, k_wallet, g_msg, [['5000', 'uscrt']], `${50000n}`));

	const h_query = format_query('storage_owner_get', {
		keys: ['test'],
	}, ['test123', k_wallet.addr]);

	print('Querying contract', {
		contract: k_contract.addr,
		message: JSON.stringify(h_query),
	});

	const a_response = await query_contract(k_contract, h_query);
	console.log(...a_response);
}

// write to owner storage
async function storage_owner_put() {
	const g_msg = {
		storage_owner_put: {
			data: [{
				key: 'test',
				value: 'data',
			}],
		},
	};

	print('Executing contract', {
		contract: k_contract.addr,
		from: k_wallet.addr,
		message: JSON.stringify(g_msg),
	});

	console.log(...await exec_contract(k_contract, k_wallet, g_msg, [['5000', 'uscrt']], `${50000n}`));

	const h_query = format_query('storage_owner_get', {
		keys: ['test'],
	}, ['test123', k_wallet.addr]);

	print('Querying contract', {
		contract: k_contract.addr,
		message: JSON.stringify(h_query),
	});

	const a_response = await query_contract(k_contract, h_query);
	console.log(JSON.stringify(a_response[2]));
}

async function upload_script(sr_path: string, a_tags=['latest'], si_package='') {
	// read file contents
	const atu8_contents = await readFile(sr_path);

	// package name
	if(!si_package) si_package = path.basename(sr_path);

	// compress using gzip
	const atu8_compressed = zlib.gzipSync(atu8_contents, {
		level: zlib.constants.Z_BEST_COMPRESSION,
	});

	// verbose
	print('Gzip compression results:', {
		'file': sr_path,
		'before': `${atu8_contents.byteLength} bytes`,
		' after': `${atu8_compressed.byteLength} bytes`,
	});

	// tx fee
	const xg_limit = 60_000n;
	const x_price = 0.125;
	const x_fee = Math.ceil(Number(xg_limit) * x_price);

	// prep readlne interface
	const d_rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	print('Ready to upload:', {
		chain: si_chain,
		contract: k_contract.addr,
		package: si_package,
		tags: a_tags.join(', '),
		from: k_wallet.addr,
	});

	// confirm
	d_rl.question('Broadcast transaction? (y/n): ', async(s_ans) => {
		// ok
		if(s_ans.startsWith('y')) {
			// upload package
			const [xc_code, s_res, g_tx] = await exec_contract(k_contract, k_wallet, {
				upload_package_version: {
					package_id: si_package,
					tags: a_tags,
					data: {
						bytes: buffer_to_base64(atu8_compressed),
						content_type: 'application/ecmascript',
						content_encoding: 'gzip',
					},
				},
			}, [[`${x_fee}` as Uint128, 'uscrt']], `${xg_limit}`);

			// log result
			console.log(xc_code, s_res.trim(), g_tx);
		}

		// done
		d_rl.close();
	});
}
