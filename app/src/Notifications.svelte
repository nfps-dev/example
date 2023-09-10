<script lang="ts">
	import {
		subscribe_tendermint_events,
	} from '@solar-republic/neutrino';

	import {K_CONTRACT} from 'nfpx:bootloader';
	
	const {
		A_RPCS,
	} = destructureImportedNfpModule('app');
	
	const s_channel = '';

	function subscribe() {
		subscribe_tendermint_events(A_RPCS[0], K_CONTRACT.addr, (d_event) => {
			console.log(JSON.parse(d_event.data).result);
		});
	}
</script>

<div>
	<fieldset disabled={false}>
		<input type="text" autocomplete="off"
			value={s_channel} placeholder="SNIP-52 Channel ID">
		<button on:click={subscribe}>Subscribe</button>
	</fieldset>
</div>
