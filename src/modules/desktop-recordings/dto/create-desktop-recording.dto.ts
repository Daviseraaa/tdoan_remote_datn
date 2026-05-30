import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateDesktopRecordingDto {
  @IsString()
  name!: string;

  @IsArray()
  steps!: unknown[];

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsString()
  source?: string;
}
