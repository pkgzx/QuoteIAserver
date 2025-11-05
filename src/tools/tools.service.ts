import { Injectable, Logger } from '@nestjs/common';
import { OrmService } from '../orm/orm.service';
import { RagService } from '../rag/rag.service';
import { SuconelService } from '../integrations/suconel/suconel.service';
import { QuotationService } from '../quotation/quotation.service';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);

  constructor(
    private readonly prisma: OrmService,
    private readonly rag: RagService,
    private readonly suconel: SuconelService,
    private readonly quotation: QuotationService,
  ) {}

  getToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'create_shopping_request',
        description: 'Creates a new shopping request in the database. Use when user wants to request purchase of items.',
        parameters: {
          type: 'object',
          properties: {
            item: { type: 'string', description: 'Item name to purchase' },
            quantity: { type: 'number', description: 'Quantity needed' },
            estimatedPrice: { type: 'number', description: 'Estimated price per unit' },
            justification: { type: 'string', description: 'Reason for purchase' },
          },
          required: ['item', 'quantity', 'estimatedPrice'],
        },
      },
      {
        name: 'search_knowledge_base',
        description: 'Busca en la base de conocimiento (políticas de compras, límites de presupuesto, procedimientos, FAQs). USA esta herramienta cuando el usuario pregunta sobre políticas, procesos, límites o cualquier información corporativa.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Consulta de búsqueda sobre políticas o procedimientos' },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_user_requests',
        description: 'Gets shopping requests history for the authenticated user.',
        parameters: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'],
              description: 'Filter by status (optional)'
            },
          },
          required: [],
        },
      },
    ];
  }

  async executeTool(
    toolName: string,
    args: any,
    userId?: number,
  ): Promise<{ result: any; trace: string }> {
    const trace = `Executing tool: ${toolName}\n📥 Arguments: ${JSON.stringify(args, null, 2)}`;
    console.log(trace);

    try {
      let result: any;

      switch (toolName) {
        case 'create_shopping_request':
          if (!userId) {
            throw new Error('Authentication required to create requests');
          }
          result = await this.createShoppingRequest(userId, args);
          break;

        case 'search_knowledge_base':
          result = await this.searchKnowledgeBase(args.query);
          break;

        case 'get_user_requests':
          if (!userId) {
            throw new Error('Authentication required to view requests');
          }
          result = await this.getUserRequests(userId, args.status);
          break;

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }

      const successTrace = `${trace}\n Result: ${JSON.stringify(result, null, 2)}`;
      console.log(successTrace);
      return { result, trace: successTrace };
    } catch (error) {
      const errorTrace = `${trace}\n Error: ${error.message}`;
      console.error(errorTrace);
      return { result: { error: error.message }, trace: errorTrace };
    }
  }

  private async createShoppingRequest(userId: number, args: any) {
    try {
      // 1. Crear la solicitud inicial
      this.logger.log(`Creating shopping request for user ${userId}: ${args.item}`);

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const request = await this.prisma.requestShopping.create({
        data: {
          item: args.item,
          quantity: args.quantity,
          estimatedPrice: args.estimatedPrice,
          justification: args.justification || null,
          requestedById: userId,
          status: 'PENDING',
        },
      });

      this.logger.log(`✓ Request created: ${request.id}`);

      // 2. Buscar productos en Suconel automáticamente
      this.logger.log(`🔍 Searching Suconel for: "${args.item}"`);

      const top5Products = await this.suconel.getTop5Products(args.item);

      if (top5Products.length === 0) {
        // Si no hay productos, devolver solo la solicitud creada
        return {
          success: true,
          requestId: request.id,
          message: `Solicitud creada, pero no se encontraron productos de componentes electrónicos para "${args.item}". Intenta con un término más específico.`,
          hasProducts: false,
        };
      }

      // Guardar resultados de búsqueda
      await this.prisma.requestShopping.update({
        where: { id: request.id },
        data: {
          meliSearchResults: top5Products.map(item => ({
            id: item.product.id,
            sku: item.product.sku,
            name: item.product.title,
            price: item.product.regular_price,
            currency: 'COP',
            score: item.score,
            reasons: item.reasons,
            link: `https://suconel.com/producto/${item.product.slug}`,
            stock: item.product.stock_quantity,
          })),
        },
      });

      // 3. Seleccionar el mejor producto automáticamente (el de mayor score)
      const bestProduct = top5Products[0]; // Ya están ordenados por score
      const product = bestProduct.product; // Ya tiene toda la información necesaria
      this.logger.log(`✓ Best product selected: ${product.title} (Score: ${bestProduct.score.toFixed(1)})`);

      this.logger.log(`Product details: ${product.title}, Price: ${product.regular_price} COP`);

      // 4. Verificar si el producto tiene precio
      if (!product.regular_price) {
        // Si NO tiene precio, solo guardamos el link y retornamos
        this.logger.warn(`Product ${product.id} has no price available. Returning link only.`);

        await this.prisma.requestShopping.update({
          where: { id: request.id },
          data: {
            meliProductId: product.id.toString(),
            meliProductName: product.title,
            meliProductLink: `https://suconel.com/producto/${product.slug}`,
          },
        });

        return {
          success: true,
          requestId: request.id,
          hasPrice: false,
          message: `He encontrado el producto "${product.title}" en Suconel, pero no hay información de precio disponible en este momento. Por favor visita el enlace para ver los detalles y precios actuales.`,
          product: {
            name: product.title,
            link: `https://suconel.com/producto/${product.slug}`,
            id: product.id,
          },
          note: 'No se generó cotización PDF porque el precio no está disponible en el catálogo.',
        };
      }

      // 5. Calcular precio en USD
      const priceUSD = this.suconel.convertCOPtoUSD(product.regular_price);

      // 6. Generar PDF de cotización
      this.logger.log(`📄 Generating quotation PDF...`);

      const pdfFileName = await this.quotation.generateQuotationPDF({
        requestId: request.id,
        userName: user.name,
        userEmail: user.email,
        item: request.item,
        quantity: request.quantity,
        estimatedPrice: request.estimatedPrice,
        productName: product.title,
        productId: product.id.toString(),
        productLink: `https://suconel.com/producto/${product.slug}`,
        productPrice: product.regular_price,
        productCurrency: 'COP',
        priceUSD: priceUSD,
        seller: undefined, // Suconel doesn't provide seller info
        shipping: undefined, // Suconel doesn't provide shipping info
        createdAt: request.createdAt,
      });

      // 7. Actualizar solicitud con toda la información
      await this.prisma.requestShopping.update({
        where: { id: request.id },
        data: {
          meliProductId: product.id.toString(),
          meliProductName: product.title,
          meliProductLink: `https://suconel.com/producto/${product.slug}`,
          meliProductPrice: product.regular_price,
          meliProductCurrency: 'COP',
          priceUSD: priceUSD,
          quotationPdfPath: pdfFileName,
        },
      });

      const downloadUrl = `/api/v1/quotations/${request.id}/download`;

      this.logger.log(`✅ Complete! Quotation ready for download.`);

      // 8. Retornar respuesta completa
      return {
        success: true,
        requestId: request.id,
        message: `¡Solicitud completada! He encontrado el mejor producto para ti en Suconel.`,
        product: {
          name: product.title,
          price: product.regular_price,
          currency: 'COP',
          priceUSD: priceUSD,
          link: `https://suconel.com/producto/${product.slug}`,
          score: bestProduct.score.toFixed(1),
          reasons: bestProduct.reasons,
        },
        quotation: {
          pdfDownloadUrl: downloadUrl,
          fullUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}${downloadUrl}`,
        },
        alternativeProducts: top5Products.slice(1, 3).map(p => ({
          name: p.product.title,
          id: p.product.id,
          score: p.score.toFixed(1),
        })),
      };

    } catch (error) {
      this.logger.error(`Error in automatic shopping request flow: ${error.message}`);
      // Si algo falla, al menos devolvemos que la solicitud se creó
      return {
        success: false,
        error: error.message,
        message: 'Se creó la solicitud pero hubo un error al buscar productos. Por favor intenta de nuevo.',
      };
    }
  }

  private async searchKnowledgeBase(query: string) {
    const results = await this.rag.search(query, 5);

    if (results.length === 0) {
      return {
        results: [],
        message: 'No se encontró información relevante.',
      };
    }

    return {
      results: results.map(r => ({
        content: r.content,
        source: r.document,
      })),
      message: `${results.length} resultados encontrados`,
    };
  }

  private async getUserRequests(userId: number, status?: string) {
    const requests = await this.prisma.requestShopping.findMany({
      where: {
        requestedById: userId,
        ...(status && { status: status as any }),
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      requests: requests.map(r => ({
        id: r.id,
        item: r.item,
        quantity: r.quantity,
        status: r.status,
        createdAt: r.createdAt,
      })),
      total: requests.length,
    };
  }

}