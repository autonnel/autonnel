export const MessagingEvent = {
  NotificationQueued: 'messaging.NotificationQueued',
  NotificationSent: 'messaging.NotificationSent',
  NotificationDelivered: 'messaging.NotificationDelivered',
  NotificationBounced: 'messaging.NotificationBounced',
  NotificationComplained: 'messaging.NotificationComplained',
  NotificationFailed: 'messaging.NotificationFailed',
  NotificationSuppressed: 'messaging.NotificationSuppressed',
  RecipientSuppressed: 'messaging.RecipientSuppressed',
  NotificationEngaged: 'messaging.NotificationEngaged',
  TemplatePublished: 'messaging.TemplatePublished',
} as const;

export type MessagingEventType = (typeof MessagingEvent)[keyof typeof MessagingEvent];
