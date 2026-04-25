import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSavedRecipientDto } from './dto/create-saved-recipient.dto';

@Injectable()
export class SavedRecipientsService {
  constructor(private readonly prisma: PrismaService) {}

  listForUser(userId: string) {
    return this.prisma.savedRecipient.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createForUser(userId: string, payload: CreateSavedRecipientDto) {
    return this.prisma.savedRecipient.create({
      data: {
        userId,
        label: payload.label?.trim() || null,
        recipientName: payload.recipientName.trim(),
        recipientPhone: payload.recipientPhone.trim(),
        houseNo: payload.houseNo.trim(),
        street: payload.street.trim(),
        landmark: payload.landmark?.trim() ?? '',
        shippingState: payload.shippingState.trim(),
        shippingLga: payload.shippingLga.trim(),
        shippingCity: payload.shippingCity.trim(),
      },
    });
  }

  async removeForUser(userId: string, id: string) {
    const row = await this.prisma.savedRecipient.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException('Saved address not found');
    }
    await this.prisma.savedRecipient.delete({ where: { id } });
  }
}
