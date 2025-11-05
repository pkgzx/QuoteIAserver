import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { QuotationService } from './quotation.service';
import { OrmService } from '../orm/orm.service';
import * as path from 'path';

@Controller('api/v1/quotations')
export class QuotationController {
  private readonly logger = new Logger(QuotationController.name);

  constructor(
    private readonly quotationService: QuotationService,
    private readonly orm: OrmService,
  ) {}

  /**
   * Endpoint para descargar una cotización en PDF
   * GET /api/v1/quotations/:requestId/download
   */
  @Get(':requestId/download')
  async downloadQuotation(
    @Param('requestId') requestId: string,
    @Res() res: Response,
  ) {
    try {
      this.logger.log(`Download request for quotation: ${requestId}`);

      // Buscar la solicitud en la base de datos
      const request = await this.orm.requestShopping.findUnique({
        where: { id: requestId },
        include: { requestedBy: true },
      });

      if (!request) {
        throw new NotFoundException(
          `Request with ID ${requestId} not found`,
        );
      }

      if (!request.quotationPdfPath) {
        throw new NotFoundException(
          `No quotation PDF found for request ${requestId}`,
        );
      }

      // Verificar que el archivo existe
      const filePath = this.quotationService.getQuotationFilePath(
        request.quotationPdfPath,
      );

      if (!this.quotationService.quotationExists(request.quotationPdfPath)) {
        this.logger.error(`PDF file not found: ${filePath}`);
        throw new NotFoundException('Quotation PDF file not found');
      }

      // Enviar el archivo PDF
      const fileName = `Cotizacion-${request.item.replace(/\s+/g, '-')}-${requestId.slice(0, 8)}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${fileName}"`,
      );

      this.logger.log(`Sending PDF: ${filePath}`);
      res.sendFile(filePath);
    } catch (error) {
      this.logger.error(`Error downloading quotation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Endpoint para obtener información de una cotización sin descargarla
   * GET /api/v1/quotations/:requestId
   */
  @Get(':requestId')
  async getQuotationInfo(@Param('requestId') requestId: string) {
    try {
      const request = await this.orm.requestShopping.findUnique({
        where: { id: requestId },
        include: { requestedBy: true },
      });

      if (!request) {
        throw new NotFoundException(
          `Request with ID ${requestId} not found`,
        );
      }

      return {
        requestId: request.id,
        item: request.item,
        status: request.status,
        hasPDF: !!request.quotationPdfPath,
        pdfUrl: request.quotationPdfPath
          ? `/api/v1/quotations/${request.id}/download`
          : null,
        meliProduct: request.meliProductId
          ? {
              id: request.meliProductId,
              name: request.meliProductName,
              link: request.meliProductLink,
              price: request.meliProductPrice,
              currency: request.meliProductCurrency,
              priceUSD: request.priceUSD,
            }
          : null,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
      };
    } catch (error) {
      this.logger.error(`Error getting quotation info: ${error.message}`);
      throw error;
    }
  }
}
