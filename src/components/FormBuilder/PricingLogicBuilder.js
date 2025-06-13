// src/components/FormBuilder/PricingLogicBuilder.js
import React, { useState } from 'react';
import { FIELD_TYPES } from './FieldTypes';

function PricingLogicBuilder({ pricingLogic, fields, onChange }) {
  const [selectedRule, setSelectedRule] = useState(null);
  
  const handleBasicSettingsChange = (field, value) => {
    onChange({
      ...pricingLogic,
      [field]: value
    });
  };
  
  const addPricingRule = () => {
    const newRule = {
      id: `rule_${Date.now()}`,
      name: 'New Rule',
      type: 'field_based', // 'field_based', 'conditional', 'formula'
      enabled: true,
      condition: {
        field: '',
        operator: 'equals', // 'equals', 'greater_than', 'less_than', 'contains'
        value: ''
      },
      action: {
        type: 'add_price', // 'add_price', 'multiply_price', 'set_time'
        value: 0
      }
    };
    
    onChange({
      ...pricingLogic,
      rules: [...pricingLogic.rules, newRule]
    });
    
    setSelectedRule(newRule);
  };
  
  const updateRule = (ruleId, updatedRule) => {
    onChange({
      ...pricingLogic,
      rules: pricingLogic.rules.map(rule =>
        rule.id === ruleId ? { ...rule, ...updatedRule } : rule
      )
    });
  };
  
  const deleteRule = (ruleId) => {
    onChange({
      ...pricingLogic,
      rules: pricingLogic.rules.filter(rule => rule.id !== ruleId)
    });
    setSelectedRule(null);
  };
  
  const getPricingFields = () => {
    return fields.filter(field => 
      field.pricingEnabled || 
      [FIELD_TYPES.NUMBER, FIELD_TYPES.SELECT, FIELD_TYPES.CHECKBOX_GROUP, FIELD_TYPES.RADIO_GROUP].includes(field.type)
    );
  };
  
  return (
    <div>
      <h3 className="font-semibold mb-4">Pricing Logic</h3>
      
      {/* Basic Pricing Settings */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <h4 className="font-medium mb-3">Basic Settings</h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Base Price (£)
            </label>
            <input
              type="number"
              value={pricingLogic.basePrice}
              onChange={(e) => handleBasicSettingsChange('basePrice', parseFloat(e.target.value) || 0)}
              className="w-full p-2 border rounded"
              min="0"
              step="0.01"
            />
            <p className="text-xs text-gray-500 mt-1">
              Starting price before any calculations
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hourly Rate (£)
            </label>
            <input
              type="number"
              value={pricingLogic.hourlyRate}
              onChange={(e) => handleBasicSettingsChange('hourlyRate', parseFloat(e.target.value) || 0)}
              className="w-full p-2 border rounded"
              min="0"
              step="0.01"
            />
            <p className="text-xs text-gray-500 mt-1">
              Rate per hour for time-based calculations
            </p>
          </div>
        </div>
      </div>
      
      {/* Pricing Rules */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium">Pricing Rules</h4>
          <button
            onClick={addPricingRule}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Add Rule
          </button>
        </div>
        
        {pricingLogic.rules.length === 0 ? (
          <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
            <p>No pricing rules created yet.</p>
            <p className="text-sm">Add rules to customize your pricing logic.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pricingLogic.rules.map((rule) => (
              <div
                key={rule.id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedRule?.id === rule.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedRule(rule)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateRule(rule.id, { enabled: e.target.checked });
                        }}
                        className="mr-2"
                      />
                      <span className="font-medium">{rule.name}</span>
                    </div>
                    <span className="ml-2 px-2 py-1 text-xs bg-gray-200 rounded">
                      {rule.type.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRule(rule);
                      }}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteRule(rule.id);
                      }}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                
                <div className="mt-2 text-sm text-gray-600">
                  {rule.condition.field && (
                    <span>
                      When <strong>{fields.find(f => f.name === rule.condition.field)?.label || rule.condition.field}</strong> {rule.condition.operator} <strong>{rule.condition.value}</strong>
                      {rule.action.type === 'add_price' && <span>, add £{rule.action.value}</span>}
                      {rule.action.type === 'multiply_price' && <span>, multiply price by {rule.action.value}</span>}
                      {rule.action.type === 'set_time' && <span>, set time to {rule.action.value} hours</span>}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Rule Editor */}
      {selectedRule && (
        <div className="bg-white border rounded-lg p-4">
          <h4 className="font-medium mb-4">Edit Rule: {selectedRule.name}</h4>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rule Name
              </label>
              <input
                type="text"
                value={selectedRule.name}
                onChange={(e) => updateRule(selectedRule.id, { name: e.target.value })}
                className="w-full p-2 border rounded"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rule Type
              </label>
              <select
                value={selectedRule.type}
                onChange={(e) => updateRule(selectedRule.id, { type: e.target.value })}
                className="w-full p-2 border rounded"
              >
                <option value="field_based">Field Based</option>
                <option value="conditional">Conditional</option>
                <option value="formula">Custom Formula</option>
              </select>
            </div>
            
            {selectedRule.type === 'field_based' && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Field
                    </label>
                    <select
                      value={selectedRule.condition.field}
                      onChange={(e) => updateRule(selectedRule.id, {
                        condition: { ...selectedRule.condition, field: e.target.value }
                      })}
                      className="w-full p-2 border rounded"
                    >
                      <option value="">Select field...</option>
                      {getPricingFields().map(field => (
                        <option key={field.name} value={field.name}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Operator
                    </label>
                    <select
                      value={selectedRule.condition.operator}
                      onChange={(e) => updateRule(selectedRule.id, {
                        condition: { ...selectedRule.condition, operator: e.target.value }
                      })}
                      className="w-full p-2 border rounded"
                    >
                      <option value="equals">Equals</option>
                      <option value="greater_than">Greater than</option>
                      <option value="less_than">Less than</option>
                      <option value="contains">Contains</option>
                      <option value="not_empty">Not empty</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Value
                    </label>
                    <input
                      type="text"
                      value={selectedRule.condition.value}
                      onChange={(e) => updateRule(selectedRule.id, {
                        condition: { ...selectedRule.condition, value: e.target.value }
                      })}
                      className="w-full p-2 border rounded"
                      placeholder="Comparison value"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Action
                    </label>
                    <select
                      value={selectedRule.action.type}
                      onChange={(e) => updateRule(selectedRule.id, {
                        action: { ...selectedRule.action, type: e.target.value }
                      })}
                      className="w-full p-2 border rounded"
                    >
                      <option value="add_price">Add to price</option>
                      <option value="multiply_price">Multiply price</option>
                      <option value="add_time">Add time</option>
                      <option value="multiply_time">Multiply time</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {selectedRule.action.type === 'add_price' ? 'Amount (£)' :
                       selectedRule.action.type === 'multiply_price' ? 'Multiplier' :
                       selectedRule.action.type === 'add_time' ? 'Hours' :
                       'Multiplier'}
                    </label>
                    <input
                      type="number"
                      value={selectedRule.action.value}
                      onChange={(e) => updateRule(selectedRule.id, {
                        action: { ...selectedRule.action, value: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full p-2 border rounded"
                      step={selectedRule.action.type.includes('multiply') ? '0.1' : '1'}
                      min="0"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Pricing Preview */}
      <div className="mt-6 bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium mb-3">Pricing Preview</h4>
        <div className="text-sm text-gray-600">
          <p>Base Price: £{pricingLogic.basePrice}</p>
          <p>Hourly Rate: £{pricingLogic.hourlyRate}/hour</p>
          <p>Active Rules: {pricingLogic.rules.filter(r => r.enabled).length}</p>
          {pricingLogic.rules.filter(r => r.enabled).length === 0 && (
            <p className="text-yellow-600">⚠️ No active pricing rules. Only base price will be used.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default PricingLogicBuilder;
