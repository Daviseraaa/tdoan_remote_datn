import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleAuthDto {
  @ApiProperty({ description: 'Google ID token from GIS / OAuth' })
  @IsString()
  @IsNotEmpty()
  idToken: string = '';
}
