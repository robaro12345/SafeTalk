import Joi from 'joi';

// User Registration Validation
export const registerSchema = Joi.object({
  email: Joi.string()
    .email({ minDomainSegments: 2 })
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .required()
    .messages({
      'string.alphanum': 'Username must contain only letters and numbers',
      'string.min': 'Username must be at least 3 characters long',
      'string.max': 'Username must not exceed 30 characters',
      'string.pattern.base': 'Username can only contain letters, numbers, underscores, and hyphens',
      'any.required': 'Username is required'
    }),
  
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.max': 'Password must not exceed 128 characters',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      'any.required': 'Password is required'
    }),
  
  twoFAMethod: Joi.string()
    .valid('email', 'totp')
    .required()
    .messages({
      'any.only': 'Two-factor authentication method must be either email or totp',
      'any.required': 'Two-factor authentication method is required'
    })
});

// User Login Validation
export const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required'
    })
});

// 2FA Verification Validation
export const verify2FASchema = Joi.object({
  userId: Joi.string()
    .required()
    .messages({
      'any.required': 'User ID is required'
    }),
  
  code: Joi.string()
    .length(6)
    .pattern(/^\d+$/)
    .required()
    .messages({
      'string.length': 'Verification code must be exactly 6 digits',
      'string.pattern.base': 'Verification code must contain only numbers',
      'any.required': 'Verification code is required'
    })
});

// Message Send Validation
export const sendMessageSchema = Joi.object({
  receiverId: Joi.string()
    .required()
    .messages({
      'any.required': 'Receiver ID is required'
    }),
  
  content: Joi.string()
    .required()
    .messages({
      'any.required': 'Message content is required'
    }),
  
  messageType: Joi.string()
    .valid('text', 'file', 'image')
    .default('text')
    .messages({
      'any.only': 'Message type must be text, file, or image'
    })
});

// User Search Validation
export const searchUsersSchema = Joi.object({
  query: Joi.string()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.min': 'Search query must not be empty',
      'string.max': 'Search query must not exceed 100 characters',
      'any.required': 'Search query is required'
    })
});

// Change Password Validation
export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string()
    .required()
    .messages({
      'any.required': 'Current password is required'
    }),
  
  newPassword: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'New password must be at least 8 characters long',
      'string.max': 'New password must not exceed 128 characters',
      'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      'any.required': 'New password is required'
    })
});

// Update 2FA Method Validation
export const update2FASchema = Joi.object({
  twoFAMethod: Joi.string()
    .valid('email', 'totp')
    .required()
    .messages({
      'any.only': 'Two-factor authentication method must be either email or totp',
      'any.required': 'Two-factor authentication method is required'
    }),
  
  currentPassword: Joi.string()
    .required()
    .messages({
      'any.required': 'Current password is required for security verification'
    })
});