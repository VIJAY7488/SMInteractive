import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationError } from '../utils/apiResponse';
import logger from '../utils/logger';

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessages = error.details.map((detail) => detail.message).join(', ');
      logger.warn(`Validation error: ${errorMessages}`);
      return next(new ValidationError(errorMessages));
    }

    // Replace request body with validated and sanitized value
    req.body = value;
    next();
  };
};