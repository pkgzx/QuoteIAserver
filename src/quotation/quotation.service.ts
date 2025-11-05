import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

export interface QuotationData {
  requestId: string;
  userName: string;
  userEmail: string;
  item: string;
  quantity: number;
  estimatedPrice: number;
  productName: string;
  productId: string;
  productLink?: string;
  productPrice: number;
  productCurrency: string;
  priceUSD: number;
  productImage?: string;
  reviews?: {
    rating: number;
    total: number;
  };
  seller?: {
    nickname: string;
    reputation: any;
  };
  shipping?: {
    freeShipping: boolean;
  };
  createdAt: Date;
}

@Injectable()
export class QuotationService {
  private readonly logger = new Logger(QuotationService.name);
  private readonly uploadsDir: string;

  constructor() {
    this.uploadsDir = path.join(process.cwd(), 'uploads', 'quotations');
    this.ensureUploadDirectory();
  }

  private ensureUploadDirectory() {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
      this.logger.log(`Created uploads directory: ${this.uploadsDir}`);
    }
  }

  /**
   * Genera un PDF de cotización con los datos del producto
   */
  async generateQuotationPDF(data: QuotationData): Promise<string> {
    const fileName = `quotation-${data.requestId}-${Date.now()}.pdf`;
    const filePath = path.join(this.uploadsDir, fileName);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'LETTER',
          margins: { top: 50, bottom: 50, left: 50, right: 50 },
        });

        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // Header
        doc
          .fontSize(24)
          .fillColor('#2c3e50')
          .text('COTIZACIÓN DE COMPRA', { align: 'center' })
          .moveDown(0.5);

        doc
          .fontSize(10)
          .fillColor('#7f8c8d')
          .text(`ID de Solicitud: ${data.requestId}`, { align: 'center' })
          .text(`Fecha: ${data.createdAt.toLocaleDateString('es-ES')}`, {
            align: 'center',
          })
          .moveDown(2);

        // Información del solicitante
        doc
          .fontSize(14)
          .fillColor('#34495e')
          .text('SOLICITANTE', { underline: true })
          .moveDown(0.5);

        doc
          .fontSize(11)
          .fillColor('#2c3e50')
          .text(`Nombre: ${data.userName}`)
          .text(`Email: ${data.userEmail}`)
          .moveDown(1.5);

        // Información del producto solicitado
        doc
          .fontSize(14)
          .fillColor('#34495e')
          .text('PRODUCTO SOLICITADO', { underline: true })
          .moveDown(0.5);

        doc
          .fontSize(11)
          .fillColor('#2c3e50')
          .text(`Artículo: ${data.item}`)
          .text(`Cantidad: ${data.quantity} unidad(es)`)
          .text(`Precio estimado: $${data.estimatedPrice.toFixed(2)} USD`)
          .moveDown(1.5);

        // Separador
        doc
          .moveTo(50, doc.y)
          .lineTo(550, doc.y)
          .strokeColor('#3498db')
          .lineWidth(2)
          .stroke()
          .moveDown(1.5);

        // Producto seleccionado de Suconel
        doc
          .fontSize(16)
          .fillColor('#3498db')
          .text('PRODUCTO SELECCIONADO', { align: 'center' })
          .moveDown(1);

        doc
          .fontSize(12)
          .fillColor('#2c3e50')
          .font('Helvetica-Bold')
          .text(data.productName)
          .font('Helvetica')
          .moveDown(0.5);

        // Precio destacado
        const totalPriceCOP = data.productPrice * data.quantity;
        const totalPriceUSD = data.priceUSD * data.quantity;

        const priceBox = {
          x: 50,
          y: doc.y,
          width: 500,
          height: 80,
        };

        doc
          .rect(priceBox.x, priceBox.y, priceBox.width, priceBox.height)
          .fillAndStroke('#ecf0f1', '#3498db');

        doc
          .fontSize(12)
          .fillColor('#2c3e50')
          .text(
            `Precio unitario: ${data.productCurrency} ${data.productPrice.toFixed(2)} (≈ $${data.priceUSD.toFixed(2)} USD)`,
            priceBox.x + 20,
            priceBox.y + 15,
          );

        doc
          .fontSize(14)
          .fillColor('#2c3e50')
          .font('Helvetica-Bold')
          .text(
            `Cantidad: ${data.quantity} unidad(es)`,
            priceBox.x + 20,
            priceBox.y + 35,
          )
          .font('Helvetica');

        doc
          .fontSize(18)
          .fillColor('#27ae60')
          .font('Helvetica-Bold')
          .text(
            `TOTAL: ${data.productCurrency} ${totalPriceCOP.toFixed(2)} ≈ $${totalPriceUSD.toFixed(2)} USD`,
            priceBox.x + 20,
            priceBox.y + 55,
          )
          .font('Helvetica');

        doc.y = priceBox.y + priceBox.height + 20;

        // Detalles del producto
        doc.fontSize(11).fillColor('#2c3e50');

       
        


        doc
          .fillColor('#2c3e50')
          .moveDown(1)
          .text(`ID Suconel: ${data.productId}`)
          .moveDown(0.5);

        // Link del producto
        // doc
        //   .fontSize(10)
        //   .fillColor('#3498db')
        //   .text('Ver producto en MercadoLibre:', { continued: false })
        //   .fontSize(9)
        //   .fillColor('#2980b9')
        //   .text(data.productLink, {
        //     link: data.productLink,
        //     underline: true,
        //   });

        // Footer
        doc
          .moveDown(3)
          .fontSize(8)
          .fillColor('#95a5a6')
          .text(
            'Esta cotización fue generada automáticamente por QuoteIA',
            { align: 'center' },
          )
          .text(
            'Los precios están sujetos a cambios según la disponibilidad del vendedor',
            { align: 'center' },
          );
       
        doc.end();

        stream.on('finish', () => {
          this.logger.log(`✓ PDF generated successfully: ${fileName}`);
          resolve(fileName);
        });

        stream.on('error', (error) => {
          this.logger.error(`Failed to generate PDF: ${error.message}`);
          reject(error);
        });
      } catch (error) {
        this.logger.error(`Error creating PDF document: ${error.message}`);
        reject(error);
      }
    });
  }

  /**
   * Obtiene la ruta completa de un archivo de cotización
   */
  getQuotationFilePath(fileName: string): string {
    return path.join(this.uploadsDir, fileName);
  }

  /**
   * Verifica si un archivo de cotización existe
   */
  quotationExists(fileName: string): boolean {
    const filePath = this.getQuotationFilePath(fileName);
    return fs.existsSync(filePath);
  }

  /**
   * Elimina un archivo de cotización
   */
  deleteQuotation(fileName: string): void {
    const filePath = this.getQuotationFilePath(fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      this.logger.log(`Deleted quotation: ${fileName}`);
    }
  }
}
