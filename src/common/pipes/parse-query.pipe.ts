import { PipeTransform, ArgumentMetadata } from '@nestjs/common';
import { PaginationQueryDto } from '../dtos/pagination-query.dto';

export class PaginationQueryPipeTransform implements PipeTransform {
  transform(
    query: PaginationQueryDto,
    metadata: ArgumentMetadata,
  ): PaginationQueryDto {
    if (query.limit && query.page) {
      query.skip = (query.page - 1) * query.limit;
    }
    return query;
  }
}
