/**
 * Application-wide constants
 * Extracted from hardcoded values across services
 */

// Exchange Rates (should eventually be fetched from external API)
export const EXCHANGE_RATES = {
  COP_TO_USD: 4300, // 1 USD = 4,300 COP
  ARS_TO_USD: 0.001, // 1 ARS = 0.001 USD
  USD_TO_USD: 1.0,
} as const;

// HTTP Timeouts (in milliseconds)
export const HTTP_TIMEOUTS = {
  SUCONEL_API: 15000, // 15 seconds
  MELI_API: 10000, // 10 seconds
  DEFAULT: 10000, // 10 seconds
} as const;

// Message Queue Timeouts
export const QUEUE_TIMEOUTS = {
  MESSAGE_PROCESSING: 5 * 60 * 1000, // 5 minutes
} as const;

// RAG Service Configuration
export const RAG_CONFIG = {
  BATCH_DELAY_MS: 100, // Delay between batch processing
  DEFAULT_RESULTS_LIMIT: 5, // Default number of results to return
  SIMILARITY_THRESHOLD: 0.7, // Minimum similarity score
} as const;

// Suconel Product Scoring Weights
export const SUCONEL_SCORING_WEIGHTS = {
  STOCK: 30, // Maximum points for stock availability
  PRICE_COMPETITIVE: 25, // Points for competitive pricing
  PRICE_ECONOMY: 15, // Points for economy pricing
  PRICE_PREMIUM: 10, // Points for premium pricing
  DISCOUNT: 15, // Maximum points for discounts
  IMAGE: 10, // Points for having images
  DESCRIPTION: 10, // Points for having description
  CATEGORY: 5, // Points for category match
  SKU: 5, // Points for having SKU
} as const;

// MercadoLibre Product Scoring Weights
export const MELI_SCORING_WEIGHTS = {
  NEW_CONDITION: 15, // Points for new condition
  STOCK_AVAILABLE: 5, // Points for stock availability
  FREE_SHIPPING: 10, // Points for free shipping
  OFFICIAL_STORE: 15, // Points for official store
  HIGH_REPUTATION: 20, // Points for high seller reputation (green/yellow)
  MEDIUM_REPUTATION: 10, // Points for medium seller reputation
  PRICE_COMPETITIVE: 20, // Points for competitive pricing
  PRICE_ECONOMY: 10, // Points for economy pricing
} as const;

// Price Range Thresholds
export const PRICE_THRESHOLDS = {
  ECONOMY: 0.7, // 70% of max price
  COMPETITIVE_MIN: 0.7, // 70% of expected price
  COMPETITIVE_MAX: 1.3, // 130% of expected price
  PREMIUM: 1.3, // 130% of max price
} as const;

// PDF Configuration
export const PDF_CONFIG = {
  SIZE: 'LETTER' as const,
  MARGINS: { top: 50, bottom: 50, left: 50, right: 50 },
  COLORS: {
    PRIMARY: '#3498db',
    SECONDARY: '#2c3e50',
    SUCCESS: '#27ae60',
    MUTED: '#7f8c8d',
    BACKGROUND: '#ecf0f1',
    DARK: '#34495e',
  },
  FONT_SIZES: {
    TITLE: 24,
    SUBTITLE: 16,
    HEADING: 14,
    BODY: 11,
    SMALL: 10,
    TINY: 8,
  },
} as const;

// Authentication
export const AUTH_CONFIG = {
  OTP_LENGTH: 6,
  OTP_EXPIRY_MINUTES: 5,
  OTP_REUSE_WINDOW_SECONDS: 60, // Can reuse OTP within 60 seconds
} as const;

// Stream Configuration
export const STREAM_CONFIG = {
  TIMEOUT_MS: 30000, // 30 seconds timeout for SSE
} as const;
