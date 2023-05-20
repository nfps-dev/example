<script lang="ts">
	import { qsa } from '@nfps.dev/runtime';
	import { exec_contract, SecretContract, type Wallet } from '@solar-republic/neutrino';

	export let k_wallet: Wallet;
	export let k_contract: SecretContract;

	const local_read = lsgs;
	const local_write = lsss;

	let b_loading = true;

	let s_name = local_read('name') || '';

	(async() => {
		s_name = await readOwner(['name']) || '';

		b_loading = false;
	})();

	async function submit(d_event: SubmitEvent) {
		b_loading = true;

		qsa((d_event.target as HTMLElement).closest('form')!, 'input,button')
			.map(dm => dm.setAttribute('disabled', 'disabled'));

		// save to cache
		local_write('name', s_name || '');

		await writeOwner({
			name: s_name,
		});

		// 
		b_loading = false;
	}
</script>

<style lang="less">

</style>

<div>
	<h3>App connected</h3>
	<div>
		<div>
			<form on:submit={submit}>
				<fieldset disabled={b_loading}>
					<label>
						Name
						<input type="text" value={s_name}>
					</label>
	
					<input type="submit" value="Save">
				</fieldset>
			</form>
		</div>
	</div>
</div>