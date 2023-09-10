import type {ComcClient, ComcClientHandlers} from '@nfps.dev/runtime';
import type {HttpsUrl} from '@solar-republic/neutrino';

import {comcPortal, comcClient} from '@nfps.dev/runtime';

export async function WebextPortal(h_handlers: ComcClientHandlers, a_hosts: [HttpsUrl, ...HttpsUrl[]]=['https://x.s2r.sh/']): Promise<ComcClient> {
	const {
		dm_foreign,
	} = destructureImportedNfpModule('app');

	for(const p_host of a_hosts) {
		const dm_iframe = await comcPortal(p_host, dm_foreign);

		return comcClient(dm_iframe, h_handlers);
	}

	return null as unknown as ComcClient;
}
