export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly timestamp: string;

  constructor(
    message: string,
    code: string = 'UNKNOWN_ERROR',
    statusCode: number = 500,
    isOperational: boolean = true,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();

    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class NetworkError extends AppError {
  constructor(message: string = '网络请求失败') {
    super(message, 'NETWORK_ERROR', 0, true);
    this.name = 'NetworkError';
  }
}

export class AuthError extends AppError {
  constructor(message: string = '认证失败') {
    super(message, 'AUTH_ERROR', 401, true);
    this.name = 'AuthError';
  }
}

export class PermissionError extends AppError {
  constructor(message: string = '权限不足') {
    super(message, 'PERMISSION_ERROR', 403, true);
    this.name = 'PermissionError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = '资源未找到') {
    super(message, 'NOT_FOUND', 404, true);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string = '数据验证失败') {
    super(message, 'VALIDATION_ERROR', 400, true);
    this.name = 'ValidationError';
  }
}

type ErrorContext = {
  component?: string;
  action?: string;
  userId?: string;
  [key: string]: unknown;
};

export function handleError(error: unknown, context?: ErrorContext): AppError {
  if (error instanceof AppError) {
    logError(error, context);
    return error;
  }

  if (error instanceof Error) {
    const appError = new AppError(
      error.message,
      'RUNTIME_ERROR',
      500,
      false,
    );
    appError.stack = error.stack;
    logError(appError, context);
    return appError;
  }

  const appError = new AppError(
    typeof error === 'string' ? error : '未知错误',
    'UNKNOWN_ERROR',
    500,
    false,
  );
  logError(appError, context);
  return appError;
}

function logError(error: AppError, context?: ErrorContext): void {
  const logData = {
    name: error.name,
    message: error.message,
    code: error.code,
    statusCode: error.statusCode,
    isOperational: error.isOperational,
    timestamp: error.timestamp,
    ...context,
  };

  if (error.isOperational) {
    console.warn('[AppError]', logData);
  } else {
    console.error('[AppError]', logData, error.stack);
  }
}

export function getUserMessage(error: unknown): string {
  if (error instanceof AppError) {
    if (error.isOperational) {
      return error.message;
    }
    return '系统异常，请稍后重试';
  }

  if (error instanceof Error) {
    return error.message || '操作失败，请稍后重试';
  }

  return '未知错误，请稍后重试';
}
