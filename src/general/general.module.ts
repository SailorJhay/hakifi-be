import { Module } from '@nestjs/common';
import { GeneralService } from './general.service';
import { GeneralController } from './general.controller';
import { InsurancesModule } from 'src/insurances/insurances.module';

@Module({
  imports: [InsurancesModule],
  controllers: [GeneralController],
  providers: [GeneralService],
})
export class GeneralModule {}
