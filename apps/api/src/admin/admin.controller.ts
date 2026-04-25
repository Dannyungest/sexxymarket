import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AssignAdminRoleDto } from './dto/assign-admin-role.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateMerchantStatusDto } from './dto/update-merchant-status.dto';
import { UpdateProductAdminDto } from './dto/update-product-admin.dto';
import { UpdateUserAdminDto } from './dto/update-user-admin.dto';
import { UpdateOrderAdminDto } from './dto/update-order-admin.dto';
import { CreateManualOrderDto } from '../orders/dto/create-manual-order.dto';
import { CreateMerchantAdminDto } from './dto/create-merchant-admin.dto';
import { UpdateMerchantTierDto } from './dto/update-merchant-tier.dto';
import { UpdateMerchantBusinessTypeDto } from './dto/update-merchant-business-type.dto';
import {
  MerchantKycDocumentAppendDto,
  MerchantKycDocumentRefDto,
} from './dto/merchant-kyc-documents.dto';
import { CreateCustomerAdminDto } from './dto/create-customer-admin.dto';
import { ProductImageUploadDto } from './dto/product-image-upload.dto';
import { ProductImageUploadInitDto } from './dto/product-image-upload-init.dto';
import { ProductImageUploadCompleteDto } from './dto/product-image-upload-complete.dto';
import { RemoveAdminUserDto } from './dto/remove-admin-user.dto';
import { RemoveListingDto } from './dto/remove-listing.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  listAdmins() {
    return this.adminService.listAdmins();
  }

  @Patch('users/:id/role')
  @Roles('SUPER_ADMIN')
  updateRole(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() payload: AssignAdminRoleDto,
  ) {
    return this.adminService.assignRole(user.sub, user.role, id, payload.role);
  }

  @Post('uploads/product-image')
  getProductImageRef(@Body() body: ProductImageUploadDto) {
    return this.adminService.getProductImageUploadRef(body.fileName);
  }

  @Post('uploads/product-image/init')
  initProductImageUpload(@Body() body: ProductImageUploadInitDto) {
    return this.adminService.initProductImageUpload(
      body.fileName,
      body.mimeType,
      body.sizeBytes,
    );
  }

  @Post('uploads/product-image/complete')
  completeProductImageUpload(@Body() body: ProductImageUploadCompleteDto) {
    return this.adminService.completeProductImageUpload(body);
  }

  @Post('uploads/product-image/file')
  @UseInterceptors(FileInterceptor('file'))
  uploadProductImageFile(
    @UploadedFile()
    file?: {
      originalname: string;
      buffer: Buffer;
      mimetype?: string;
      size?: number;
    },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Image file is required.');
    }
    if (!file.mimetype?.toLowerCase().startsWith('image/')) {
      throw new BadRequestException(
        'Unsupported file type. Use an image file.',
      );
    }
    return this.adminService.uploadProductImageFile(file);
  }

  @Get('stats')
  overviewStats() {
    return this.adminService.getOverviewStats();
  }

  @Get('merchants')
  listMerchants() {
    return this.adminService.listMerchants();
  }

  @Get('merchants/:id')
  getMerchantById(@Param('id') id: string) {
    return this.adminService.getMerchantAdminDetail(id);
  }

  @Patch('merchants/:id/status')
  updateMerchantStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() payload: UpdateMerchantStatusDto,
  ) {
    return this.adminService.updateMerchantStatus(user.sub, id, payload);
  }

  @Patch('merchants/:id/tier')
  updateMerchantTier(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() payload: UpdateMerchantTierDto,
  ) {
    return this.adminService.updateMerchantTier(user.sub, id, payload);
  }

  @Patch('merchants/:id/business-type')
  updateMerchantBusinessType(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() payload: UpdateMerchantBusinessTypeDto,
  ) {
    return this.adminService.updateMerchantBusinessType(
      user.sub,
      id,
      payload.businessType,
    );
  }

  @Post('merchants/:id/kyc/document-ref')
  merchantKycDocumentRef(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: MerchantKycDocumentRefDto,
  ) {
    return this.adminService.createMerchantKycDocumentReference(
      user.sub,
      id,
      body,
    );
  }

  @Post('merchants/:id/kyc/documents')
  appendMerchantKycDocument(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: MerchantKycDocumentAppendDto,
  ) {
    return this.adminService.appendMerchantKycDocument(user.sub, id, body);
  }

  @Get('listings')
  listListings(
    @Query('q') query?: string,
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: string,
    @Query('stockState') stockState?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.adminService.listListings({
      query,
      categoryId,
      status,
      stockState,
      sort,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Patch('listings/:id')
  updateListing(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() payload: UpdateProductAdminDto,
  ) {
    return this.adminService.updateListing(user.sub, id, payload);
  }

  @Get('listings/:id')
  getListing(@Param('id') id: string) {
    return this.adminService.getListingById(id);
  }

  @Delete('listings/:id')
  removeListing(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() payload: RemoveListingDto,
  ) {
    return this.adminService.removeListing(user.sub, id, payload?.reason);
  }

  @Get('orders')
  listOrders(
    @Query('status') status?: string,
    @Query('q') query?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.adminService.listOrders({
      status,
      query,
      dateFrom,
      dateTo,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get('orders/:id')
  getOrder(@Param('id') id: string) {
    return this.adminService.getOrderById(id);
  }

  @Post('orders')
  createManualOrder(
    @CurrentUser() user: AuthUser,
    @Body() payload: CreateManualOrderDto,
  ) {
    return this.adminService.createManualOrder(user.sub, payload);
  }

  @Patch('orders/:id')
  updateOrder(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() payload: UpdateOrderAdminDto,
  ) {
    return this.adminService.updateOrder(user.sub, id, payload);
  }

  @Post('merchants')
  createMerchant(
    @CurrentUser() user: AuthUser,
    @Body() payload: CreateMerchantAdminDto,
  ) {
    return this.adminService.createMerchantByAdmin(user.sub, payload);
  }

  @Get('customers')
  listCustomers() {
    return this.adminService.listCustomers();
  }

  @Post('customers')
  createCustomer(
    @CurrentUser() user: AuthUser,
    @Body() payload: CreateCustomerAdminDto,
  ) {
    return this.adminService.createCustomerByAdmin(user.sub, payload);
  }

  @Patch('customers/:id')
  updateUser(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() payload: UpdateUserAdminDto,
  ) {
    return this.adminService.updateUser(user.sub, id, payload);
  }

  @Get('merchant-support')
  listMerchantSupportMessages() {
    return this.adminService.listMerchantSupportMessages();
  }

  @Post('users')
  @Roles('SUPER_ADMIN')
  createAdmin(
    @CurrentUser() user: AuthUser,
    @Body() payload: CreateAdminUserDto,
  ) {
    return this.adminService.createAdmin(user.sub, payload);
  }

  @Patch('users/:id/deactivate')
  @Roles('SUPER_ADMIN')
  removeAdmin(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() payload: RemoveAdminUserDto,
  ) {
    return this.adminService.removeAdmin(
      user.sub,
      user.role,
      id,
      payload.reason,
    );
  }
}
