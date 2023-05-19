import {qsa} from '@nfps.dev/runtime';

// reference the root document element (svg)
export const dm_root = document.documentElement;

// dismiss the banner
window.dismiss = () => document.getElementById('dismiss')!.click();

// show onlyscripts
qsa(dm_root, '.onlyscript').map(dm_elmt => dm_elmt.classList.remove('onlyscript'));
