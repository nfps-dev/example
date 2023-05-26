<script lang="ts">
	import type {Coin} from '@cosmjs/amino';
	
	import type app from 'nfpx:app';
	
	import {queryBankSpendableBalances, queryFeegrantAllowances, type SecretBech32} from '@solar-republic/neutrino';

	import SX_ICON_WALLET from '../media/wallet.svg?raw';

	const {
		K_WALLET,
		SA_OWNER,
	} = destructureImportedNfpModule<app>('app');  // eslint-disable-line no-undef

	const sa_wallet = K_WALLET.addr;

	let s_spendable = '0';

	let a_feegrants: [
		sa_granter: SecretBech32,
		s_amount: string,
	][] = [];

	let xg_balance = 0n;
	let xg_granted = 0n;

	const accumulate_uscrt = (a_coins: Coin[]) => a_coins
		.reduce((xg_out, g_coin) => 'uscrt' === g_coin.denom? xg_out + BigInt(g_coin.amount): 0n, 0n);

	const uscrt_to_string = (xg_amount: bigint): string => {
		const s_amount = (xg_amount+'').padStart(6, '0');
		return s_amount.slice(0, -6)+'.'+s_amount.slice(-6, -3);
	};

	async function refresh_spendable_gas() {
		a_feegrants = [];

		await Promise.all([
			queryBankSpendableBalances(K_WALLET.lcd, sa_wallet).then(a_coins => xg_balance += accumulate_uscrt(a_coins)),

			queryFeegrantAllowances(K_WALLET.lcd, sa_wallet).then((a_results) => {
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
	
	void refresh_spendable_gas();
</script>

<style lang="less">
	#wallet {
		background: #112;
		border-radius: 4px;
		padding: 1em 2em;

		position: absolute;
		top: 2em;
		right: 2em;	
	}

	#wallet>:first-child {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.bal {
		font-size: 18px;
	}

	.fields {
		>div {
			margin: 6px 0 0 0;

			>:first-child {
				color: #777;
				font-size: 11px;
			}

			>:last-child {

			}
		}
	}
</style>

<div id="wallet">
	<div>
		<span>
			{@html SX_ICON_WALLET}
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
	<div class="fields">
		<div>
			<div>
				Address of this burner account wallet
			</div>
			<div>
				{K_WALLET.addr}
			</div>
		</div>
		<div>
			<div>
				Feegrants currently available
			</div>
			<div>
				{#each a_feegrants as g_grant}
					<div>
						
					</div>
				{/each}
			</div>
		</div>
		<div>
			<div>
				Address of the NFP token owner
			</div>
			<div>
				{SA_OWNER}
			</div>
		</div>
		<div>
			<div>
				URL of the network API endpoint
			</div>
			<div>
				{K_WALLET.lcd}
			</div>
		</div>
	</div>
</div>
