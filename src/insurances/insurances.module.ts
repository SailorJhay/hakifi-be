import { Module } from '@nestjs/common';
import { InsurancesService } from './insurances.service';
import { InsurancesController } from './insurances.controller';
import { InsuranceHelper } from './insurance.helper';
import { InsuranceContractService } from './insurance-contract.service';
import { InsuranceSchedule } from './insurances.schedule';
import { PriceModule } from 'src/price/price.module';

@Module({
  imports: [PriceModule],
  controllers: [InsurancesController],
  providers: [
    InsurancesService,
    InsuranceHelper,
    InsuranceContractService,
    InsuranceSchedule,
  ],
  exports: [InsurancesService, InsuranceContractService],
})
export class InsurancesModule {}
