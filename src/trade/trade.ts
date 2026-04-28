import { ClobClient, OrderType, Side } from "@polymarket/clob-client-v2";
import { executor } from "..";
import { purchased_token_global, set_purchased_token } from "../services/ws_rtds";
import { tui } from "../tui";

/**
 * Trade execution handler for prediction market positions
 */
export class Trade {
    upTokenId: string;
    downTokenId: string;
    private client: ClobClient;

    constructor(bullToken: string, bearToken: string, clobClient: ClobClient) {
        this.upTokenId = bullToken;
        this.downTokenId = bearToken;
        this.client = clobClient;
    }

    /**
     * Evaluates market conditions and executes if criteria met
     */
    make_trading_decision = function (
        priceDelta: number,
        timeLeft: number,
        volBandLow: number,
        volBandHigh: number,
        bullAskPrice: number,
        bullBidPrice: number,
        bearAskPrice: number,
        bearBidPrice: number,
    ): void {
        // Skip if volatility bands cross zero or position already taken
        if (volBandLow * volBandHigh < 0 || purchased_token_global) return;

        const entryRules = globalThis.__CONFIG__.trade_1.entry;
        
        for (const rule of entryRules) {
            const timeInWindow = rule.entry_remaining_sec_down <= timeLeft && rule.entry_remaining_sec_up > timeLeft;
            const deltaInRange = Math.abs(priceDelta) >= rule.min && Math.abs(priceDelta) < rule.max;
            
            if (timeInWindow && deltaInRange) {
                if (priceDelta >= 0) {
                    executor.executeBullEntry(bullBidPrice, rule.amount);
                } else {
                    executor.executeBearEntry(bearBidPrice, rule.amount);
                }
                break;
            }
        }
    };

    /**
     * Execute long/bull position entry
     */
    executeBullEntry = async function (price: number, size: number): Promise<void> {
        if (purchased_token_global) return;
        
        try {
            const startTime = Date.now();
            set_purchased_token(true);

            const orderPayload = await this.client.createOrder({
                tokenID: this.upTokenId,
                price: price,
                side: Side.BUY,
                size: size,
            });

            console.log(tui.success(`[BULL] Order: ${JSON.stringify(orderPayload)}`));

            const result = await this.client.postOrder(orderPayload, OrderType.GTC);
            console.log(tui.success(`[BULL] Submitted: ${JSON.stringify(result)} (${Date.now() - startTime}ms)`));
        } catch (err) {
            console.error("[BULL] Execution failed:", err);
        }
    };

    /**
     * Execute short/bear position entry
     */
    executeBearEntry = async function (price: number, size: number): Promise<void> {
        if (purchased_token_global) return;
        
        try {
            const startTime = Date.now();
            set_purchased_token(true);

            const orderPayload = await this.client.createOrder({
                tokenID: this.downTokenId,
                price: price,
                side: Side.BUY,
                size: size,
            });

            console.log(tui.success(`[BEAR] Order: ${JSON.stringify(orderPayload)}`));

            const result = await this.client.postOrder(orderPayload, OrderType.GTC);
            console.log(tui.success(`[BEAR] Submitted: ${JSON.stringify(result)} (${Date.now() - startTime}ms)`));
        } catch (err) {
            console.error("[BEAR] Execution failed:", err);
        }
    };
}