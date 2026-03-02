import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getStats() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [sessionsByStatus, messagesToday, handoffsCount, stopListCount, managersCount, pendingOffHours] =
      await Promise.all([
        this.prisma.leadSession.groupBy({
          by: ['status'],
          _count: { id: true },
        }),
        this.prisma.message.count({ where: { createdAt: { gte: todayStart } } }),
        this.prisma.handoffAssignment.count(),
        this.prisma.stopList.count(),
        this.prisma.manager.count({ where: { active: true } }),
        this.prisma.offHoursQueue.count({ where: { status: 'PENDING' } }),
      ]);

    const statusCounts: Record<string, number> = {};
    for (const row of sessionsByStatus) {
      statusCounts[row.status] = row._count.id;
    }

    return {
      sessionsByStatus: statusCounts,
      totalSessions: Object.values(statusCounts).reduce((a, b) => a + b, 0),
      messagesToday,
      handoffsCount,
      stopListCount,
      managersCount,
      pendingOffHours,
    };
  }
}
