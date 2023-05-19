import {create_svg, create_html} from '@nfps.dev/runtime';

const dm_root = document.documentElement;

alert('hello from the chain!');

// create ui to allow user to play/pause animations
const dm_pause = create_html('button', {
	style: 'position:absolute;top:40em;left:22em;background:#333;color:#ce3',
}, [
	'Pause',
]);

dm_root.append(create_svg('foreignObject', {
	width: '100%',
	height: '100%',
	x: '0',
	y: '0',
}, [
	create_html('div', {}, [
		dm_pause,
	]),
]));

dm_pause.onclick = () => {
	dm_pause.textContent = dm_root.classList.toggle('paused')? 'Resume': 'Pause';
};

