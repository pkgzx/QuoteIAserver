import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios, { AxiosInstance } from 'axios';

export interface MeliProduct {
  id: string;
  name: string;
  title?: string;
  price?: number;
  currency_id?: string;
  thumbnail?: string;
  permalink?: string;
  seller?: {
    id: number;
    nickname?: string;
    reputation?: any;
  };
  attributes?: Array<{
    id: string;
    name: string;
    value_name: string;
  }>;
  reviews?: {
    rating_average?: number;
    total?: number;
  };
  available_quantity?: number;
  condition?: string;
  shipping?: {
    free_shipping?: boolean;
  };
  buy_box_winner?: {
    item_id: string;
    price: number;
    currency_id: string;
    condition: string;
    available_quantity?: number;
    shipping?: {
      free_shipping?: boolean;
    };
    seller?: {
      id: number;
      nickname?: string;
    };
  };
}

export interface MeliSearchResponse {
  results: MeliProduct[];
  paging: {
    total: number;
    offset: number;
    limit: number;
  };
}

export interface ProductScore {
  product: MeliProduct;
  score: number;
  reasons: string[];
}

@Injectable()
export class MercadolibreService implements OnModuleInit {
  private readonly logger = new Logger(MercadolibreService.name);
  private accessToken: string;
  private refreshToken: string;
  private tokenExpiresAt: Date;
  private readonly httpClient: AxiosInstance;
  private readonly baseUrl = 'https://api.mercadolibre.com';

