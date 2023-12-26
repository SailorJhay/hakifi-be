import { Injectable, OnModuleInit } from '@nestjs/common';
import Binance, { Ticker } from 'binance-api-node';
import { PrismaService } from 'nestjs-prisma';
import { CheckPrice, SymbolStreamPrice } from './type';
import { diff } from 'src/common/helpers/utils';

@Injectable()
export class PriceService implements OnModuleInit {
  private binance = Binance();
  private priceStreams = new Map<string, SymbolStreamPrice>();

  constructor(private readonly prismaService: PrismaService) {}

  onModuleInit() {
    this.startAllSymbolTickerStreams();
  }

  private async startAllSymbolTickerStreams() {
    const symbols = await this.prismaService.pair.findMany({
      where: {
        isActive: true,
      },
      select: {
        symbol: true,
      },
    });

    symbols.forEach((symbol) => {
      this.startSymbolTickerStream(symbol.symbol);
    });
  }

  public async startSymbolTickerStream(symbol: string) {
    const close = this.binance.ws.futuresTicker(
      symbol,
      this.updateTickerPrice.bind(this),
    );
    if (this.priceStreams.has(symbol)) {
      this.closeSymbolTickerStream(symbol);
    }

    this.priceStreams.set(symbol, {
      closeStream: close,
      checkPrices: [],
      lastPrice: 0,
      symbol,
      updateTime: 0,
    });
  }

  private updateTickerPrice(ticker: Ticker) {
    const priceStream = this.priceStreams.get(ticker.symbol);

    if (!priceStream) return;

    const lastPrice = parseFloat(ticker.curDayClose);
    priceStream.lastPrice = lastPrice;
    priceStream.updateTime = ticker.eventTime;
    priceStream.checkPrices.push({
      p: lastPrice,
      t: ticker.eventTime,
    });
    if (priceStream.checkPrices.length > 1000) {
      priceStream.checkPrices.shift();
    }
  }

  public async closeSymbolTickerStream(symbol: string) {
    const stream = this.priceStreams.get(symbol);
    if (!stream) return;

    stream.closeStream();
    this.priceStreams.delete(symbol);
  }

  public async getFuturePrice(symbol: string): Promise<number> {
    const stream = this.priceStreams.get(symbol);

    if (stream && diff(stream.updateTime, Date.now()) < 10000) {
      return stream.lastPrice;
    }

    const prices = await this.binance.futuresPrices({ symbol });
    if (!prices[symbol]) throw new Error(`Invalid symbol (${symbol})`);

    return parseFloat(prices[symbol]);
  }

  public getCheckPrices(symbols: string[]) {
    const checkPricesMap = new Map<string, CheckPrice[]>();
    symbols.forEach((symbol) => {
      checkPricesMap.set(
        symbol,
        this.priceStreams.get(symbol)?.checkPrices.concat() || [],
      );
    });
    return checkPricesMap;
  }

  public async resetAllCheckPrices() {
    this.priceStreams.forEach((stream) => {
      stream.checkPrices = [];
    });
  }
}
