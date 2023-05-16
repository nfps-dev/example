import {readFile} from 'node:fs/promises';
import readline from 'node:readline';
import zlib from 'node:zlib';
import path from 'node:path';

import {oderac, base64_to_buffer, buffer_to_base64, hex_to_buffer} from '@blake.regalia/belt';

import {
	gen_sk,
	sk_to_pk,
	pubkey_to_bech32,
	wallet,
	secretContract,
	queryContract,
	execContract,
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
	const atu8_sk = await gen_sk();
	const sb16_sk_gen = buffer_to_hex(atu8_sk);
	const sa_gen = await pubkey_to_bech32(sk_to_pk(atu8_sk));
	console.log(`No private key found; here is a new account you can use for testing...\n  NFP_OWNER="${sa_gen}"\n  NFP_WALLET_PRIVATE_KEY="${sb16_sk_gen}"`);
	process.exit(0);
}

// user-friendly output
const print = (s_header, h_fields) => console.log(s_header+'\n'+oderac(h_fields, (si_key, s_label) => `  ${si_key}: ${s_label}`).join('\n')+'\n');

// destructure env vars
const {
	NFP_SELF_CHAIN: si_chain,
	NFP_WEB_LCDS: s_lcds,
	NFP_SELF_CONTRACT: sa_contract,
} = h_env

// decode private key
let atu8_sk;
if(64 === sh_sk.length) atu8_sk = hex_to_buffer(sh_sk);
else atu8_sk = atu8_sk = base64_to_buffer(sh_sk);

// create wallet
const k_wallet = await wallet(s_lcds?.split(',')[0], si_chain, atu8_sk);

// connect to the contract
const k_contract = await secretContract(s_lcds?.split(',')[0], sa_contract);

void upload_script('dist/app.js');


async function upload_script(sr_path, a_tags=['latest'], si_package='') {
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
		file: sr_path,
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
		contract: k_contract.bech32,
		package: si_package,
		tags: a_tags.join(', '),
		from: k_wallet.bech32,
	});

	// confirm
	d_rl.question('Broadcast transaction? (y/n): ', async(s_ans) => {
		// ok
		if(/^y/.test(s_ans)) {
			// upload package
			const [xc_code, s_res, g_tx] = await execContract(k_contract, k_wallet, {
				upload_package_version: {
					package_id: si_package,
					tags: a_tags,
					data: {
						bytes: buffer_to_base64(atu8_compressed),
						content_type: 'application/ecmascript',
						content_encoding: 'gzip',
					},
				},
			}, [[`${x_fee}`, 'uscrt']], `${xg_limit}`);

			// log result
			console.log(xc_code, s_res, g_tx);
		}

		// done
		d_rl.close();
	});
}
