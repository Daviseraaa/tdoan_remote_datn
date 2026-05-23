import { Module, forwardRef } from '@nestjs/common';
import { AutomationModule } from '../automation/automation.module';
import { TriggerDispatcherService } from './trigger-dispatcher.service';
import { ScheduleTriggerService } from './schedule-trigger.service';
import { TriggersController } from './triggers.controller';
import { TriggersService } from './triggers.service';
import { TelegramApiService } from './telegram/telegram-api.service';
import { TelegramUpdateService } from './telegram/telegram-update.service';
import { TelegramWebhookController } from './telegram/telegram-webhook.controller';
import { TelegramActionService } from './telegram/telegram-action.service';
import { TriggerRegistryService } from './trigger-registry.service';

@Module({
  imports: [forwardRef(() => AutomationModule)],
  controllers: [TriggersController, TelegramWebhookController],
  providers: [
    TriggersService,
    TriggerDispatcherService,
    ScheduleTriggerService,
    TelegramApiService,
    TelegramUpdateService,
    TelegramActionService,
    TriggerRegistryService,
  ],
  exports: [
    TriggerDispatcherService,
    TelegramApiService,
    TelegramActionService,
    TriggersService,
  ],
})
export class TriggersModule {}
