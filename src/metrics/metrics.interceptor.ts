import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { MetricsService } from './metrics.service';

/**
 * MetricsInterceptor
 *
 * Globally records HTTP request throughput and latency for every endpoint.
 *
 * Labels are:
 *   method      — HTTP verb (GET, POST, …)
 *   route       — Parameterised route path (/clips/:id, not /clips/42)
 *                 Falls back to the raw URL if no route is matched.
 *   status_code — HTTP response status code
 *
 * Registered in main.ts via `app.useGlobalInterceptors(app.get(MetricsInterceptor))`.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startMs = Date.now();
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();

    return next.handle().pipe(
      tap({
        next: () => this.record(http.getResponse<Response>(), req, startMs),
        error: () => this.record(http.getResponse<Response>(), req, startMs),
      }),
    );
  }

  private record(res: Response, req: Request, startMs: number): void {
    const durationSeconds = (Date.now() - startMs) / 1000;
    const method = req.method ?? 'UNKNOWN';
    // Use the NestJS matched route pattern when available (strips dynamic segments)
    const route: string =
      (req as any).route?.path ??
      req.path ??
      req.url ??
      'unknown';
    const statusCode = res.statusCode ?? 0;

    this.metricsService.observeHttpDuration(method, route, statusCode, durationSeconds);
  }
}
