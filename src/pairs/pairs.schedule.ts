import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'nestjs-prisma';
import Binance, { CandleChartResult } from 'binance-api-node';
import { round, sleep } from 'src/common/helpers/utils';
import { CONFIG_HEDGE_DIFF } from './pairs.contants';

@Injectable()
export class PairsSchedule {
  private readonly logger = new Logger(PairsSchedule.name);
  private readonly binance = Binance();
  constructor(private readonly prismaService: PrismaService) {}

  @Cron('*/10 * * * *') // every 10 minutes
  async cronUpdateDayChangeRatio() {
    this.logger.log('Updating day change ratio');
    const pairs = await this.prismaService.pair.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        symbol: true,
      },
    });
    const endTime = Date.now();
    const startTime = endTime - 2 * 86400 * 1000; //last 2 days

    for (const pair of pairs) {
      let candles: CandleChartResult[] = [];
      try {
        candles = await this.binance.futuresCandles({
          interval: '8h',
          symbol: pair.symbol,
          startTime,
          endTime,
        });
      } catch (error) {
        this.logger.warn(
          `Symbol: ${pair.symbol} | futuresCandles Error: ` + error.message,
        );
        continue;
      }

      let avgChange = 0.04; // initital value

      candles.forEach((candle) => {
        const high = parseFloat(candle.high);
        const low = parseFloat(candle.low);
        const perc = (0.9 * (high - low)) / high;
        avgChange = perc > avgChange ? perc : avgChange;
      });

      const listDayChangeRatio: number[] = [];
      let prevRatio = 0;
      for (let i = 1; i <= 365; i++) {
        let ratioChange = 0;
        if (i === 1) {
          ratioChange = CONFIG_HEDGE_DIFF.D1 * avgChange;
        } else if (i <= 4) {
          ratioChange = CONFIG_HEDGE_DIFF.D2_D4 * avgChange;
        } else if (i === 5) {
          prevRatio = 0;
          ratioChange = CONFIG_HEDGE_DIFF.WEEK * avgChange;
        } else if (i <= 10) {
          ratioChange = CONFIG_HEDGE_DIFF.D6_D10 * avgChange;
        } else if (i <= 15) {
          ratioChange = CONFIG_HEDGE_DIFF.D11_D15 * avgChange;
        } else if (i <= 20) {
          ratioChange = CONFIG_HEDGE_DIFF.D16_D20 * avgChange;
        } else if (i <= 27) {
          ratioChange = CONFIG_HEDGE_DIFF.D21_D27 * avgChange;
        } else if (i <= 30) {
          ratioChange = CONFIG_HEDGE_DIFF.D28_D30 * avgChange;
        } else if (i <= 365) {
          ratioChange = CONFIG_HEDGE_DIFF.D31_D365 * avgChange;
        }
        prevRatio += ratioChange;

        listDayChangeRatio.push(round(prevRatio, 5));
      }

      try {
        this.logger.log('Updating day change ratio for ' + pair.symbol);
        await this.prismaService.pairConfig.upsert({
          where: {
            symbol: pair.symbol,
          },
          update: {
            listDayChangeRatio,
          },
          create: {
            symbol: pair.symbol,
            listDayChangeRatio,
            listHourChangeRatio: [],
          },
        });
      } catch (error) {
        this.logger.error('Update Pair Config Error: ' + error.message);
      }

      await sleep(100);
    }
  }

  //TODO: update hour change ratio
}
