import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  BadRequestException,
  Query,
  Put,
} from '@nestjs/common';
import { InsurancesService } from './insurances.service';
import { CreateInsuranceDto } from './dto/create-insurance.dto';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UserAuthRequest } from 'src/common/types/request.type';
import { ParseObjectIdPipe } from 'src/common/pipes/parse-object-id.pipe';
import { ListInsuranceQueryDto } from './dto/query-insurance.dto';

@Controller('insurances')
@UseGuards(JwtAuthGuard)
@ApiTags('Insurances')
export class InsurancesController {
  constructor(private readonly insurancesService: InsurancesService) {}

  @Post()
  create(
    @Req() req: UserAuthRequest,
    @Body() createInsuranceDto: CreateInsuranceDto,
  ) {
    return this.insurancesService.create(req.user.id, createInsuranceDto);
  }

  @Get()
  findAll(@Req() req: UserAuthRequest, @Query() query: ListInsuranceQueryDto) {
    query.userId = req.user.id;
    return this.insurancesService.findAll(query);
  }

  @Get(':id')
  async findOne(
    @Req() req: UserAuthRequest,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    const insurance = await this.insurancesService.findOne(id, req.user.id);
    if (!insurance) {
      throw new BadRequestException('Insurance not found');
    }
    return insurance;
  }

  @Get(':id/contract')
  getInsuranceContract(@Param('id', ParseObjectIdPipe) id: string) {
    return this.insurancesService.getInsuranceContract(id);
  }

  @Put(':id/cancel')
  update(
    @Req() req: UserAuthRequest,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.insurancesService.cancelInsurance(req.user.id, id);
  }

  // For Testing Purpose
  @Get('pclaim-distances/:symbol')
  @ApiParam({ name: 'symbol', example: 'BNBUSDT' })
  getCurrentDistancePClaim(@Param('symbol') symbol: string) {
    return this.insurancesService.getCurrentDistancePClaim(symbol);
  }
}
