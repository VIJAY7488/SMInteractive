import { ErrorCodeEnum, ErrorCodeEnumType } from '../enums/error-code.enum';
import { HTTPSTATUS, HttpStatusCodeType } from '../config/http.config';
import { http } from 'winston';

export class AppError extends Error {
  public statusCode: HttpStatusCodeType;
  public errorCode?: ErrorCodeEnumType;

  constructor(
    message: string,
    statusCode = HTTPSTATUS.INTERNAL_SERVER_ERROR,
    errorCode?: ErrorCodeEnumType,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class HttpException extends AppError {
  constructor(
    message = 'Http Exception Error',
    statusCode: HttpStatusCodeType,
    errorCode?: ErrorCodeEnumType,
  ) {
    super(message, statusCode, errorCode);
  }
}

export class InternalServerException extends AppError {
  constructor(
    message = 'Internal Server Error',
    errorCode?: ErrorCodeEnumType,
  ) {
    super(
      message,
      HTTPSTATUS.INTERNAL_SERVER_ERROR,
      errorCode || ErrorCodeEnum.INTERNAL_SERVER_ERROR,
    );
  }
}

export class NotFoundException extends AppError {
  constructor(message = 'Resource not found', errorCode?: ErrorCodeEnumType) {
    super(
      message,
      HTTPSTATUS.NOT_FOUND,
      errorCode || ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }
}

export class BadRequestException extends AppError {
  constructor(message = 'Bad Request', errorCode?: ErrorCodeEnumType) {
    super(
      message,
      HTTPSTATUS.BAD_REQUEST,
      errorCode || ErrorCodeEnum.VALIDATION_ERROR,
    );
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, HTTPSTATUS.BAD_REQUEST, ErrorCodeEnum.VALIDATION_ERROR);
  }
}


export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, HTTPSTATUS.UNAUTHORIZED, ErrorCodeEnum.AUTH_UNAUTHORIZED_ACCESS);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'You do not have permission to perform this action') {
    super(message, HTTPSTATUS.FORBIDDEN, ErrorCodeEnum.ACCESS_UNAUTHORIZED);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, HTTPSTATUS.NOT_FOUND, ErrorCodeEnum.RESOURCE_NOT_FOUND);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, HTTPSTATUS.CONFLICT, ErrorCodeEnum.CONFLICT_ERROR);
  }
}

export class InsufficientCoinsError extends AppError {
  constructor(required: number, available: number) {
    super(
      `Insufficient coins. Required: ${required}, Available: ${available}`,
      HTTPSTATUS.BAD_REQUEST,
      ErrorCodeEnum.INSUFFICIENT_COINS
    );
  }
}

export class SpinWheelError extends AppError {
  constructor(message: string) {
    super(message, HTTPSTATUS.BAD_REQUEST, ErrorCodeEnum.SPIN_WHEEL_ERROR);
  }
}

export class ConcurrencyError extends AppError {
  constructor(message: string = 'Concurrent operation conflict') {
    super(message, HTTPSTATUS.CONFLICT, ErrorCodeEnum.CONCURRENCY_ERROR);
  }
}