import type {} from '../interface';

import type {
	StorageData,
} from '@nfps.dev/runtime';

import {
	ofe,
} from '@blake.regalia/belt';

Object.assign(window, {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	async readOwner(a_keys) {
		// perform query on contract
		const [g_storage,, s_error] = await qci<StorageData>(sc, 'storage_owner_get', {
			keys: a_keys,
		}, qp || [vk!, toa]);

		// restructure response
		return g_storage? ofe((g_storage.data || []).map(g => [g.key, g.value])): alert(s_error);
	},
} as Pick<typeof globalThis, 'readOwner'>);
