export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly metadata?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    statusCode = 500,
    metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.metadata = metadata;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super("VALIDATION_ERROR", message, 422, metadata);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super("NOT_FOUND", message, 404);
    this.name = "NotFoundError";
  }
}

export class AgentParseError extends AppError {
  constructor(agent: string, raw: string) {
    super("AGENT_PARSE_ERROR", `${agent} returned unparseable output`, 500, {
      agent,
      preview: raw.slice(0, 200),
    });
    this.name = "AgentParseError";
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
