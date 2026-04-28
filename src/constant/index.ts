// WebSocket channels
export const MARKET_CHANNEL = "market";
export const USER_CHANNEL = "user";

// Trading limits
export const MIN_ORDER_USD = 1.0;
export const minBuyUSD = MIN_ORDER_USD; // backward compat

// Polygon contract addresses
export const CTF_ADDRESS = "0x4d97dcd97ec945f40cf65f87097ace5ea0476045";
export const EXCHANGE_ADDRESS = "0xE111180000d2663C0091e4f400237545B87B996B";
export const NEG_RISK_EXCHANGE_ADDRESS = "0xe2222d279d744050d28e00520010520000310F59";

// Stablecoin addresses
export const LEGACY_USDC = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
export const USDCe_ADDRESS = LEGACY_USDC; // alias
export const PUSD_ADDRESS = "0x0000000000000000000000000000000000000000"; // pUSD collateral