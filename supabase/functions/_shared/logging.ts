// Structured logging for edge functions

interface LogContext {
  functionName: string;
  requestId?: string;
  userId?: string;
  [key: string]: unknown;
}

// Create a logger instance for a function
export function createLogger(functionName: string) {
  const requestId = crypto.randomUUID().slice(0, 8);

  return {
    info: (message: string, data?: Record<string, unknown>) => {
      log('INFO', functionName, requestId, message, data);
    },
    warn: (message: string, data?: Record<string, unknown>) => {
      log('WARN', functionName, requestId, message, data);
    },
    error: (message: string, error?: unknown, data?: Record<string, unknown>) => {
      const errorData = error instanceof Error 
        ? { errorMessage: error.message, errorStack: error.stack }
        : { error };
      log('ERROR', functionName, requestId, message, { ...errorData, ...data });
    },
    debug: (message: string, data?: Record<string, unknown>) => {
      if (Deno.env.get('DEBUG') === 'true') {
        log('DEBUG', functionName, requestId, message, data);
      }
    },
    // Track function execution time
    startTimer: () => {
      const start = performance.now();
      return {
        end: (operation: string) => {
          const duration = Math.round(performance.now() - start);
          log('INFO', functionName, requestId, `${operation} completed`, { durationMs: duration });
          return duration;
        },
      };
    },
  };
}

function log(
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG',
  functionName: string,
  requestId: string,
  message: string,
  data?: Record<string, unknown>
) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    function: functionName,
    requestId,
    message,
    ...data,
  };

  // Use appropriate console method
  switch (level) {
    case 'ERROR':
      console.error(JSON.stringify(logEntry));
      break;
    case 'WARN':
      console.warn(JSON.stringify(logEntry));
      break;
    default:
      console.log(JSON.stringify(logEntry));
  }
}

// Helper to mask sensitive data in logs
export function maskSensitive(value: string, visibleChars = 4): string {
  if (!value || value.length <= visibleChars) return '****';
  return value.slice(0, visibleChars) + '****';
}
