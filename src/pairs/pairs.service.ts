import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { ListPairQueryDto } from './dto/token-query.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class PairsService {
  constructor(private readonly prismaService: PrismaService) {}

  async findAll(query: ListPairQueryDto) {
    const where: Prisma.PairWhereInput = {};
    const orderBy: Prisma.PairOrderByWithAggregationInput[] = [
      { isHot: Prisma.SortOrder.desc },
      { symbol: Prisma.SortOrder.asc },
    ];

    if (query.q) {
      where.symbol = {
        contains: query.q,
        mode: 'insensitive',
      };
    }

    const [total, rows] = await Promise.all([
      this.prismaService.pair.count({ where, orderBy }),
      this.prismaService.pair.findMany({
        skip: query.skip,
        take: query.limit,
        where,
        include: {
          token: {
            select: {
              attachment: true,
              id: true,
              decimals: true,
            },
          },
        },
        orderBy,
      }),
    ]);

    return {
      rows,
      total,
    };
  }

  async findOne(symbol: string) {
    symbol = symbol.trim().toUpperCase();

    const pair = await this.prismaService.pair.findUnique({
      where: { symbol },
      include: {
        token: {
          select: {
            id: true,
            symbol: true,
            attachment: true,
            decimals: true,
          },
        },
        config: {
          select: {
            listDayChangeRatio: true,
            listHourChangeRatio: true,
          },
        },
      },
    });

    if (!pair) {
      throw new NotFoundException('Symbol not found');
    }

    if (!pair.config) {
      throw new BadRequestException('Config for this pair is not found');
    }

    pair.config.listDayChangeRatio = pair.config.listDayChangeRatio.slice(
      0,
      15,
    );

    return pair;
  }
}
