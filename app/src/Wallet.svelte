<script lang="ts">
	import type {Arrayable, Promisable} from '@blake.regalia/belt';
	import type {AccountData, Coin} from '@cosmjs/amino';
	import type {IconDefinition} from '@fortawesome/fontawesome-svg-core';
	import type {Key as KeplrKey} from '@keplr-wallet/types';
	import type {ComcClient, ComcClientHandlers} from '@nfps.dev/runtime';
	
	import {
		oda,
		ode,
		buffer_to_hex,
		buffer_to_base64,
		sha256,
	} from '@blake.regalia/belt';
	
	import {
		faCircleInfo,
		faHandHoldingDollar,
		faReceipt,
		faServer,
		faUser,
		faWallet,
	} from '@fortawesome/free-solid-svg-icons';
	import {create_html, create_svg, qs, qsa} from '@nfps.dev/runtime';
	import {broadcast, create_tx, Protobuf, safe_json, type BroadcastResult, type SecretBech32, type BroadcastResultOk, type BroadcastResultErr} from '@solar-republic/neutrino';
	import {
		anyBasicAllowance,
		msgGrantAllowance,
		encode_txraw,
		queryAuthAccounts,
		queryBankSpendableBalances,
		queryFeegrantAllowances,
	} from '@solar-republic/neutrino';
	
	
	import G_PACKAGE_JSON_NEUTRINO from '@solar-republic/neutrino/package.json';
	
	import {afterUpdate, beforeUpdate, tick} from 'svelte';
	
	import {WebextPortal} from './webext-portal';

	const {
		K_WALLET,
		SA_OWNER,
	} = destructureImportedNfpModule('app');

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
		'Add Funds to Wallet': [() => (request_feegrant(reset_menu), null), faHandHoldingDollar],
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

	const a_menus_added: MenuDef[] = [];

	let h_menu_entering: MenuDef | null = null;

	beforeUpdate(() => {
		const h_menu = a_menus.at(-1);
		if(h_menu !== h_menu_leaf) {
			// debugger;
			h_menu_leaf = h_menu_entering = h_menu!;
		}

		// const h_menu_leaf = a_menus.at(-1);
		// if(a_menus_added[0] !== h_menu_leaf) {
		// 	a_menus_added.unshift(h_menu_leaf);
		// }
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

	const notify = (si_title: string, a_messages: (string | HTMLElement)[], si_context='') => {
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

	let k_portal: ComcClient;
	let g_webext_account: KeplrKey;
	const init_portal = async(fk_ready: (
		sa_account: SecretBech32,
		s_name: string,
		atu8_pk33: Uint8Array
	) => any, fk_signed?: () => any) => {
		if(!k_portal) {
			k_portal = await WebextPortal({
				// connection was approved
				a(g_account: KeplrKey) {
					const {
						name: s_name_webext,
						bech32Address: sa_webext,
						pubKey: atu8_pk33,
					} = g_account;

					fk_ready(sa_webext as SecretBech32, s_name_webext, atu8_pk33);
				},

				async s([
					atu8_auth,
					atu8_body,
					atu8_signature,
				]: [
					atu8_auth: Uint8Array,
					atu8_body: Uint8Array,
					atu8_signature: Uint8Array,
				]) {
					// encode the raw bytes for tx
					const atu8_raw = encode_txraw(Protobuf(), atu8_body, atu8_auth, [atu8_signature]).o();

					// compute transaction hash id
					const si_txn = buffer_to_hex(await sha256(atu8_raw)).toUpperCase();

					// broadcast
					const [sx_res, d_res] = await broadcast(K_WALLET.lcd, atu8_raw);

					// not OK
					if(!d_res.ok) return tx_err(sx_res, 'LCD server error '+d_res.status);

					// parse response
					const g_res = safe_json(sx_res) as BroadcastResult;

					// invalid json
					if(!g_res) return tx_err(sx_res);

					// destructure broadcast response
					const g_tx_res = (g_res as BroadcastResultOk).tx_response;

					// not success; restructure error
					if(!g_tx_res) return tx_err('Error '+(g_res as BroadcastResultErr).code+': '+(g_res as BroadcastResultErr).message);

					// continue
					fk_signed?.();
				},

				// connection was rejected
				r(s_reason: string) {
					notify('Error from Keplr/StarShell', [
						s_reason,
						...s_reason.includes('chain info')? [
							'You may need to enable this chain first',
						]: [],
					]);
				},

				// user does not have wallet installed
				n() {
					notify('Unable to proceed', [
						'It appears that you do not have a supported web extension wallet installed',
						create_html('a', {
							href: 'https://starshell.net/',
						}, [
							'Install the StarShell Wallet',
						]),
					]);
				},
			});
		}

		k_portal.post('o', {
			href: location.href,
			ref: K_WALLET.ref,
		});
	};

	const cta = async(si_label: string, a_msgs: MenuValueItem[], s_action: string, f_click: () => any) => {
		reset_menu();
		notify(si_label, [
			...a_msgs,
			create_html('button', {
				// "call to action" styling
				class: 'cta',
			}, [s_action]),
		]);

		await tick();

		qsa(dm_viewport, '.cta')[0].onclick = f_click;
	};

	const request_feegrant = (fk_done?: () => void) => init_portal((sa_webext, s_name_webext, atu8_pk33) => {
		void cta('Grant fee allowance', [
			`Allow this Neutrino account to pay its gas fees using your "${s_name_webext}" account`,
		], 'Grant Allowance', async() => {
			const xg_limit = 1_000_000n;  // 1 SCRT

			const atu8_allowance = anyBasicAllowance([[xg_limit, 'uscrt']]);

			const atu8_msg = msgGrantAllowance(sa_webext, SA_WALLET, atu8_allowance);

			const [atu8_auth, atu8_body, sg_account] = await create_tx(1, {
				lcd: K_WALLET.lcd,
				addr: sa_webext,
				pk33: atu8_pk33,
			}, [atu8_msg], [['5000', 'uscrt']], '40000');

			k_portal.post('s', [
				atu8_auth,
				atu8_body,
				sg_account,
			]);
		});
	}, fk_done);

	const authorize_writes = (fk_done?: () => void) => init_portal((sa_webext, s_name_webext, atu8_pk33) => {
		void cta('Authorize this account', [
			`Tell the smart contract that its OK for this account to execute a very limited set of actions on behalf of your "${s_name_webext}" account.`,
			'For security, this account will not be able to burn, transfer, or change privileges of the NFP whatsoever.',
		], 'Authorize', () => {
			notify('Not yet implemented', []);
		});
	}, fk_done);

	const check_authorized = () => {
		b_writable = true;

		void authorize_writes();
	};

	(async() => {
		await refresh_spendable_gas();

		if(xg_balance + xg_granted < 40_000n) {
			void request_feegrant(check_authorized);
		}
		else {
			check_authorized();
		}
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
	}

	.heading:first-child {
		border-top: 1px solid #333;
	}

	:where(.field) {
		margin: 8px 0 0 0;

		>:first-child {
			color: #777;
			font-size: 11px;
		}

		p {
			margin: 6px 0;
		}
	}
</style>

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
