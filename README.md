# Crypto Prediction Executor

Event-driven execution tooling for short-horizon crypto prediction markets. The project watches live price feeds and CLOB order books, then evaluates configured entry windows before submitting positions through a Safe-backed Polymarket account.

This version targets Polymarket CLOB V2 and uses the `@polymarket/clob-client-v2` SDK.

## What It Does

- Tracks active BTC, ETH, SOL, and XRP up/down markets.
- Derives the current market slug from the configured asset and period.
- Streams order book data from Polymarket's market WebSocket.
- Streams reference crypto prices from Polymarket RTDS.
- Applies TOML-defined delta, volatility, and timing rules.
- Places bull or bear entries through a proxy wallet using CLOB V2 signing.

## Requirements

- Node.js 20 or newer
- npm 9 or newer
- Polygon RPC endpoint
- Polymarket account with CLOB API access
- Proxy wallet funded with pUSD for CLOB V2 trading

API-only users should make sure their collateral is available as pUSD. Legacy USDC.e balances are not the active CLOB V2 collateral.

## Configuration

Create your local environment file:

```bash
cp .env.example .env
```

Set the wallet and RPC values:

```env
POLYMARKET_PRIVATE_KEY=YOUR_PRIVATE_KEY
PROXY_WALLET_ADDRESS=0x0000000000000000000000000000000000000000
RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/your-key
```

Tune market selection and entry rules in `trade.toml`:

```toml
[market]
market_coin = "btc"
market_period = "5"

[trade_1]
entry = [
  { min = 10, max = 500, entry_remaining_sec_down = 1, entry_remaining_sec_up = 2, amount = 5 },
  { min = 20, max = 500, entry_remaining_sec_down = 2, entry_remaining_sec_up = 3, amount = 5 },
]

[monitor]
proxy_wallet_address = "0x0000000000000000000000000000000000000000"
market_slug = "btc-updown-5m-1769634900"
```

## Running

Install dependencies:

```bash
npm install
```

Run in development mode:

```bash
npm run start:dev
```

Write runtime output to `output.log`:

```bash
npm run start:log
```

Build TypeScript:

```bash
npm run compile
```

Inspect wallet activity for the configured monitor market:

```bash
npm run inspect
```

## Execution Flow

1. Load `.env` and `trade.toml`.
2. Create or derive Polymarket CLOB API credentials.
3. Generate the active market slug for the configured cycle.
4. Resolve CLOB token IDs from Gamma market data.
5. Subscribe to order book and reference price streams.
6. Evaluate price delta, volatility bands, and remaining seconds.
7. Submit one bull or bear order when a configured entry rule matches.
8. Reset state and move to the next market cycle.

## CLOB V2 Notes

- The project uses `@polymarket/clob-client-v2`.
- Client construction uses the V2 options object with `chain`, `signer`, `creds`, `signatureType`, and `funderAddress`.
- Fees are handled by the protocol at match time.
- Orders are signed against the V2 exchange domain.
- Optional builder attribution can be added later with `POLY_BUILDER_CODE`.

## Risk Notice

This software can submit real orders. Test with small size, confirm wallet permissions, and verify pUSD balance before live trading. Prediction markets are volatile and the configured strategy can lose funds.

## License

MIT