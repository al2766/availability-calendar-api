// src/utils/customFormUtils.js
import { FIELD_TYPES } from '../components/FormBuilder/FieldTypes';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Calculate pricing for a custom form based on its configuration and form data
 * @param {Object} formConfig - The form configuration
 * @param {Object} formData - The current form data
 * @returns {Object} - Price breakdown with totalPrice, basePrice, fieldPrice, estimatedHours
 */
export const calculateCustomFormPricing = async (formConfig, formData) => {
  if (!formConfig || !formData) {
    return {
      basePrice: 0,
      fieldPrice: 0,
      totalPrice: 0,
      estimatedHours: 0,
      assignTwoCleaners: false,
      adjustedHours: 0
    };
  }

  let totalPrice = formConfig.pricingLogic.basePrice || 0;
  let totalTime = 0;
  let fieldPrice = 0;
  let assignTwoCleaners = false;

  // Get cleaner assignment settings
  let assignTwoCleanersThreshold = 4;
  try {
    const settingsDoc = await getDoc(doc(db, "settings", "availability"));
    if (settingsDoc.exists()) {
      assignTwoCleanersThreshold = settingsDoc.data().assignTwoCleanersAfterHours || 4;
    }
  } catch (error) {
    console.error("Error getting cleaner assignment settings:", error);
  }

  // Apply field-based pricing
  formConfig.fields.forEach(field => {
    const value = formData[field.name];
    if (!value || !field.pricingEnabled) return;

    switch (field.type) {
      case FIELD_TYPES.NUMBER:
        if (field.pricePerUnit) {
          const price = parseFloat(value) * field.pricePerUnit;
          fieldPrice += price;
          totalTime += parseFloat(value) * (field.timePerUnit || 0);
        }
        break;

      case FIELD_TYPES.SELECT:
        if (field.options) {
          const selectedOption = field.options.find(opt => opt.value === value);
          if (selectedOption) {
            if (selectedOption.priceModifier && selectedOption.priceModifier !== 1.0) {
              totalPrice *= selectedOption.priceModifier;
            }
            if (selectedOption.price) {
              fieldPrice += selectedOption.price;
            }
            if (selectedOption.time) {
              totalTime += selectedOption.time;
            }
          }
        }
        break;

      case FIELD_TYPES.CHECKBOX_GROUP:
        if (field.options && Array.isArray(value)) {
          value.forEach(selectedValue => {
            const option = field.options.find(opt => opt.value === selectedValue);
            if (option) {
              fieldPrice += option.price || 0;
              totalTime += option.time || 0;
            }
          });
        }
        break;

      case FIELD_TYPES.RADIO_GROUP:
        if (field.options) {
          const selectedOption = field.options.find(opt => opt.value === value);
          if (selectedOption && selectedOption.priceModifier) {
            totalPrice *= selectedOption.priceModifier;
          }
        }
        break;
    }
  });

  // Apply pricing rules
  formConfig.pricingLogic.rules.forEach(rule => {
    if (!rule.enabled) return;

    const fieldValue = formData[rule.condition.field];
    let conditionMet = false;

    switch (rule.condition.operator) {
      case 'equals':
        conditionMet = fieldValue == rule.condition.value;
        break;
      case 'greater_than':
        conditionMet = parseFloat(fieldValue) > parseFloat(rule.condition.value);
        break;
      case 'less_than':
        conditionMet = parseFloat(fieldValue) < parseFloat(rule.condition.value);
        break;
      case 'contains':
        conditionMet = String(fieldValue).includes(rule.condition.value);
        break;
      case 'not_empty':
        conditionMet = fieldValue && fieldValue !== '';
        break;
    }

    if (conditionMet) {
      switch (rule.action.type) {
        case 'add_price':
          fieldPrice += rule.action.value;
          break;
        case 'multiply_price':
          totalPrice *= rule.action.value;
          break;
        case 'add_time':
          totalTime += rule.action.value;
          break;
        case 'multiply_time':
          totalTime *= rule.action.value;
          break;
      }
    }
  });

  // Add field price to total
  totalPrice += fieldPrice;

  // Convert time to price if hourly rate is set
  if (totalTime > 0 && formConfig.pricingLogic.hourlyRate) {
    totalPrice += totalTime * formConfig.pricingLogic.hourlyRate;
  }

  // Store original hours before cleaner adjustment
  let originalHours = Math.ceil(totalTime);
  let adjustedHours = originalHours;

  // Check if we need to assign 2 cleaners
  if (originalHours > assignTwoCleanersThreshold) {
    assignTwoCleaners = true;
    // Adjust time by dividing by 1.75 (2 cleaners complete job faster)
    adjustedHours = Math.ceil(originalHours / 1.75);
  }

  return {
    basePrice: formConfig.pricingLogic.basePrice || 0,
    fieldPrice: fieldPrice,
    totalPrice: Math.max(0, totalPrice),
    estimatedHours: adjustedHours,
    originalHours: originalHours,
    assignTwoCleaners: assignTwoCleaners,
    adjustedHours: adjustedHours
  };
};

/**
 * Validate form data against field requirements
 * @param {Object} formConfig - The form configuration
 * @param {Object} formData - The form data to validate
 * @returns {Object} - Validation result with isValid and errors
 */
