import { Request, Response, NextFunction } from 'express';

const SLOW_REQUEST_THRESHOLD_MS = 1000;

export function requestLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const isTest = process.env.NODE_ENV === 'test';
  const verboseTestLogging = process.env.DEBUG_INTEGRATION === '1';

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const method = req.method;
    const path = req.path;
    const statusCode = res.statusCode;
    const isSlow = duration > SLOW_REQUEST_THRESHOLD_MS;

    const logPrefix = isSlow ? '[API] [SLOW]' : '[API]';
    const logMessage = `${logPrefix} ${method} ${path} ${statusCode} ${duration}ms`;

    if (isTest && !verboseTestLogging) {
      if (statusCode < 400 && !isSlow) {
        return;
      }
    }

    if (isSlow) {
      console.warn(logMessage);
    } else {
      console.log(logMessage);
    }
  });

  next();
}
