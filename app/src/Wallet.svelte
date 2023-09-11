<script lang="ts">
	import type {Arrayable, Dict, Promisable, Uint128} from '@blake.regalia/belt';
	import type {Coin} from '@cosmjs/amino';
	import type {IconDefinition} from '@fortawesome/fontawesome-svg-core';
	import type {Key as KeplrKey} from '@keplr-wallet/types';
	import type {ComcClient} from '@nfps.dev/runtime';
	import type {BroadcastResult, SecretBech32, BroadcastResultOk, BroadcastResultErr, TxResponse, SlimCoin} from '@solar-republic/neutrino';
	
	// anything imported by svelte component that is also imported by entry module will get merged in bundle
	import {
		oda,
		ode,
		buffer_to_hex,
		sha256,
		hex_to_buffer,
		buffer_to_text,
		base64_to_buffer,
		oderaf,
	} from '@blake.regalia/belt';
	
	import {
		faCircleInfo,
		faHandHoldingDollar,
		faReceipt,
		faServer,
		faUser,
		faWallet,
	} from '@fortawesome/free-solid-svg-icons';

	import {
		XC_CMD_ACCOUNT_CHANGED,
		XC_CMD_CONNECT,
		XC_CMD_SECRET_DECRYPT,
		XC_CMD_SECRET_ENCRYPT,
		XC_CMD_SIGN_AUTO,
		create_html,
		create_svg,
		qsa,
	} from '@nfps.dev/runtime';

	import {
		XC_SIGN_MODE_AMINO,
		broadcast,
		create_tx_body,
		safe_json,
		Protobuf,
		anyBasicAllowance,
		msgGrantAllowance,
		encode_txraw,
		queryBankSpendableBalances,
		queryFeegrantAllowances,
		auth,
		bech32_decode,
		any,
		decode_protobuf,
		query_contract_infer,
	} from '@solar-republic/neutrino';
	
	import G_PACKAGE_JSON_NEUTRINO from '@solar-republic/neutrino/package.json';
	
	// use import statements for any modules that are already loaded by the time 'app' starts loading
	import {
		A_TOKEN_LOCATION,
		K_CONTRACT,
		SH_VIEWING_KEY,
	} from 'nfpx:bootloader';
	
	
	import {afterUpdate, beforeUpdate, tick} from 'svelte';
	
	import {WebextPortal} from './webext-portal';

	// before 'Wallet.svelte' is instantiated, 'main.ts' dynamically exports some data.
	// use an reserved function to import from the loaded module rather than a static import.
	// this way, the destructuring expression will not get moved outside the svelte component.
	const {
		K_WALLET,
		SA_OWNER,
		A_COMCS,
	} = destructureImportedNfpModule('app');

	const XG_MINIMUM_SPENDABLE_GAS = 40_000n;

	const SA_WALLET = K_WALLET.addr;
	const P_LCD = K_WALLET.lcd;

	const __LABEL = Symbol();

	export let b_writable = false;

	type MenuValueItem = string | HTMLElement;

	type MenuDefItem =
		| Arrayable<MenuValueItem>
		| MenuValueItem
		| (() => MenuDef | null)
		| [f: () => MenuDef | null, g?: IconDefinition];

	type MenuDef = Record<string, MenuDefItem> & Partial<Record<typeof __LABEL, string>>;

	const H_MENU_ROOT: MenuDef = {
		'Account Details': [() => ({
			'Address of this account': SA_WALLET,
		}), faUser],
		'Add Funds to Wallet': [() => ((request_feegrant(), null)), faHandHoldingDollar],
		'Transaction History': [() => null, faReceipt],
		'App Information': [() => ({
			'View Packages': [() => ({
				'': 'Not yet implemented. Fake data:',
				' ': 'bootloader.js: v0.1.0',
				'  ': 'main.js: v0.2.3',
			})],
			'Chain ID': K_WALLET.ref,
			'Address of NFP token owner': SA_OWNER,
			'URL of network API endpoint': P_LCD,
		}), faServer],
		'About Neutrino Wallet': [() => ({
			'What is the Neutrino Wallet?': 'A hot wallet that only exists in this browser tab.',
			'Where did my account come from?': 'Neutrino securely generated this account on your device.',
			'How do I back up or export my private key?': `YOU DON'T. Think of it as a "burner" account.`,
			'How do I send funds to this account?': `YOU DON'T. Instead, this account can be funded using Feegrants, which allow it to spend gas from another account. Follow instructions to "Fund Wallet" from the main menu.`,
			'Developed by': 'Blake Regalia, founder of StarShell Wallet, Solar Republic LLC',
		}), faCircleInfo],
	};

	let a_menus: MenuDef[] = [H_MENU_ROOT];
	let h_menu_leaf = a_menus[0];

	const reset_menu = () => a_menus = [H_MENU_ROOT];

	let h_menu_entering: MenuDef | null = null;

	beforeUpdate(() => {
		const h_menu = a_menus.at(-1);
		if(h_menu !== h_menu_leaf) {
			h_menu_leaf = h_menu_entering = h_menu!;
		}
	});

	afterUpdate(() => {
		setTimeout(() => h_menu_entering = null);
	});


	let s_spendable = '0';

	let dm_viewport: HTMLDivElement;

	let a_feegrants: [
		sa_granter: SecretBech32,
		s_amount: string,
	][] = [];

	let xg_balance = 0n;
	let xg_granted = 0n;

	let b_collapsed = true;

	const accumulate_uscrt = (a_coins: Coin[]) => a_coins
		.reduce((xg_out, g_coin) => 'uscrt' === g_coin.denom? xg_out + BigInt(g_coin.amount): 0n, 0n);

	const uscrt_to_string = (xg_amount: bigint): string => {
		const s_amount = (xg_amount+'').padStart(6, '0');
		return s_amount.slice(0, -6)+'.'+s_amount.slice(-6, -3);
	};

	async function refresh_spendable_gas() {
		a_feegrants = [];

		await Promise.all([
			queryBankSpendableBalances(K_WALLET.lcd, SA_WALLET).then(a_coins => xg_balance += accumulate_uscrt(a_coins)),

			queryFeegrantAllowances(K_WALLET.lcd, SA_WALLET).then((a_results) => {
				for(const g_result of a_results) {
					const g_allowance = g_result.allowance;
					const si_type = g_allowance['@type'];

					// basic allowance
					if(si_type.includes('Basic')) {
						// no expiration or hasn't taken effect yet
						const s_expiration = g_allowance.expiration;
						if(!s_expiration || Date.parse(s_expiration) > Date.now()) {
							const xg_limit = accumulate_uscrt(g_allowance.spend_limit);
							xg_granted += xg_limit;
							a_feegrants.push([g_result.granter, uscrt_to_string(xg_limit)]);
						}
					}
				}
			}),
		]);

		// string-based decimal shifting and truncation
		s_spendable = uscrt_to_string(xg_balance+xg_granted);
	}

	function generic_click() {
		b_collapsed = !b_collapsed;
	}

	let b_menu_transitioning = false;
	function heading_click(si_label: string, z_value: MenuDefItem) {
		if('function' === typeof z_value) {
			b_menu_transitioning = true;
			const h_submenu = z_value();
			if(h_submenu && !(h_submenu instanceof Promise)) {
				h_submenu[__LABEL] = si_label;

				a_menus = [...a_menus, h_submenu];
			}
		}
	}

	function menu_pop(d_event: MouseEvent) {
		const dm_menu = (d_event.target as HTMLElement).closest('.menu')!;
		const dm_clone = dm_menu.cloneNode(true) as HTMLElement;
		dm_menu.parentElement?.append(dm_clone);
		setTimeout(() => {
			dm_clone.className += ' staging out';
			dm_clone.addEventListener('transitionend', () => dm_clone.remove());
		});

		a_menus = a_menus.slice(0, -1);
	}

	const icon_to_svg = (a_icon: IconDefinition['icon'], xl_width: number, sx_fill='777') => create_svg('svg', {
		viewBox: `0 0 ${a_icon[0]} ${a_icon[1]}`,
		height: ''+xl_width,
		style: 'fill:#'+sx_fill,
	}, [
		create_svg('path', {
			d: a_icon[4],
		}),
	]).outerHTML;


	const create_description_list = (h_data: Dict<MenuValueItem>): HTMLDListElement => create_html('dl', {}, oderaf(h_data, (si_key, s_value) => [
		create_html('div', {
			class: 'dt-dd',
		}, [
			create_html('dt', {}, [si_key]),
			create_html('dd', {}, [s_value]),
		]),
	]));

	const notify = (si_title: string, a_messages: MenuValueItem[], si_context='') => {
		a_menus = [...a_menus, oda({
			[si_context]: a_messages,
		}, {
			[__LABEL]: si_title,
		})];

		b_collapsed = false;
	};

	const tx_err = (s_msg: string, s_context?: string) => notify('❌ Transaction Failed', [
		s_msg,
	], s_context ?? 'The network said:');

	type WebextTuple = [sa_webext: SecretBech32, atu8_pk33: Uint8Array, s_name: string];

	const submit_tx = async(atu8_msg: Uint8Array, sg_limit: Uint128) => {
		// fetch auth info for signer
		const a_auth = await auth({
			lcd: K_WALLET.lcd,
			addr: a_webext[0],
		});

		// request signature
		const [g_signed_doc, atu8_signature] = await k_portal.post(XC_CMD_SIGN_AUTO, [atu8_msg, sg_limit, a_auth]);

		// create tx
		const [
			atu8_auth,
			atu8_body,
		] = await create_tx_body(XC_SIGN_MODE_AMINO, {
			lcd: K_WALLET.lcd,
			addr: a_webext[0],
			pk33: a_webext[1],
		}, [atu8_msg], g_signed_doc.fee.amount.map(g => [g.amount, g.denom] as SlimCoin), g_signed_doc.fee.gas as Uint128, a_auth);

		// encode the raw bytes for tx
		const atu8_raw = encode_txraw(Protobuf(), atu8_body, atu8_auth, [atu8_signature]).o();

		// compute transaction hash id
		const si_txn = buffer_to_hex(await sha256(atu8_raw)).toUpperCase();

		// update ui
		notify('⏳ Waiting for confirmation', [
			create_description_list({
				'Transaction hash:': create_html('code', {}, [
					buffer_to_hex(await sha256(atu8_raw)).toUpperCase(),
				]),
			}),
		]);

		// broadcast tx to chain
		const [sx_res, d_res] = await broadcast(K_WALLET.lcd, atu8_raw);

		// not OK
		if(!d_res.ok) throw tx_err(sx_res, 'LCD server error '+d_res.status);

		// parse response
		const g_res = safe_json(sx_res) as BroadcastResult;

		// invalid json
		if(!g_res) throw tx_err(sx_res);

		// destructure broadcast response
		const g_tx_res = (g_res as BroadcastResultOk).tx_response;

		// not success; restructure error
		if(!g_tx_res) throw tx_err('Error '+(g_res as BroadcastResultErr).code+': '+(g_res as BroadcastResultErr).message);

		// continue
		return {
			res: g_tx_res,
			hash: si_txn,
		};
	};

	let k_portal: ComcClient;

	const init_portal = async(): Promise<WebextTuple> => {
		// init portal if needed
		if(!k_portal) k_portal = await WebextPortal(A_COMCS);

		// open new connection
		try {
			const g_account = await k_portal.post(XC_CMD_CONNECT, [location.href, K_WALLET.ref]);

			// return re-structured tuple
			return [
				g_account.bech32Address as SecretBech32,
				g_account.pubKey,
				g_account.name,
			];
		}
		catch(e_connect) {
			notify('Error from web extension wallet', [
				(e_connect as Error).message,
			]);

			throw e_connect;
		}
	};

	/**
	 * apply a "call-to-action" prompt
	 */
	const cta = async(si_label: string, a_msgs: MenuValueItem[], s_action: string, f_click: (d_event: MouseEvent) => Promisable<any>) => {
		reset_menu();
		notify(si_label, [
			...a_msgs,
			create_html('button', {
				// "call to action" styling
				class: 'cta',
			}, [s_action]),
		]);

		await tick();

		return new Promise((fk_resolve) => {
			qsa(dm_viewport, '.cta')[0].onclick = async(d_event) => {
				fk_resolve(await f_click(d_event));
			};
		});
	};

	const decrypt_response = async(h_results: Dict<any>, atu8_nonce: Uint8Array): Promise<string | void> => {
		if(h_results?.['res']) {
			// destructure
			const {
				res: g_tx_res,
			} = h_results as {
				res: TxResponse;
			};

			// parse data
			const [
				[[
					// type_url
					[atu8_type],  // eslint-disable-line @typescript-eslint/no-unused-vars

					// value
					[
						[[atu8_contents]],
					],
				]],
			] = decode_protobuf(hex_to_buffer(g_tx_res.data)) as [[[[Uint8Array], [[[Uint8Array]]]]]];

			// decode message type
			const si_type = buffer_to_text(atu8_type);

			// execution
			if('/secret.compute.v1beta1.MsgExecuteContract' === si_type) {
				// request decrypt message from contract
				const atu8_plaintext = await k_portal.post(XC_CMD_SECRET_DECRYPT, [atu8_contents, atu8_nonce]);

				// return decrypted response
				return buffer_to_text(base64_to_buffer(buffer_to_text(atu8_plaintext)));
			}
		}
	};

	const request_feegrant = async() => {
		const [sa_webext, , s_name_webext] = a_webext;

		await cta('Grant fee allowance', [
			`Allow this Neutrino account to pay its gas fees using your "${s_name_webext}" account`,
		], 'Grant Allowance', async() => {
			const xg_limit = 1_000_000n;  // 1 SCRT

			// create basic allowance message
			const atu8_allowance = anyBasicAllowance([[xg_limit, 'uscrt']]);

			// create grant message
			const atu8_msg = msgGrantAllowance(sa_webext, SA_WALLET, atu8_allowance);

			// carry out tx
			await submit_tx(atu8_msg, `${50_000n}`);
		});
	};

	// ensure the hot account is authorized as a delegate
	const authorize_writes = async() => {
		const [sa_webext, , s_name_webext] = a_webext;

		// const [g_res, xc_code, s_error] = await query_contract_infer<{
		// 	tokens: string[];
		// }>(K_CONTRACT, 'tokens', {
		// 	owner: sa_webext,
		// }, [SH_VIEWING_KEY, SA_OWNER]);

		// TODO: query for delegates

		await cta('Authorize this account', [
			`Tells the smart contract its OK for this account to execute a certain set of actions on behalf of your "${s_name_webext}" account.`,
			'For security, this account will not be able to burn, transfer, or change privileges of the NFP whatsoever.',
		], 'Authorize', async() => {
			// // request encrypt message for contract
			const atu8_exec = await k_portal.post(XC_CMD_SECRET_ENCRYPT, [K_CONTRACT.hash, {
				approve_owner_delegate: {
					address: SA_WALLET,
				},
			}]);

			// save nonce
			const atu8_nonce = atu8_exec.subarray(0, 32);

			// construct proto message
			const atu8_msg = any('/secret.compute.v1beta1.MsgExecuteContract', Protobuf()
				.v(10).b(bech32_decode(sa_webext))
				.v(18).b(bech32_decode(K_CONTRACT.addr))
				.v(26).b(atu8_exec)
				.o());

			// submit for signing and broadcast
			const h_results = await submit_tx(atu8_msg, `${50_000n}`);

			// decrypt contract response
			const sx_res = await decrypt_response(h_results, atu8_nonce);

			console.log(sx_res);
		});
	};


	const check_owner = async(): Promise<boolean> => {
		const [sa_webext, atu8_pk33, s_name_webext] = await init_portal();

		// not the owner
		if(sa_webext !== SA_OWNER) {
			// just retried
			const dm_retry = qsa(dm_viewport, '.retry')[0];
			if(dm_retry) {
				const n_attempts = dm_retry.dataset['attempts'] = (+(dm_retry.dataset['attempts'] || 0) + 1)+'';
				dm_retry.textContent = `Retry (${n_attempts})`;
			}
			else {
				const dm_a_cli = create_html('a', {
					class: 'inlink',
				}, [
					create_html('code', {}, ['secretcli']),
				]);

				reset_menu();

				notify('⚠️ Authorization required', [
					'To run this application, the NFP owner account needs to authorize this Neutrino wallet.',
					`Your "${s_name_webext}" account from the connected web wallet is not the owner of this NFP (token id: ${A_TOKEN_LOCATION[2]}).`,
					'Do you need to switch accounts in your web wallet?',
					create_html('div', {}, [
						'Advanced users may need to use ',
						dm_a_cli,
					]),
					create_html('p', {
						id: 'secretcli-ins',
						style: 'display:none',
					}, [
						create_html('textarea', {
							spellcheck: 'false',
							style: 'height:4em',
						}, [
							`secretcli tx compute execute ${K_CONTRACT.addr} '${JSON.stringify({
								approve_owner_delegate: {
									address: SA_WALLET,
								},
							})}' --gas 50000 --from "\${NFP_OWNER_ACCOUNT}"`,
						]),
					]),

					create_html('button', {
						class: 'cta retry',
					}, [
						'Retry',
					]),
				]);

				await tick();

				qsa(dm_viewport, '.inlink')[0].onclick = () => {
					qsa(dm_viewport, '#secretcli-ins')[0].style.display = 'block';
				};
			}

			return new Promise((fk_resolve) => {
				qsa(dm_viewport, '.cta')[0].onclick = () => {
					fk_resolve(false);
				};
			});
		}

		return true;
	};

	let a_webext!: [sa_webext: SecretBech32, atu8_pk33: Uint8Array, s_name: string];

	// init
	(async() => {
		// load account tuple
		a_webext = await init_portal();

		// check that the wallet is ready to interact with the nfp
		const f_recheck = async(): Promise<void> => {
			// on account change
			void k_portal!.post(XC_CMD_ACCOUNT_CHANGED, 0 as unknown as void).then((g_account: KeplrKey) => {
				// update account tuple
				a_webext = [g_account.bech32Address as SecretBech32, g_account.pubKey, g_account.name];

				// reload
				void f_recheck();
			});

			// check the owner
			const b_owner = await check_owner();

			// not the owner, retry
			if(!b_owner) return f_recheck();

			// check how much spendable gas this account has
			await refresh_spendable_gas();

			// less than the minimum threshold
			if(xg_balance + xg_granted < XG_MINIMUM_SPENDABLE_GAS) {
				// request feegrant from web wallet
				await request_feegrant();

				// reset wallet
				reset_menu();

				// retry
				return f_recheck();
			}

			// ensure the wallet is authorized as a delegate
			await authorize_writes();
		};

		// boot
		void f_recheck();
	})();


