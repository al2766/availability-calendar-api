// src/components/FormBuilder/FieldTypes.js

export const FIELD_TYPES = {
  TEXT: 'text',
  EMAIL: 'email',
  PHONE: 'phone',
  TEXTAREA: 'textarea',
  SELECT: 'select',
  NUMBER: 'number',
  CHECKBOX_GROUP: 'checkbox_group',
  RADIO_GROUP: 'radio_group',
  ADDRESS: 'address',
  SECTION_HEADER: 'section_header'
};

export const FIELD_CATEGORIES = {
  BASIC: 'basic',
  CONTACT: 'contact',
  SELECTION: 'selection',
  PRICING: 'pricing',
  LAYOUT: 'layout'
};

export const FIELD_TEMPLATES = {
  [FIELD_TYPES.TEXT]: {
    type: FIELD_TYPES.TEXT,
    category: FIELD_CATEGORIES.BASIC,
    label: 'Text Input',
    icon: '📝',
    defaultConfig: {
      label: 'Text Field',
      placeholder: 'Enter text...',
      required: false,
      validation: {
        minLength: null,
        maxLength: null,
        pattern: null
      }
    }
  },
  [FIELD_TYPES.EMAIL]: {
    type: FIELD_TYPES.EMAIL,
    category: FIELD_CATEGORIES.CONTACT,
    label: 'Email',
    icon: '✉️',
    defaultConfig: {
      label: 'Email Address',
      placeholder: 'your@email.com',
      required: true,
      validation: {
        pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'
      }
    }
  },
  [FIELD_TYPES.PHONE]: {
    type: FIELD_TYPES.PHONE,
    category: FIELD_CATEGORIES.CONTACT,
    label: 'Phone Number',
    icon: '📞',
    defaultConfig: {
      label: 'Phone Number',
      placeholder: '+44 7xxx xxx xxx',
      required: true,
      validation: {
        pattern: '^[+]?[0-9\\s\\-\\(\\)]+$'
      }
    }
  },
  [FIELD_TYPES.TEXTAREA]: {
    type: FIELD_TYPES.TEXTAREA,
    category: FIELD_CATEGORIES.BASIC,
    label: 'Text Area',
    icon: '📄',
    defaultConfig: {
      label: 'Additional Information',
      placeholder: 'Enter additional details...',
      required: false,
      rows: 4,
      validation: {
        maxLength: 1000
      }
    }
  },
  [FIELD_TYPES.SELECT]: {
    type: FIELD_TYPES.SELECT,
    category: FIELD_CATEGORIES.SELECTION,
    label: 'Dropdown',
    icon: '📋',
    defaultConfig: {
      label: 'Select Option',
      placeholder: 'Choose an option...',
      required: false,
      options: [
        { value: 'option1', label: 'Option 1', priceModifier: 0 },
        { value: 'option2', label: 'Option 2', priceModifier: 0 }
      ],
      pricingEnabled: false
    }
  },
  [FIELD_TYPES.NUMBER]: {
    type: FIELD_TYPES.NUMBER,
    category: FIELD_CATEGORIES.PRICING,
    label: 'Number Input',
    icon: '🔢',
    defaultConfig: {
      label: 'Quantity',
      placeholder: 'Enter number...',
      required: false,
      min: 0,
      max: null,
      step: 1,
      pricingEnabled: false,
      pricePerUnit: 0,
      timePerUnit: 0 // in hours
    }
  },
  [FIELD_TYPES.CHECKBOX_GROUP]: {
    type: FIELD_TYPES.CHECKBOX_GROUP,
    category: FIELD_CATEGORIES.SELECTION,
    label: 'Checkbox Group',
    icon: '☑️',
    defaultConfig: {
      label: 'Select Options',
      required: false,
      options: [
        { value: 'option1', label: 'Option 1', price: 0, time: 0 },
        { value: 'option2', label: 'Option 2', price: 0, time: 0 }
      ],
      pricingEnabled: false
    }
  },
  [FIELD_TYPES.RADIO_GROUP]: {
    type: FIELD_TYPES.RADIO_GROUP,
    category: FIELD_CATEGORIES.SELECTION,
    label: 'Radio Group',
    icon: '🔘',
    defaultConfig: {
      label: 'Choose One',
      required: false,
      options: [
        { value: 'option1', label: 'Option 1', priceModifier: 1.0 },
        { value: 'option2', label: 'Option 2', priceModifier: 1.2 }
      ],
      pricingEnabled: false
    }
  },
  [FIELD_TYPES.ADDRESS]: {
    type: FIELD_TYPES.ADDRESS,
    category: FIELD_CATEGORIES.CONTACT,
    label: 'Address Lookup',
    icon: '🏠',
    defaultConfig: {
      label: 'Address',
      required: true,
      apiKey: null // Will use existing address lookup component
    }
  },
  [FIELD_TYPES.SECTION_HEADER]: {
    type: FIELD_TYPES.SECTION_HEADER,
    category: FIELD_CATEGORIES.LAYOUT,
    label: 'Section Header',
    icon: '📋',
    defaultConfig: {
      label: 'Section Title',
      description: 'Optional section description',
      showDescription: false
    }
  }
};

