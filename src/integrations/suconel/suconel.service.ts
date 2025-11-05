import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { EnvironmentConfig } from '../../config/environment.config';
import {
  EXCHANGE_RATES,
  HTTP_TIMEOUTS,
  SUCONEL_SCORING_WEIGHTS,
  PRICE_THRESHOLDS,
} from '../../config/constants.config';

export interface SuconelProduct {
  id: number;
  title: string;
  slug: string;
  sku: string;
  product_type: string;
  regular_price: number;
  stock_status: string;
  stock_quantity: number;
  is_in_stock: boolean;
  thumbnail?: {
    url: string;
    width: number;
    height: number;
  };
  product_categories?: Array<{
    id: number;
    title: string;
    slug: string;
  }>;
  short_description?: any[];
  temporal_description?: string;
  discount_percentage?: number;
  weight?: number;
}

export interface ProductScore {
  product: SuconelProduct;
  score: number;
  reasons: string[];
}

@Injectable()
export class SuconelService {
  private readonly logger = new Logger(SuconelService.name);
  private readonly httpClient: AxiosInstance;

  constructor(private readonly config: EnvironmentConfig) {
    this.httpClient = axios.create({
      baseURL: this.config.suconelBaseUrl,
      timeout: HTTP_TIMEOUTS.SUCONEL_API,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  }

  /**
   * Busca productos en Suconel
   */
  async searchProducts(query: string, limit: number = 50): Promise<SuconelProduct[]> {
    try {
      this.logger.log(`Searching Suconel for: "${query}"`);

      const response = await this.httpClient.post(
        '/products/quick-search',
        { search: query },
        {
          headers: {
            'Authorization': this.config.suconelAuthToken,
          },
          params: {
            v: Date.now(), // Cache buster
          },
        },
      );

      const products = response.data || [];
      this.logger.log(`Found ${products.length} products in Suconel`);

      // Filtrar solo productos en stock
      const inStockProducts = products.filter((p: SuconelProduct) => p.is_in_stock);
      this.logger.log(`${inStockProducts.length} products are in stock`);

      return inStockProducts.slice(0, limit);
    } catch (error) {
      this.logger.error('Error searching Suconel:', error.message);
      if (error.response) {
        this.logger.error('Response status:', error.response.status);
        this.logger.error('Response data:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Convierte COP a USD usando tasa de cambio de configuración
   * Note: Exchange rates should eventually be fetched from external API
   */
  convertCOPtoUSD(amountCOP: number): number {
    return amountCOP / EXCHANGE_RATES.COP_TO_USD;
  }

  /**
   * Algoritmo de puntuación para productos de Suconel
   * Criterios:
   * - Stock disponible (mayor stock = mejor)
   * - Precio razonable (ni muy barato ni muy caro)
   * - Descuento disponible
   * - Tiene imagen
   * - Tiene descripción
   */
  scoreProducts(products: SuconelProduct[]): ProductScore[] {
    const scoredProducts: ProductScore[] = [];

    if (products.length === 0) {
      return scoredProducts;
    }

    // Calcular estadísticas para scoring relativo
    const prices = products.map(p => p.regular_price).filter(p => p > 0);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const stocks = products.map(p => p.stock_quantity).filter(s => s > 0);
    const maxStock = Math.max(...stocks, 1);

    for (const product of products) {
      let score = 0;
      const reasons: string[] = [];

      // 1. Stock disponible
      if (product.stock_quantity > 0) {
        const stockScore = Math.min(
          (product.stock_quantity / maxStock) * SUCONEL_SCORING_WEIGHTS.STOCK,
          SUCONEL_SCORING_WEIGHTS.STOCK
        );
        score += stockScore;
        reasons.push(`Stock: ${product.stock_quantity} unidades (+${stockScore.toFixed(1)} pts)`);
      }

      // 2. Precio razonable
      if (product.regular_price > 0 && avgPrice > 0) {
        const priceRatio = product.regular_price / avgPrice;
        let priceScore = 0;
        if (priceRatio >= PRICE_THRESHOLDS.COMPETITIVE_MIN && priceRatio <= PRICE_THRESHOLDS.COMPETITIVE_MAX) {
          priceScore = SUCONEL_SCORING_WEIGHTS.PRICE_COMPETITIVE;
          reasons.push(`Precio competitivo (+${priceScore} pts)`);
        } else if (priceRatio < PRICE_THRESHOLDS.ECONOMY) {
          priceScore = SUCONEL_SCORING_WEIGHTS.PRICE_ECONOMY;
          reasons.push(`Precio económico (+${priceScore} pts)`);
        } else if (priceRatio > PRICE_THRESHOLDS.PREMIUM) {
          priceScore = SUCONEL_SCORING_WEIGHTS.PRICE_PREMIUM;
          reasons.push(`Precio premium (+${priceScore} pts)`);
        }
        score += priceScore;
      }

      // 3. Descuento disponible
      if (product.discount_percentage && product.discount_percentage > 0) {
        const discountScore = Math.min(product.discount_percentage, SUCONEL_SCORING_WEIGHTS.DISCOUNT);
        score += discountScore;
        reasons.push(`${product.discount_percentage}% descuento (+${discountScore.toFixed(1)} pts)`);
      }

      // 4. Tiene imagen
      if (product.thumbnail?.url) {
        score += SUCONEL_SCORING_WEIGHTS.IMAGE;
        reasons.push(`Tiene imagen (+${SUCONEL_SCORING_WEIGHTS.IMAGE} pts)`);
      }

      // 5. Tiene descripción
      if (product.temporal_description || (product.short_description && product.short_description.length > 0)) {
        score += SUCONEL_SCORING_WEIGHTS.DESCRIPTION;
        reasons.push(`Tiene descripción (+${SUCONEL_SCORING_WEIGHTS.DESCRIPTION} pts)`);
      }

      // 6. Tiene categoría
      if (product.product_categories && product.product_categories.length > 0) {
        score += SUCONEL_SCORING_WEIGHTS.CATEGORY;
        reasons.push(`Categorizado (+${SUCONEL_SCORING_WEIGHTS.CATEGORY} pts)`);
      }

      // 7. Tiene SKU
      if (product.sku) {
        score += SUCONEL_SCORING_WEIGHTS.SKU;
        reasons.push(`Tiene SKU (+${SUCONEL_SCORING_WEIGHTS.SKU} pts)`);
      }

      scoredProducts.push({
        product,
        score,
        reasons,
      });
    }

    // Ordenar por puntuación descendente
    return scoredProducts.sort((a, b) => b.score - a.score);
  }

  /**
   * Obtiene los top 5 productos
   */
  async getTop5Products(query: string): Promise<ProductScore[]> {
    const products = await this.searchProducts(query, 50);

    if (products.length === 0) {
      this.logger.warn(`No products found for query: "${query}"`);
      return [];
    }

    const scoredProducts = this.scoreProducts(products);
    const top5 = scoredProducts.slice(0, 5);

    this.logger.log(`Top 5 products for "${query}":`);
    top5.forEach((item, index) => {
      this.logger.log(
        `${index + 1}. ${item.product.title} - Score: ${item.score.toFixed(1)} - $${item.product.regular_price} COP`,
      );
    });

    return top5;
  }

  /**
   * Formatea productos para el LLM
   */
  formatProductsForLLM(scoredProducts: ProductScore[]): string {
    return scoredProducts
      .map((item, index) => {
        const { product, score, reasons } = item;
        const priceUSD = this.convertCOPtoUSD(product.regular_price);

        return `
**Producto ${index + 1}** (Score: ${score.toFixed(1)}/100)
- **SKU**: ${product.sku}
- **Nombre**: ${product.title}
- **Precio**: $${product.regular_price.toLocaleString()} COP (≈ $${priceUSD.toFixed(2)} USD)
- **Stock**: ${product.stock_quantity} unidades disponibles
- **Descuento**: ${product.discount_percentage ? `${product.discount_percentage}%` : 'No'}
- **Categorías**: ${product.product_categories?.map(c => c.title).join(', ') || 'N/A'}
- **Link**: https://suconel.com/producto/${product.slug}
- **Razones de puntuación**: ${reasons.join(', ')}
`;
      })
      .join('\n---\n');
  }

  /**
   * Obtiene detalles de un producto específico por ID
   */
  async getProductDetails(productId: number): Promise<SuconelProduct | null> {
    try {
      // Primero buscamos por el ID haciendo una búsqueda general
      // (la API de Suconel no tiene endpoint directo por ID)
      const response = await this.httpClient.post(
        '/products/quick-search',
        { search: '' }, // Búsqueda vacía para obtener todos
        {
          headers: {
            'Authorization': this.config.suconelAuthToken,
          },
          params: {
            v: Date.now(),
          },
        },
      );

      const products: SuconelProduct[] = response.data || [];
      const product = products.find(p => p.id === productId);

      if (product) {
        this.logger.log(`Product details for ID ${productId}: ${product.title}`);
        return product;
      } else {
        this.logger.warn(`Product with ID ${productId} not found`);
        return null;
      }
    } catch (error) {
      this.logger.error(`Error getting product details for ID ${productId}:`, error.message);
      throw error;
    }
  }
}
