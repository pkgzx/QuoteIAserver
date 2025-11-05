# QuoteIA - Backend Server

Backend API para el sistema QuoteIA de automatización de solicitudes de compra, construido con NestJS y potenciado por IA.

## Descripción

API RESTful que implementa un agente de IA conversacional para automatizar el proceso de solicitudes de compra en empresas. Integra autenticación por OTP, RAG (Retrieval Augmented Generation) para consulta de políticas, búsqueda de productos en marketplace, y persistencia en PostgreSQL.

## Características Principales

### Agente de IA Conversacional
- **OpenAI GPT-4o-mini**: Modelo de lenguaje para conversación y razonamiento
- **Function Calling**: Ejecución de herramientas (tools) de forma dinámica
- **Streaming SSE**: Respuestas en tiempo real usando Server-Sent Events
- **Context Management**: Manejo de historial de conversación

### Sistema RAG (Retrieval Augmented Generation)
- **Vector Database**: pgvector para almacenamiento de embeddings
- **Text Embeddings**: text-embedding-3-small de OpenAI
- **Document Processing**: Soporte para PDF, DOCX, TXT y Markdown
- **Semantic Search**: Búsqueda semántica de políticas y documentos

### Herramientas (Tools) del Agente

#### 1. Autenticación (`request_verification` / `verify_user`)
- Envío de código OTP por email usando Courier
- Verificación de identidad del usuario
- Gestión de sesiones

#### 2. Búsqueda de Conocimiento (`search_knowledge_base`)
- Consulta de políticas empresariales
- Búsqueda vectorial en documentos indexados
- Respuestas contextuales basadas en RAG

#### 3. Gestión de Solicitudes (`create_shopping_request` / `get_user_requests`)
- Creación de solicitudes de compra
- Consulta de historial de solicitudes
- Validación de datos

#### 4. Búsqueda de Productos (`search_product_prices`)
- Integración con MercadoLibre API
- Búsqueda en Suconel (proveedor local)
- Comparación de precios
- Generación de cotizaciones en PDF

### Integraciones Externas
- **Courier**: Envío de emails transaccionales (OTP)
- **OpenAI**: Modelos de lenguaje y embeddings
- **MercadoLibre API**: Búsqueda de productos
- **Suconel API**: Catálogo de productos B2B

## Stack Tecnológico

- **Framework**: NestJS 11.0.1
- **Database**: PostgreSQL + Prisma ORM
- **Vector Search**: pgvector extension
- **AI/LLM**: OpenAI (GPT-4o-mini + text-embedding-3-small)
- **RAG**: LangChain 1.0.2 + @langchain/openai
- **Email**: Courier API
- **PDF Generation**: PDFKit
- **Document Parsing**: pdf-parse, mammoth, markdown-it
- **TypeScript**: Tipado completo
- **Package Manager**: pnpm

## Requisitos Previos

- Node.js 18+ o superior
- PostgreSQL 14+ con extensión pgvector
- pnpm (recomendado) o npm
- Cuenta de OpenAI con API key
- Cuenta de Courier para emails

## Instalación

```bash
# Clonar el repositorio
cd server

# Instalar dependencias
pnpm install
# o
npm install
```

## Configuración

### 1. Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto server:

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/shopping_ia?schema=public"

# OpenAI
OPENAI_BASE_URL=https://models.inference.ai.azure.com
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small

# URLs
FRONTEND_URL=http://localhost:3001
BACKEND_URL=http://localhost:3000

# Courier (Email)
COURIER_API_KEY=your_courier_api_key
COURIER_TEMPLATE_OTP=your_otp_template_id

# Suconel (opcional)
SUCONEL_BASE_URL=https://cms.suconel.com/api
SUCONEL_AUTH_TOKEN=Bearer your_token

