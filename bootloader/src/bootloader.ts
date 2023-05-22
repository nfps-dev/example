import type {
	BootInfo,
	SlimTokenLocation,
} from '@nfps.dev/runtime';

import {
	boot,
	load_script,
	ls_read,
	ls_write,
	ls_read_json,
	ls_write_json,
} from '@nfps.dev/runtime';

import {
	query_contract_infer,
} from '@solar-republic/neutrino';

// import autoboot as a module so that it can be optimized out in production
import autoboot from './_autoboot';

// for side-effects
import './common';

// development mode; perform autoboot
if(import.meta.env.DEV) {
	autoboot();
}
// production
else {
	// bind boot function to global so that user has to click to boot
	window.boot = async(d_event) => {
		const dm_button = d_event.target as HTMLButtonElement;
		dm_button.textContent = 'Connecting...';
		dm_button.disabled = true;

		// boot and save bootinfo
		let a_info: BootInfo | void;
		if((a_info=await boot())) {  // eslint-disable-line @typescript-eslint/no-extra-parens
			const dm_div = dm_button.closest('div')!;
			dm_div.firstChild!.textContent = 'Loaded latest app from chain';
			dm_div.style.background = '#2ec';
			dm_div.style.opacity = '0';

			dm_button.textContent = 'Connected';

			// save reusable globals
			exportNfpx({
				// boot info
				A_TOKEN_LOCATION: a_info[0],
				P_LCD: a_info[1],
				G_QUERY_PERMIT: a_info[2],
				SH_VIEWING_KEY: a_info[3],
				K_CONTRACT: a_info[4],
			});
		}
		// boot failed
		else {
			dm_button.textContent = 'Failed';
		}
	};
}

// export anything that may come in handy to reuse in the app or applibs
export {
	load_script,
	ls_read,
	ls_write,
	ls_read_json,
	ls_write_json,
	query_contract_infer,
};

export type {NfpxExports} from './env';
