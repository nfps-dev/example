<script lang="ts">
	import {qs, qsa} from '@nfps.dev/runtime';
	
	// we use import statements for any modules that are already loaded by the time our 'app' module starts loading
	import {
		ls_read,
		ls_write,
	} from 'nfpx:bootloader';
	
	import Notifications from './Notifications.svelte';
	import Wallet from './Wallet.svelte';

	// before 'App.svelte' is instantiated, 'main.ts' must have successfully loaded the storage module
	// using an expression ensures the destructuring will not be seen as an import and thus not reordered
	const {
		readOwner,
		writeOwner,
	} = destructureImportedNfpModule('storage');

	// disable parts of the UI while loading results
	let b_loading = true;

	// lock the name if it is saved to chain
	let b_locked = false;

	// load existing data from localStorage cacheSain
	let s_name = ls_read('name') || '';

	const S_ACTION_SAVE = 'Save to chain';
	const S_ACTION_EDIT = 'Edit';

	let dm_section: HTMLElement;

	const S_PLACEHOLDER_LOADING = 'Loading...';
	const S_PLACEHOLDER_READY = 'Name your token';
	let s_placeholder = S_PLACEHOLDER_LOADING;

	let s_action = S_ACTION_EDIT;
	async function edit_name() {
		if(s_action === S_ACTION_EDIT) {
			b_locked = false;
			qs(dm_section, '#name')!.focus();
		}
		else {
			b_loading = true;

			qsa(dm_section, 'input,button')
				.map(dm => dm.setAttribute('disabled', 'disabled'));

			// save to cache
			ls_write('name', s_name || '');

			s_action = 'Saving...';

			await writeOwner({
				name: s_name,
			});

			s_action = S_ACTION_EDIT;

			// 
			b_loading = false;
		}
	}

	let b_writable = false;

	// load saved value
	(async() => {
		// load name from the chain and lock/unlock the input depending on whether a name exists
		if(!(b_locked=!!(s_name=(await readOwner(['name']))?.name || ''))) {
			s_placeholder = S_PLACEHOLDER_READY;
			s_action = S_ACTION_SAVE;
		}

		b_loading = false;
	})();

</script>

<style lang="less">
	@import './def.less';

	:global(#app) {
		--ease-out-quick: @ease-out-quick;
	}

	:global(*) {
		color: #f7f7f7;
	}

	section {
		margin: 1em
	}

	h3 {
		&.on i {
			background: chartreuse;
		}
	}

	i {
		border-radius: 8px;
		width: 8px;
		height: 8px;
		display: inline-block;
		margin-bottom: 1px;

		background: darkorange;
	}

	fieldset {
		:global(&) {
			border: 0;
		}

		input, button {
			:global(&) {
				background: #333;
				color: #ce3;
				padding: 8px 12px;
				border: 0;
		
				&:focus {
					outline: 1px solid orange;
					border-radius: 2px;
				}
		
				&:disabled {
					opacity: 0.8;
				}
			}
		}
	}


	:global(.flex) {
		display: flex;
	}

	:global(.spaced) {
		justify-content: space-between;
	}
</style>

<section bind:this={dm_section}>
	<div class="flex spaced">
		<h3 class:on={!b_loading && b_writable}>
			<i /> {b_loading? 'Loading...': b_writable? 'Synced': 'Awaiting Wallet'}
		</h3>
	</div>

	<div>
		<fieldset disabled={b_loading || !b_writable}>
			<input id="name" type="text" autocomplete="off"
				disabled={b_locked} bind:value={s_name} placeholder={s_placeholder}>
			<button on:click={edit_name}>{s_action}</button>
		</fieldset>
	</div>

	<!-- <Notifications /> -->
</section>

<Wallet bind:b_writable />
