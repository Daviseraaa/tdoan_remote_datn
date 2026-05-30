import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateDesktopRecordingDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  steps?: unknown[];
}
