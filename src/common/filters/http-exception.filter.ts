import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ method?: string; url?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as { message: string | string[] }).message ||
            exception.message;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      this.logger.error(
        `Prisma ${exception.code}: ${exception.message} meta=${JSON.stringify(exception.meta)}`,
        exception.stack,
      );
    } else if (exception instanceof Error) {
      this.logger.error(
        `${request.method ?? '?'} ${request.url ?? '?'} — ${exception.message}`,
        exception.stack,
      );
    } else {
      this.logger.error(
        `${request.method ?? '?'} ${request.url ?? '?'} — unhandled exception`,
        String(exception),
      );
    }

    response.status(status).json({
      success: false,
      error: {
        statusCode: status,
        message,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
