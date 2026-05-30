import { Module, forwardRef } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { ChromeScriptsController } from './chrome-scripts.controller';
import { ChromeScriptsService } from './chrome-scripts.service';

@Module({
  imports: [forwardRef(() => AgentsModule)],
  controllers: [ChromeScriptsController],
  providers: [ChromeScriptsService],
  exports: [ChromeScriptsService],
})
export class ChromeScriptsModule {}
