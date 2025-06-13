// src/components/FormBuilder/FormBuilder.js
import React, { useState, useEffect } from 'react';
import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  FIELD_TEMPLATES, 
  FIELD_CATEGORIES, 
  createField, 
  getFieldsByCategory,
  validateFieldConfig 
} from './FieldTypes';
import FieldEditor from './FieldEditor';
import FormPreview from './FormPreview';
import PricingLogicBuilder from './PricingLogicBuilder';

function FormBuilder({ onSave, onCancel, existingForm = null, isEditMode = false }) {
  // Form builder state
  const [formConfig, setFormConfig] = useState({
    id: null,
    name: '',
    description: '',
    fields: [],
    pricingLogic: {
      basePrice: 0,
      hourlyRate: 28,
      rules: []
    },
    settings: {
      showCalendar: true,
      showTimeSlots: true,
      requirePayment: false,
      sendConfirmationEmail: true
    },
    createdAt: null,
    updatedAt: null
  });
  
  const [activeTab, setActiveTab] = useState('fields'); // 'fields', 'pricing', 'settings', 'preview'
  const [selectedField, setSelectedField] = useState(null);
  const [draggedField, setDraggedField] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  
  // Load existing form if in edit mode
  useEffect(() => {
    if (isEditMode && existingForm) {
      setFormConfig(existingForm);
    }
  }, [isEditMode, existingForm]);
  
  // Handle form name and description changes
  const handleFormConfigChange = (field, value) => {
    setFormConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Add field to form
  const addField = (fieldType) => {
    const newField = createField(fieldType);
    setFormConfig(prev => ({
      ...prev,
      fields: [...prev.fields, newField]
    }));
    setSelectedField(newField);
  };
  
  // Update field configuration
  const updateField = (fieldId, updatedField) => {
    setFormConfig(prev => ({
      ...prev,
      fields: prev.fields.map(field => 
        field.id === fieldId ? { ...field, ...updatedField } : field
      )
    }));
  };
  
  // Delete field
  const deleteField = (fieldId) => {
    setFormConfig(prev => ({
      ...prev,
      fields: prev.fields.filter(field => field.id !== fieldId)
    }));
    setSelectedField(null);
  };
  
  // Reorder fields
  const reorderFields = (dragIndex, dropIndex) => {
    const newFields = [...formConfig.fields];
    const draggedField = newFields[dragIndex];
    newFields.splice(dragIndex, 1);
    newFields.splice(dropIndex, 0, draggedField);
    
    setFormConfig(prev => ({
      ...prev,
      fields: newFields
    }));
  };
  
  // Handle drag and drop
  const handleDragStart = (e, field, index) => {
    setDraggedField({ field, index });
    e.dataTransfer.effectAllowed = 'move';
  };
  
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  
  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedField && draggedField.index !== dropIndex) {
      reorderFields(draggedField.index, dropIndex);
    }
    setDraggedField(null);
  };
  
  // Validate form
  const validateForm = () => {
    const validationErrors = [];
    
    if (!formConfig.name.trim()) {
      validationErrors.push('Form name is required');
    }
    
    if (formConfig.fields.length === 0) {
      validationErrors.push('At least one field is required');
    }
    
    // Validate field names are unique
    const fieldNames = formConfig.fields.map(f => f.name);
    const duplicateNames = fieldNames.filter((name, index) => fieldNames.indexOf(name) !== index);
    if (duplicateNames.length > 0) {
      validationErrors.push(`Duplicate field names: ${duplicateNames.join(', ')}`);
    }
    
    // Validate individual fields
    formConfig.fields.forEach((field, index) => {
      const fieldErrors = validateFieldConfig(field);
      if (fieldErrors.length > 0) {
        validationErrors.push(`Field ${index + 1}: ${fieldErrors.join(', ')}`);
      }
    });
    
    setErrors(validationErrors);
    return validationErrors.length === 0;
  };
  
  // Save form
  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }
    
    setSaving(true);
    
    try {
      const formId = formConfig.id || `form_${Date.now()}`;
      const now = new Date().toISOString();
      
      const formData = {
        ...formConfig,
        id: formId,
        updatedAt: now,
        createdAt: formConfig.createdAt || now
      };
      
      await setDoc(doc(db, 'customForms', formId), formData);
      
      if (onSave) {
        onSave(formData);
      }
      
      alert(`Form ${isEditMode ? 'updated' : 'created'} successfully!`);
    } catch (error) {
      console.error('Error saving form:', error);
      alert(`Error ${isEditMode ? 'updating' : 'creating'} form. Please try again.`);
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div className="form-builder min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isEditMode ? 'Edit Form' : 'Form Builder'}
              </h1>
              <p className="text-gray-600">
                {isEditMode ? `Editing: ${formConfig.name}` : 'Create a custom booking form'}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : (isEditMode ? 'Update Form' : 'Save Form')}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Form Configuration */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Field Library */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold mb-4">Form Settings</h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Form Name *
                </label>
                <input
                  type="text"
                  value={formConfig.name}
                  onChange={(e) => handleFormConfigChange('name', e.target.value)}
                  className="w-full p-2 border rounded-lg"
                  placeholder="e.g., Office Cleaning"
                />
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formConfig.description}
                  onChange={(e) => handleFormConfigChange('description', e.target.value)}
                  className="w-full p-2 border rounded-lg"
                  rows="3"
                  placeholder="Brief description of this form..."
                />
              </div>
              
              <h3 className="font-semibold mb-4">Field Library</h3>
              
              {/* Field Categories */}
              {Object.values(FIELD_CATEGORIES).map(category => (
                <div key={category} className="mb-4">
                  <h4 className="text-sm font-medium text-gray-500 uppercase mb-2">
                    {category.replace('_', ' ')}
                  </h4>
                  <div className="space-y-1">
                    {getFieldsByCategory(category).map(fieldTemplate => (
                      <button
                        key={fieldTemplate.type}
                        onClick={() => addField(fieldTemplate.type)}
                        className="w-full flex items-center p-2 text-left text-sm bg-gray-50 hover:bg-gray-100 rounded border border-dashed border-gray-300"
                      >
                        <span className="mr-2">{fieldTemplate.icon}</span>
                        {fieldTemplate.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="bg-white rounded-lg shadow-sm mb-6">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex">
                  {[
                    { id: 'fields', label: 'Fields', count: formConfig.fields.length },
                    { id: 'pricing', label: 'Pricing' },
                    { id: 'settings', label: 'Settings' },
                    { id: 'preview', label: 'Preview' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`py-3 px-6 border-b-2 font-medium text-sm ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {tab.label}
                      {tab.count !== undefined && (
                        <span className="ml-2 px-2 py-1 text-xs bg-gray-200 rounded-full">
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </nav>
              </div>
              
              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'fields' && (
                  <div>
                    <h3 className="font-semibold mb-4">Form Fields</h3>
                    
                    {formConfig.fields.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <p>No fields added yet.</p>
                        <p className="text-sm">Drag fields from the library to get started.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {formConfig.fields.map((field, index) => (
                          <div
                            key={field.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, field, index)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, index)}
                            className={`p-4 border rounded-lg cursor-move hover:shadow-md transition-shadow ${
                              selectedField?.id === field.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                            }`}
                            onClick={() => setSelectedField(field)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <span className="mr-2">{FIELD_TEMPLATES[field.type]?.icon}</span>
                                <div>
                                  <span className="font-medium">{field.label}</span>
                                  <span className="text-sm text-gray-500 ml-2">({field.type})</span>
                                  {field.required && (
                                    <span className="text-red-500 ml-1">*</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedField(field);
                                  }}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteField(field.id);
                                  }}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {activeTab === 'pricing' && (
                  <PricingLogicBuilder
                    pricingLogic={formConfig.pricingLogic}
                    fields={formConfig.fields}
                    onChange={(pricingLogic) => handleFormConfigChange('pricingLogic', pricingLogic)}
                  />
                )}
                
                {activeTab === 'settings' && (
                  <div>
                    <h3 className="font-semibold mb-4">Form Settings</h3>
                    <div className="space-y-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formConfig.settings.showCalendar}
                          onChange={(e) => handleFormConfigChange('settings', {
                            ...formConfig.settings,
                            showCalendar: e.target.checked
                          })}
                          className="mr-2"
                        />
                        Show calendar for date selection
                      </label>
                      
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formConfig.settings.showTimeSlots}
                          onChange={(e) => handleFormConfigChange('settings', {
                            ...formConfig.settings,
                            showTimeSlots: e.target.checked
                          })}
                          className="mr-2"
                        />
                        Show time slot selection
                      </label>
                      
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formConfig.settings.sendConfirmationEmail}
                          onChange={(e) => handleFormConfigChange('settings', {
                            ...formConfig.settings,
                            sendConfirmationEmail: e.target.checked
                          })}
                          className="mr-2"
                        />
                        Send confirmation email after booking
                      </label>
                    </div>
                  </div>
                )}
                
                {activeTab === 'preview' && (
                  <FormPreview formConfig={formConfig} />
                )}
              </div>
            </div>
            
            {/* Validation Errors */}
            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-red-800 mb-2">Please fix the following errors:</h4>
                <ul className="list-disc list-inside text-red-700 space-y-1">
                  {errors.map((error, index) => (
                    <li key={index} className="text-sm">{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          {/* Right Sidebar - Field Editor */}
          <div className="lg:col-span-1">
            {selectedField ? (
              <FieldEditor
                field={selectedField}
                onChange={(updatedField) => updateField(selectedField.id, updatedField)}
                onDelete={() => deleteField(selectedField.id)}
              />
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-4">
                <p className="text-gray-500 text-center">
                  Select a field to edit its properties
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default FormBuilder;
