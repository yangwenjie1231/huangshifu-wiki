import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  formatters: {
    level: (label) => ({ level: label }),
    log: (object) => {
      if (object.password || object.pass) object.password = '[REDACTED]';
      if (object.email && typeof object.email === 'string') object.email = object.email.substring(0, 3) + '***';
      return object;
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
