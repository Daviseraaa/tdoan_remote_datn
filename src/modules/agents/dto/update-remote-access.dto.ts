import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateRemoteAccessDto {
  @ApiPropertyOptional({
    example: 'AA:BB:CC:DD:EE:FF',
    description: 'MAC cho Wake-on-LAN (admin ghi đè giá trị agent báo cáo)',
  })
  @IsOptional()
  @IsString()
  wolMacAddress?: string;

  @ApiPropertyOptional({
    example: '192.168.1.255',
    description: 'Địa chỉ broadcast UDP cho magic packet',
  })
  @IsOptional()
  @IsString()
  wolBroadcast?: string;

  @ApiPropertyOptional({
    example: 'DESKTOP-ABC',
    description: 'Hostname/IP gợi ý khi kết nối RDP',
  })
  @IsOptional()
  @IsString()
  rdpHost?: string;

  @ApiPropertyOptional({ example: 3389 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  rdpPort?: number;

  @ApiPropertyOptional({
    description: 'Ghi chú trạng thái RDP (chỉ metadata admin; agent vẫn báo rdpEnabled thực tế khi connect)',
  })
  @IsOptional()
  @IsBoolean()
  rdpEnabled?: boolean;
}
