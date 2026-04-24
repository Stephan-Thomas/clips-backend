import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  namespace: '/clips',
  cors: {
    origin: '*',
  },
})
export class ClipsGateway {
  @WebSocketServer()
  server: Server;

  emitProgressToUser(userId: string, payload: any): void {
    const room = `user:${userId}`;
    this.server.to(room).emit('clip.progress', payload);
  }
}
