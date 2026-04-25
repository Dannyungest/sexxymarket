import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AdminLoginResendDto } from './dto/admin-login-resend.dto';
import { AdminLoginStartDto } from './dto/admin-login-start.dto';
import { AdminLoginVerifyDto } from './dto/admin-login-verify.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() payload: RegisterDto) {
    return this.authService.register(payload);
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() payload: LoginDto) {
    return this.authService.login(payload);
  }

  @Post('admin/login/start')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  adminLoginStart(@Body() payload: AdminLoginStartDto) {
    return this.authService.adminLoginStart(payload);
  }

  @Post('admin/login/verify')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  adminLoginVerify(@Body() payload: AdminLoginVerifyDto) {
    return this.authService.adminLoginVerify(payload);
  }

  @Post('admin/login/resend')
  @Throttle({ default: { limit: 4, ttl: 60_000 } })
  adminLoginResend(@Body() payload: AdminLoginResendDto) {
    return this.authService.adminLoginResend(payload);
  }

  @Post('verify-email')
  verifyEmail(@Body() body: VerifyEmailDto) {
    return this.authService.verifyEmail(body.token);
  }

  @Post('resend-verification')
  @UseGuards(JwtAuthGuard)
  resendVerification(@CurrentUser() user: AuthUser) {
    return this.authService.resendVerification(user.sub);
  }

  @Post('password-reset/request')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  passwordResetRequest(@Body() body: PasswordResetRequestDto) {
    return this.authService.requestPasswordReset(body.email);
  }

  @Post('password-reset/confirm')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  passwordResetConfirm(@Body() body: PasswordResetConfirmDto) {
    return this.authService.confirmPasswordReset(body);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() body: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.sub, body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.authService.getMe(user.sub);
  }
}
