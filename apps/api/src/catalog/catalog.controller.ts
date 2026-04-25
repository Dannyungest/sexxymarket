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
import { CatalogService } from './catalog.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Post('uploads/product-image/file')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MERCHANT', 'ADMIN', 'SUPER_ADMIN')
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
    return this.catalogService.uploadProductImageFile(file);
  }

  @Get('products')
  listProducts() {
    return this.catalogService.listProducts();
  }

  @Get('products/search')
  searchProducts(
    @Query('q') query?: string,
    @Query('categoryId') categoryId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.catalogService.searchProducts({
      query,
      categoryId,
      page,
      pageSize,
    });
  }

  @Get('categories')
  listCategories() {
    return this.catalogService.listCategories();
  }

  @Get('products/merchant/mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MERCHANT')
  listMine(@CurrentUser() user: AuthUser) {
    return this.catalogService.listMerchantProducts(user.sub);
  }

  @Post('products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MERCHANT', 'ADMIN', 'SUPER_ADMIN')
  createProduct(
    @Body() payload: CreateProductDto,
    @CurrentUser() user: AuthUser,
  ) {
    const merchantId = user.role === 'MERCHANT' ? user.sub : undefined;
    return this.catalogService.createProduct(payload, merchantId);
  }

  @Patch('products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MERCHANT', 'ADMIN', 'SUPER_ADMIN')
  updateProduct(
    @Param('id') id: string,
    @Body() payload: UpdateProductDto,
    @CurrentUser() user: AuthUser,
  ) {
    const merchantId = user.role === 'MERCHANT' ? user.sub : undefined;
    return this.catalogService.updateProduct(id, payload, merchantId);
  }

  @Post('products/readiness/preview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MERCHANT', 'ADMIN', 'SUPER_ADMIN')
  previewReadiness(
    @Body() payload: UpdateProductDto,
    @Query('currentStatus')
    currentStatus?: 'DRAFT' | 'READY_FOR_REVIEW' | 'PUBLISHED',
  ) {
    return this.catalogService.previewReadiness(payload, currentStatus);
  }

  @Patch('products/:id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MERCHANT', 'ADMIN', 'SUPER_ADMIN')
  publishProduct(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const merchantId = user.role === 'MERCHANT' ? user.sub : undefined;
    return this.catalogService.updateProduct(
      id,
      { lifecycleAction: 'PUBLISH' },
      merchantId,
    );
  }

  @Delete('products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MERCHANT', 'ADMIN', 'SUPER_ADMIN')
  deleteProduct(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const merchantId = user.role === 'MERCHANT' ? user.sub : undefined;
    return this.catalogService.deleteProduct(id, merchantId);
  }

  @Get('products/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  pendingListings() {
    return this.catalogService.listPendingListings();
  }

  @Get('products/:idOrSlug')
  productDetail(@Param('idOrSlug') idOrSlug: string) {
    return this.catalogService.getProductByIdOrSlug(idOrSlug);
  }

  @Patch('products/:id/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  reviewListing(
    @Param('id') id: string,
    @Body() payload: { decision: 'APPROVED' | 'REJECTED' },
  ) {
    return this.catalogService.reviewListing(id, payload.decision);
  }

  @Get('products/:id/revisions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MERCHANT', 'ADMIN', 'SUPER_ADMIN')
  productRevisions(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.catalogService.listProductRevisions(id, user);
  }

  @Post('products/:id/rollback')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MERCHANT', 'ADMIN', 'SUPER_ADMIN')
  rollbackProduct(
    @Param('id') id: string,
    @Body() payload: { revisionId: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalogService.rollbackProductToRevision(
      id,
      payload.revisionId,
      user,
    );
  }
}
