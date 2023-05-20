/* eslint-disable @typescript-eslint/naming-convention,no-var */
import type {Promisable, Nilable} from '@blake.regalia/belt';

import type {
	SlimTokenLocation,
	load_script,
	ls_get_json,
	ls_get_str,
	ls_set_json,
	ls_set_str,
} from '@nfps.dev/runtime';

import type {
	SecretContract,
	QueryPermit,
	Wallet,
	HttpsUrl,
	query_contract_infer,
	SecretBech32,
} from '@solar-republic/neutrino';

declare global {
	var boot: (d_event: MouseEvent) => Promisable<void>;
	var dismiss: () => void;

	/**
	 * Save the boot info to the global scope so that the app can use it right away
	 */
	var loc: SlimTokenLocation;
	var lcd: HttpsUrl;
	var qp: QueryPermit | undefined;
	var vk: string | undefined;
	var sc: SecretContract;

	/**
	 * Reserved
	 */
	var toa: SecretBech32;

	/**
	 * Runtime functions
	 */
	var load: typeof load_script;
	var lsgs: typeof ls_get_str;
	var lsss: typeof ls_set_str;
	var lsgj: typeof ls_get_json;
	var lssj: typeof ls_set_json;

	/**
	 * Since the bootloader includes some neutrino lib, make some functions available for reuse
	 */
	var qci: typeof query_contract_infer;
}
