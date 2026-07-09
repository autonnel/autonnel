import type { MessagingPort, ComposedTouch } from '../../application/ports';

export interface SendNotificationInbound {
  send(input: {
    channel: string;
    recipientAddress: string;
    templateKey: string;
    mergeVariables: Record<string, unknown>;
    idempotencyKey: string;
  }): Promise<{ dispatchId: string }>;
}

export class MessagingPortClient implements MessagingPort {
  constructor(private readonly send: SendNotificationInbound) {}
  async sendTouch(touch: ComposedTouch): Promise<{ messageHandoffRef: string }> {
    const { dispatchId } = await this.send.send({
      channel: touch.channel,
      recipientAddress: touch.recipientAddress,
      templateKey: touch.templateKey,
      mergeVariables: touch.mergeVariables,
      idempotencyKey: touch.idempotencyKey,
    });
    return { messageHandoffRef: dispatchId };
  }
}
