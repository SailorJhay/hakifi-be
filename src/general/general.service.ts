import { Injectable } from '@nestjs/common';
import { InsuranceSide, InsuranceState, Prisma } from '@prisma/client';
import { PrismaService } from 'nestjs-prisma';

@Injectable()
export class GeneralService {
  constructor(private readonly prismaService: PrismaService) {}

  async getStats() {
    const [totalUsers, resultCommon] = await Promise.all([
      this.prismaService.user.count(),
      this.prismaService.insurance.aggregate({
        where: {
          state: { not: InsuranceState.INVALID },
        },
        _sum: {
          q_covered: true,
        },
        _count: true,
      }),
    ]);

    const totalPayback: any = await this.prismaService.insurance.aggregateRaw({
      pipeline: [
        {
          $match: {
            state: {
              $in: [
                InsuranceState.CLAIMED,
                InsuranceState.CLAIM_WAITING,
                InsuranceState.REFUNDED,
                InsuranceState.REFUND_WAITING,
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      '$state',
                      [InsuranceState.CLAIM_WAITING, InsuranceState.CLAIMED],
                    ],
                  },
                  '$q_claim',
                  '$margin',
                ],
              },
            },
          },
        },
      ],
    });

    return {
      totalUsers,
      totalContracts: resultCommon._count,
      totalQCovered: resultCommon._sum.q_covered,
      totalPayback: totalPayback[0]?.total ?? 0,
    };
  }

  async getTransactions() {
    const select: Prisma.InsuranceSelect = {
      id: true,
      state: true,
      side: true,
      asset: true,
      unit: true,
      txhash: true,
      stateLogs: true,
      q_claim: true,
      margin: true,
      closedAt: true,
      createdAt: true,
      updatedAt: true,
    };
    const listBullInsurances = await this.prismaService.insurance.findMany({
      where: {
        state: {
          not: InsuranceState.INVALID,
        },
        side: InsuranceSide.BULL,
      },
      orderBy: {
        updatedAt: Prisma.SortOrder.desc,
      },
      take: 20,
      select,
    });

    const listBearInsurances = await this.prismaService.insurance.findMany({
      where: {
        state: {
          not: InsuranceState.INVALID,
        },
        side: InsuranceSide.BEAR,
      },
      orderBy: {
        updatedAt: Prisma.SortOrder.desc,
      },
      take: 20,
      select,
    });

    return {
      listBullInsurances,
      listBearInsurances,
    };
  }

  async getSmartContractStats() {
    const sumResult = await this.prismaService.insurance.aggregate({
      where: {
        state: InsuranceState.AVAILABLE,
      },
      _sum: {
        q_claim: true,
        margin: true,
      },
    });

    const q_refund = await this.prismaService.insurance.aggregate({
      where: {
        state: InsuranceState.REFUND_WAITING,
      },
      _sum: {
        margin: true,
      },
    });

    const q_claim = await this.prismaService.insurance.aggregate({
      where: {
        state: InsuranceState.REFUND_WAITING,
      },
      _sum: {
        q_claim: true,
      },
    });

    return {
      claimPool: sumResult._sum.q_claim ?? 0,
      marginPool: sumResult._sum.margin ?? 0,
      hakifiFund: 0,
      scilabsFund: 0,
      q_refund: q_refund._sum.margin ?? 0,
      q_claim: q_claim._sum.q_claim ?? 0,
    };
  }
}
