import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckoutDto {
  @ApiProperty({ description: 'Subscription plan ID' })
  @IsString()
  @IsNotEmpty()
  planId!: string;
}
