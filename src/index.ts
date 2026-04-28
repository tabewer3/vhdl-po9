import { ClobClient, Side } from "@polymarket/clob-client-v2";
import { WebSocket } from "ws";
import { generateMarketSlug } from "./config";
import type { Coin, MarketConfig, Minutes } from "./types";
import { CHAIN_ID, FUNDER, getMarket, getPrices, HOST, SIGNATURE_TYPE, SIGNER, createUserWebSocket, orderBook, createRTDSClient, setMarket, getPriceToBeat, createClobClient } from "./services";
import { getCurrentTime } from "./utils";
import { loadConfig } from "./config/toml";
import { Trade } from "./trade";
import { current_price, price_to_beat_global, set_purchased_token } from "./services/ws_rtds";
import { Volatility } from "./analysis";
import { redeem } from "./trade/inventory";
import { tui } from "./tui";

// Bootstrap configuration
loadConfig();

// Execution state
export let executor: Trade;
export let cycleStartTs: number;
export let cycleEndTs: number;
export let cycleDuration: number;

// Volatility tracker instance
export const volTracker = new Volatility();

// Market parameters from config
const execConfig: MarketConfig = {
  coin: globalThis.__CONFIG__.market.market_coin as Coin,
  minutes: parseInt(globalThis.__CONFIG__.market.market_period) as Minutes,
};

async function bootstrap() {
  console.log("[INIT] Wallet:", SIGNER.address);

  // Initialize CLOB connection
  const baseClient = createClobClient();
  const credentials = await baseClient.createOrDeriveApiKey();
  console.log("[INIT] API credentials obtained");

  // Main execution loop
  while (true) {
    const marketInfo = generateMarketSlug(execConfig.coin, execConfig.minutes);
    const { slug: marketSlug, startTimestamp, endTimestamp } = marketInfo;

    // Update cycle timing
    cycleStartTs = startTimestamp;
    cycleEndTs = endTimestamp;
    cycleDuration = endTimestamp - startTimestamp;

    console.log(tui.section("Cycle", [
      `Target: ${tui.highlight(marketSlug)}`,
      tui.dim(`Window: ${getCurrentTime()} -> ${endTimestamp}`),
    ]));

    const marketData = await getMarket(marketSlug);
    setMarket(marketData);

    // Extract token identifiers
    const tokenIds = JSON.parse(marketData.clobTokenIds);
    const bullTokenId = tokenIds[0];
    const bearTokenId = tokenIds[1];

    console.log(tui.dim("━".repeat(60)));

    // Create authenticated client for this cycle
    const authClient = createClobClient(credentials);

    executor = new Trade(bullTokenId, bearTokenId, authClient);
    set_purchased_token(false);

    // Establish WebSocket connections
    const orderbookWs = createUserWebSocket();
    let priceWs: ReturnType<typeof createRTDSClient>;

    await new Promise<void>((resolve, reject) => {
      const connTimeout = setTimeout(() => {
        reject(new Error("Connection timeout exceeded"));
      }, 10000);

      let obConnected = false;
      let priceConnected = false;

      const verifyConnections = () => {
        if (obConnected && priceConnected) {
          clearTimeout(connTimeout);
          resolve();
        }
      };

      orderbookWs.onopen = () => {
        obConnected = true;
        verifyConnections();
      };

      orderbookWs.onerror = (err) => {
        clearTimeout(connTimeout);
        reject(err);
      };

      priceWs = createRTDSClient(
        () => { priceConnected = true; verifyConnections(); },
        (err) => { clearTimeout(connTimeout); reject(err); }
      );
    });

    // Subscribe to market data
    orderbookWs.send(JSON.stringify({
      type: "market",
      assets_ids: [bullTokenId, bearTokenId]
    }));

    priceWs.subscribe({
      subscriptions: [
        { topic: "crypto_prices", type: "update", filters: "{\"symbol\":\"BTCUSDT\"}" },
        { topic: "crypto_prices_chainlink", type: "update", filters: "{\"symbol\":\"btc/usd\"}" },
      ],
    });

    console.log(tui.success(`Monitoring: ${bullTokenId.slice(0, 12)}... / ${bearTokenId.slice(0, 12)}...`));

    // Cycle monitoring loop
    while (true) {
      await new Promise(r => setTimeout(r, 1000));
      orderbookWs.send("PING");

      const timeRemaining = endTimestamp - getCurrentTime();
      if (price_to_beat_global !== 0 && timeRemaining <= 0) {
        const outcome = price_to_beat_global > current_price ? "BEAR" : "BULL";
        console.log(tui.outcomeBanner(`${outcome} OUTCOME`));
        volTracker.clearHistory();
        break;
      }
    }

    // Cleanup connections
    if (orderbookWs.readyState === WebSocket.OPEN || orderbookWs.readyState === WebSocket.CONNECTING) {
      console.log(tui.dim("[CLEANUP] Closing connections"));
      orderbookWs.close();
    }

    // Brief pause before next cycle
    await new Promise(r => setTimeout(r, 2000));
  }
}

// Entry point
bootstrap();