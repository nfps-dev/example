/* eslint-disable @typescript-eslint/naming-convention */
import type {Promisable} from '@blake.regalia/belt';

declare global {
	export const boot: (d_event: MouseEvent) => Promisable<void>;
	export const dismiss: () => void;

	interface Window {
		boot: typeof boot;
		dismiss: typeof dismiss;
	}
}
