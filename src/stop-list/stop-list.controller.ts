import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { StopListService } from './stop-list.service';
import { StopListAddedBy } from '@prisma/client';

@Controller('admin/stop-list')
export class StopListController {
  constructor(private readonly stopListService: StopListService) {}

  @Get()
  async list() {
    return this.stopListService.findAll();
  }

  @Post()
  async add(
    @Body() body: { phone: string; reason?: string; addedBy?: StopListAddedBy },
  ) {
    return this.stopListService.add(
      body.phone,
      body.reason ?? 'Добавлено вручную',
      body.addedBy ?? 'admin',
    );
  }

  @Delete(':phone')
  async remove(@Param('phone') phone: string) {
    await this.stopListService.remove(phone);
    return { ok: true };
  }
}
