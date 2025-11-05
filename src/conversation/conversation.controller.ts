import {
  Controller,
  Post,
  Get,
  Body,
  Sse,
  Param,
  MessageEvent,
  Res,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { Observable } from 'rxjs';
import { Response } from 'express';

@Controller('api/v1/conversations')
export class ConversationController {
  private readonly logger = new Logger(ConversationController.name);

  constructor(private readonly conversationService: ConversationService) {}

  @Post()
  async createConversation() {
    return this.conversationService.createConversation();
  }

  @Get(':id')
  async getConversation(@Param('id') id: string) {
    return this.conversationService.getConversation(id);
  }

  /**
   * Enviar mensaje (POST)
   * POST /api/v1/conversations/:id/messages
   * Body: { message: string }
   * Devuelve: { messageId: string }
   */
  @Post(':id/messages')
  async sendMessage(
    @Param('id') conversationId: string,
    @Body('message') message: string,
  ) {
    if (!message) {
      throw new BadRequestException('Message is required');
    }

    // Guardar mensaje y generar ID único para el stream
    const messageId = await this.conversationService.queueMessage(conversationId, message);

    return { messageId };
  }

  /**
   * Recibir respuesta en streaming (GET SSE)
   * GET /api/v1/conversations/:id/messages/:messageId/stream
   */
    @Sse(':id/messages/:messageId/stream')
  streamMessage(
    @Param('id') conversationId: string,
    @Param('messageId') messageId: string,
  ): Observable<MessageEvent> {
    
    return new Observable((subscriber) => {
      (async () => {
        try {
          let eventId = 0;
          
          for await (const chunk of this.conversationService.streamResponseById(
            conversationId,
            messageId,
          )) {
            const event = {
              id: String(++eventId),
              data: chunk,
            } as MessageEvent;
            
            subscriber.next(event);
  
            //  Si es 'done', terminar inmediatamente
            if (chunk.type === 'done') {
              subscriber.complete();
              return; // Salir del loop
            }
          }
          
          // Si llegamos aquí sin 'done', enviarlo manualmente
          subscriber.next({
            id: String(++eventId),
            data: { type: 'done' },
          } as MessageEvent);
          
          subscriber.complete();
        } catch (error) {
          this.logger.error('SSE Error:', error.stack);

          subscriber.next({
            id: '0',
            data: { type: 'error', error: error.message },
          } as MessageEvent);

          subscriber.error(error);
        }
      })();

      return () => {
        this.logger.log('SSE Client disconnected');
      };
    });
  }
}