import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponseDto } from '../dtos/api-response.dto';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        const response = context.switchToHttp().getResponse();
        const statusCode = response.statusCode;

        if (data instanceof ApiResponseDto) {
          return data;
        }

        if (statusCode === 201) {
          return ApiResponseDto.created(data, 'Created');
        }

        return ApiResponseDto.success(data, 'Success');
      }),
    );
  }
}
