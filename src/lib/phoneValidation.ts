"use client";

import { z } from "zod";

/**
 * Phone number validation schemas
 */

/**
 * Validates a phone number (without country code)
 * Accepts digits with optional spaces, dashes, or parentheses for formatting
 */
export const phoneNumberSchema = z
  .string()
  .min(1, "Phone number is required")
  .refine(
    (val) => {
      // Remove formatting characters
      const digits = val.replace(/\D/g, "");
      // Check minimum length (at least 7 digits for most countries)
      return digits.length >= 7;
    },
    {
      message: "Phone number must be at least 7 digits",
    }
  )
  .refine(
    (val) => {
      // Remove formatting characters
      const digits = val.replace(/\D/g, "");
      // Check maximum length (15 digits max for international numbers)
      return digits.length <= 15;
    },
    {
      message: "Phone number cannot exceed 15 digits",
    }
  )
  .refine(
    (val) => {
      // Allow digits, spaces, dashes, and parentheses for formatting
      return /^[\d\s\-\(\)]+$/.test(val);
    },
    {
      message:
        "Phone number can only contain digits and formatting characters (spaces, dashes, parentheses)",
    }
  );

/**
 * Validates a full phone number with country code
 */
export const fullPhoneNumberSchema = z
  .string()
  .min(1, "Phone number is required")
  .regex(
    /^\+\d{1,4}\d{7,15}$/,
    "Invalid phone number format. Must start with country code (e.g., +263123456789)"
  );

/**
 * Validate phone number and return error message if invalid
 */
export function validatePhoneNumber(phoneNumber: string): {
  valid: boolean;
  error?: string;
} {
  // Return valid if empty (required check is done separately)
  if (!phoneNumber || phoneNumber.trim() === "") {
    return { valid: true };
  }

  try {
    phoneNumberSchema.parse(phoneNumber);
    return { valid: true };
  } catch (error) {
    if (
      error instanceof z.ZodError &&
      error.errors &&
      error.errors.length > 0
    ) {
      return {
        valid: false,
        error: error.errors[0].message || "Invalid phone number",
      };
    }
    return {
      valid: false,
      error: "Invalid phone number",
    };
  }
}

/**
 * Validate full phone number (with country code)
 */
export function validateFullPhoneNumber(fullPhoneNumber: string): {
  valid: boolean;
  error?: string;
} {
  // Return valid if empty (required check is done separately)
  if (!fullPhoneNumber || fullPhoneNumber.trim() === "") {
    return { valid: true };
  }

  try {
    fullPhoneNumberSchema.parse(fullPhoneNumber);
    return { valid: true };
  } catch (error) {
    if (
      error instanceof z.ZodError &&
      error.errors &&
      error.errors.length > 0
    ) {
      return {
        valid: false,
        error: error.errors[0].message || "Invalid phone number format",
      };
    }
    return {
      valid: false,
      error: "Invalid phone number format",
    };
  }
}
