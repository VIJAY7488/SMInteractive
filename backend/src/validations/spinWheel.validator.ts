import Joi from 'joi';

export const createSpinWheelSchema = Joi.object({
  entryFee: Joi.number()
    .integer()
    .min(1)
    .required()
    .messages({
      'number.base': 'Entry fee must be a number',
      'number.integer': 'Entry fee must be an integer',
      'number.min': 'Entry fee must be at least 1 coin',
      'any.required': 'Entry fee is required',
    }),
  maxParticipants: Joi.number()
    .integer()
    .min(3)
    .max(1000)
    .default(100)
    .messages({
      'number.min': 'Maximum participants must be at least 3',
      'number.max': 'Maximum participants cannot exceed 1000',
    }),
  winnerPoolPercentage: Joi.number()
    .min(0)
    .max(100)
    .messages({
      'number.min': 'Percentage cannot be negative',
      'number.max': 'Percentage cannot exceed 100',
    }),
  adminPoolPercentage: Joi.number()
    .min(0)
    .max(100)
    .messages({
      'number.min': 'Percentage cannot be negative',
      'number.max': 'Percentage cannot exceed 100',
    }),
  appPoolPercentage: Joi.number()
    .min(0)
    .max(100)
    .messages({
      'number.min': 'Percentage cannot be negative',
      'number.max': 'Percentage cannot exceed 100',
    }),
}).custom((value, helpers) => {
  const { winnerPoolPercentage, adminPoolPercentage, appPoolPercentage } = value;
  
  if (winnerPoolPercentage !== undefined && adminPoolPercentage !== undefined && appPoolPercentage !== undefined) {
    const total = winnerPoolPercentage + adminPoolPercentage + appPoolPercentage;
    if (Math.abs(total - 100) > 0.01) {
      return helpers.error('any.custom', { 
        message: 'Distribution percentages must sum to 100' 
      });
    }
  }
  
  return value;
});

export const joinSpinWheelSchema = Joi.object({
  spinWheelId: Joi.string()
    .required()
    .messages({
      'any.required': 'Spin wheel ID is required',
    }),
});

export const spinWheelIdParamSchema = Joi.object({
  spinWheelId: Joi.string()
    .length(24)
    .hex()
    .required()
    .messages({
      'string.length': 'Invalid spin wheel ID format',
      'string.hex': 'Invalid spin wheel ID format',
      'any.required': 'Spin wheel ID is required',
    }),
});

export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid('waiting', 'in_progress', 'completed', 'aborted'),
  search: Joi.string().max(100),
});