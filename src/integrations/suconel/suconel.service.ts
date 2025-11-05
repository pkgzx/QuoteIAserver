import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

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
  private readonly baseUrl = process.env.SUCONEL_BASE_URL;
  private readonly authToken: string;

  constructor() {
    this.authToken = process.env.SUCONEL_AUTH_TOKEN || '';

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 15000,
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
            'Authorization': this.authToken,
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
   * Convierte COP a USD usando tasa de cambio aproximada
   * Tasa actual: 1 USD ≈ 4,300 COP (actualizar según tasa real)
   */
  convertCOPtoUSD(amountCOP: number): number {
    const exchangeRate = 4300; // 1 USD = 4,300 COP (aproximado)
    return amountCOP / exchangeRate;
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

      // 1. Stock disponible (max 30 puntos)
      if (product.stock_quantity > 0) {
        const stockScore = Math.min((product.stock_quantity / maxStock) * 30, 30);
        score += stockScore;
        reasons.push(`Stock: ${product.stock_quantity} unidades (+${stockScore.toFixed(1)} pts)`);
      }

      // 2. Precio razonable (max 25 puntos)
      if (product.regular_price > 0 && avgPrice > 0) {
        const priceRatio = product.regular_price / avgPrice;
        let priceScore = 0;
        if (priceRatio >= 0.7 && priceRatio <= 1.3) {
          priceScore = 25; // Precio cerca del promedio
          reasons.push(`Precio competitivo (+${priceScore} pts)`);
        } else if (priceRatio < 0.7) {
          priceScore = 15; // Precio bajo
          reasons.push(`Precio económico (+${priceScore} pts)`);
        } else if (priceRatio > 1.3) {
          priceScore = 10; // Precio alto
          reasons.push(`Precio premium (+${priceScore} pts)`);
        }
        score += priceScore;
      }

      // 3. Descuento disponible (max 15 puntos)
      if (product.discount_percentage && product.discount_percentage > 0) {
        const discountScore = Math.min(product.discount_percentage, 15);
        score += discountScore;
        reasons.push(`${product.discount_percentage}% descuento (+${discountScore.toFixed(1)} pts)`);
      }

      // 4. Tiene imagen (10 puntos)
      if (product.thumbnail?.url) {
        score += 10;
        reasons.push('Tiene imagen (+10 pts)');
      }

      // 5. Tiene descripción (10 puntos)
      if (product.temporal_description || (product.short_description && product.short_description.length > 0)) {
        score += 10;
        reasons.push('Tiene descripción (+10 pts)');
      }

      // 6. Tiene categoría (5 puntos)
      if (product.product_categories && product.product_categories.length > 0) {
        score += 5;
        reasons.push('Categorizado (+5 pts)');
      }

      // 7. Tiene SKU (5 puntos)
      if (product.sku) {
        score += 5;
        reasons.push('Tiene SKU (+5 pts)');
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
            'Authorization': this.authToken,
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
