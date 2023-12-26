import { ApiPropertyOptional } from '@nestjs/swagger';
import { InsuranceState } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsBooleanString, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dtos/pagination-query.dto';

export class ListInsuranceQueryDto extends PaginationQueryDto {
  userId: string;

  @ApiPropertyOptional({
    enum: InsuranceState,
    default: InsuranceState.AVAILABLE,
  })
  @IsOptional()
  @IsEnum(InsuranceState)
  state?: InsuranceState

  @ApiPropertyOptional({
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  isClosed?: boolean;
}
