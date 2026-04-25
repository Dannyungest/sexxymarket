import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../integrations/notifications.service';
import { RegisterDto } from './dto/register.dto';
import { AdminLoginResendDto } from './dto/admin-login-resend.dto';
import { AdminLoginStartDto } from './dto/admin-login-start.dto';
import { AdminLoginVerifyDto } from './dto/admin-login-verify.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  private get adminOtpExpiresMinutes() {
    return Number(
      this.configService.get<string>('ADMIN_LOGIN_OTP_EXPIRES_MINUTES') ?? '10',
    );
  }

  private get adminOtpMaxAttempts() {
    return Number(
      this.configService.get<string>('ADMIN_LOGIN_OTP_MAX_ATTEMPTS') ?? '5',
    );
  }

  private get adminOtpResendCooldownSeconds() {
    return Number(
      this.configService.get<string>(
        'ADMIN_LOGIN_OTP_RESEND_COOLDOWN_SECONDS',
      ) ?? '45',
    );
  }

  private get passwordResetOtpExpiresMinutes() {
    return Number(
      this.configService.get<string>('PASSWORD_RESET_OTP_EXPIRES_MINUTES') ??
        '10',
    );
  }

  private get passwordResetOtpMaxAttempts() {
    return Number(
      this.configService.get<string>('PASSWORD_RESET_OTP_MAX_ATTEMPTS') ?? '5',
    );
  }

  async register(payload: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: payload.email },
    });
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await argon2.hash(payload.password);
    const emailVerificationToken = randomBytes(32).toString('hex');
    const now = new Date();
    const user = await this.prisma.user.create({
      data: {
        email: payload.email,
        passwordHash,
        firstName: payload.firstName,
        lastName: payload.lastName,
        phone: payload.phone,
        emailVerifiedAt: null,
        emailVerificationToken,
        mustChangePassword: false,
        passwordSetAt: now,
      },
    });

    const verificationSender =
      user.role === 'MERCHANT'
        ? this.notifications.sendMerchantEmailVerification.bind(
            this.notifications,
          )
        : this.notifications.sendStorefrontEmailVerification.bind(
            this.notifications,
          );
    await verificationSender({
      email: user.email,
      firstName: user.firstName,
      token: emailVerificationToken,
    });

    return {
      success: true,
      message:
        'Check your email to verify your account before you can place orders.',
      email: user.email,
    };
  }

  async login(payload: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: payload.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await argon2.verify(user.passwordHash, payload.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive || user.isBlocked || user.isBlacklisted) {
      throw new UnauthorizedException('Account is restricted');
    }

    if (this.isAdminRole(user.role)) {
      return this.startAdminChallenge(user, false);
    }

    return this.issueTokensForUser(user);
  }

  async adminLoginStart(payload: AdminLoginStartDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: payload.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const isValid = await argon2.verify(user.passwordHash, payload.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive || user.isBlocked || user.isBlacklisted) {
      throw new UnauthorizedException('Account is restricted');
    }
    if (!this.isAdminRole(user.role)) {
      throw new UnauthorizedException('Admin access required');
    }
    return this.startAdminChallenge(user, payload.keepSignedIn ?? false);
  }

  async adminLoginVerify(payload: AdminLoginVerifyDto) {
    const challenge = await this.prisma.adminLoginChallenge.findUnique({
      where: { id: payload.challengeId },
      include: { user: true },
    });
    if (!challenge) {
      throw new UnauthorizedException('Invalid verification challenge');
    }
    if (challenge.invalidatedAt || challenge.consumedAt) {
      throw new UnauthorizedException(
        'Verification challenge is no longer valid',
      );
    }
    if (challenge.expiresAt <= new Date()) {
      throw new UnauthorizedException('Verification code has expired');
    }
    if (challenge.attempts >= this.adminOtpMaxAttempts) {
      await this.prisma.adminLoginChallenge.update({
        where: { id: challenge.id },
        data: { invalidatedAt: new Date() },
      });
      throw new UnauthorizedException('Too many invalid verification attempts');
    }
    const hashed = this.hashAdminOtp(payload.code);
    if (hashed !== challenge.codeHash) {
      const nextAttempts = challenge.attempts + 1;
      await this.prisma.adminLoginChallenge.update({
        where: { id: challenge.id },
        data: {
          attempts: nextAttempts,
          invalidatedAt:
            nextAttempts >= this.adminOtpMaxAttempts ? new Date() : null,
        },
      });
      throw new UnauthorizedException('Invalid verification code');
    }
    if (!this.isAdminRole(challenge.user.role)) {
      throw new UnauthorizedException('Admin access required');
    }
    await this.prisma.adminLoginChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
    const keepSignedIn = payload.keepSignedIn ?? challenge.keepSignedIn;
    return this.issueTokensForUser(challenge.user, keepSignedIn);
  }

  async adminLoginResend(payload: AdminLoginResendDto) {
    const challenge = await this.prisma.adminLoginChallenge.findUnique({
      where: { id: payload.challengeId },
      include: { user: true },
    });
    if (!challenge) {
      throw new UnauthorizedException('Invalid verification challenge');
    }
    if (challenge.invalidatedAt || challenge.consumedAt) {
      throw new UnauthorizedException(
        'Verification challenge is no longer valid',
      );
    }
    const now = new Date();
    const cooldownMs = this.adminOtpResendCooldownSeconds * 1000;
    if (now.getTime() - challenge.createdAt.getTime() < cooldownMs) {
      throw new BadRequestException(
        `Please wait ${this.adminOtpResendCooldownSeconds} seconds before requesting another code.`,
      );
    }
    if (!this.isAdminRole(challenge.user.role)) {
      throw new UnauthorizedException('Admin access required');
    }
    await this.prisma.adminLoginChallenge.update({
      where: { id: challenge.id },
      data: { invalidatedAt: now },
    });
    return this.startAdminChallenge(challenge.user, challenge.keepSignedIn);
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: { emailVerificationToken: token },
    });
    if (!user) {
      throw new BadRequestException('Invalid or expired verification link');
    }
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
      },
    });
    return this.issueTokensForUser(updated);
  }

  async resendVerification(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    if (user.emailVerifiedAt) {
      return { success: true, message: 'Email is already verified.' };
    }
    const emailVerificationToken = randomBytes(32).toString('hex');
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerificationToken },
    });
    const verificationSender =
      user.role === 'MERCHANT'
        ? this.notifications.sendMerchantEmailVerification.bind(
            this.notifications,
          )
        : this.notifications.sendStorefrontEmailVerification.bind(
            this.notifications,
          );
    await verificationSender({
      email: user.email,
      firstName: user.firstName,
      token: emailVerificationToken,
    });
    return { success: true, message: 'Verification email sent.' };
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const generic =
      'If this email exists, a password reset code has been sent.';
    if (!user || !user.isActive || user.isBlocked || user.isBlacklisted) {
      return { success: true, message: generic };
    }
    const now = new Date();
    await this.prisma.passwordResetOtp.updateMany({
      where: {
        userId: user.id,
        consumedAt: null,
        invalidatedAt: null,
        expiresAt: { gt: now },
      },
      data: { invalidatedAt: now },
    });
    const code = this.generateAdminOtpCode();
    await this.prisma.passwordResetOtp.create({
      data: {
        userId: user.id,
        codeHash: this.hashOtp(code, 'PASSWORD_RESET_OTP_SECRET'),
        expiresAt: new Date(
          now.getTime() + this.passwordResetOtpExpiresMinutes * 60 * 1000,
        ),
      },
    });
    await this.notifications.sendPasswordResetOtp({
      email: user.email,
      firstName: user.firstName,
      code,
      expiresInMinutes: this.passwordResetOtpExpiresMinutes,
    });
    return { success: true, message: generic };
  }

  async confirmPasswordReset(payload: PasswordResetConfirmDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: payload.email },
    });
    if (!user || !user.isActive || user.isBlocked || user.isBlacklisted) {
      throw new UnauthorizedException('Invalid or expired reset code');
    }
    const challenge = await this.prisma.passwordResetOtp.findFirst({
      where: {
        userId: user.id,
        consumedAt: null,
        invalidatedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge || challenge.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid or expired reset code');
    }
    if (challenge.attempts >= this.passwordResetOtpMaxAttempts) {
      await this.prisma.passwordResetOtp.update({
        where: { id: challenge.id },
        data: { invalidatedAt: new Date() },
      });
      throw new UnauthorizedException('Too many invalid reset attempts');
    }
    const hashed = this.hashOtp(payload.code, 'PASSWORD_RESET_OTP_SECRET');
    if (hashed !== challenge.codeHash) {
      const nextAttempts = challenge.attempts + 1;
      await this.prisma.passwordResetOtp.update({
        where: { id: challenge.id },
        data: {
          attempts: nextAttempts,
          invalidatedAt:
            nextAttempts >= this.passwordResetOtpMaxAttempts
              ? new Date()
              : null,
        },
      });
      throw new UnauthorizedException('Invalid or expired reset code');
    }
    const passwordHash = await argon2.hash(payload.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          mustChangePassword: false,
          passwordSetAt: new Date(),
        },
      }),
      this.prisma.passwordResetOtp.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      }),
    ]);
    return { success: true, message: 'Password reset successful.' };
  }

  async changePassword(userId: string, payload: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    const valid = await argon2.verify(
      user.passwordHash,
      payload.currentPassword,
    );
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const passwordHash = await argon2.hash(payload.newPassword);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: false,
        passwordSetAt: new Date(),
      },
    });
    return this.issueTokensForUser(updated);
  }

  async getMe(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        emailVerifiedAt: true,
        mustChangePassword: true,
      },
    });
    if (!u) {
      throw new UnauthorizedException();
    }
    return {
      sub: u.id,
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      phone: u.phone,
      emailVerified: u.emailVerifiedAt != null,
      mustChangePassword: u.mustChangePassword,
    };
  }

  private isAdminRole(role: UserRole) {
    return role === 'ADMIN' || role === 'SUPER_ADMIN';
  }

  private generateAdminOtpCode() {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private hashAdminOtp(code: string) {
    return this.hashOtp(code, 'ADMIN_LOGIN_OTP_SECRET');
  }

  private hashOtp(code: string, envKey: string) {
    const secretSeed =
      this.configService.get<string>(envKey) ??
      this.configService.get<string>('JWT_ACCESS_SECRET') ??
      'sexxymarket-otp';
    return createHash('sha256').update(`${code}:${secretSeed}`).digest('hex');
  }

  private async startAdminChallenge(user: User, keepSignedIn: boolean) {
    if (!this.isAdminRole(user.role)) {
      throw new UnauthorizedException('Admin access required');
    }
    const now = new Date();
    await this.prisma.adminLoginChallenge.updateMany({
      where: {
        userId: user.id,
        consumedAt: null,
        invalidatedAt: null,
        expiresAt: { gt: now },
      },
      data: { invalidatedAt: now },
    });
    const code = this.generateAdminOtpCode();
    const challenge = await this.prisma.adminLoginChallenge.create({
      data: {
        userId: user.id,
        codeHash: this.hashAdminOtp(code),
        expiresAt: new Date(
          now.getTime() + this.adminOtpExpiresMinutes * 60 * 1000,
        ),
        keepSignedIn,
      },
    });
    try {
      await this.notifications.sendAdminLoginVerificationCode({
        email: user.email,
        firstName: user.firstName,
        code,
        expiresInMinutes: this.adminOtpExpiresMinutes,
      });
    } catch (err) {
      await this.prisma.adminLoginChallenge.delete({
        where: { id: challenge.id },
      });
      throw err;
    }
    return {
      requiresVerification: true,
      challengeId: challenge.id,
      expiresAt: challenge.expiresAt,
      message: 'Verification code sent to your email.',
    };
  }

  private issueTokensForUser(user: User, keepSignedIn = false) {
    return this.issueTokens({
      id: user.id,
      role: user.role,
      email: user.email,
      emailVerified: user.emailVerifiedAt != null,
      mustChangePassword: user.mustChangePassword,
      keepSignedIn,
    });
  }

  private issueTokens(args: {
    id: string;
    role: UserRole;
    email: string;
    emailVerified: boolean;
    mustChangePassword: boolean;
    keepSignedIn: boolean;
  }) {
    const tokenPayload = {
      sub: args.id,
      role: args.role,
      email: args.email,
      ev: args.emailVerified,
      mcp: args.mustChangePassword,
    };
    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET');
    if (!accessSecret) {
      throw new InternalServerErrorException(
        'JWT_ACCESS_SECRET is not configured',
      );
    }
    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ?? accessSecret;
    const accessToken = this.jwtService.sign(
      {
        sub: args.id,
        role: args.role,
        email: args.email,
        ev: args.emailVerified,
        mcp: args.mustChangePassword,
      },
      { expiresIn: '30m', secret: accessSecret },
    );
    const refreshToken = this.jwtService.sign(
      {
        sub: args.id,
        role: args.role,
        email: args.email,
        ev: args.emailVerified,
        mcp: args.mustChangePassword,
      },
      { expiresIn: args.keepSignedIn ? '90d' : '30d', secret: refreshSecret },
    );

    return {
      accessToken,
      refreshToken,
      keepSignedIn: args.keepSignedIn,
      user: {
        id: args.id,
        role: args.role,
        email: args.email,
        emailVerified: args.emailVerified,
        mustChangePassword: args.mustChangePassword,
      },
    };
  }
}
