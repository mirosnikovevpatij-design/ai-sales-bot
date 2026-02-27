import { Body, Controller, Param, Post } from '@nestjs/common';
import { EscalationService } from '../../escalation/escalation.service';

@Controller('admin/lead-sessions')
export class AdminEscalationController {
  constructor(private readonly escalation: EscalationService) {}

  @Post(':id/handoff')
  async handoff(
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    const managerId = await this.escalation.handoff(
      id,
      body.reason ?? 'manual_from_admin',
    );
    return { ok: true, assignedManagerId: managerId };
  }
}