# MercadoLibre (opcional, para búsqueda avanzada)
# MELI_CLIENT_ID=your_client_id
# MELI_CLIENT_SECRET=your_client_secret
# MELI_ACCESS_TOKEN=your_access_token
# MELI_REFRESH_TOKEN=your_refresh_token
```

### 2. Base de Datos

#### Instalar PostgreSQL y pgvector

```bash
# En Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# Instalar pgvector
cd /tmp
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
```

#### Crear base de datos

```sql
CREATE DATABASE shopping_ia;
\c shopping_ia
CREATE EXTENSION vector;
```

#### Ejecutar migraciones de Prisma

```bash
# Generar cliente Prisma
npx prisma generate

# Ejecutar migraciones
npx prisma migrate dev

# (Opcional) Abrir Prisma Studio para ver la DB
npx prisma studio
```

### 3. Datos Iniciales

#### Crear usuarios de prueba

```sql
-- Insertar usuarios de prueba
INSERT INTO "user" (email, name, department) VALUES
('olvadis2004@gmail.com', 'Olvadis', 'IT'),
('olvadishernandezledesma@gmail.com', 'Monica', 'Marketing');
```

#### Indexar documentos (políticas)

Coloca tus documentos de políticas en la carpeta `data/documents/` y ejecuta:

```bash
# Indexar documentos en la base de datos vectorial
pnpm run index:docs
# o
npm run index:docs
```

Formatos soportados: `.pdf`, `.docx`, `.txt`, `.md`

## Uso

### Desarrollo

```bash
pnpm run start:dev
# o
npm run start:dev
```

El servidor estará disponible en `http://localhost:3000`

### Producción

```bash
# Build
pnpm run build

# Start
pnpm run start:prod
```

### Otros Comandos

```bash
# Linting
pnpm run lint

# Format code
pnpm run format

# Tests unitarios
pnpm run test

# Tests e2e
pnpm run test:e2e

# Test coverage
pnpm run test:cov

# Deploy (migración + build)
pnpm run deploy
```

## Estructura del Proyecto

```
server/
├── src/
│   ├── app.module.ts                     # Módulo principal
│   ├── main.ts                           # Entry point
│   ├── auth/                             # Módulo de autenticación
│   │   ├── auth.controller.ts            # Endpoints de auth
│   │   ├── auth.service.ts               # Lógica de OTP
│   │   └── dto/                          # DTOs de autenticación
│   ├── conversation/                     # Módulo de conversaciones
│   │   ├── conversation.controller.ts    # Endpoints de chat
│   │   ├── conversation.service.ts       # Lógica del agente IA
│   │   └── types/                        # Tipos y eventos SSE
│   ├── quotation/                        # Módulo de cotizaciones
│   │   ├── quotation.controller.ts       # Endpoints de solicitudes
│   │   ├── quotation.service.ts          # Lógica de solicitudes
│   │   └── dto/                          # DTOs de solicitudes
│   ├── rag/                              # Módulo RAG
│   │   ├── rag.service.ts                # Vector search y embeddings
│   │   └── document-processor.ts         # Procesamiento de docs
│   ├── integrations/                     # Integraciones externas
│   │   ├── mercadolibre/                 # MercadoLibre API
│   │   │   ├── mercadolibre.service.ts
│   │   │   └── dto/
│   │   └── suconel/                      # Suconel API
│   │       ├── suconel.service.ts
│   │       └── dto/
│   ├── email/                            # Módulo de email
│   │   ├── email.service.ts              # Servicio Courier
│   │   └── courier.module.ts
│   ├── orm/                              # Configuración Prisma
│   │   └── orm.service.ts
│   ├── config/                           # Configuración
│   │   ├── environment.config.ts         # Variables de entorno
│   │   └── constants.config.ts           # Constantes
│   └── scripts/                          # Scripts de utilidad
│       ├── index-documents.ts            # Indexar docs
│       └── parse-sse.ts                  # Parse logs SSE
├── prisma/
│   └── schema.prisma                     # Esquema de base de datos
├── data/
│   ├── documents/                        # Documentos para RAG
│   └── uploads/                          # Archivos subidos
├── test/                                 # Tests e2e
├── .env                                  # Variables de entorno
├── nest-cli.json                         # Configuración NestJS
├── tsconfig.json                         # Configuración TypeScript
└── package.json
```

