import {
  Body,
  Controller,
  Headers,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import { BillingService } from './billing.service';
import { SepayWebhookPayload } from './sepay.service';

@ApiTags('Billing')
@Controller('billing/sepay')
export class SepayWebhookController {
  constructor(private readonly billing: BillingService) {}

  @Public()
  @SkipTransform()
  @Post('webhook')
  @ApiOperation({ summary: 'SePay bank transfer webhook (public)' })
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() payload: SepayWebhookPayload,
    @Headers('authorization') authorization?: string,
    @Headers('x-sepay-signature') signature?: string,
    @Headers('x-sepay-timestamp') timestamp?: string,
  ) {
    const rawBody =
      req.rawBody?.toString('utf8') ??
      (typeof req.body === 'string' ? req.body : JSON.stringify(payload));

    try {
      await this.billing.handleSepayWebhook(
        payload,
        authorization,
        rawBody,
        signature,
        timestamp,
      );
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      // SePay retry nếu lỗi — log và vẫn trả success nếu duplicate/ignored
    }

    return { success: true };
  }
}
