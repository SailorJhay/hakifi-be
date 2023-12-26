import { Controller, Get, Param, Query } from '@nestjs/common';
import { PairsService } from './pairs.service';
import { ListPairQueryDto } from './dto/token-query.dto';
import { ApiTags } from '@nestjs/swagger';
import { ParseObjectIdPipe } from 'src/common/pipes/parse-object-id.pipe';

@Controller('pairs')
@ApiTags('Pairs')
export class PairsController {
  constructor(private readonly pairsService: PairsService) {}

  @Get()
  findAll(@Query() query: ListPairQueryDto) {
    return this.pairsService.findAll(query);
  }

  @Get(':symbol')
  findOne(@Param('symbol') symbol: string) {
    return this.pairsService.findOne(symbol);
  }
}
