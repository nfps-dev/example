import type {} from '../interface';

import type {L} from 'ts-toolbelt';

import type {
	StorageData,
} from '@nfps.dev/runtime';

import {
	ofe,
} from '@blake.regalia/belt';

import {
	SA_OWNER,
} from 'nfpx:app';

import {
	G_QUERY_PERMIT,
	K_CONTRACT,
	SH_VIEWING_KEY,
	query_contract_infer,
} from 'nfpx:bootloader';


// eslint-disable-next-line @typescript-eslint/naming-convention
export async function readOwner<
	a_keys extends string[],
>(a_keys: a_keys): Promise<Record<L.UnionOf<a_keys>, string> | void | undefined> {
	// perform query on contract
	const [g_storage,, s_error] = await query_contract_infer<StorageData>(K_CONTRACT, 'storage_owner_get', {
		keys: a_keys,
	}, G_QUERY_PERMIT || [SH_VIEWING_KEY, SA_OWNER]);

	// restructure response
	return g_storage? ofe((g_storage.data || []).map(g => [g.key, g.value])): alert(s_error);
}

// } as Pick<typeof globalThis, 'readOwner'>);