export const PRICING_LOGIC_TYPES = {
  FIXED_PRICE: 'fixed_price',
  HOURLY_RATE: 'hourly_rate',
  TIERED_PRICING: 'tiered_pricing',
  CUSTOM_FORMULA: 'custom_formula'
};

export const PRICING_OPERATORS = {
  ADD: 'add',
  MULTIPLY: 'multiply',
  CONDITIONAL: 'conditional'
};

export const VALIDATION_RULES = {
  REQUIRED: 'required',
  MIN_LENGTH: 'minLength',
  MAX_LENGTH: 'maxLength',
  PATTERN: 'pattern',
  MIN_VALUE: 'min',
  MAX_VALUE: 'max',
  EMAIL: 'email',
  PHONE: 'phone'
};

// Helper function to create a new field instance
export const createField = (type, overrides = {}) => {
  const template = FIELD_TEMPLATES[type];
  if (!template) {
    throw new Error(`Unknown field type: ${type}`);
  }
  
  return {
    id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    name: `field_${Date.now()}`,
    ...template.defaultConfig,
    ...overrides
  };
};

// Helper function to get fields by category
export const getFieldsByCategory = (category) => {
  return Object.values(FIELD_TEMPLATES).filter(field => field.category === category);
};

// Helper function to validate field configuration
export const validateFieldConfig = (field) => {
  const errors = [];
  
  if (!field.label || field.label.trim() === '') {
    errors.push('Field label is required');
  }
  
  if (!field.name || field.name.trim() === '') {
    errors.push('Field name is required');
  }
  
  // Validate field name is unique (this should be checked at form level)
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(field.name)) {
    errors.push('Field name must start with a letter and contain only letters, numbers, and underscores');
  }
  
  // Type-specific validations
  switch (field.type) {
    case FIELD_TYPES.SELECT:
    case FIELD_TYPES.CHECKBOX_GROUP:
    case FIELD_TYPES.RADIO_GROUP:
      if (!field.options || field.options.length === 0) {
        errors.push('At least one option is required');
      }
      break;
    case FIELD_TYPES.NUMBER:
      if (field.min !== null && field.max !== null && field.min > field.max) {
        errors.push('Minimum value cannot be greater than maximum value');
      }
      break;
  }
  
  return errors;
};

export default {
  FIELD_TYPES,
  FIELD_CATEGORIES,
  FIELD_TEMPLATES,
  PRICING_LOGIC_TYPES,
  PRICING_OPERATORS,
  VALIDATION_RULES,
  createField,
  getFieldsByCategory,
  validateFieldConfig
};
