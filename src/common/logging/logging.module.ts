import { Global, Module } from '@nestjs/common';
import { TelegramActionNotifierService } from './telegram-action-notifier.service';

@Global()
@Module({
  providers: [TelegramActionNotifierService],
  exports: [TelegramActionNotifierService],
})
export class LoggingModule {}
