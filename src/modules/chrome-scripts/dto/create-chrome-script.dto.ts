import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateChromeScriptDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  startUrl?: string;

  @IsArray()
  steps!: unknown[];

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsString()
  source?: string;
}