## API Endpoints

### Autenticación

#### POST `/api/v1/auth/request-otp`
Solicita código OTP por email

**Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "Código enviado a user@example.com"
}
```

#### POST `/api/v1/auth/verify-otp`
Verifica código OTP

**Body:**
```json
{
  "email": "user@example.com",
  "otp": 123456
}
```

**Response:**
```json
{
  "token": "session_token_...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "User Name",
    "department": "IT"
  }
}
```

### Conversaciones

#### POST `/api/v1/conversations`
Crea una nueva conversación

**Response:**
```json
{
  "id": "clx1234567890",
  "userId": null,
  "title": "New Conversation",
  "isAuthenticated": false,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### GET `/api/v1/conversations`
Lista todas las conversaciones

**Query Params:**
- `userId` (opcional): Filtrar por usuario

#### GET `/api/v1/conversations/:id`
Obtiene una conversación específica con sus mensajes

#### GET `/api/v1/conversations/:id/messages` (SSE)
Stream de mensajes del agente en tiempo real

**Query Params:**
- `message`: Mensaje del usuario
- `sessionToken` (opcional): Token de sesión para auth

**Response Stream (SSE):**
```
data: {"type":"content","content":"Hola, "}
data: {"type":"content","content":"¿cómo "}
data: {"type":"content","content":"puedo "}
data: {"type":"content","content":"ayudarte?"}
data: {"type":"tool_start","tools":["search_knowledge_base"]}
data: {"type":"tool_result","name":"search_knowledge_base","result":{...}}
data: {"type":"usage","usage":{"inputTokens":150,"outputTokens":200}}
data: {"type":"done"}
```

### Solicitudes de Compra

#### POST `/api/v1/quotations`
Crea una nueva solicitud de compra

**Headers:**
```
Authorization: Bearer session_token
```

**Body:**
```json
{
  "item": "Laptop Dell XPS 15",
  "quantity": 5,
  "estimatedPrice": 15000,
  "justification": "Renovación de equipos"
}
```

#### GET `/api/v1/quotations`
Lista solicitudes del usuario autenticado

**Headers:**
```
Authorization: Bearer session_token
```

#### GET `/api/v1/quotations/:id/pdf`
Descarga cotización en PDF

## Modelos de Datos (Prisma)

### User
```prisma
model user {
  id            Int       @id @default(autoincrement())
  email         String    @unique
  name          String
  otp           Int?
  otpExpiresAt  DateTime?
  department    String?
  createdAt     DateTime  @default(now())
}
```

### Conversation
```prisma
model Conversation {
  id              String   @id @default(cuid())
  userId          Int?
  title           String   @default("New Conversation")
  isAuthenticated Boolean  @default(false)
  createdAt       DateTime @default(now())
  messages        Message[]
}
```

### Message
```prisma
model Message {
  id             String      @id @default(cuid())
  conversationId String
  role           MessageRole
  content        String      @db.Text
  toolCalls      Json?
  createdAt      DateTime    @default(now())
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
  TOOL
}
```

### RequestShopping
```prisma
model RequestShopping {
  id                  String        @id @default(cuid())
  item                String
  quantity            Int
  estimatedPrice      Float
  justification       String?
  status              RequestStatus @default(PENDING)
  requestedById       Int

  // MercadoLibre fields
  meliProductId       String?
  meliProductName     String?
  meliProductLink     String?
  meliProductPrice    Float?
  priceUSD            Float?
  quotationPdfPath    String?

  createdAt           DateTime      @default(now())
}

enum RequestStatus {
  PENDING
  APPROVED
  REJECTED
  COMPLETED
}
```

### Document & DocumentChunk
```prisma
model Document {
  id         String          @id @default(cuid())
  title      String
  content    String          @db.Text
  filePath   String
  metadata   Json?
  chunks     DocumentChunk[]
  createdAt  DateTime        @default(now())
}

model DocumentChunk {
  id          String   @id @default(cuid())
  documentId  String
  content     String   @db.Text
  embedding   Unsupported("vector(1536)")?
  chunkIndex  Int
  createdAt   DateTime @default(now())
}
```

## Flujo del Agente de IA

### 1. Recepción del Mensaje

```
Usuario -> POST /conversations/:id/messages?message="Hola"
         -> ConversationService.sendMessage()
```

### 2. Construcción del Contexto

```typescript
// Se construye el historial de mensajes
const messages = [
  { role: 'system', content: systemPrompt },
  ...historyMessages,
  { role: 'user', content: userMessage }
]
```

### 3. Llamada a OpenAI con Tools

```typescript
const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages,
  tools: [
    { type: 'function', function: requestVerification },
    { type: 'function', function: verifyUser },
    { type: 'function', function: searchKnowledgeBase },
    { type: 'function', function: createShoppingRequest },
    { type: 'function', function: getUserRequests },
    { type: 'function', function: searchProductPrices }
  ],
  stream: true
})
```

### 4. Procesamiento de Chunks

```typescript
for await (const chunk of response) {
  if (chunk.choices[0]?.delta?.content) {
    // Enviar contenido al cliente vía SSE
    emit({ type: 'content', content: chunk.choices[0].delta.content })
  }

  if (chunk.choices[0]?.delta?.tool_calls) {
    // Ejecutar herramienta
    const result = await executeTool(tool_call)
    emit({ type: 'tool_result', name: toolName, result })
  }
}
```

### 5. Persistencia

```typescript
// Guardar mensaje del usuario
await prisma.message.create({
  data: {
    conversationId,
    role: 'USER',
    content: userMessage
  }
})

// Guardar respuesta del asistente
await prisma.message.create({
  data: {
    conversationId,
    role: 'ASSISTANT',
    content: assistantResponse,
    toolCalls: toolCallsData
  }
})
```

## Sistema RAG

### Indexación de Documentos

```typescript
// 1. Cargar documento
const document = await loadDocument('policy.pdf')

// 2. Dividir en chunks
const chunks = await splitDocument(document, {
  chunkSize: 1000,
  chunkOverlap: 200
})

// 3. Generar embeddings
for (const chunk of chunks) {
  const embedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: chunk.content
  })

  // 4. Guardar en base de datos vectorial
  await prisma.documentChunk.create({
    data: {
      documentId: doc.id,
      content: chunk.content,
      embedding: embedding.data[0].embedding,
      chunkIndex: chunk.index
    }
  })
}
```

### Búsqueda Semántica

```typescript
// 1. Generar embedding de la query
const queryEmbedding = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: userQuery
})

// 2. Búsqueda vectorial en PostgreSQL
const results = await prisma.$queryRaw`
  SELECT content, 1 - (embedding <=> ${queryEmbedding}::vector) AS similarity
  FROM "DocumentChunk"
  ORDER BY embedding <=> ${queryEmbedding}::vector
  LIMIT 5
`

// 3. Retornar contexto
return results.map(r => r.content).join('\n\n')
```

## Herramientas del Agente

### search_knowledge_base

Busca información en la base de conocimiento usando RAG.

```typescript
{
  name: 'search_knowledge_base',
  description: 'Busca información en políticas y documentos de la empresa',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Consulta a buscar'
      }
    },
    required: ['query']
  }
}
```

### create_shopping_request

Crea una nueva solicitud de compra.

```typescript
{
  name: 'create_shopping_request',
  description: 'Crea una solicitud de compra',
  parameters: {
    type: 'object',
    properties: {
      item: { type: 'string', description: 'Producto a comprar' },
      quantity: { type: 'number', description: 'Cantidad' },
      estimatedPrice: { type: 'number', description: 'Precio estimado USD' },
      justification: { type: 'string', description: 'Justificación' }
    },
    required: ['item', 'quantity', 'estimatedPrice']
  }
}
```

### search_product_prices

Busca precios en MercadoLibre y Suconel.

```typescript
{
  name: 'search_product_prices',
  description: 'Busca precios de productos en marketplaces',
  parameters: {
    type: 'object',
    properties: {
      productName: { type: 'string', description: 'Nombre del producto' },
      maxResults: { type: 'number', description: 'Máx. resultados (default: 5)' }
    },
    required: ['productName']
  }
}
```

## Solución de Problemas

### Error: "Cannot connect to database"

**Causa**: PostgreSQL no está corriendo o credenciales incorrectas.

**Solución**:
```bash
# Verificar que PostgreSQL esté corriendo
sudo systemctl status postgresql

# Verificar DATABASE_URL en .env
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
```

### Error: "pgvector extension not found"

**Causa**: Extensión pgvector no instalada.

**Solución**:
```sql
-- Conectar a la base de datos
\c shopping_ia

-- Crear extensión
CREATE EXTENSION IF NOT EXISTS vector;
```

### Error: "OpenAI API key invalid"

**Causa**: API key incorrecta o expirada.

**Solución**:
1. Verifica tu API key en OpenAI Dashboard
2. Actualiza `OPENAI_API_KEY` en `.env`
3. Reinicia el servidor

### Error: "Courier email not sent"

**Causa**: Credenciales de Courier incorrectas.

**Solución**:
1. Verifica `COURIER_API_KEY` en Courier Dashboard
2. Verifica que el template OTP exista
3. Revisa los logs: `console.log` en `email.service.ts`

### Documentos no indexados

**Causa**: Script de indexación no ejecutado o error en procesamiento.

**Solución**:
```bash
# Re-ejecutar indexación
pnpm run index:docs

# Verificar en Prisma Studio
npx prisma studio
# Ver tabla Document y DocumentChunk
```

## Testing

### Unit Tests

```bash
pnpm test

# Específico
pnpm test auth.service
```

### E2E Tests

```bash
pnpm test:e2e
```

### Manual Testing con cURL

#### Crear conversación
```bash
curl -X POST http://localhost:3000/api/v1/conversations
```

#### Enviar mensaje (SSE)
```bash
curl -N "http://localhost:3000/api/v1/conversations/clx123/messages?message=Hola"
```

#### Request OTP
```bash
curl -X POST http://localhost:3000/api/v1/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'
```

## Deployment

### Railway / Render / Heroku

```bash
# Build command
npm run deploy

# Start command
npm run start:prod
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
```

```bash
docker build -t quoteai-server .
docker run -p 3000:3000 --env-file .env quoteai-server
```

### Environment Variables en Producción

Asegúrate de configurar:
- `DATABASE_URL` (PostgreSQL con pgvector)
- `OPENAI_API_KEY`
- `COURIER_API_KEY`
- `FRONTEND_URL` (URL del frontend en producción)

## Contribución

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/new-tool`)
3. Commit cambios (`git commit -m 'Add new tool'`)
4. Push (`git push origin feature/new-tool`)
5. Abre un Pull Request

## Licencia

Proyecto privado - Todos los derechos reservados

## Recursos

- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [LangChain Documentation](https://js.langchain.com/docs)
- [pgvector GitHub](https://github.com/pgvector/pgvector)

## Soporte

Para problemas o preguntas:
- Revisa la [documentación del proyecto](../project.md)
- Consulta las [instrucciones del chat](../INSTRUCCIONES_CHAT.md)
- Verifica el [resumen de refactoring](../REFACTORING_SUMMARY.md)

---

Desarrollado para QuoteIA - Sistema inteligente de gestión de compras
