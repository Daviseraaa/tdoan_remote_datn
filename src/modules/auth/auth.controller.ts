import { Body, Controller, HttpCode, HttpStatus, Ip, Post, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public, SkipSubscription } from '../../common/decorators/index';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  SendRegisterOtpDto,
  GoogleAuthDto,
  LoginDto,
  RefreshTokenDto,
} from './dto/index';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register/send-otp')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send OTP email for new user registration' })
  sendRegisterOtp(@Body() dto: SendRegisterOtpDto) {
    return this.authService.sendRegisterOtp(dto.email);
  }

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register a new user (requires email OTP)' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('google')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login or register with Google ID token' })
  loginWithGoogle(@Body() dto: GoogleAuthDto, @Ip() ip: string) {
    return this.authService.loginWithGoogle(dto.idToken, ip);
  }

  @Public()
  @Post('google/redirect')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Google GIS redirect callback (Safari / ITP browsers)',
  })
  async googleRedirect(
    @Body('credential') credential: string | undefined,
    @Ip() ip: string,
    @Res() res: Response,
  ) {
    const url = await this.authService.completeGoogleRedirect(credential, ip);
    return res.redirect(302, url);
  }

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.authService.login(dto, ip);
  }

  @Public()
  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @SkipSubscription()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  logout(
    @Body() dto: RefreshTokenDto,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
  ) {
    return this.authService.logout(
      dto.refreshToken,
      { id: user.sub, email: user.email },
      ip,
    );
  }
}
