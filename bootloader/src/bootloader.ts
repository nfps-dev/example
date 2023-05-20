import {oda} from '@blake.regalia/belt';
import {ls_get_str, type BootInfo, ls_set_str, ls_get_json, ls_set_json} from '@nfps.dev/runtime';

import {
	boot,
	load_script,
} from '@nfps.dev/runtime';

import {
	query_contract_infer,
} from '@solar-republic/neutrino';

// for side-effects
import './common';

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
		oda(window, {
			// boot info
			loc: a_info[0],
			lcd: a_info[1],
			qp: a_info[2],
			vk: a_info[3],
			sc: a_info[4],

			// reserved
			toa: '',

			// runtime functions
			load: load_script,
			lsgs: ls_get_str,
			lsss: ls_set_str,
			lsgj: ls_get_json,
			lssj: ls_set_json,

			// neutrino functions
			qci: query_contract_infer,
		});
	}
	// boot failed
	else {
		dm_button.textContent = 'Failed';
	}
};
