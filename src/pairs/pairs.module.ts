import { Module } from '@nestjs/common';
import { PairsService } from './pairs.service';
import { PairsController } from './pairs.controller';
import { PairsSchedule } from './pairs.schedule';

@Module({
  controllers: [PairsController],
  providers: [PairsService, PairsSchedule],
})
export class PairsModule {}
