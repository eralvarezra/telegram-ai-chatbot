class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

class ExternalServiceError extends AppError {
  constructor(message, service) {
    super(`${service} error: ${message}`, 502);
  }
}

class ApiKeyError extends AppError {
  constructor(message) {
    super(message, 400);
  }
}

class RateLimitError extends AppError {
  constructor(message, resetTime) {
    super(message, 429);
    this.resetTime = resetTime;
  }
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  ExternalServiceError,
  ApiKeyError,
  RateLimitError
};