import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateRemoteSessionDto {
  @ApiProperty({ description: 'Agent to control' })
  @IsUUID()
  agentId!: string;

  @ApiProperty({ required: false, default: 'full' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  controlMode?: string;

  @ApiProperty({ required: false, enum: ['low-latency', 'balanced', 'high-quality'], default: 'balanced' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  qualityProfile?: 'low-latency' | 'balanced' | 'high-quality';

  @ApiProperty({ required: false, description: 'Preferred TURN region key, e.g. sg/jp/us' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  preferredRegion?: string;

  @ApiProperty({ required: false, enum: ['wrtc', 'ndc'] })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  mediaEngine?: 'wrtc' | 'ndc';
}
