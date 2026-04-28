import { ApiKeyCreds, ClobClient, Side } from "@polymarket/clob-client-v2";
import { Wallet } from "ethers";
import { POLYMARKET_PRIVATE_KEY, PROXY_WALLET_ADDRESS } from "../config";

// Network configuration
const CLOB_ENDPOINT = "https://clob.polymarket.com";
const POLYGON_CHAIN = 137;

// Wallet setup
export const HOST = CLOB_ENDPOINT;
export const CHAIN_ID = POLYGON_CHAIN;
export const SIGNER = new Wallet(POLYMARKET_PRIVATE_KEY);
export const FUNDER = PROXY_WALLET_ADDRESS;

// Signature mode: 0=EOA, 1=EIP-1271, 2=Safe
export const SIGNATURE_TYPE = 2;

/**
 * Creates authenticated CLOB client instance
 */
export function createClobClient(credentials?: ApiKeyCreds): ClobClient {
  return new ClobClient({
    host: CLOB_ENDPOINT,
    chain: POLYGON_CHAIN,
    signer: SIGNER,
    creds: credentials,
    signatureType: SIGNATURE_TYPE,
    funderAddress: FUNDER,
  });
}

/**
 * Fetches current bid/ask prices for token pair
 */
export async function getPrices(bullToken: string, bearToken: string) {
    const priceRequest = [
        { token_id: bullToken, side: "BUY" },
        { token_id: bullToken, side: "SELL" },
        { token_id: bearToken, side: "BUY" },
        { token_id: bearToken, side: "SELL" },
    ];

    const resp = await fetch(`${CLOB_ENDPOINT}/prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(priceRequest),
    });
    
    return resp.json();
}