</script>

<style lang="less">
	* {
		transition-duration: 0.8s;
		transition-timing-function: var(--ease-out-quick);
	}

	@s_background: #112;
	@xlw_wallet: 320px;
	@xlh_collapsed: 40px;
	@xlw_scrollbar_gap: 12px;

	#wallet {
		background: @s_background;
		border-radius: 6px;
		padding: 1em 2em;

		position: absolute;
		top: 2em;
		right: 2em;

		transition-property: width, height;

		width: @xlw_wallet;
		height: 300px;

		overflow: hidden;

		&.collapsed {
			width: 180px;
			height: @xlh_collapsed;
			cursor: pointer;

			&:hover {
				outline: 1px solid white;
			}

			>:last-child {
				opacity: 0;
			}
		}
	
		>:first-child {
			display: flex;
			align-items: center;
			gap: 8px;
	
			height: @xlh_collapsed;
		}
	
		// push the scrollbar into the margins
		>:last-child {
			margin-right: -(ceil(@xlw_scrollbar_gap * (3/4)));
			opacity: 1;
		}

		button {
			:global(&) {
				margin-top: 6px;
				background: hsl(224.79deg 9.63% 27.56%);
				border: 2px solid #666;
				color: #f7f7f7;
				padding: 8px 16px;
				border-radius: 6px
			}
			
			:global(&.cta) {
				background: hsl(225 29% 71% / 1);
				border-color: #66f;
				color: #003;
			}
		}
	}

	.bal {
		font-size: 18px;
	}

	@xlh_viewport: 260px;
	@xlw_menu_indent: 8px;
	@xlw_menu_separator: 1px;

	.viewport {
		overflow: hidden;
		height: @xlh_viewport;
		position: relative;
	}

	@xlh_menu_title_margin: 12px;
	@xlh_menu_title_height: 18px;
	@xlh_scroll_fade: 10px;
	@xlh_menu: @xlh_viewport - @xlh_menu_title_margin + @xlh_menu_title_height + @xlh_scroll_fade;

	.menu {
		width: 100%;
		position: absolute;
		background: @s_background;
		min-height: @xlh_viewport;
		border-left: @xlw_menu_separator solid #333;
		padding-left: @xlw_menu_indent;
		margin-left: -(@xlw_menu_indent + @xlw_menu_separator);
		z-index: 1;

		@xlw_menu_half: ((@xlw_wallet + @xlw_menu_indent + @xlw_menu_separator) / 2);
		&.staging {
			transform: translateX(@xlw_menu_half);

			&.out {
				margin-left: @xlw_menu_half;
			}
		}

		>h3 {
			margin: @xlh_menu_title_margin 0 7px 0;
			height: @xlh_menu_title_height;

			>span {
				margin-left: 6px;
	
				&:first-child {
					cursor: pointer;
					margin: 0;
					border: 1px solid #333;
					border-radius: 4px;
					padding: 6px 16px;
				}
			}
		}
	}

	.heading {
		cursor: pointer;
		padding: 12px 12px 12px 0;
		border-bottom: 1px solid #333;
		background: #0000;
		transition: background 0.3s ease-out;

		position: relative;

		&::after {
			position: absolute;
			right: 12px;
			content: "›";
			margin-top: -4px;
			color: #666;
			font-size: 1.3em;
		}

		&:hover {
			background: #0004;
			transition: none;
		}
	}

	.icon {
		display: inline-flex;
		width: 16px;
		vertical-align: bottom;
		justify-content: center;
		margin: 0 6px;
	}

	.fields {
		display: flex;
		flex-direction: column;
		gap: 4px;

		max-height: @xlh_menu - 50px;
		overflow: scroll;

		>* {
			// leave space on right side for scrollbar
			margin-right: @xlw_scrollbar_gap;
	
			&:first-child {
				margin-top: @xlh_scroll_fade + 2px;
			}
	
			&:last-child {
				margin-bottom: @xlh_scroll_fade + 2px;
			}
		}

		&::before {
			pointer-events: none;
			content: '';
			position: absolute;
			width: 150%;
			height: @xlh_menu - 50px;
			z-index: 2;
			left: -25%;
			box-shadow: inset 0 0 @xlh_scroll_fade @xlh_scroll_fade @s_background;
		}

		:global(&::-webkit-scrollbar) {
			background: transparent;
		}

		:global(&::-webkit-scrollbar-corner) {
			background: transparent;
		}
	}

	.heading:first-child {
		border-top: 1px solid #333;
	}

	.field-data-row() {
		margin: 8px 0 0 0;
	}

	.field() {
		color: #777;
		font-size: 11px;
	}

	.data() {
		margin: 6px 0;
	}

	:where(.field) {
		.field-data-row();

		>:first-child {
			.field();
		}

		p {
			.data();
		}
	}

	#wallet {
		:global(.dt-dd) {
			.field-data-row();
		}
	
		:global(dt) {
			.field();
		}
	
		:global(dd) {
			.data();
		}
	
		.inlink, .inlink * {
			:global(&) {
				color: #6495ED;
				cursor: pointer;
			}
		}

		:global(textarea) {
			background-color: rgba(0,0,0,0.2);
			border: 1px solid rgba(250,250,250,0.2);
			width: 100%;
			padding: 2px 4px;
		}
	}

