import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { SepayWebhookController } from './sepay-webhook.controller';
import { BillingService } from './billing.service';
import { SepayService } from './sepay.service';
import { SubscriptionService } from './subscription.service';

@Module({
  controllers: [BillingController, SepayWebhookController],
  providers: [BillingService, SepayService, SubscriptionService],
  exports: [SubscriptionService, BillingService],
})
export class BillingModule {}
