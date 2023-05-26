/// <reference types="@nfps.dev/sdk/env-vars" />
/// <reference types="@nfps.dev/sdk/nfpx" />

import type {Wallet} from '@solar-republic/neutrino';

// declare what the app can export dynamically
export interface NfpxExports {
	K_WALLET: Wallet;
}

/* eslint-disable @typescript-eslint/naming-convention,no-var */
declare global {
	function exportNfpx(h_exports: NfpxExports): void;
}
