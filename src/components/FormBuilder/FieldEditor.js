// src/components/FormBuilder/FieldEditor.js
import React, { useState, useEffect } from 'react';
import { FIELD_TYPES, FIELD_TEMPLATES } from './FieldTypes';

function FieldEditor({ field, onChange, onDelete }) {
  const [localField, setLocalField] = useState(field);
  
  useEffect(() => {
    setLocalField(field);
  }, [field]);
  
  const handleChange = (path, value) => {
    const updatedField = { ...localField };
    
    // Handle nested properties
    if (path.includes('.')) {
      const keys = path.split('.');
      let current = updatedField;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
    } else {
      updatedField[path] = value;
    }
    
    setLocalField(updatedField);
    onChange(updatedField);
  };
  
  const handleOptionChange = (index, optionField, value) => {
    const newOptions = [...localField.options];
    newOptions[index] = {
      ...newOptions[index],
      [optionField]: value
    };
    handleChange('options', newOptions);
  };
  
  const addOption = () => {
    const newOptions = [...(localField.options || [])];
    newOptions.push({
      value: `option_${newOptions.length + 1}`,
      label: `Option ${newOptions.length + 1}`,
      price: 0,
      time: 0,
      priceModifier: 1.0
    });
    handleChange('options', newOptions);
  };
  
  const removeOption = (index) => {
    const newOptions = localField.options.filter((_, i) => i !== index);
    handleChange('options', newOptions);
  };
  
  const fieldTemplate = FIELD_TEMPLATES[field.type];
  
  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center">
          <span className="mr-2">{fieldTemplate?.icon}</span>
          Edit Field
        </h3>
        <button
          onClick={onDelete}
          className="text-red-600 hover:text-red-800 text-sm"
        >
          Delete
        </button>
      </div>
      
      <div className="space-y-4">
        {/* Basic Properties */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Field Label *
          </label>
          <input
            type="text"
            value={localField.label}
            onChange={(e) => handleChange('label', e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="Enter field label"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Field Name *
          </label>
          <input
            type="text"
            value={localField.name}
            onChange={(e) => handleChange('name', e.target.value.replace(/[^a-zA-Z0-9_]/g, '_'))}
            className="w-full p-2 border rounded"
            placeholder="field_name"
          />
          <p className="text-xs text-gray-500 mt-1">
            Used internally to identify this field
          </p>
        </div>
        
        {/* Placeholder for text inputs */}
        {[FIELD_TYPES.TEXT, FIELD_TYPES.EMAIL, FIELD_TYPES.PHONE, FIELD_TYPES.TEXTAREA, FIELD_TYPES.SELECT].includes(field.type) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Placeholder
            </label>
            <input
              type="text"
              value={localField.placeholder || ''}
              onChange={(e) => handleChange('placeholder', e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
        )}
        
        {/* Required checkbox */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="required"
            checked={localField.required}
            onChange={(e) => handleChange('required', e.target.checked)}
            className="mr-2"
          />
          <label htmlFor="required" className="text-sm font-medium text-gray-700">
            Required field
          </label>
        </div>
        
        {/* Type-specific properties */}
        {field.type === FIELD_TYPES.TEXTAREA && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rows
            </label>
            <input
              type="number"
              value={localField.rows || 4}
              onChange={(e) => handleChange('rows', parseInt(e.target.value))}
              className="w-full p-2 border rounded"
              min="2"
              max="10"
            />
          </div>
        )}
        
        {field.type === FIELD_TYPES.NUMBER && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Value
                </label>
                <input
                  type="number"
                  value={localField.min || ''}
                  onChange={(e) => handleChange('min', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Value
                </label>
                <input
                  type="number"
                  value={localField.max || ''}
                  onChange={(e) => handleChange('max', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full p-2 border rounded"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Step
              </label>
              <input
                type="number"
                value={localField.step || 1}
                onChange={(e) => handleChange('step', parseFloat(e.target.value))}
                className="w-full p-2 border rounded"
                step="0.1"
                min="0.1"
              />
            </div>
          </>
        )}
        
        {/* Options for select, checkbox, and radio fields */}
        {[FIELD_TYPES.SELECT, FIELD_TYPES.CHECKBOX_GROUP, FIELD_TYPES.RADIO_GROUP].includes(field.type) && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Options
              </label>
              <button
                onClick={addOption}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                + Add Option
              </button>
            </div>
            
            <div className="space-y-2">
              {(localField.options || []).map((option, index) => (
                <div key={index} className="border rounded p-3">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Label</label>
                      <input
                        type="text"
                        value={option.label}
                        onChange={(e) => handleOptionChange(index, 'label', e.target.value)}
                        className="w-full p-1 border rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Value</label>
                      <input
                        type="text"
                        value={option.value}
                        onChange={(e) => handleOptionChange(index, 'value', e.target.value)}
                        className="w-full p-1 border rounded text-sm"
                      />
                    </div>
                  </div>
                  
                  {/* Pricing fields for options */}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        {field.type === FIELD_TYPES.RADIO_GROUP ? 'Price Multiplier' : 'Additional Price (£)'}
                      </label>
                      <input
                        type="number"
                        value={field.type === FIELD_TYPES.RADIO_GROUP ? (option.priceModifier || 1.0) : (option.price || 0)}
                        onChange={(e) => handleOptionChange(
                          index, 
                          field.type === FIELD_TYPES.RADIO_GROUP ? 'priceModifier' : 'price', 
                          parseFloat(e.target.value)
                        )}
                        className="w-full p-1 border rounded text-sm"
                        step={field.type === FIELD_TYPES.RADIO_GROUP ? '0.1' : '1'}
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Additional Time (hrs)</label>
                      <input
                        type="number"
                        value={option.time || 0}
                        onChange={(e) => handleOptionChange(index, 'time', parseFloat(e.target.value))}
                        className="w-full p-1 border rounded text-sm"
                        step="0.5"
                        min="0"
                      />
                    </div>
                  </div>
                  
                  <button
                    onClick={() => removeOption(index)}
                    className="text-red-600 hover:text-red-800 text-xs"
                  >
                    Remove Option
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Section header specific fields */}
        {field.type === FIELD_TYPES.SECTION_HEADER && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={localField.description || ''}
                onChange={(e) => handleChange('description', e.target.value)}
                className="w-full p-2 border rounded"
                rows="3"
                placeholder="Optional section description"
              />
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="showDescription"
                checked={localField.showDescription}
                onChange={(e) => handleChange('showDescription', e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="showDescription" className="text-sm font-medium text-gray-700">
                Show description
              </label>
            </div>
          </>
        )}
        
        {/* Pricing configuration */}
        {[FIELD_TYPES.NUMBER, FIELD_TYPES.SELECT, FIELD_TYPES.CHECKBOX_GROUP, FIELD_TYPES.RADIO_GROUP].includes(field.type) && (
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">Pricing Configuration</h4>
            
            <div className="flex items-center mb-2">
              <input
                type="checkbox"
                id="pricingEnabled"
                checked={localField.pricingEnabled}
                onChange={(e) => handleChange('pricingEnabled', e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="pricingEnabled" className="text-sm font-medium text-gray-700">
                Enable pricing for this field
              </label>
            </div>
            
            {localField.pricingEnabled && field.type === FIELD_TYPES.NUMBER && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Price per unit (£)</label>
                  <input
                    type="number"
                    value={localField.pricePerUnit || 0}
                    onChange={(e) => handleChange('pricePerUnit', parseFloat(e.target.value))}
                    className="w-full p-1 border rounded text-sm"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Time per unit (hrs)</label>
                  <input
                    type="number"
                    value={localField.timePerUnit || 0}
                    onChange={(e) => handleChange('timePerUnit', parseFloat(e.target.value))}
                    className="w-full p-1 border rounded text-sm"
                    step="0.1"
                    min="0"
                  />
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Validation rules */}
        <div className="border-t pt-4">
          <h4 className="font-medium mb-2">Validation</h4>
          
          {[FIELD_TYPES.TEXT, FIELD_TYPES.TEXTAREA].includes(field.type) && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Min Length</label>
                <input
                  type="number"
                  value={localField.validation?.minLength || ''}
                  onChange={(e) => handleChange('validation.minLength', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full p-1 border rounded text-sm"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Max Length</label>
                <input
                  type="number"
                  value={localField.validation?.maxLength || ''}
                  onChange={(e) => handleChange('validation.maxLength', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full p-1 border rounded text-sm"
                  min="0"
                />
              </div>
            </div>
          )}
          
          {field.type === FIELD_TYPES.TEXT && (
            <div className="mt-2">
              <label className="block text-xs text-gray-600 mb-1">
                Pattern (RegEx)
              </label>
              <input
                type="text"
                value={localField.validation?.pattern || ''}
                onChange={(e) => handleChange('validation.pattern', e.target.value)}
                className="w-full p-1 border rounded text-sm"
                placeholder="^[a-zA-Z ]+$"
              />
              <p className="text-xs text-gray-500 mt-1">
                Regular expression for validation
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FieldEditor;