export const validateCustomFormData = (formConfig, formData) => {
  const errors = {};
  let isValid = true;

  formConfig.fields.forEach(field => {
    const value = formData[field.name];
    const fieldErrors = [];

    // Check required fields
    if (field.required) {
      if (!value || 
          (typeof value === 'string' && value.trim() === '') ||
          (Array.isArray(value) && value.length === 0)) {
        fieldErrors.push(`${field.label} is required`);
        isValid = false;
      }
    }

    // Type-specific validation
    if (value && typeof value === 'string' && value.trim() !== '') {
      switch (field.type) {
        case FIELD_TYPES.EMAIL:
          const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailPattern.test(value)) {
            fieldErrors.push(`${field.label} must be a valid email address`);
            isValid = false;
          }
          break;

        case FIELD_TYPES.PHONE:
          const phonePattern = /^[+]?[0-9\s\-\(\)]+$/;
          if (!phonePattern.test(value)) {
            fieldErrors.push(`${field.label} must be a valid phone number`);
            isValid = false;
          }
          break;

        case FIELD_TYPES.NUMBER:
          const numValue = parseFloat(value);
          if (isNaN(numValue)) {
            fieldErrors.push(`${field.label} must be a valid number`);
            isValid = false;
          } else {
            if (field.min !== null && numValue < field.min) {
              fieldErrors.push(`${field.label} must be at least ${field.min}`);
              isValid = false;
            }
            if (field.max !== null && numValue > field.max) {
              fieldErrors.push(`${field.label} must be no more than ${field.max}`);
              isValid = false;
            }
          }
          break;

        case FIELD_TYPES.TEXT:
        case FIELD_TYPES.TEXTAREA:
          if (field.validation) {
            if (field.validation.minLength && value.length < field.validation.minLength) {
              fieldErrors.push(`${field.label} must be at least ${field.validation.minLength} characters`);
              isValid = false;
            }
            if (field.validation.maxLength && value.length > field.validation.maxLength) {
              fieldErrors.push(`${field.label} must be no more than ${field.validation.maxLength} characters`);
              isValid = false;
            }
            if (field.validation.pattern) {
              try {
                const pattern = new RegExp(field.validation.pattern);
                if (!pattern.test(value)) {
                  fieldErrors.push(`${field.label} format is invalid`);
                  isValid = false;
                }
              } catch (e) {
                console.error('Invalid regex pattern:', field.validation.pattern);
              }
            }
          }
          break;
      }
    }

    if (fieldErrors.length > 0) {
      errors[field.name] = fieldErrors;
    }
  });

  return { isValid, errors };
};

/**
 * Format form data for submission (similar to existing forms)
 * @param {Object} formConfig - The form configuration
 * @param {Object} formData - The form data
 * @param {Object} priceBreakdown - The calculated price breakdown
 * @returns {Object} - Formatted submission data
 */
export const formatCustomFormSubmission = (formConfig, formData, priceBreakdown) => {
  // Extract special fields that need to be handled separately
  const additionalRooms = [];
  const addOns = [];
  const submissionData = { ...formData };

  // Process checkbox groups to extract add-ons and additional rooms
  formConfig.fields.forEach(field => {
    if (field.type === FIELD_TYPES.CHECKBOX_GROUP && Array.isArray(formData[field.name])) {
      formData[field.name].forEach(value => {
        const option = field.options.find(opt => opt.value === value);
        if (option) {
          if (field.pricingEnabled) {
            addOns.push({ value, price: option.price || 0 });
          } else {
            additionalRooms.push(value);
          }
        }
      });
    }
  });

  // Format address if present
  const addressField = formConfig.fields.find(f => f.type === FIELD_TYPES.ADDRESS);
  if (addressField && formData[addressField.name]) {
    const address = formData[addressField.name];
    submissionData.address = `${address.line1}, ${address.line2 ? address.line2 + ', ' : ''}${address.town}, ${address.county}, ${address.postcode}`.replace(/,\s*,/g, ',').trim();
  }

  return {
    ...submissionData,
    additionalRooms,
    addOns,
    service: formConfig.name,
    totalPrice: priceBreakdown.totalPrice,
    estimatedHours: priceBreakdown.estimatedHours,
    originalHours: priceBreakdown.originalHours,
    assignTwoCleaners: priceBreakdown.assignTwoCleaners
  };
};

/**
 * Get default form data structure for a form configuration
 * @param {Object} formConfig - The form configuration
 * @returns {Object} - Default form data
 */
export const getDefaultFormData = (formConfig) => {
  const defaultData = {};
  
  formConfig.fields.forEach(field => {
    switch (field.type) {
      case FIELD_TYPES.CHECKBOX_GROUP:
        defaultData[field.name] = [];
        break;
      case FIELD_TYPES.ADDRESS:
        defaultData[field.name] = {
          line1: '',
          line2: '',
          town: '',
          county: '',
          postcode: ''
        };
        break;
      case FIELD_TYPES.NUMBER:
        defaultData[field.name] = field.min || 0;
        break;
      default:
        defaultData[field.name] = '';
    }
  });
  
  return defaultData;
};

export default {
  calculateCustomFormPricing,
  validateCustomFormData,
  formatCustomFormSubmission,
  getDefaultFormData
};
