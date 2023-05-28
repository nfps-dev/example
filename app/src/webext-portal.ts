import type {ComcClient, ComcClientHandlers} from '@nfps.dev/runtime';
import type {HttpsUrl} from '@solar-republic/neutrino';

import {comcPortal, comcClient} from '@nfps.dev/runtime';

export async function WebextPortal(h_handlers: ComcClientHandlers, p_host: HttpsUrl='https://x.s2r.sh/'): Promise<ComcClient> {
	const {
		dm_foreign,
	} = destructureImportedNfpModule('app');

	const dm_iframe = await comcPortal(p_host, dm_foreign);

	return comcClient(dm_iframe, h_handlers);
}