</style>

<!-- {#if }
	<dl class="fields">
		<dt></dt>
		<dd></dd>
	</dl>
{/if} -->

<div id="wallet" class:collapsed={b_collapsed} on:click={generic_click}>
	<div>
		<span>
			{@html icon_to_svg(faWallet.icon, 22, 'f7f7f7')}
		</span>
		<span>
			<span class="bal">
				{s_spendable}
			</span>
			<span>
				SCRT
			</span>
		</span>
	</div>
	<div on:click|stopPropagation>
		<div class="viewport" bind:this={dm_viewport}>
			{#each a_menus as h_menu, i_menu (JSON.stringify(h_menu))}
				<div class="menu" class:staging={h_menu_entering === h_menu} class:out={0}>
					<h3>
						{#if i_menu}
							<span on:click={menu_pop}>
								‹
							</span>
							<span>
								{h_menu[__LABEL]}
							</span>
						{:else}
							Neutrino Wallet v{G_PACKAGE_JSON_NEUTRINO.version}
						{/if}
					</h3>
	
					<div class="fields">
						{#each ode(h_menu) as [si_label, z_value]}
							{#if Array.isArray(z_value) && 'function' === typeof z_value[0]}
								<div class="heading" on:click={() => heading_click(si_label, z_value[0])}>
									{#if z_value[1]}
										<span class="icon">
											{@html icon_to_svg(z_value[1].icon, 14)}
										</span>
									{/if}
									<span>
										{si_label}
									</span>
								</div>
							{:else}
								<div class="field">
									<div>
										{si_label}
									</div>
									<div>
										{#each Array.isArray(z_value)? z_value: [z_value] as z_p}
											<p>
												{#if z_p instanceof HTMLElement}
													{@html z_p.outerHTML}
												{:else}
													{z_p}
												{/if}
											</p>
										{/each}
									</div>
								</div>
							{/if}
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
