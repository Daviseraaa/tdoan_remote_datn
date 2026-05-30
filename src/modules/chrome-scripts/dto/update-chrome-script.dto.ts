import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateChromeScriptDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  startUrl?: string;

  @IsOptional()
  @IsArray()
  steps?: unknown[];
}
