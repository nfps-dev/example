/**
 * This script is only used in the development environment. It's purpose is to emulate the boot process
 * offline instead of forcing you, the developer, to perform an actual boot every time you reload.
 */

import {create_svg, qsa} from '@nfps.dev/runtime';

import {dm_root} from './common';

// show onlyscripts
qsa(dm_root, '.onlyscript').map(dm_elmt => dm_elmt.classList.remove('onlyscript'));

// wait for document to load
addEventListener('load', () => {
	// inject the app
	dm_root.append(create_svg('script', {
		href: './app.dev.js',
	}));

	// hide banner
	qsa(dm_root, '#default div')[0].style.display = 'none';
});
