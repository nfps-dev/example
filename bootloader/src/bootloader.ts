import {
	boot,
} from '@nfps.dev/runtime';

declare global {
	interface Window {
		boot: typeof boot;
	}
}

// bind to global so that user has to click to boot
window.boot = boot;
