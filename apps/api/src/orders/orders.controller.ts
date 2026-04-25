import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  async create(
    @Body() payload: CreateOrderDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.ordersService.createOrder(payload, user?.sub);
  }

  /**
   * Public: load receipt / order line items after payment redirect (by Flutterwave tx_ref).
   */
  @Get('receipt')
  @Throttle({ default: { limit: 45, ttl: 60_000 } })
  getPublicReceipt(@Query('txRef') txRef: string) {
    const t = (txRef ?? '').trim();
    if (!t) {
      throw new BadRequestException('txRef is required');
    }
    return this.ordersService.getPublicReceiptByTxRef(t);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  listMine(
    @CurrentUser() user: AuthUser,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ordersService.listOrdersForUser(user.sub, {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  listAll(@Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    return this.ordersService.listAllOrders({
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
