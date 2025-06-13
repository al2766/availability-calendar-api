// src/utils/formMigration.js
// Utility to convert existing hardcoded forms to the new custom form format

import { FIELD_TYPES, createField } from '../components/FormBuilder/FieldTypes';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Convert Home Cleaning form to custom form format
 */
export const createHomeCleaningFormConfig = () => {
  const homeCleaningForm = {
    id: 'home_cleaning_template',
    name: 'Home Cleaning Service',
    description: 'Professional residential cleaning service with customized pricing based on property size and requirements.',
    fields: [
      // Personal Information Section
      createField(FIELD_TYPES.SECTION_HEADER, {
        label: 'Personal Information',
        description: 'Please provide your contact details',
        showDescription: true
      }),
      
      createField(FIELD_TYPES.TEXT, {
        name: 'name',
        label: 'Full Name',
        placeholder: 'Enter your full name',
        required: true
      }),
      
      createField(FIELD_TYPES.EMAIL, {
        name: 'email',
        label: 'Email Address',
        placeholder: 'your@email.com',
        required: true
      }),
      
      createField(FIELD_TYPES.PHONE, {
        name: 'phone',
        label: 'Phone Number',
        placeholder: '+44 7xxx xxx xxx',
        required: true
      }),
      
      // Address
      createField(FIELD_TYPES.ADDRESS, {
        name: 'address',
        label: 'Property Address',
        required: true
      }),
      
      // Property Access Section
      createField(FIELD_TYPES.SECTION_HEADER, {
        label: 'Property Access',
        description: 'How will our team access your property?'
      }),
      
      createField(FIELD_TYPES.SELECT, {
        name: 'access',
        label: 'Property Access Method',
        required: true,
        options: [
          { value: 'home', label: 'I will be home' },
          { value: 'key', label: 'Key will be left in a location' }
        ]
      }),
      
      createField(FIELD_TYPES.TEXT, {
        name: 'keyLocation',
        label: 'Key Location (if applicable)',
        placeholder: 'e.g., Under the plant pot, with neighbor, etc.'
      }),
      
      // Property Details Section
      createField(FIELD_TYPES.SECTION_HEADER, {
        label: 'Property Details',
        description: 'Tell us about your property size and requirements'
      }),
      
      createField(FIELD_TYPES.SELECT, {
        name: 'bedrooms',
        label: 'Number of Bedrooms',
        required: true,
        pricingEnabled: true,
        options: [
          { value: '0', label: '0 (Studio)', time: 0, priceModifier: 1.0 },
          { value: '1', label: '1', time: 0.75, priceModifier: 1.0 },
          { value: '2', label: '2', time: 1.5, priceModifier: 1.0 },
          { value: '3', label: '3', time: 2.25, priceModifier: 1.0 },
          { value: '4', label: '4', time: 3.0, priceModifier: 1.0 },
          { value: '5', label: '5', time: 3.75, priceModifier: 1.0 },
          { value: '6', label: '6', time: 4.5, priceModifier: 1.0 }
        ]
      }),
      
      createField(FIELD_TYPES.SELECT, {
        name: 'livingRooms',
        label: 'Number of Living Rooms',
        required: true,
        pricingEnabled: true,
        options: [
          { value: '0', label: '0', time: 0 },
          { value: '1', label: '1', time: 0.5 },
          { value: '2', label: '2', time: 1.0 },
          { value: '3', label: '3', time: 1.5 }
        ]
      }),
      
      createField(FIELD_TYPES.SELECT, {
        name: 'kitchens',
        label: 'Number of Kitchens',
        required: true,
        pricingEnabled: true,
        options: [
          { value: '0', label: '0', time: 0 },
          { value: '1', label: '1', time: 1.0 },
          { value: '2', label: '2', time: 2.0 }
        ]
      }),
      
      createField(FIELD_TYPES.SELECT, {
        name: 'bathrooms',
        label: 'Number of Bathrooms/Toilets',
        required: true,
        pricingEnabled: true,
        options: [
          { value: '0', label: '0', time: 0 },
          { value: '1', label: '1', time: 0.75 },
          { value: '2', label: '2', time: 1.5 },
          { value: '3', label: '3', time: 2.25 },
          { value: '4', label: '4', time: 3.0 }
        ]
      }),
      
      createField(FIELD_TYPES.SELECT, {
        name: 'utilityRooms',
        label: 'Number of Utility Rooms',
        required: true,
        pricingEnabled: true,
        options: [
          { value: '0', label: '0', time: 0 },
          { value: '1', label: '1', time: 0.5 },
          { value: '2', label: '2', time: 1.0 }
        ]
      }),
      
      createField(FIELD_TYPES.RADIO_GROUP, {
        name: 'cleanliness',
        label: 'Property Cleanliness Level',
        required: true,
        pricingEnabled: true,
        options: [
          { value: 'quite-clean', label: 'Quite clean', priceModifier: 1.0 },
          { value: 'average', label: 'Average', priceModifier: 1.2 },
          { value: 'quite-dirty', label: 'Quite dirty', priceModifier: 1.5 },
          { value: 'filthy', label: 'Very dirty/filthy', priceModifier: 2.0 }
        ]
      }),
      
      createField(FIELD_TYPES.SELECT, {
        name: 'products',
        label: 'Cleaning Products',
        required: true,
        options: [
          { value: 'bring', label: 'Bring our products' },
          { value: 'customer', label: 'Use my products' }
        ]
      }),
      
      // Additional Rooms Section
      createField(FIELD_TYPES.SECTION_HEADER, {
        label: 'Additional Rooms',
        description: 'Select any additional rooms that need cleaning'
      }),
      
      createField(FIELD_TYPES.CHECKBOX_GROUP, {
        name: 'additionalRooms',
        label: 'Additional Rooms',
        pricingEnabled: true,
        options: [
          { value: 'garage', label: 'Garage', time: 0.5, price: 14 },
          { value: 'dining-room', label: 'Dining Room', time: 0.5, price: 14 },
          { value: 'conservatory', label: 'Conservatory', time: 0.75, price: 21 }
        ]
      }),
      
      // Add-on Services Section
      createField(FIELD_TYPES.SECTION_HEADER, {
        label: 'Add-on Services',
        description: 'Optional additional services'
      }),
      
      createField(FIELD_TYPES.CHECKBOX_GROUP, {
        name: 'addOns',
        label: 'Additional Services',
        pricingEnabled: true,
        options: [
          { value: 'freezer', label: 'Freezer - empty', price: 25 },
          { value: 'fridge', label: 'Fridge - empty', price: 20 },
          { value: 'fridge-freezer', label: 'Fridge + freezer clean', price: 60 },
          { value: 'ironing', label: 'Ironing', price: 30 },
          { value: 'oven', label: 'Oven', price: 40 },
          { value: 'kitchen-cupboard', label: 'Kitchen cupboard (£15 each)', price: 15 },
          { value: 'blind-cleaning', label: 'Blind cleaning', price: 35 },
          { value: 'curtain', label: 'Curtain', price: 40 }
        ]
      }),
      
      // Additional Information
      createField(FIELD_TYPES.SECTION_HEADER, {
        label: 'Additional Information'
      }),
      
      createField(FIELD_TYPES.TEXTAREA, {
        name: 'additionalInfo',
        label: 'Additional Details',
        placeholder: 'Please share any other details that would help us provide the best service',
        rows: 4
      })
    ],
    
    pricingLogic: {
      basePrice: 56, // Minimum 2 hours at £28/hour
      hourlyRate: 28,
      rules: [
        {
          id: 'minimum_hours',
          name: 'Minimum 2 Hours',
          type: 'field_based',
          enabled: true,
          condition: {
            field: 'totalTime',
            operator: 'less_than',
            value: '2'
          },
          action: {
            type: 'set_time',
            value: 2
          }
        }
      ]
    },
    
    settings: {
      showCalendar: true,
      showTimeSlots: true,
      requirePayment: false,
      sendConfirmationEmail: true
    },
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  return homeCleaningForm;
};

/**
 * Convert Office Cleaning form to custom form format
 */
export const createOfficeCleaningFormConfig = () => {
  const officeCleaningForm = {
    id: 'office_cleaning_template',
    name: 'Office Cleaning Service',
    description: 'Professional commercial cleaning service for offices and business premises.',
    fields: [
      // Personal Information Section
      createField(FIELD_TYPES.SECTION_HEADER, {
        label: 'Contact Information',
        description: 'Business contact details'
      }),
      
      createField(FIELD_TYPES.TEXT, {
        name: 'name',
        label: 'Contact Name',
        placeholder: 'Primary contact person',
        required: true
      }),
      
      createField(FIELD_TYPES.EMAIL, {
        name: 'email',
        label: 'Business Email',
        placeholder: 'business@company.com',
        required: true
      }),
      
      createField(FIELD_TYPES.PHONE, {
        name: 'phone',
        label: 'Business Phone',
        placeholder: '+44 20 xxxx xxxx',
        required: true
      }),
      
      // Address
      createField(FIELD_TYPES.ADDRESS, {
        name: 'address',
        label: 'Office Address',
        required: true
      }),
      
      // Property Access Section
      createField(FIELD_TYPES.SECTION_HEADER, {
        label: 'Office Access',
        description: 'How will our team access your office?'
      }),
      
      createField(FIELD_TYPES.SELECT, {
        name: 'access',
        label: 'Access Method',
        required: true,
        options: [
          { value: 'home', label: 'Someone will be present' },
          { value: 'key', label: 'Key will be provided' }
        ]
      }),
      
      createField(FIELD_TYPES.TEXT, {
        name: 'keyLocation',
        label: 'Key/Access Instructions',
        placeholder: 'e.g., Reception desk, security office, etc.'
      }),
      
      // Office Details Section
      createField(FIELD_TYPES.SECTION_HEADER, {
        label: 'Office Details',
        description: 'Tell us about your office space'
      }),
      
      createField(FIELD_TYPES.SELECT, {
        name: 'officeRooms',
        label: 'Number of Office Rooms',
        required: true,
        pricingEnabled: true,
        options: [
          { value: '0', label: '0 (Open plan only)', time: 0 },
          { value: '1', label: '1', time: 1.0 },
          { value: '2', label: '2', time: 2.0 },
          { value: '3', label: '3', time: 3.0 },
          { value: '4', label: '4', time: 4.0 },
          { value: '5', label: '5', time: 5.0 }
        ]
      }),
      
      createField(FIELD_TYPES.RADIO_GROUP, {
        name: 'officeSize',
        label: 'Office Size',
        required: true,
        pricingEnabled: true,
        options: [
          { value: 'small', label: 'Small (1-3 workstations)', priceModifier: 1.0 },
          { value: 'medium', label: 'Medium (4-10 workstations)', priceModifier: 1.5 },
          { value: 'large', label: 'Large (11+ workstations)', priceModifier: 2.0 }
        ]
      }),
      
      createField(FIELD_TYPES.SELECT, {
        name: 'meetingRooms',
        label: 'Number of Meeting Rooms',
        required: true,
        pricingEnabled: true,
        options: [
          { value: '0', label: '0', time: 0 },
          { value: '1', label: '1', time: 0.75 },
          { value: '2', label: '2', time: 1.5 },
          { value: '3', label: '3', time: 2.25 },
          { value: '4', label: '4', time: 3.0 }
        ]
      }),
      
      createField(FIELD_TYPES.SELECT, {
        name: 'kitchens',
        label: 'Kitchen/Break Rooms',
        required: true,
        pricingEnabled: true,
        options: [
          { value: '0', label: '0', time: 0 },
          { value: '1', label: '1', time: 1.0 },
          { value: '2', label: '2', time: 2.0 }
        ]
      }),
      
      createField(FIELD_TYPES.SELECT, {
        name: 'bathrooms',
        label: 'Number of Bathrooms',
        required: true,
        pricingEnabled: true,
        options: [
          { value: '0', label: '0', time: 0 },
          { value: '1', label: '1', time: 0.75 },
          { value: '2', label: '2', time: 1.5 },
          { value: '3', label: '3', time: 2.25 }
        ]
      }),
      
      createField(FIELD_TYPES.RADIO_GROUP, {
        name: 'cleanliness',
        label: 'Office Cleanliness Level',
        required: true,
        pricingEnabled: true,
        options: [
          { value: 'quite-clean', label: 'Quite clean', priceModifier: 1.0 },
          { value: 'average', label: 'Average', priceModifier: 1.2 },
          { value: 'quite-dirty', label: 'Quite dirty', priceModifier: 1.5 },
          { value: 'filthy', label: 'Very dirty', priceModifier: 2.0 }
        ]
      }),
      
      createField(FIELD_TYPES.SELECT, {
        name: 'products',
        label: 'Cleaning Products',
        required: true,
        options: [
          { value: 'bring', label: 'Bring our products' },
          { value: 'customer', label: 'Use office products' }
        ]
      }),
      
      // Additional Areas Section
      createField(FIELD_TYPES.SECTION_HEADER, {
        label: 'Additional Areas',
        description: 'Select any additional areas that need cleaning'
      }),
      
      createField(FIELD_TYPES.CHECKBOX_GROUP, {
        name: 'additionalAreas',
        label: 'Additional Areas',
        pricingEnabled: true,
        options: [
          { value: 'reception', label: 'Reception area', time: 0.5, price: 14 },
          { value: 'waiting-area', label: 'Waiting area', time: 0.5, price: 14 },
          { value: 'stairwell', label: 'Stairwell', time: 0.75, price: 21 },
          { value: 'hallways', label: 'Hallways', time: 0.5, price: 14 }
        ]
      }),
      
      // Add-on Services Section
      createField(FIELD_TYPES.SECTION_HEADER, {
        label: 'Add-on Services',
        description: 'Optional additional services'
      }),
      
      createField(FIELD_TYPES.CHECKBOX_GROUP, {
        name: 'addOns',
        label: 'Additional Services',
        pricingEnabled: true,
        options: [
          { value: 'carpet-cleaning', label: 'Carpet cleaning', price: 80 },
          { value: 'fridge', label: 'Fridge - empty', price: 20 },
          { value: 'microwave', label: 'Microwave', price: 15 },
          { value: 'window-cleaning', label: 'Window cleaning', price: 40 },
          { value: 'blind-cleaning', label: 'Blind cleaning', price: 35 }
        ]
      }),
      
      // Additional Information
      createField(FIELD_TYPES.SECTION_HEADER, {
        label: 'Additional Information'
      }),
      
      createField(FIELD_TYPES.TEXTAREA, {
        name: 'additionalInfo',
        label: 'Special Requirements',
        placeholder: 'Please share any specific requirements or instructions',
        rows: 4
      })
    ],
    
    pricingLogic: {
      basePrice: 84, // Minimum 3 hours at £28/hour for office cleaning
      hourlyRate: 28,
      rules: [
        {
          id: 'minimum_hours_office',
          name: 'Minimum 3 Hours for Office',
          type: 'field_based',
          enabled: true,
          condition: {
            field: 'totalTime',
            operator: 'less_than',
            value: '3'
          },
          action: {
            type: 'set_time',
            value: 3
          }
        }
      ]
    },
    
    settings: {
      showCalendar: true,
      showTimeSlots: true,
      requirePayment: false,
      sendConfirmationEmail: true
    },
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  return officeCleaningForm;
};

/**
 * Save template forms to Firebase
 * This function can be called from the admin interface to create template forms
 */
export const createTemplateFormsInFirebase = async () => {
  try {
    const homeForm = createHomeCleaningFormConfig();
    const officeForm = createOfficeCleaningFormConfig();
    
    await setDoc(doc(db, 'customForms', homeForm.id), homeForm);
    await setDoc(doc(db, 'customForms', officeForm.id), officeForm);
    
    console.log('Template forms created successfully!');
    return { success: true, message: 'Template forms created successfully!' };
  } catch (error) {
    console.error('Error creating template forms:', error);
    return { success: false, message: `Error creating template forms: ${error.message}` };
  }
};

/**
 * Create a basic contact form template
 */
export const createBasicContactFormConfig = () => {
  return {
    id: 'basic_contact_template',
    name: 'Basic Contact Form',
    description: 'Simple contact form for general inquiries',
    fields: [
      createField(FIELD_TYPES.TEXT, {
        name: 'name',
        label: 'Full Name',
        required: true
      }),
      
      createField(FIELD_TYPES.EMAIL, {
        name: 'email',
        label: 'Email Address',
        required: true
      }),
      
      createField(FIELD_TYPES.PHONE, {
        name: 'phone',
        label: 'Phone Number',
        required: false
      }),
      
      createField(FIELD_TYPES.SELECT, {
        name: 'service',
        label: 'Service Interested In',
        required: true,
        options: [
          { value: 'home-cleaning', label: 'Home Cleaning' },
          { value: 'office-cleaning', label: 'Office Cleaning' },
          { value: 'deep-cleaning', label: 'Deep Cleaning' },
          { value: 'other', label: 'Other' }
        ]
      }),
      
      createField(FIELD_TYPES.TEXTAREA, {
        name: 'message',
        label: 'Message',
        placeholder: 'Please describe your requirements...',
        required: true,
        rows: 5
      })
    ],
    
    pricingLogic: {
      basePrice: 0,
      hourlyRate: 0,
      rules: []
    },
    
    settings: {
      showCalendar: true,
      showTimeSlots: true,
      requirePayment: false,
      sendConfirmationEmail: true
    },
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

export default {
  createHomeCleaningFormConfig,
  createOfficeCleaningFormConfig,
  createBasicContactFormConfig,
  createTemplateFormsInFirebase
};
