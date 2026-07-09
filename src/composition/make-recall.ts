import type { PrismaClient } from '@prisma/client';
import { ConfigRecallCampaignRepository } from '../modules/recall/infra/config/config-recall-campaign.repository';
import { PrismaRecallAttemptRepository } from '../modules/recall/infra/prisma/recall-attempt.repository';
import { PrismaSuppressionRepository } from '../modules/recall/infra/prisma/suppression.repository';
import { MessagingPortClient, type SendNotificationInbound } from '../modules/recall/infra/clients/messaging.client';
import { CheckoutPaymentStatusPortClient, type CheckoutPaymentStatusInbound } from '../modules/recall/infra/clients/checkout-payment-status.client';
import { CheckoutResumePortClient, type CheckoutResumeInbound } from '../modules/recall/infra/clients/checkout-resume.client';
import { CommerceGatewayReadPortClient, type CommerceCatalogReadInbound } from '../modules/recall/infra/clients/commerce-gateway-read.client';
import { AppConfigAdapter, type ConfigQuery } from '../modules/recall/infra/app-config.adapter';
import { WorkersClockAdapter } from '../modules/recall/infra/workers-clock';
import { DetectAndEnrollService } from '../modules/recall/application/detect-and-enroll.service';
import { ProcessDueTouchService } from '../modules/recall/application/process-due-touch.service';
import { HandleCheckoutPaidService } from '../modules/recall/application/handle-checkout-paid.service';
import { HandleEngagementCallbackService } from '../modules/recall/application/handle-engagement-callback.service';
import { ManageCampaignService } from '../modules/recall/application/manage-campaign.service';
import { ManageSuppressionService } from '../modules/recall/application/manage-suppression.service';
import { CancelRecallService } from '../modules/recall/application/cancel-recall.service';
import type { JobQueuePort, EventPublisherPort } from '../modules/recall/application/ports';

export interface RecallDeps {
  prisma: PrismaClient;
  sendNotification: SendNotificationInbound;
  checkoutPaymentStatus: CheckoutPaymentStatusInbound;
  checkoutResume: CheckoutResumeInbound;
  commerceRead: CommerceCatalogReadInbound;
  jobQueue: JobQueuePort;
  events: EventPublisherPort;
  configQuery: ConfigQuery;
}

export function makeRecall(deps: RecallDeps) {
  const clock = new WorkersClockAdapter();
  const campaignRepo = new ConfigRecallCampaignRepository(deps.prisma);
  const attemptRepo = new PrismaRecallAttemptRepository(deps.prisma);
  const suppressionRepo = new PrismaSuppressionRepository(deps.prisma);
  const messaging = new MessagingPortClient(deps.sendNotification);
  const paymentStatus = new CheckoutPaymentStatusPortClient(deps.checkoutPaymentStatus);
  const resume = new CheckoutResumePortClient(deps.checkoutResume);
  const commerce = new CommerceGatewayReadPortClient(deps.commerceRead);
  const appConfig = new AppConfigAdapter(deps.configQuery);

  return {
    detectAndEnroll: new DetectAndEnrollService(campaignRepo, attemptRepo, suppressionRepo, deps.jobQueue, deps.events, clock),
    processDueTouch: new ProcessDueTouchService(campaignRepo, attemptRepo, suppressionRepo, paymentStatus, messaging, resume, commerce, deps.events, appConfig, clock),
    handleCheckoutPaid: new HandleCheckoutPaidService(attemptRepo, suppressionRepo, deps.events, appConfig, clock),
    handleEngagementCallback: new HandleEngagementCallbackService(suppressionRepo, deps.events, clock),
    manageCampaign: new ManageCampaignService(campaignRepo),
    manageSuppression: new ManageSuppressionService(suppressionRepo, clock),
    cancelRecall: new CancelRecallService(attemptRepo, deps.events),
  };
}
