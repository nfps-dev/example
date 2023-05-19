import {
	boot,
} from '@nfps.dev/runtime';

// for side-effects
import './common';

// bind boot function to global so that user has to click to boot
window.boot = async(d_event) => {
	const dm_button = d_event.target as HTMLButtonElement;
	dm_button.textContent = 'Connecting...';
	dm_button.disabled = true;

	await boot();

	const dm_div = dm_button.closest('div')!;
	dm_div.firstChild!.textContent = 'Loaded latest app from chain';
	dm_div.style.background = '#2ec';
	dm_div.style.opacity = '0';

	dm_button.textContent = 'Connected';
};
