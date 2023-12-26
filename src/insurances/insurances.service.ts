import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateInsuranceDto } from './dto/create-insurance.dto';
import { PrismaService } from 'nestjs-prisma';
import { ERROR_INSURANRCE } from './constant/errors.constant';
import {
  ENUM_INSURANCE_SIDE,
  InsuranceFormula,
  PERIOD_UNIT,
} from 'hakifi-formula';
import { InsuranceHelper } from './insurance.helper';
import { InsuranceSide, InsuranceState, Prisma } from '@prisma/client';
import { InsuranceContractService } from './insurance-contract.service';
import { ListInsuranceQueryDto } from './dto/query-insurance.dto';
import { inRange } from 'src/common/helpers/utils';
import { PriceService } from 'src/price/price.service';

@Injectable()
export class InsurancesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly insuranceHelper: InsuranceHelper,
    private readonly insuranceContractService: InsuranceContractService,
    private readonly priceService: PriceService,
  ) {}

  /**
   * Creates a new insurance for a user.
   * @param userId - The ID of the user.
   * @param createInsuranceDto - The data for creating the insurance.
   * @returns The created insurance.
   * @throws BadRequestException if the symbol is invalid, the pair is not active, or the pair is under maintenance.
   * @throws BadRequestException if there is an error retrieving the current price.
   * @throws BadRequestException if the period unit is invalid.
   */
  async create(userId: string, createInsuranceDto: CreateInsuranceDto) {
    const { asset, unit, period, periodUnit, p_claim, margin, q_covered } =
      createInsuranceDto;
    const symbol = `${asset}${unit}`;
    const pair = await this.prismaService.pair.findUnique({
      where: { symbol },
      select: {
        symbol: true,
        asset: true,
        unit: true,
        isActive: true,
        isMaintain: true,
        config: {
          select: {
            listDayChangeRatio: true,
            listHourChangeRatio: true,
          },
        },
      },
    });
    if (!pair || !pair.isActive || !pair.config) {
      throw new BadRequestException(ERROR_INSURANRCE.BAD_SYMBOL);
    }

    if (pair.isMaintain) {
      throw new BadRequestException(ERROR_INSURANRCE.MAINTAINED);
    }

    let periodChangeRatio: number;
    switch (periodUnit) {
      case PERIOD_UNIT.DAY:
        periodChangeRatio = pair.config.listDayChangeRatio[period - 1];
        break;
      case PERIOD_UNIT.HOUR:
        // TODO:
        // periodChangeRatio = pair.config.listHourChangeRatio[period - 1];
        periodChangeRatio = pair.config.listDayChangeRatio[0];
        break;
      default:
        throw new BadRequestException(ERROR_INSURANRCE.BAD_PERIOD_UNIT);
    }

    let currentPrice = 0;
    try {
      currentPrice = await this.priceService.getFuturePrice(symbol);
    } catch (error) {
      throw new BadRequestException(ERROR_INSURANRCE.BAD_SYMBOL);
    }
    // set p_open with current price when create insurance
    createInsuranceDto.p_open = currentPrice;

    const listChangeRatio = pair.config.listDayChangeRatio;
    const side =
      p_claim > currentPrice ? InsuranceSide.BULL : InsuranceSide.BEAR;

    createInsuranceDto.periodChangeRatio = periodChangeRatio;
    createInsuranceDto.side = side;

    // Calculate Insurance params
    const {
      expiredAt,
      hedge,
      p_liquidation,
      q_claim,
      systemCapital,
      p_refund,
      leverage,
      p_cancel,
    } = this.insuranceHelper.calculateInsuranceParams(createInsuranceDto);

    let invalidReason: string;

    // Throw when invalid insurance
    this.insuranceHelper.validateInsurance(createInsuranceDto, listChangeRatio);

    // Create Insurance
    const insurance = await this.prismaService.insurance.create({
      data: {
        userId,
        asset,
        unit,
        margin,
        q_claim,
        q_covered,
        p_open: currentPrice,
        p_liquidation,
        p_claim,
        p_refund,
        p_cancel,
        leverage,
        periodChangeRatio,
        hedge,
        systemCapital,
        invalidReason,
        period,
        periodUnit,
        state: InsuranceState.PENDING,
        side,
        expiredAt,
      },
    });

    this.insuranceContractService.createSampleInsurance({
      id: insurance.id,
      margin: insurance.margin,
      q_claim: insurance.q_claim,
      expiredAt: insurance.expiredAt,
    });

    return insurance;
  }

  async findAll(query: ListInsuranceQueryDto) {
    const where: Prisma.InsuranceWhereInput = {
      userId: query.userId,
    };

    if (query.state) {
      where.state = query.state;
    }

    if (query.isClosed) {
      where.closedAt = { not: null };
    }

    const orderBy: Prisma.InsuranceOrderByWithRelationInput[] = [
      { createdAt: Prisma.SortOrder.desc },
      { closedAt: Prisma.SortOrder.desc },
    ];

    const [total, rows] = await Promise.all([
      this.prismaService.insurance.count({ where, orderBy }),
      this.prismaService.insurance.findMany({
        skip: query.skip,
        take: query.limit,
        where,
        orderBy,
      }),
    ]);

    return {
      total,
      rows,
    };
  }

  /**
   * Cancels an insurance for a specific user.
   *
   * @param userId - The ID of the user.
   * @param id - The ID of the insurance.
   * @returns The cancelled insurance.
   * @throws BadRequestException if the insurance is not found, or if it is not in the correct state to be cancelled.
   * @throws BadRequestException if the current price is invalid for cancellation.
   * @throws InternalServerErrorException if an error occurs while cancelling the insurance.
   */
  async cancelInsurance(userId: string, id: string) {
    const insurance = await this.prismaService.insurance.findUnique({
      where: { id, userId },
    });
    if (!insurance) {
      throw new BadRequestException('Insurance not found');
    }

    const isLocked = await this.insuranceHelper.isInsuranceLocked(id);

    if (insurance.state !== InsuranceState.AVAILABLE || isLocked) {
      throw new BadRequestException(ERROR_INSURANRCE.ERROR_CANCEL);
    }

    const symbol = `${insurance.asset}${insurance.unit}`;
    const currentPrice = await this.priceService.getFuturePrice(symbol);

    if (!currentPrice) {
      throw new BadRequestException(ERROR_INSURANRCE.INVALID_CANCLE_PRICE);
    }

    const canCancel = inRange(
      currentPrice,
      insurance.p_cancel,
      insurance.p_claim,
    );

    if (!canCancel) {
      throw new BadRequestException(ERROR_INSURANRCE.INVALID_CANCLE_PRICE);
    }
    try {
      const updatedInsurance =
        await this.insuranceContractService.cancelInsurance(
          insurance,
          currentPrice,
        );
      return updatedInsurance;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  findOne(id: string, userId: string) {
    return this.prismaService.insurance.findUnique({
      where: { id, userId },
    });
  }

  getInsuranceContract(id: string) {
    return this.insuranceContractService.getInsuranceContract(id);
  }

  // For Testing Purpose
  async getCurrentDistancePClaim(symbol: string) {
    const formula = new InsuranceFormula();
    const config = await this.prismaService.pairConfig.findUnique({
      where: { symbol },
      select: {
        listDayChangeRatio: true,
        listHourChangeRatio: true,
      },
    });
    if (!config) {
      throw new BadRequestException('Symbol not found');
    }

    const price = await this.priceService.getFuturePrice(symbol);
    if (!price) {
      throw new BadRequestException('Symbol not found');
    }

    const listChangeRatio = config.listDayChangeRatio;

    const { claim_price_max, claim_price_min } = formula.getDistancePClaim({
      p_market: price,
      current_avg: listChangeRatio[0],
      list_avg: listChangeRatio,
      side: ENUM_INSURANCE_SIDE.BEAR,
    });

    return {
      claim_price_max,
      claim_price_min,
      side: ENUM_INSURANCE_SIDE.BEAR,
      currentPrice: price,
    };
  }
}
