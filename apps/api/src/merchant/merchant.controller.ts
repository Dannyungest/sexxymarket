import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MerchantService } from './merchant.service';
import { CreateMerchantProfileDto } from './dto/create-merchant-profile.dto';
import { SubmitVerificationDto } from './dto/submit-verification.dto';
import { ReviewVerificationDto } from './dto/review-verification.dto';
import { ResolveBankAccountDto } from './dto/resolve-bank-account.dto';
import { SetPayoutAccountDto } from './dto/set-payout-account.dto';
import { StartPayoutAccountSetupDto } from './dto/start-payout-account-setup.dto';
import { ConfirmPayoutAccountSetupDto } from './dto/confirm-payout-account-setup.dto';
import { CreateSupportMessageDto } from './dto/create-support-message.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';

@Controller('merchant')
export class MerchantController {
  constructor(private readonly merchantService: MerchantService) {}

  @Post('apply')
  @UseGuards(JwtAuthGuard)
  apply(
    @CurrentUser() user: AuthUser,
    @Body() payload: CreateMerchantProfileDto,
  ) {
    return this.merchantService.apply(user.sub, payload);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MERCHANT')
  getProfile(@CurrentUser() user: AuthUser) {
    return this.merchantService.getProfile(user.sub);
  }

  @Get('kyc-documents/:documentId/file')
  @UseGuards(JwtAuthGuard)
  streamKycDocument(
    @CurrentUser() user: AuthUser,
    @Param('documentId') documentId: string,
  ) {
    return this.merchantService.streamKycDocumentFile(user, documentId);
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MERCHANT')
  orders(
    @CurrentUser() user: AuthUser,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.merchantService.listOrders(user.sub, {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('banks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MERCHANT')
  listBanks() {
    return this.merchantService.listSupportedBanks();
  }

  @Post('payout-account/resolve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MERCHANT')
  resolvePayoutAccount(@Body() payload: ResolveBankAccountDto) {
    return this.merchantService.resolvePayoutAccount(payload);
  }

  @Put('payout-account')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MERCHANT')
  setPayoutAccount(
    @CurrentUser() user: AuthUser,
    @Body() payload: SetPayoutAccountDto,
  ) {
    return this.merchantService.setPayoutAccount(user.sub, payload);
  }

  @Post('payout-account/start')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MERCHANT')
  startPayoutAccountSetup(
    @CurrentUser() user: AuthUser,
    @Body() payload: StartPayoutAccountSetupDto,
  ) {
    return this.merchantService.startPayoutAccountSetup(user.sub, payload);
  }

  @Post('payout-account/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MERCHANT')
  confirmPayoutAccountSetup(
    @CurrentUser() user: AuthUser,
    @Body() payload: ConfirmPayoutAccountSetupDto,
  ) {
    return this.merchantService.confirmPayoutAccountSetup(user.sub, payload);
  }

  @Patch('payout-account/remove')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MERCHANT')
  removePayoutAccount(@CurrentUser() user: AuthUser) {
    return this.merchantService.removePayoutAccount(user.sub);
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  pending(@Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    return this.merchantService.listPending({
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  approve(@Param('id') id: string) {
    return this.merchantService.approve(id);
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  reject(@Param('id') id: string) {
    return this.merchantService.reject(id);
  }

  @Post('verification')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MERCHANT')
  submitVerification(
    @CurrentUser() user: AuthUser,
    @Body() payload: SubmitVerificationDto,
  ) {
    return this.merchantService.submitVerification(
      user.sub,
      payload,
      payload.documents,
    );
  }

  @Patch('verification/:id/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  reviewVerification(
    @Param('id') id: string,
    @Body() payload: ReviewVerificationDto,
  ) {
    return this.merchantService.reviewVerification(id, payload);
  }

  @Post('documents/reference')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MERCHANT')
  documentReference(
    @CurrentUser() user: AuthUser,
    @Body() payload: { documentType: string; fileName: string },
  ) {
    return this.merchantService.createDocumentReference(user.sub, payload);
  }

  @Post('documents/upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MERCHANT')
  @UseInterceptors(FileInterceptor('file'))
  uploadDocumentFile(
    @CurrentUser() user: AuthUser,
    @Body() payload: { documentType: string },
    @UploadedFile()
    file?: {
      originalname: string;
      buffer: Buffer;
      mimetype?: string;
      size?: number;
    },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Document file is required.');
    }
    return this.merchantService.uploadDocumentFile(user.sub, payload, file);
  }

  @Post('support/messages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MERCHANT')
  createSupportMessage(
    @CurrentUser() user: AuthUser,
    @Body() payload: CreateSupportMessageDto,
  ) {
    return this.merchantService.createSupportMessage(user.sub, payload);
  }

  @Get('support/messages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MERCHANT')
  listSupportMessages(@CurrentUser() user: AuthUser) {
    return this.merchantService.listSupportMessages(user.sub);
  }
}
