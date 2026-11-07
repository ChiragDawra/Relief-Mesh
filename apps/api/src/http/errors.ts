import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

export type ErrorCode =
  | 'INVALID_INPUT'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_TRANSITION'
  | 'CONFLICT'
  | 'UNPROCESSABLE'
  | 'RATE_LIMITED'
  | 'INTERNAL'
  | 'SERVICE_UNAVAILABLE';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  INVALID_INPUT: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVALID_TRANSITION: 409,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  SERVICE_UNAVAILABLE: 503,
};

export class ApiError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.status = STATUS_BY_CODE[code];
  }
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new ApiError('NOT_FOUND', 'Route not found.'));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let apiError: ApiError;
  if (err instanceof ApiError) {
    apiError = err;
  } else if (err instanceof ZodError) {
    const fields = err.issues.map((i) => i.path.join('.') || '(root)').join(', ');
    apiError = new ApiError('INVALID_INPUT', `Invalid request fields: ${fields}`);
  } else if (err instanceof SyntaxError && 'body' in err) {
    apiError = new ApiError('INVALID_INPUT', 'Request body is not valid JSON.');
  } else {
    req.log?.error({ err }, 'unhandled error');
    apiError = new ApiError('INTERNAL', 'Unexpected server error.');
  }
  res.status(apiError.status).json({
    error: { code: apiError.code, message: apiError.message, request_id: String(req.id ?? '') },
  });
};
