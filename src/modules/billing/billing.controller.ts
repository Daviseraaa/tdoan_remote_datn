import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { SkipSubscription } from '../../common/decorators/skip-subscription.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  JwtPayload,
} from '../../common/decorators/current-user.decorator';
import { BillingService } from './billing.service';
import { AdminSetSubscriptionDto, CheckoutDto } from './dto';

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Public()
  @Get('plans')
  @ApiOperation({ summary: 'List active subscription plans' })
  listPlans() {
    return this.billing.listActivePlans();
  }

  @SkipSubscription()
  @Get('subscription')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current user subscription status' })
  getSubscription(@CurrentUser() user: JwtPayload) {
    return this.billing.getSubscription(user.sub);
  }

  @SkipSubscription()
  @Post('checkout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo đơn chuyển khoản SePay (mã StationHub...)' })
  checkout(@CurrentUser() user: JwtPayload, @Body() dto: CheckoutDto) {
    return this.billing.createCheckout(user.sub, dto.planId);
  }

  @SkipSubscription()
  @Get('payments/:id/checkout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xem lại mã chuyển khoản (đơn PENDING)' })
  paymentCheckout(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.billing.getPaymentCheckout(user.sub, id);
  }

  @SkipSubscription()
  @Get('payments/:id/status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Trạng thái đơn thanh toán (poll sau CK)' })
  paymentStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.billing.getPaymentStatus(user.sub, id);
  }

  @SkipSubscription()
  @Get('payments')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Payment history for current user' })
  listPayments(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? parseInt(limit, 10) : 20;
    return this.billing.listPayments(user.sub, Number.isFinite(n) ? n : 20);
  }

  @SkipSubscription()
  @Roles(Role.ADMIN)
  @Patch('users/:id/subscription')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: set user subscription manually' })
  adminSetSubscription(
    @Param('id') id: string,
    @Body() dto: AdminSetSubscriptionDto,
  ) {
    return this.billing.adminSetSubscription(id, dto);
  }
}