  constructor() {
    this.accessToken = process.env.MELI_ACCESS_TOKEN || '';
    this.refreshToken = process.env.MELI_REFRESH_TOKEN || '';

    // El token dura 6 horas, lo inicializamos con la fecha actual
    this.tokenExpiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'User-Agent': 'QuoteIA/1.0',
        'Accept': 'application/json',
      },
    });
  }

  async onModuleInit() {
    this.logger.log('MercadoLibre Service initialized');
    this.logger.log(`Token expires at: ${this.tokenExpiresAt.toISOString()}`);
  }

  /**
   * Cron job que refresca el token cada 5 horas y 55 minutos
   * (5 minutos antes de que expire el token de 6 horas)
   */
  @Cron('0 55 */4 * * *', {
    name: 'refresh-meli-token',
  })
  async refreshAccessToken(): Promise<void> {
    try {
      this.logger.log('Refreshing MercadoLibre access token...');

      const clientId = process.env.MELI_CLIENT_ID || '';
      const clientSecret = process.env.MELI_CLIENT_SECRET || '';

      const response = await axios.post(
        `${this.baseUrl}/oauth/token`,
        new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: this.refreshToken,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      this.tokenExpiresAt = new Date(
        Date.now() + response.data.expires_in * 1000,
      );

      this.logger.log('✓ Access token refreshed successfully');
      this.logger.log(`New token expires at: ${this.tokenExpiresAt.toISOString()}`);
      this.logger.log('⚠️  IMPORTANT: Update your .env file with new tokens:');
      this.logger.log(`MELI_ACCESS_TOKEN=${this.accessToken}`);
      this.logger.log(`MELI_REFRESH_TOKEN=${this.refreshToken}`);
    } catch (error) {
      this.logger.error('Failed to refresh access token:', error.message);
      if (error.response) {
        this.logger.error('Response data:', error.response.data);
      }
    }
  }

  /**
   * Busca productos en MercadoLibre Argentina y opcionalmente Colombia
   * Devuelve precios en USD cuando sea posible
   */
  async searchProducts(
    query: string,
    siteId: 'MLA' | 'MCO' = 'MLA', // MLA = Argentina, MCO = Colombia
    limit: number = 50,
  ): Promise<MeliProduct[]> {
    try {
      this.logger.log(`Searching items: "${query}" in site ${siteId}`);

      // Usar /sites/MLA/search para obtener ITEMS con precios
      // Aunque sea "público", MercadoLibre parece requerir token válido
      const response = await this.httpClient.get(
        `/sites/${siteId}/search`,
        {
          params: {
            q: query,
            limit: Math.min(limit, 50), // Max 50 por request
          },
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        },
      );

      this.logger.log(`Found ${response.data.results?.length || 0} items with prices`);

      // Enriquecer productos con información adicional
      const enrichedProducts = await Promise.all(
        response.data.results.map((product) => this.enrichProduct(product)),
      );

      return enrichedProducts;
    } catch (error) {
      this.logger.error('Error searching products:', error.message);
      if (error.response) {
        this.logger.error('Response status:', error.response.status);
        this.logger.error('Response data:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Enriquece un item con información adicional (reviews, etc)
   * Los items del search ya vienen con precio, solo necesitamos enriquecer con reviews
   */
  private async enrichProduct(product: MeliProduct): Promise<MeliProduct> {
    try {
      // Los items del /sites/MLA/search ya vienen con toda la info básica
      // Solo obtenemos reviews si es necesario
      let reviews: any = null;

      // Intentar obtener reviews solo si el item tiene suficiente info
      if (product.id && product.price) {
        try {
          const reviewsResponse = await this.httpClient.get(
            `/reviews/item/${product.id}`,
            {
              headers: {
                Authorization: `Bearer ${this.accessToken}`,
              },
            },
          );
          reviews = {
            rating_average: reviewsResponse.data.rating_average || 0,
            total: reviewsResponse.data.reviews_total || 0,
          };
        } catch (error) {
          // Reviews pueden no estar disponibles
          this.logger.debug(`No reviews for item ${product.id}`);
        }
      }

      return {
        ...product,
        title: product.title || product.name,
        reviews: reviews,
      };
    } catch (error) {
      this.logger.warn(`Could not enrich item ${product.id}:`, error.message);
      return product;
    }
  }

  /**
   * Convierte un precio de ARS o COP a USD usando tasas aproximadas
   * En producción, deberías usar una API de tasas de cambio en tiempo real
   */
  async convertToUSD(amount: number, currencyId: string): Promise<number> {
    const exchangeRates: Record<string, number> = {
      ARS: 0.0010, // 1 ARS ≈ 0.001 USD (aproximado, actualizar según tasa real)
      COP: 0.00025, // 1 COP ≈ 0.00025 USD (aproximado)
      USD: 1.0,
    };

    const rate = exchangeRates[currencyId] || 1.0;
    return amount * rate;
  }

  /**
   * Algoritmo de puntuación para seleccionar los mejores productos
   * Criterios:
   * - Reviews positivas (rating alto)
   * - Cantidad de reviews (confiabilidad)
   * - Reputación del vendedor
   * - Precio razonable (no el más barato ni el más caro)
   * - Disponibilidad
   * - Envío gratis
   */
  async scoreProducts(products: MeliProduct[]): Promise<ProductScore[]> {
    const scoredProducts: ProductScore[] = [];

    // Calcular precios en USD para comparación
    const pricesUSD = await Promise.all(
      products.map((p) =>
        p.price && p.currency_id
          ? this.convertToUSD(p.price, p.currency_id)
          : Promise.resolve(0),
      ),
    );

    const avgPrice = pricesUSD.reduce((a, b) => a + b, 0) / pricesUSD.length;

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      let score = 0;
      const reasons: string[] = [];

      // 1. Rating de reviews (max 40 puntos)
      if (product.reviews?.rating_average) {
        const ratingScore = (product.reviews.rating_average / 5) * 40;
        score += ratingScore;
        reasons.push(
          `Rating: ${product.reviews.rating_average.toFixed(1)}/5 (+${ratingScore.toFixed(1)} pts)`,
        );
      }

      // 2. Cantidad de reviews (max 20 puntos)
      if (product.reviews?.total && product.reviews.total > 0) {
        const reviewCountScore = Math.min(
          (product.reviews.total / 100) * 20,
          20,
        );
        score += reviewCountScore;
        reasons.push(
          `${product.reviews.total} reviews (+${reviewCountScore.toFixed(1)} pts)`,
        );
      }

      // 3. Reputación del vendedor (max 15 puntos)
      if (product.seller?.reputation) {
        const sellerScore = 15; // Simplificado, puedes analizar más detalles
        score += sellerScore;
        reasons.push(`Vendedor verificado (+${sellerScore} pts)`);
      }

      // 4. Precio razonable - penalizar extremos (max 15 puntos)
      if (product.price && pricesUSD[i] > 0) {
        const priceRatio = pricesUSD[i] / avgPrice;
        let priceScore = 0;
        if (priceRatio >= 0.7 && priceRatio <= 1.3) {
          priceScore = 15; // Precio cerca del promedio
          reasons.push(`Precio competitivo (+${priceScore} pts)`);
        } else if (priceRatio < 0.5) {
          priceScore = 5; // Muy barato, posible baja calidad
          reasons.push(`Precio muy bajo (+${priceScore} pts)`);
        } else if (priceRatio > 2) {
          priceScore = 5; // Muy caro
          reasons.push(`Precio alto (+${priceScore} pts)`);
        } else {
          priceScore = 10;
          reasons.push(`Precio aceptable (+${priceScore} pts)`);
        }
        score += priceScore;
      }

      // 5. Disponibilidad (max 5 puntos)
      if (product.available_quantity && product.available_quantity > 0) {
        score += 5;
        reasons.push(`${product.available_quantity} disponibles (+5 pts)`);
      }

      // 6. Envío gratis (max 5 puntos)
      if (product.shipping?.free_shipping) {
        score += 5;
        reasons.push('Envío gratis (+5 pts)');
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
   * Selecciona los 5 mejores productos basado en el algoritmo de puntuación
   */
  async getTop5Products(query: string, siteId: 'MLA' | 'MCO' = 'MLA'): Promise<ProductScore[]> {
    const products = await this.searchProducts(query, siteId);

    if (products.length === 0) {
      this.logger.warn(`No products found for query: "${query}"`);
      return [];
    }

    const scoredProducts = await this.scoreProducts(products);
    const top5 = scoredProducts.slice(0, 5);

    this.logger.log(`Top 5 products for "${query}":`);
    top5.forEach((item, index) => {
      this.logger.log(
        `${index + 1}. ${item.product.name} - Score: ${item.score.toFixed(1)} - $${item.product.price} ${item.product.currency_id}`,
      );
    });

    return top5;
  }

  /**
   * Formatea los productos para que el LLM pueda procesarlos
   */
  formatProductsForLLM(scoredProducts: ProductScore[]): string {
    return scoredProducts
      .map((item, index) => {
        const { product, score, reasons } = item;
        return `
**Producto ${index + 1}** (Score: ${score.toFixed(1)}/100)
- **ID**: ${product.id}
- **Nombre**: ${product.name}
- **Precio**: ${product.price} ${product.currency_id}
- **Condición**: ${product.condition}
- **Stock**: ${product.available_quantity} unidades
- **Envío gratis**: ${product.shipping?.free_shipping ? 'Sí' : 'No'}
- **Rating**: ${product.reviews?.rating_average || 'N/A'}/5 (${product.reviews?.total || 0} reviews)
- **Vendedor**: ${product.seller?.nickname || 'N/A'}
- **Link**: ${product.permalink}
- **Razones de puntuación**: ${reasons.join(', ')}
`;
      })
      .join('\n---\n');
  }

  /**
   * Obtiene información detallada de un item específico
   */
  async getProductDetails(productId: string): Promise<any> {
    try {
      // Usar /items para obtener detalles completos del item
      const response = await this.httpClient.get(`/items/${productId}`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      const detail = response.data;

      this.logger.log(`Item details for ${productId}: ${detail.title}, Price: ${detail.price} ${detail.currency_id}`);

      return {
        ...detail,
        title: detail.title,
        name: detail.title, // Para compatibilidad
      };
    } catch (error) {
      this.logger.error(`Error getting item details for ${productId}:`, error.message);
      if (error.response) {
        this.logger.error('Response status:', error.response.status);
        this.logger.error('Response data:', JSON.stringify(error.response.data));
      }
      throw error;
    }
  }
}
