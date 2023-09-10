<script lang="ts">
	import type {Arrayable, Dict, Uint128} from '@blake.regalia/belt';
	import type {Coin, StdSignDoc} from '@cosmjs/amino';
	import type {IconDefinition} from '@fortawesome/fontawesome-svg-core';
	import type {Key as KeplrKey} from '@keplr-wallet/types';
	import type {ComcClient, ComcHostMessages} from '@nfps.dev/runtime';
	import type {
		BroadcastResult, SecretBech32, BroadcastResultOk, BroadcastResultErr, TxResponse, SlimAuthInfo, SlimCoin, TypedAminoMsg,
	} from '@solar-republic/neutrino';
	
	import {
		oda,
		ode,
		buffer_to_hex,
		buffer_to_base64,
		sha256,
		uuid_v4,
		hex_to_buffer,
		buffer_to_text,
		buffer_to_json,
		base64_to_buffer,
		timeout,
		oderaf,
		defer,
	} from '@blake.regalia/belt';
	
	import {
		faCircleInfo,
		faHandHoldingDollar,
		faReceipt,
		faServer,
		faUser,
		faWallet,
	} from '@fortawesome/free-solid-svg-icons';
	import {create_html, create_svg, qsa} from '@nfps.dev/runtime';
	import {
		broadcast, create_tx_body, Protobuf, safe_json,
		anyBasicAllowance,
		msgGrantAllowance,
		encode_txraw,
		queryBankSpendableBalances,
		queryFeegrantAllowances,
		auth,
		bech32_decode,
		any,
		XC_SIGN_MODE_AMINO,
		decode_protobuf,
	} from '@solar-republic/neutrino';
	
	import G_PACKAGE_JSON_NEUTRINO from '@solar-republic/neutrino/package.json';

	import {
		K_CONTRACT,
	} from 'nfpx:bootloader';
	
	
	
	import {afterUpdate, beforeUpdate, tick} from 'svelte';
	
	import {WebextPortal} from './webext-portal';

	const {
		K_WALLET,
		SA_OWNER,
		A_COMCS,
		exec_contract,
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

	// store data associated with a comc request
	const h_zone: Dict<any> = {};

	// make a comc request, storing some arbitrary data to associated with the request
	function comc_request<
		si_cmd extends keyof ComcHostMessages,
	>(si_cmd: si_cmd, w_args: ComcHostMessages[si_cmd]['arg'], w_data?: any) {
		// new request id
		const si_req = uuid_v4();

		// store arbitrary request-associated data
		h_zone[si_req] = w_data;

		// request amino signature
		k_portal.post(si_cmd, w_args, si_req);
	}

	// unpack request data
	function unpack<
		w_data=any,
	>(si_req: string): w_data {
		// lookup data and cast
		const w_data = h_zone[si_req] as w_data;

		// delete entry
		delete h_zone[si_req];

		// return
		return w_data;
	}

	// request signature for an amino doc
	async function submit_amino(
		sa_webext: SecretBech32,
		atu8_pk33: Uint8Array,
		g_msg: TypedAminoMsg,
		atu8_msg: Uint8Array,
		sg_amount: Uint128,
		sg_limit: Uint128,
		w_data?: any
	) {
		// fetch auth info for signer
		const [sg_account, sg_sequence] = await auth({
			lcd: K_WALLET.lcd,
			addr: sa_webext,
		});

		// construct amino signdoc
		const g_doc: StdSignDoc = {
			chain_id: K_WALLET.ref,
			account_number: sg_account!,
			sequence: sg_sequence || '0',
			fee: {
				amount: [{
					amount: sg_amount,
					denom: 'uscrt',
				}],
				gas: sg_limit,
			},
			msgs: [g_msg],
			memo: '',
		};

		// request amino signature
		comc_request('amino', [g_doc, sa_webext], [
			sa_webext,
			atu8_pk33,
			atu8_msg,
			[sg_account, sg_sequence],
			w_data,
		]);
	}

	/**
	 * broadcast a tx to the network and update ui
	 */
	async function broadcast_tx(
		atu8_auth: Uint8Array,
		atu8_body: Uint8Array,
		atu8_signature: Uint8Array,
		w_data: any,
		fk_completed?: ((w_data: Dict<any>) => void) | undefined
	) {
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
		fk_completed?.({
			res: g_tx_res,
			hash: si_txn,
			data: w_data,
		});
	}

	let k_portal: ComcClient;
	let g_webext_account: KeplrKey;
	const init_portal = async(fk_ready: (
		sa_account: SecretBech32,
		s_name: string,
		atu8_pk33: Uint8Array
	) => any, fk_completed?: (h_data?: Dict<any>) => any) => {
		if(!k_portal) {
			k_portal = await WebextPortal({
				// user does not have wallet installed
				unavailable(s_ignore, si_req) {
					// discard
					unpack(si_req);

					notify('', [
						'It appears that you do not have a supported web extension wallet installed',
						create_html('a', {
							href: 'https://starshell.net/',
						}, [
							'Install the StarShell Wallet',
						]),
					]);
				},

				// connection was rejected
				rejected(s_reason, si_req) {
					// discard
					unpack(si_req);

					notify('Error from Keplr/StarShell', [
						s_reason,
						...s_reason.includes('chain info')? [
							'You may need to enable this chain first',
						]: [],
					]);
				},

				// error occurred
				error(s_reason, si_req) {
					// discard
					unpack(si_req);

					notify('Error from Keplr/StarShell', [
						s_reason,
						...s_reason.includes('chain info')? [
							'You may need to enable this chain first',
						]: [],
					]);
				},

				// connection was approved
				approved(g_account, si_req) {
					// discard
					unpack(si_req);

					const {
						name: s_name_webext,
						bech32Address: sa_webext,
						pubKey: atu8_pk33,
					} = g_account;

					fk_ready(sa_webext as SecretBech32, s_name_webext, atu8_pk33);
				},


				// contract execution was encrypted
				async $encrypt([atu8_exec], si_req) {
					// destructure data
					const [sa_webext, atu8_pk33, sg_amount, sg_limit] = unpack<[SecretBech32, Uint8Array, Uint128, Uint128]>(si_req);

					// prep execution message
					const g_msg: TypedAminoMsg = {
						type: 'wasm/MsgExecuteContract',
						value: {
							sender: sa_webext,
							contract: K_CONTRACT.addr,
							msg: buffer_to_base64(atu8_exec),
							sent_funds: [],
						},
					};

					// construct proto message
					const atu8_msg = any('/secret.compute.v1beta1.MsgExecuteContract', Protobuf()
						.v(10).b(bech32_decode(sa_webext))
						.v(18).b(bech32_decode(K_CONTRACT.addr))
						.v(26).b(atu8_exec)
						.o());

					// submit for amino
					await submit_amino(sa_webext, atu8_pk33, g_msg, atu8_msg, sg_amount, sg_limit, [
						atu8_exec.slice(0, 32),
					]);
				},

				// message was decrypted
				$decrypt([atu8_plaintext], si_req) {
					// unpack handler
					const fk_handle = unpack<(s_msg: string) => void>(si_req);

					// decode plaintext
					const s_plaintext = buffer_to_text(base64_to_buffer(buffer_to_text(atu8_plaintext)));

					// handle
					fk_handle?.(s_plaintext);
				},

				// amino document was signed
				async $amino([g_signed_doc, atu8_signature], si_req) {
					// destructure data
					const [sa_webext, atu8_pk33, atu8_msg, a_auth, w_data] = unpack<[SecretBech32, Uint8Array, Uint8Array, SlimAuthInfo, any]>(si_req);

					// create tx
					const [
						atu8_auth,
						atu8_body,
					] = await create_tx_body(XC_SIGN_MODE_AMINO, {
						lcd: K_WALLET.lcd,
						addr: sa_webext,
						pk33: atu8_pk33,
					}, [atu8_msg], g_signed_doc.fee.amount.map(g => [g.amount, g.denom] as SlimCoin), g_signed_doc.fee.gas as Uint128, a_auth);

					await broadcast_tx(atu8_auth, atu8_body, atu8_signature, w_data, fk_completed);
				},

				// proto document was signed (direct mode)
				async $direct([
					atu8_auth,
					atu8_body,
					atu8_signature,
				], si_req) {
					const [w_data] = unpack(si_req);

					await broadcast_tx(atu8_auth, atu8_body, atu8_signature, w_data, fk_completed);
				},

			}, A_COMCS);
		}

		// request to open a new connection
		comc_request('open', {
			href: location.href,
			ref: K_WALLET.ref,
		});
	};

	/**
	 * apply a "call-to-action" prompt
	 */
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

	const decrypt_response = async(h_results?: Dict<any> | undefined) => {
		if(h_results?.['res']) {
			// destructure
			const {
				res: g_tx_res,
				data: a_data,
			} = h_results as {
				res: TxResponse;
				data: [
					atu8_nonce: Uint8Array,
				];
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
				const [
					atu8_nonce,
				] = a_data;

				// defer async
				const [dp_defer, f_resolve] = defer();

				// request decrypt message from contract
				comc_request('decrypt', [atu8_contents, atu8_nonce], (s_msg: string) => {
					h_results['msg'] = s_msg;

					f_resolve(0);
				});

				// await for message to decrypt
				await dp_defer;
			}
		}

		return h_results;
	};

	const request_feegrant = (fk_done?: () => void) => init_portal((sa_webext, s_name_webext, atu8_pk33) => {
		void cta('Grant fee allowance', [
			`Allow this Neutrino account to pay its gas fees using your "${s_name_webext}" account`,
		], 'Grant Allowance', async() => {
			const xg_limit = 1_000_000n;  // 1 SCRT

			// prep amino equivalent
			const g_msg: TypedAminoMsg = {
				type: 'cosmos-sdk/MsgGrantAllowance',
				value: {
					granter: sa_webext,
					grantee: SA_WALLET,
					allowance: {
						type: 'cosmos-sdk/BasicAllowance',
						value: {
							spend_limit: [{
								amount: xg_limit+'',
								denom: 'uscrt',
							}],
						},
					},
				},
			};

			// create basic allowance message
			const atu8_allowance = anyBasicAllowance([[xg_limit, 'uscrt']]);

			// create grant message
			const atu8_msg = msgGrantAllowance(sa_webext, SA_WALLET, atu8_allowance);

			// carry out amino tx
			await submit_amino(sa_webext, atu8_pk33, g_msg, atu8_msg, '5000', `${50_000n}`);
		});
	}, fk_done);

	const authorize_writes = (fk_done?: () => void) => init_portal((sa_webext, s_name_webext, atu8_pk33) => {
		void cta('Authorize this account', [
			`Tells the smart contract its OK for this account to execute a certain set of actions on behalf of your "${s_name_webext}" account.`,
			'For security, this account will not be able to burn, transfer, or change privileges of the NFP whatsoever.',
		], 'Authorize', () => {
			// request encrypt message for contract
			comc_request('encrypt', [
				K_CONTRACT.hash,
				{
					approve_owner_delegate: {
						address: SA_WALLET,
					},
				},
			], [sa_webext, atu8_pk33, '5000', `${50_000n}`]);
		});
	}, async(h_results) => {
		await decrypt_response(h_results);
	
		// // prep base tx description list
		// const h_dl: Parameters<typeof create_description_list>[0] = {
		// 	'Transaction hash': g_tx_res.txhash,
		// 	// 'Block height': g_tx_res.height,
		// 	'Gas used/spent': `${g_tx_res.gas_used} / ${g_tx_res.gas_wanted}`,
		// };

		// h_dl['Contract response'] = create_html('code', {
		// 	style: 'text-wrap: nowrap;',
		// }, [
		// 	s_msg,
		// ]);

			// // update ui
			// void cta('✅ Tx Succeeded', [
			// 	create_description_list(h_dl),
			// ], 'Close', () => {
			// 	reset_menu();
			// 	b_collapsed = true;
			// });

		fk_done?.();
	});

	// ensure the hot account is authorized as a delegate
	const check_authorized = () => {
		b_writable = true;

		void authorize_writes(() => {
			reset_menu();
			b_collapsed = true;
		});
	};

	// init
	(async() => {
		await refresh_spendable_gas();

		if(xg_balance + xg_granted < 40_000n) {
			void request_feegrant(() => {
				reset_menu();
				check_authorized();
			});
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

	.dt-dd {
		.field-data-row();
	}

	:global(dt) {
		.field();
	}

	:global(dd) {
		.data();
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
