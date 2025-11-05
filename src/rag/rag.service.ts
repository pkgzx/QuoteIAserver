import { Injectable, OnModuleInit } from '@nestjs/common';
import { OrmService } from '../orm/orm.service';
import OpenAI from 'openai';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class RagService implements OnModuleInit {
  private openai: OpenAI;
  private readonly dataPath = path.join(process.cwd(), 'data');
  private readonly CHUNK_SIZE = 800; // Reducido de 1000
  private readonly CHUNK_OVERLAP = 100; // Reducido de 200

  constructor(private readonly prisma: OrmService) {
    this.openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    });
  }

  async onModuleInit() {
    // Solo indexar si NO hay documentos
    const existingDocs = await this.prisma.document.count();
    if (existingDocs === 0) {
      await this.indexDocuments();
    } 
  }

  private async indexDocuments() {
    try {
      const files = await fs.readdir(this.dataPath);
      const markdownFiles = files.filter(f => f.endsWith('.md') || f.endsWith('.txt'));


      for (const file of markdownFiles) {
        const filePath = path.join(this.dataPath, file);
        const existingDoc = await this.prisma.document.findFirst({
          where: { filePath }
        });

        if (!existingDoc) {
          await this.indexDocument(filePath);
        }
      }
      
    } catch (error) {
      console.error(' Error en indexación RAG:', error.message);
    }
  }

  private async indexDocument(filePath: string) {
    const content = await fs.readFile(filePath, 'utf-8');
    const fileName = path.basename(filePath);
    
    // Create document
    const document = await this.prisma.document.create({
      data: {
        title: fileName,
        content,
        filePath,
        metadata: { indexed: new Date().toISOString() }
      }
    });

    // Split into chunks
    const chunks = this.splitIntoChunks(content);

    // BATCH_SIZE reducido para evitar memory overflow
    const BATCH_SIZE = 20; // Reducido de 50 a 20

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);
      
      
      try {
        // Generar embeddings para el lote
        const response = await this.openai.embeddings.create({
          model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
          input: batch,
        });

        // Preparar y ejecutar inserts en paralelo (más rápido)
        const insertPromises = batch.map(async (chunk, j) => {
          const chunkIndex = i + j;
          const embedding = response.data[j].embedding;
          const embeddingStr = `[${embedding.join(',')}]`;
          
          return this.prisma.$executeRaw`
            INSERT INTO "DocumentChunk" (id, "documentId", content, embedding, "chunkIndex", "createdAt")
            VALUES (
              gen_random_uuid()::text,
              ${document.id},
              ${chunk},
              ${embeddingStr}::vector,
              ${chunkIndex},
              NOW()
            )
          `;
        });

        await Promise.all(insertPromises);
        
        // Liberar memoria
        if (global.gc) {
          global.gc();
        }
        
      } catch (error) {
        console.error(`   Error en lote ${batchNum}:`, error.message);
        
        // Si falla el batch, intentar uno por uno
        for (let j = 0; j < batch.length; j++) {
          try {
            const chunkIndex = i + j;
            const embedding = await this.generateEmbedding(batch[j]);
            
            await this.prisma.$executeRaw`
              INSERT INTO "DocumentChunk" (id, "documentId", content, embedding, "chunkIndex", "createdAt")
              VALUES (
                gen_random_uuid()::text,
                ${document.id},
                ${batch[j]},
                ${embedding}::vector,
                ${chunkIndex},
                NOW()
              )
            `;
          } catch (chunkError) {
            console.error(`   Error en chunk ${i + j}:`, chunkError.message);
          }
        }
      }
      
      // Pequeña pausa entre batches para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
  }

  private splitIntoChunks(text: string): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + this.CHUNK_SIZE, text.length);
      chunks.push(text.slice(start, end));
      start = end - this.CHUNK_OVERLAP;
      
      // Evitar chunks infinitos
      if (start >= end) break;
    }

    return chunks;
  }

  private async generateEmbedding(text: string): Promise<string> {
    const response = await this.openai.embeddings.create({
      model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
      input: text,
    });
    return `[${response.data[0].embedding.join(',')}]`;
  }

  async search(query: string, limit: number = 5): Promise<Array<{ content: string; document: string }>> {
    const queryEmbedding = await this.generateEmbedding(query);

    const results = await this.prisma.$queryRaw<Array<{
      content: string;
      title: string;
      distance: number;
    }>>`
      SELECT 
        dc.content,
        d.title,
        (dc.embedding <=> ${queryEmbedding}::vector) as distance
      FROM "DocumentChunk" dc
      JOIN "Document" d ON d.id = dc."documentId"
      ORDER BY distance ASC
      LIMIT ${limit}
    `;

    return results.map(r => ({
      content: r.content,
      document: r.title
    }));
  }
}