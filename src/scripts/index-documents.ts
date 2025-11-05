import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import * as fs from 'fs/promises';
import * as path from 'path';


const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

async function indexDocument(filePath: string) {
  const content = await fs.readFile(filePath, 'utf-8');
  const fileName = path.basename(filePath);


  // Verificar si ya existe
  const existing = await prisma.document.findFirst({
    where: { filePath }
  });

  if (existing) {
    return;
  }

  // Crear documento
  const document = await prisma.document.create({
    data: {
      title: fileName,
      content,
      filePath,
      metadata: { indexed: new Date().toISOString() },
    },
  });


  // Dividir en chunks de 500 caracteres
  const CHUNK_SIZE = 500;
  const chunks: string[] = [];
  
  for (let i = 0; i < content.length; i += CHUNK_SIZE) {
    chunks.push(content.slice(i, i + CHUNK_SIZE));
  }


  // Procesar chunk por chunk (UNO A LA VEZ)
  for (let i = 0; i < chunks.length; i++) {
    
    try {
      // Generar embedding
      const response = await openai.embeddings.create({
        model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
        input: chunks[i],
      });

      const embedding = response.data[0].embedding;
      const embeddingStr = `[${embedding.join(',')}]`;

      // Insertar en BD
      await prisma.$executeRaw`
        INSERT INTO "DocumentChunk" (id, "documentId", content, embedding, "chunkIndex", "createdAt")
        VALUES (
          gen_random_uuid()::text,
          ${document.id},
          ${chunks[i]},
          ${embeddingStr}::vector,
          ${i},
          NOW()
        )
      `;

      
    } catch (error) {
      console.error(`   Error en chunk ${i + 1}:`, error.message);
      throw error;
    }
  }

}

async function main() {
  try {
    
    const dataPath = path.join(process.cwd(), 'data');
    const files = await fs.readdir(dataPath);
    const docs = files.filter((f) => f.endsWith('.md') || f.endsWith('.txt'));


    for (const file of docs) {
      await indexDocument(path.join(dataPath, file));
    }

    // Verificar
    const totalDocs = await prisma.document.count();
    const totalChunks = await prisma.documentChunk.count();

 

  } catch (error) {
    console.error('\n Error:', error);
    process.exit(1);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());