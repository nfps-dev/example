/// <reference types="@nfps.dev/sdk/env-vars" />
/// <reference types="@nfps.dev/sdk/nfpx" />

import type {Nilable, Promisable} from '@blake.regalia/belt';
import type {SlimTokenLocation, load_script} from '@nfps.dev/runtime';
import type {HttpsUrl, QueryPermit, SecretContract} from '@solar-republic/neutrino';

// declare what the bootloader can export dynamically
export interface NfpxExports {
	A_TOKEN_LOCATION: SlimTokenLocation;
	P_LCD: HttpsUrl;
	K_CONTRACT: SecretContract;
	G_QUERY_PERMIT: Nilable<QueryPermit>;
	SH_VIEWING_KEY: string;

	load_script?: typeof load_script;
}

/* eslint-disable @typescript-eslint/naming-convention,no-var */
declare global {
	var boot: (d_event: MouseEvent) => Promisable<void>;
	var dismiss: () => void;

	function exportNfpx(h_exports: NfpxExports): void;
}
