import { Injectable } from '@nestjs/common';
import { OrmService } from '../orm/orm.service';
import { EmailService } from '../email/email.service';
import { ToolsService } from '../tools/tools.service';
import OpenAI from 'openai';
import { randomUUID } from 'crypto';

interface QueuedMessage {
  id: string;
  conversationId: string;
  message: string;
  timestamp: number;
}

@Injectable()
export class ConversationService {
  private openai: OpenAI;
    private messageQueue: Map<string, QueuedMessage> = new Map();

  constructor(
    private readonly prisma: OrmService,
    private readonly emailService: EmailService,
    private readonly tools: ToolsService,
  ) {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY,  baseURL: process.env.OPENAI_BASE_URL });
  }

 async createConversation() {
    return this.prisma.conversation.create({
      data: { 
        title: 'New Conversation',
        isAuthenticated: false,
      },
      include: {
        messages: true,
        user: {
          select: { id: true, name: true, email: true }
        }
      },
    });
  }

  async getConversation(conversationId: string) {
    return this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /**
   * Guardar mensaje en cola y devolver ID
   */
  async queueMessage(conversationId: string, message: string): Promise<string> {
    const messageId = randomUUID();
    
    this.messageQueue.set(messageId, {
      id: messageId,
      conversationId,
      message,
      timestamp: Date.now(),
    });

    // Limpiar mensajes antiguos (más de 5 minutos)
    setTimeout(() => {
      this.messageQueue.delete(messageId);
    }, 5 * 60 * 1000);

    return messageId;
  }

  /**
   * Procesar mensaje desde la cola
   */
  async *streamResponseById(conversationId: string, messageId: string) {
    const queued = this.messageQueue.get(messageId);
    
    if (!queued || queued.conversationId !== conversationId) {
      throw new Error('Message not found or expired');
    }

    // Remover de la cola
    this.messageQueue.delete(messageId);

    // Procesar normalmente
    yield* this.streamResponse(conversationId, queued.message);
  }

  async *streamResponse(conversationId: string, userMessage: string) {
    // ... resto del código igual
    await this.saveMessage(conversationId, 'USER', userMessage);

    const conversation = await this.getConversation(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const authIntent = await this.detectAuthIntent(userMessage, conversation);
    if (authIntent) {
      yield* this.handleAuthentication(conversationId, authIntent, conversation);
      return;
    }

    const messages = this.buildMessages(conversation);
    yield* this.streamWithTools(conversationId, messages, conversation.user?.id);
  }

    private async *streamWithTools(
    conversationId: string,
    messages: any[],
    userId?: number,
  ) {
    const tools = this.tools.getToolDefinitions();
    let fullResponse = '';
    let toolCalls: any[] = [];
  
    const stream = await this.openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages,
      tools: tools.map(t => ({ type: 'function', function: t })),
      stream: true,
    });
  
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
  
      if (delta?.content) {
        fullResponse += delta.content;
        yield { type: 'content', content: delta.content };
      }
  
      if (delta?.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          if (!toolCalls[toolCall.index]) {
            toolCalls[toolCall.index] = {
              id: toolCall.id || '',
              type: 'function',
              function: { name: '', arguments: '' },
            };
          }
  
          const current = toolCalls[toolCall.index];
  
          if (toolCall.id) {
            current.id = toolCall.id;
          }
  
          if (toolCall.function?.name) {
            current.function.name = toolCall.function.name;
          }
  
          if (toolCall.function?.arguments) {
            current.function.arguments += toolCall.function.arguments;
          }
        }
      }
    }
  
    // Execute tool calls
    if (toolCalls.length > 0) {
      yield { type: 'tool_start', tools: toolCalls.map(t => t.function.name) };
  
      messages.push({
        role: 'assistant',
        content: fullResponse || null,
        tool_calls: toolCalls,
      });
  
      for (const toolCall of toolCalls) {
        try {
  
          const args = JSON.parse(toolCall.function.arguments);
          const { result, trace } = await this.tools.executeTool(
            toolCall.function.name,
            args,
            userId,
          );
  
  
          yield { type: 'tool_result', name: toolCall.function.name, result, trace };
  
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        } catch (error) {
          console.error(` Tool error:`, error);
          
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: error.message || 'Tool execution failed' }),
          });
  
          yield { type: 'tool_error', name: toolCall.function.name, error: error.message };
        }
      }
  
  
      const finalStream = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages,
        stream: true,
      });
  
      let finalResponse = '';
      for await (const chunk of finalStream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          finalResponse += content;
          yield { type: 'content', content };
        }
      }
  
      fullResponse = finalResponse;
    }
  
    // Save assistant final message
    if (fullResponse) {
      await this.saveMessage(conversationId, 'ASSISTANT', fullResponse);
    }
  
    //  IMPORTANTE: Enviar evento 'done' al final
    yield { type: 'done' };
  }

    private async detectAuthIntent(message: string, conversation: any): Promise<any> {
    // Si ya está autenticado, no detectar intento de autenticación
    if (conversation.isAuthenticated) return null;
  
    const lowerMessage = message.toLowerCase();
  
   
    // Pattern 1: Solo números: "423532"
    // Pattern 2: Con texto: "codigo 423532" / "código: 423532"
    
    // Buscar 6 dígitos consecutivos en el mensaje
    const codeMatch = message.match(/\b(\d{6})\b/);
    
    if (codeMatch && codeMatch[1]) {
      const code = parseInt(codeMatch[1]);
      return { type: 'verify_code', code };
    }
  
    // Pattern: "soy [name]" - solo si no hay código pendiente
    const nameMatch = lowerMessage.match(/(?:soy|mi nombre es|me llamo)\s+([a-záéíóúñ\s]+)/i);
    if (nameMatch && nameMatch[1]) {
      const name = nameMatch[1].trim();
      return { type: 'request_auth', name };
    }
  
    return null;
  }

    private async *handleAuthentication(conversationId: string, intent: any, conversation: any) {
    if (intent.type === 'request_auth') {
      const user = await this.prisma.user.findFirst({
        where: { name: { contains: intent.name, mode: 'insensitive' } },
      });
  
      if (!user) {
        const response = `No encontré "${intent.name}". Verifica el nombre.`;
        yield { type: 'content', content: response };
        await this.saveMessage(conversationId, 'ASSISTANT', response);
        yield { type: 'done' }; //  Agregar aquí
        return;
      }
  
      const otp = Math.floor(100000 + Math.random() * 900000);
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          otp,
          otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });
  
      await this.emailService.sendOTPEmail(user.email, otp, 5, user.name);
  
      const response = `Código enviado a ${user.email}. Ingresa el código.`;
      yield { type: 'content', content: response };
      await this.saveMessage(conversationId, 'ASSISTANT', response);
      yield { type: 'done' }; //  Agregar aquí
    }
  
    if (intent.type === 'verify_code') {
      const user = await this.prisma.user.findFirst({
        where: {
          otp: intent.code,
          otpExpiresAt: { gt: new Date() },
        },
      });
  
      if (!user) {
        const response = 'Código inválido. Di tu nombre para obtener uno nuevo.';
        yield { type: 'content', content: response };
        await this.saveMessage(conversationId, 'ASSISTANT', response);
        yield { type: 'done' }; //  Agregar aquí
        return;
      }
  
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          userId: user.id,
          isAuthenticated: true,
          title: `Chat con ${user.name}`,
        },
      });
  
      await this.prisma.user.update({
        where: { id: user.id },
        data: { otp: null, otpExpiresAt: null },
      });
  
      const response = `Listo, ${user.name}. ¿En qué te ayudo?`;
      yield { type: 'content', content: response };
      yield { type: 'authenticated', user: { id: user.id, name: user.name, email: user.email } };
      await this.saveMessage(conversationId, 'ASSISTANT', response);
      yield { type: 'done' }; //  Agregar aquí
    }
  }

    private buildMessages(conversation: any): any[] {
    const messages: any[] = [
      {
        role: 'system',
        content: `Asistente de compras.${conversation.isAuthenticated ? ` Usuario: ${conversation.user.name}.` : ''}
  
        Herramientas:
        - create_shopping_request: crear solicitudes${!conversation.isAuthenticated ? ' (requiere auth)' : ''}
        - search_knowledge_base: buscar políticas/procedimientos (USA SIEMPRE para preguntas sobre políticas o procesos)
        - get_user_requests: consultar historial${!conversation.isAuthenticated ? ' (requiere auth)' : ''}
        
        ${!conversation.isAuthenticated ? 'Para autenticar: usuario dice su nombre, recibe código por email, luego lo ingresa.' : ''}
        
        Sé conciso. Usa search_knowledge_base para preguntas sobre políticas, límites, procesos de compra.`,
      },
    ];
  
    conversation.messages.forEach((msg: any) => {
      // Ignorar mensajes TOOL
      if (msg.role === 'TOOL') return;
      
      messages.push({
        role: msg.role.toLowerCase(),
        content: msg.content,
        //  NO incluir tool_calls de mensajes previos
        // Solo el contenido de la respuesta final
      });
    });
  
    return messages;
  }

  private async saveMessage(
    conversationId: string,
    role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL',
    content: string,
    toolCalls?: any,
  ) {
    await this.prisma.message.create({
      data: {
        conversationId,
        role,
        content,
        toolCalls: toolCalls || undefined,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  }
}