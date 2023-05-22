/// <reference types="@nfps.dev/sdk/nfpx" />

/* eslint-disable @typescript-eslint/naming-convention,no-var */
import type {L} from 'ts-toolbelt';

import type {
	Dict,
} from '@blake.regalia/belt';


declare global {
	/**
	 * Reads from the contract's owner storage
	 * @returns an `object` of the key/value pairs contained in the response, or `undefined` if there was 
	 * a query error 
	 */
	var readOwner: <
		a_keys extends string[],
	>(a_keys: a_keys) => Promise<Record<L.UnionOf<a_keys>, string> | undefined>;

	/**
	 * Writes to the contract's owner storage
	 */
	var writeOwner: (h_write: Dict) => Promise<0 | 1>;
}



export {};
