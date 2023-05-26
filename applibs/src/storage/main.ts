import type {L} from 'ts-toolbelt';

import type {
	JsonValue,
	JsonObject,
	Uint128,
} from '@blake.regalia/belt';

import type {
	StorageData,
} from '@nfps.dev/runtime';

import type {SecretBech32} from '@solar-republic/neutrino';


import {
	ode,
	oderac, ofe} from '@blake.regalia/belt';


import {
	queryFeegrantAllowances,
	// tpa,
	// tpae,
	// tpas,
	// tpaw,
	// tpar,
} from '@solar-republic/neutrino';

import {
	SA_OWNER,
	K_WALLET,
	exec_contract,
} from 'nfpx:app';

import {
	G_QUERY_PERMIT,
	K_CONTRACT,
	SH_VIEWING_KEY,
	query_contract_infer,
} from 'nfpx:bootloader';


type StoragePutSuccess<si_area extends 'owner'> = {
	[si_key in `storage_${si_area}_put`]: {
		status: 'success';
	};
};


type Allowance = [];

const h_feegrants: Record<SecretBech32, Record<SecretBech32, Allowance>> = {};

/**
 * 
 */
export async function findFeegranter(sa_grantee: SecretBech32, xg_needed: bigint): Promise<SecretBech32 | undefined> {
	for(const [sa_granter, a_allowance] of ode(h_feegrants[sa_grantee] || {})) {
		if(a_allowance) {
			return sa_granter;
		}
	}

	const a_results = await queryFeegrantAllowances(K_WALLET.lcd, sa_grantee);

	debugger;
	for(const g_result of a_results) {
		const g_allowance = g_result.allowance;

		// basic allowance
		if(g_allowance['@type'].includes('Basic')) {
			// destructure spend limit
			const [g_coin] = g_allowance.spend_limit;

			// allowance amount is enough to cover needed amount
			if(BigInt(g_coin.amount) >= xg_needed) {
				return g_result.granter;
			}
		}
	}

	// return tpa(a_results[0])._g || tpa(a_results[0]).$r!;
	// return tpas(a_results[0], 'g') || tpae(a_results[0], 'r');
	// return tpaw(a_results[0], 'g') || tpaw(a_results[0], 'r', 1);
	// return tpar(a_results[0], /^g/) || tpar(a_results[0], /r$/);
	// return a_results[0].granter;

	return;
}



/**
 * Reads from the contract's owner storage
 * @returns an `object` of the key/value pairs contained in the response, or `undefined` if there was 
 * a query error 
 */
export async function readOwner<
	const a_keys extends readonly string[],
>(a_keys: a_keys): Promise<{
	[si_key in L.UnionOf<a_keys>]: string;
} | void | undefined> {
	// perform query on contract
	const [g_storage,, s_error] = await query_contract_infer<StorageData>(K_CONTRACT, 'storage_owner_get', {
		keys: a_keys,
	}, G_QUERY_PERMIT || [SH_VIEWING_KEY, SA_OWNER]);

	// restructure response
	return g_storage? ofe((g_storage.data || []).map(g => [g.key, g.value])) as {
		[si_key in L.UnionOf<a_keys>]: string;
	}: alert(s_error);
}


/**
 * Writes to the contract's owner storage
 */
export async function writeOwner(h_write: Record<string, JsonValue>): Promise<StoragePutSuccess<'owner'>> {
	const a_entries = oderac(h_write, (si_key, w_value) => ({
		key: si_key,
		value: w_value,
	}));

	const x_limit = 60_000;
	const x_fee = x_limit * 0.125;

	// find feegrant
	const sa_granter = await findFeegranter(K_WALLET.addr, BigInt(x_fee));

	const [xc_code, s_res, g_tx] = await exec_contract(K_CONTRACT, K_WALLET, {
		storage_owner_put: {
			data: a_entries,
		},
	}, [[''+x_fee as Uint128, 'uscrt']], ''+x_limit as Uint128, '', sa_granter);

	if(xc_code) throw s_res;

	return JSON.parse(s_res) as StoragePutSuccess<'owner'>;
}
