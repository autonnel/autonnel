import type { MessagingPort, SendNotificationInput } from "../../application/ports";

export interface SendNotificationPort {
  send(input: {
    channel: "EMAIL";
    templateKey: string;
    recipient: string;
    mergeVariables: Record<string, unknown>;
    idempotencyKey: string;
    locale?: string;
  }): Promise<void>;
}

export class MessagingClient implements MessagingPort {
  constructor(private readonly messaging: SendNotificationPort) {}

  async send(input: SendNotificationInput): Promise<void> {
    await this.messaging.send(input);
  }
}
