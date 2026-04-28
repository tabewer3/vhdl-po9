import { RealTimeDataClient } from "@polymarket/real-time-data-client";
import { orderBook } from "./ws_clob";
import { cycleEndTs, cycleDuration, cycleStartTs, executor, volTracker } from "..";
import { getCurrentTimeMs } from "../utils";
import { tui } from "../tui";

// Price tracking state
export let price_to_beat_global: number = 0;
export let current_price: number = 0;

export const set_price_to_beat = (targetPrice: number) => {
    price_to_beat_global = targetPrice;
}

// Position state
export let purchased_token_global: boolean = false;

export const set_purchased_token = (hasPosition: boolean) => {
    purchased_token_global = hasPosition;
}

// Subscription management
let activeSubscriptions: Array<{ topic: string; type: string; filters: string }> = [];

export function setSubscriptions(subs: Array<{ topic: string; type: string; filters: string }>) {
    console.log(tui.dim("[WS] Configuring subscriptions: " + JSON.stringify(subs)));
    activeSubscriptions = subs;
}

export function createRTDSClient(
    onConnectCb?: () => void,
    onErrorCb?: (error: any) => void
): RealTimeDataClient {
    const wsClient = new RealTimeDataClient({
        host: "wss://ws-live-data.polymarket.com",
        onConnect: (c) => {
            if (activeSubscriptions.length > 0) {
                c.subscribe({ subscriptions: activeSubscriptions });
            }
            onConnectCb?.();
        },
        onMessage: (_c, msg) => {
            if (msg.payload["symbol"] !== "btc/usd") return;

            // Handle historical price data
            if (msg.payload["value"] === undefined) {
                const matchingPrice = msg.payload["data"].find(
                    (e: any) => e.timestamp === cycleStartTs || e.timestamp === cycleEndTs
                );
                if (matchingPrice) set_price_to_beat(matchingPrice["value"]);
                return;
            }

            // Process live price update
            current_price = msg.payload["value"];
            const secondsLeft = cycleEndTs - msg.payload["timestamp"] / 1000;
            const priceDelta = current_price - price_to_beat_global;

            // Check for cycle boundary
            const msgTs = msg.payload["timestamp"];
            if (msgTs === cycleEndTs * 1000 || msgTs === cycleStartTs * 1000) {
                set_price_to_beat(current_price);
            }

            // Get orderbook prices
            const bullAsk = orderBook[executor.upTokenId]?.asks.slice(-1)[0]?.price;
            const bullBid = orderBook[executor.upTokenId]?.bids.slice(-1)[0]?.price;
            const bearAsk = orderBook[executor.downTokenId]?.asks.slice(-1)[0]?.price;
            const bearBid = orderBook[executor.downTokenId]?.bids.slice(-1)[0]?.price;

            if (price_to_beat_global !== 0 && secondsLeft > 0) {
                volTracker.insertHistory(priceDelta, secondsLeft);

                const volData = volTracker.getVolatility(secondsLeft, priceDelta);
                const volLower = priceDelta - Math.abs(volData?.delta);
                const volUpper = priceDelta + Math.abs(volData?.delta);

                console.log(tui.tickLine({
                    priceToBeat: price_to_beat_global,
                    delta: priceDelta,
                    currentPrice: current_price,
                    vol1: volLower,
                    vol2: volUpper,
                    upAsk: bullAsk,
                    upBid: bullBid,
                    downAsk: bearAsk,
                    downBid: bearBid,
                    remainingSec: secondsLeft,
                    marketPeriod: cycleDuration,
                }));

                executor.make_trading_decision(
                    priceDelta, secondsLeft, volLower, volUpper,
                    bullAsk, bullBid, bearAsk, bearBid
                );
            }
        },
        onStatusChange: (status) => {
            const statusStr = String(status).toLowerCase();
            if (statusStr.includes("disconnect") || statusStr.includes("error")) {
                onErrorCb?.(new Error(`Price feed: ${status}`));
            }
        },
    });

    wsClient.connect();
    return wsClient;
}

// Standalone client instance
export const RTDS_CLIENT = createRTDSClient();
