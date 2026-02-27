import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StopListAddedBy } from '@prisma/client';

@Injectable()
export class StopListService {
  constructor(private readonly prisma: PrismaService) {}

  async isInStopList(phone: string): Promise<boolean> {
    const normalized = this.normalizePhone(phone);
    const entry = await this.prisma.stopList.findUnique({
      where: { phone: normalized },
    });
    return !!entry;
  }

  async add(phone: string, reason: string, addedBy: StopListAddedBy, leadSessionId?: string) {
    const normalized = this.normalizePhone(phone);
    return this.prisma.stopList.upsert({
      where: { phone: normalized },
      update: { reason, addedBy },
      create: { phone: normalized, reason, addedBy, leadSessionId },
    });
  }

  async remove(phone: string) {
    const normalized = this.normalizePhone(phone);
    return this.prisma.stopList.deleteMany({ where: { phone: normalized } });
  }

  async findAll() {
    return this.prisma.stopList.findMany({ orderBy: { createdAt: 'desc' } });
  }

  normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 10) {
      const rest = digits.slice(-10);
      return '+7' + rest;
    }
    return phone;
  }
}
