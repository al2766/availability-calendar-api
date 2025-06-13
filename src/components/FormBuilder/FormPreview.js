// src/components/FormBuilder/FormPreview.js
import React, { useState } from 'react';
import { FIELD_TYPES } from './FieldTypes';
import AddressLookup from '../AddressLookup';

function FormPreview({ formConfig }) {
  const [previewData, setPreviewData] = useState({});
  const [calculatedPrice, setCalculatedPrice] = useState(0);
  const [calculatedTime, setCalculatedTime] = useState(0);
  
  // Handle form input changes for preview
  const handlePreviewChange = (fieldName, value, field) => {
    const newData = {
      ...previewData,
      [fieldName]: value
    };
    setPreviewData(newData);
    
    // Recalculate price and time
    calculatePricing(newData);
  };
  
  // Calculate pricing based on form data and pricing logic
  const calculatePricing = (data) => {
    let totalPrice = formConfig.pricingLogic.basePrice || 0;
    let totalTime = 0;
    
    // Apply field-based pricing
    formConfig.fields.forEach(field => {
      const value = data[field.name];
      if (!value) return;
      
      switch (field.type) {
        case FIELD_TYPES.NUMBER:
          if (field.pricingEnabled && field.pricePerUnit) {
            totalPrice += parseFloat(value) * field.pricePerUnit;
            totalTime += parseFloat(value) * (field.timePerUnit || 0);
          }
          break;
          
        case FIELD_TYPES.SELECT:
          if (field.pricingEnabled && field.options) {
            const selectedOption = field.options.find(opt => opt.value === value);
            if (selectedOption) {
              if (selectedOption.priceModifier) {
                totalPrice *= selectedOption.priceModifier;
              }
              if (selectedOption.price) {
                totalPrice += selectedOption.price;
              }
              if (selectedOption.time) {
                totalTime += selectedOption.time;
              }
            }
          }
          break;
          
        case FIELD_TYPES.CHECKBOX_GROUP:
          if (field.pricingEnabled && field.options && Array.isArray(value)) {
            value.forEach(selectedValue => {
              const option = field.options.find(opt => opt.value === selectedValue);
              if (option) {
                totalPrice += option.price || 0;
                totalTime += option.time || 0;
              }
            });
          }
          break;
          
        case FIELD_TYPES.RADIO_GROUP:
          if (field.pricingEnabled && field.options) {
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
      
      const fieldValue = data[rule.condition.field];
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
            totalPrice += rule.action.value;
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
    
    // Convert time to price if hourly rate is set
    if (totalTime > 0 && formConfig.pricingLogic.hourlyRate) {
      totalPrice += totalTime * formConfig.pricingLogic.hourlyRate;
    }
    
    setCalculatedPrice(Math.max(0, totalPrice));
    setCalculatedTime(Math.max(0, totalTime));
  };
  
  // Render individual field based on type
  const renderField = (field) => {
    const fieldValue = previewData[field.name] || '';
    
    switch (field.type) {
      case FIELD_TYPES.TEXT:
      case FIELD_TYPES.EMAIL:
      case FIELD_TYPES.PHONE:
        return (
          <input
            type={field.type === FIELD_TYPES.EMAIL ? 'email' : field.type === FIELD_TYPES.PHONE ? 'tel' : 'text'}
            value={fieldValue}
            onChange={(e) => handlePreviewChange(field.name, e.target.value, field)}
            placeholder={field.placeholder}
            className="w-full p-2 border rounded-lg"
            required={field.required}
          />
        );
        
      case FIELD_TYPES.TEXTAREA:
        return (
          <textarea
            value={fieldValue}
            onChange={(e) => handlePreviewChange(field.name, e.target.value, field)}
            placeholder={field.placeholder}
            rows={field.rows || 4}
            className="w-full p-2 border rounded-lg"
            required={field.required}
          />
        );
        
      case FIELD_TYPES.NUMBER:
        return (
          <input
            type="number"
            value={fieldValue}
            onChange={(e) => handlePreviewChange(field.name, e.target.value, field)}
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
            step={field.step}
            className="w-full p-2 border rounded-lg"
            required={field.required}
          />
        );
        
      case FIELD_TYPES.SELECT:
        return (
          <select
            value={fieldValue}
            onChange={(e) => handlePreviewChange(field.name, e.target.value, field)}
            className="w-full p-2 border rounded-lg"
            required={field.required}
          >
            <option value="">{field.placeholder || 'Select an option...'}</option>
            {field.options?.map((option, index) => (
              <option key={index} value={option.value}>
                {option.label}
                {field.pricingEnabled && option.price > 0 && ` (+£${option.price})`}
              </option>
            ))}
          </select>
        );
        
      case FIELD_TYPES.CHECKBOX_GROUP:
        return (
          <div className="space-y-2">
            {field.options?.map((option, index) => (
              <label key={index} className="flex items-center">
                <input
                  type="checkbox"
                  checked={Array.isArray(fieldValue) && fieldValue.includes(option.value)}
                  onChange={(e) => {
                    const currentValues = Array.isArray(fieldValue) ? fieldValue : [];
                    const newValues = e.target.checked
                      ? [...currentValues, option.value]
                      : currentValues.filter(v => v !== option.value);
                    handlePreviewChange(field.name, newValues, field);
                  }}
                  className="mr-2"
                />
                <span>
                  {option.label}
                  {field.pricingEnabled && option.price > 0 && ` (+£${option.price})`}
                </span>
              </label>
            ))}
          </div>
        );
        
      case FIELD_TYPES.RADIO_GROUP:
        return (
          <div className="space-y-2">
            {field.options?.map((option, index) => (
              <label key={index} className="flex items-center">
                <input
                  type="radio"
                  name={field.name}
                  value={option.value}
                  checked={fieldValue === option.value}
                  onChange={(e) => handlePreviewChange(field.name, e.target.value, field)}
                  className="mr-2"
                />
                <span>
                  {option.label}
                  {field.pricingEnabled && option.priceModifier !== 1.0 && ` (×${option.priceModifier})`}
                </span>
              </label>
            ))}
          </div>
        );
        
      case FIELD_TYPES.ADDRESS:
        return (
          <AddressLookup
            onAddressSelect={(address) => handlePreviewChange(field.name, address, field)}
          />
        );
        
      case FIELD_TYPES.SECTION_HEADER:
        return (
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-blue-600 pb-2 border-b">
              {field.label}
            </h3>
            {field.showDescription && field.description && (
              <p className="text-gray-600 mt-2">{field.description}</p>
            )}
          </div>
        );
        
      default:
        return (
          <div className="p-4 bg-gray-100 rounded text-center text-gray-500">
            Unsupported field type: {field.type}
          </div>
        );
    }
  };
  
  return (
    <div>
      <h3 className="font-semibold mb-4">Form Preview</h3>
      
      <div className="bg-white border rounded-lg p-6 max-h-96 overflow-y-auto">
        <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
          {/* Form Title */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900">{formConfig.name}</h2>
            {formConfig.description && (
              <p className="text-gray-600 mt-1">{formConfig.description}</p>
            )}
          </div>
          
          {/* Calendar/Time Selection Placeholder */}
          {formConfig.settings.showCalendar && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-700 font-medium">📅 Calendar Selection</p>
              <p className="text-blue-600 text-sm">Calendar and time slot selection will appear here</p>
            </div>
          )}
          
          {/* Form Fields */}
          {formConfig.fields.map((field) => (
            <div key={field.id} className="space-y-2">
              {field.type !== FIELD_TYPES.SECTION_HEADER && (
                <label className="block text-sm font-medium text-gray-700">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
              )}
              {renderField(field)}
            </div>
          ))}
          
          {/* Price Display */}
          {(calculatedPrice > 0 || formConfig.pricingLogic.basePrice > 0) && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-medium">Estimated Total:</span>
                <span className="text-xl font-bold text-blue-600">
                  £{calculatedPrice.toFixed(2)}
                </span>
              </div>
              {calculatedTime > 0 && (
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm text-gray-600">Estimated Time:</span>
                  <span className="text-sm text-gray-600">
                    {calculatedTime.toFixed(1)} hour{calculatedTime !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          )}
          
          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-medium py-3 px-6 rounded-lg hover:bg-blue-700 transition duration-200"
          >
            Book Now
          </button>
        </form>
      </div>
      
      {/* Preview Info */}
      <div className="mt-4 text-sm text-gray-600">
        <p>👆 This is how your form will look to customers</p>
        <p>Try filling out the fields to see pricing calculations in action</p>
      </div>
    </div>
  );
}

export default FormPreview;
