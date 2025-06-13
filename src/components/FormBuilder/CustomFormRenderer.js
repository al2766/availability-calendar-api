// src/components/FormBuilder/CustomFormRenderer.js
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { FIELD_TYPES } from './FieldTypes';
import useBookingLogic from '../../hooks/useBookingLogic';
import AddressLookup from '../AddressLookup';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { handleFormSubmission } from '../../utils/bookingFormUtils';
import { 
  calculateCustomFormPricing, 
  validateCustomFormData, 
  formatCustomFormSubmission,
  getDefaultFormData 
} from '../../utils/customFormUtils';

function CustomFormRenderer() {
  const { formId } = useParams();
  const [formConfig, setFormConfig] = useState(null);
  const [formData, setFormData] = useState({});
  const [priceBreakdown, setPriceBreakdown] = useState({
    basePrice: 0,
    fieldPrice: 0,
    totalPrice: 0,
    estimatedHours: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Use the shared booking logic
  const booking = useBookingLogic(`custom-form-${formId}`);
  
  // Load form configuration
  useEffect(() => {
    const loadFormConfig = async () => {
      try {
        setLoading(true);
        const formDoc = await getDoc(doc(db, 'customForms', formId));
        
        if (!formDoc.exists()) {
          setError('Form not found');
          return;
        }
        
        const config = formDoc.data();
        setFormConfig(config);
        
        // Initialize form data with default values
        const initialData = getDefaultFormData(config);
        setFormData(initialData);
        
      } catch (err) {
        console.error('Error loading form:', err);
        setError('Failed to load form');
      } finally {
        setLoading(false);
      }
    };
    
    if (formId) {
      loadFormConfig();
    }
  }, [formId]);
  
  // Calculate pricing when form data changes
  useEffect(() => {
    if (formConfig) {
      calculatePricing();
    }
  }, [formData, formConfig]);
  
  // Handle form input changes
  const handleInputChange = (fieldName, value, field) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };
  
  // Calculate pricing based on form configuration
  const calculatePricing = async () => {
    if (!formConfig) return;
    
    try {
      const pricing = await calculateCustomFormPricing(formConfig, formData);
      setPriceBreakdown(pricing);
    } catch (error) {
      console.error('Error calculating pricing:', error);
      // Fallback to basic pricing
      setPriceBreakdown({
        basePrice: formConfig.pricingLogic.basePrice || 0,
        fieldPrice: 0,
        totalPrice: formConfig.pricingLogic.basePrice || 0,
        estimatedHours: 0,
        assignTwoCleaners: false
      });
    }
  };
  
  // Handle address selection
  const handleAddressSelect = (fieldName, selectedAddress) => {
    if (!selectedAddress) return;
    
    const formattedAddress = {
      line1: selectedAddress.line1 || '',
      line2: selectedAddress.line2 || '',
      town: selectedAddress.town || '',
      county: selectedAddress.county || '',
      postcode: selectedAddress.postcode || ''
    };
    
    handleInputChange(fieldName, formattedAddress);
  };
  
  // Render individual field
  const renderField = (field) => {
    const fieldValue = formData[field.name] || '';
    
    switch (field.type) {
      case FIELD_TYPES.TEXT:
      case FIELD_TYPES.EMAIL:
      case FIELD_TYPES.PHONE:
        return (
          <input
            type={field.type === FIELD_TYPES.EMAIL ? 'email' : field.type === FIELD_TYPES.PHONE ? 'tel' : 'text'}
            value={fieldValue}
            onChange={(e) => handleInputChange(field.name, e.target.value, field)}
            placeholder={field.placeholder}
            className="w-full p-2 border rounded-lg"
            required={field.required}
            minLength={field.validation?.minLength}
            maxLength={field.validation?.maxLength}
            pattern={field.validation?.pattern}
          />
        );
        
      case FIELD_TYPES.TEXTAREA:
        return (
          <textarea
            value={fieldValue}
            onChange={(e) => handleInputChange(field.name, e.target.value, field)}
            placeholder={field.placeholder}
            rows={field.rows || 4}
            className="w-full p-2 border rounded-lg"
            required={field.required}
            minLength={field.validation?.minLength}
            maxLength={field.validation?.maxLength}
          />
        );
        
      case FIELD_TYPES.NUMBER:
        return (
          <input
            type="number"
            value={fieldValue}
            onChange={(e) => handleInputChange(field.name, e.target.value, field)}
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
            onChange={(e) => handleInputChange(field.name, e.target.value, field)}
            className="w-full p-2 border rounded-lg"
            required={field.required}
          >
            <option value="">{field.placeholder || 'Select an option...'}</option>
            {field.options?.map((option, index) => (
              <option key={index} value={option.value}>
                {option.label}
                {field.pricingEnabled && option.price > 0 && ` (+£${option.price})`}
                {field.pricingEnabled && option.priceModifier && option.priceModifier !== 1.0 && ` (×${option.priceModifier})`}
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
                    handleInputChange(field.name, newValues, field);
                  }}
                  className="mr-2"
                />
                <span>
                  {option.label}
                  {field.pricingEnabled && option.price > 0 && ` (+£${option.price})`}
                  {field.pricingEnabled && option.time > 0 && ` (+${option.time}h)`}
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
                  onChange={(e) => handleInputChange(field.name, e.target.value, field)}
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
            onAddressSelect={(address) => handleAddressSelect(field.name, address)}
          />
        );
        
      case FIELD_TYPES.SECTION_HEADER:
        return (
          <div className="mb-4 -mt-2">
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
  
  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate form data
    const validation = validateCustomFormData(formConfig, formData);
    if (!validation.isValid) {
      const errorMessages = Object.values(validation.errors).flat();
      alert('Please fix the following errors:\n' + errorMessages.join('\n'));
      return;
    }
    
    // Format submission data
    const submissionData = formatCustomFormSubmission(formConfig, formData, priceBreakdown);
    
    // Use the existing form submission utility
    handleFormSubmission(
      e,
      booking,
      booking.selectedDate,
      booking.selectedTime,
      submissionData,
      submissionData.additionalRooms,
      submissionData.addOns,
      priceBreakdown,
      formConfig.name,
      () => {
        // Reset form after successful submission
        const initialData = getDefaultFormData(formConfig);
        setFormData(initialData);
      }
    );
  };
  
  if (loading) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-center min-h-64">
          <div className="spinner mr-3"></div>
          <span>Loading form...</span>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <div className="text-center text-red-600">
          <p>Error: {error}</p>
          <button 
            onClick={() => window.location.href = '/'}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }
  
  if (!formConfig) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <div className="text-center text-gray-600">
          <p>Form configuration not found</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container max-w-6xl mx-auto p-6">
      <div className="flex flex-wrap gap-6">
        {/* Calendar Container */}
        {formConfig.settings.showCalendar && (
          <div className="calendar-container flex-grow-0 w-full md:w-5/12 bg-white rounded-lg shadow-md p-6">
            {booking.loading ? (
              <p>Loading calendar...</p>
            ) : (
              <Calendar
                activeStartDate={new Date(booking.currentYear, booking.currentMonth, 1)}
                onClickDay={booking.handleDateSelect}
                tileClassName={booking.tileClassName}
                view="month"
                className="booking-calendar"
                formatShortWeekday={(locale, date) => 
                  ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][date.getDay()]
                }
                prevLabel="< Prev"
                nextLabel="Next >"
                navigationLabel={({ date }) => `${booking.monthNames[date.getMonth()]} ${date.getFullYear()}`}
                onActiveStartDateChange={({ activeStartDate }) => {
                  booking.setCurrentMonth(activeStartDate.getMonth());
                  booking.setCurrentYear(activeStartDate.getFullYear());
                }}
                minDate={booking.getCalendarMinMaxDates().minDate}
                maxDate={booking.getCalendarMinMaxDates().maxDate}
              />
            )}
            
            {/* Time Slot Container */}
            {formConfig.settings.showTimeSlots && (
              <div className="time-slot-container mt-6 p-6 bg-white rounded-lg">
                <h2 className="time-slot-title text-lg text-blue-600 font-medium mb-4">
                  {booking.selectedDate ? "Select a Time" : "Please select a date first"}
                </h2>
                {booking.selectedDate && (
                  <div className="time-slots-grid grid grid-cols-3 gap-2 md:gap-3">
                    {booking.availableTimeSlots.map((slot, index) => (
                      slot.isLoading ? (
                        <div key="loading" className="p-3 text-center border rounded-md bg-gray-100">
                          <span className="text-gray-500">Loading...</span>
                        </div>
                      ) : slot.isError ? (
                        <div key="error" className="p-3 text-center border rounded-md bg-red-50">
                          <span className="text-red-500">Error loading slots</span>
                        </div>
                      ) : (
                        <div 
                          key={index}
                          className={`time-slot p-3 text-center border rounded-md 
                            ${!slot.available ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'cursor-pointer hover:bg-blue-100'} 
                            ${booking.selectedTime === slot.value ? 'selected' : ''}`}
                          onClick={() => slot.available && booking.handleTimeSelect(slot.value)}
                        >
                          {slot.display}
                        </div>
                      )
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Form Container */}
        <div className={`form-container flex-grow w-full ${formConfig.settings.showCalendar ? 'md:w-6/12' : ''}`}>
          <form className="fs-form bg-white rounded-lg shadow-md p-6" onSubmit={handleSubmit}>
            {/* Form Title */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">{formConfig.name}</h1>
              {formConfig.description && (
                <p className="text-gray-600 mt-2">{formConfig.description}</p>
              )}
            </div>
            
            {/* Selected Date Display */}
            {formConfig.settings.showCalendar && (
              <div className="fs-field mb-4">
                <span id="date-label" className="selected-date text-blue-600">
                  {booking.formatDisplayDate(booking.selectedDate)}
                </span>
              </div>
            )}
            
            {/* Dynamic Form Fields */}
            {formConfig.fields.map((field) => (
              <div key={field.id} className="fs-field mb-4">
                {field.type !== FIELD_TYPES.SECTION_HEADER && (
                  <label className="fs-label block text-gray-700 mb-1" htmlFor={field.name}>
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                )}
                {renderField(field)}
              </div>
            ))}
            
            {/* Price Breakdown */}
            {(priceBreakdown.totalPrice > 0 || priceBreakdown.basePrice > 0) && (
              <div className="fs-price-breakdown bg-gray-50 p-4 rounded-lg mb-6">
                {priceBreakdown.basePrice > 0 && (
                  <div className="fs-price-item flex justify-between mb-2">
                    <span>Base price:</span>
                    <span>£{priceBreakdown.basePrice.toFixed(2)}</span>
                  </div>
                )}
                {priceBreakdown.fieldPrice > 0 && (
                  <div className="fs-price-item flex justify-between mb-2">
                    <span>Additional services:</span>
                    <span>£{priceBreakdown.fieldPrice.toFixed(2)}</span>
                  </div>
                )}
                <div className="fs-price-total flex justify-between pt-2 border-t mt-2 text-blue-600 font-medium">
                  <span>Total:</span>
                  <span>£{priceBreakdown.totalPrice.toFixed(2)}</span>
                </div>
                {priceBreakdown.estimatedHours > 0 && (
                <div className="fs-price-item flex justify-between mt-2 italic">
                <span>Estimated time:</span>
                <span>{priceBreakdown.estimatedHours.toFixed(1)} hour{priceBreakdown.estimatedHours !== 1 ? 's' : ''}</span>
                </div>
                )}
              
              {/* Cleaner assignment note */}
              {priceBreakdown.assignTwoCleaners && (
                <div className="mt-2 p-2 bg-blue-50 text-blue-700 rounded text-sm">
                  <span className="font-bold">✓ Two cleaners will be assigned to this booking</span>
                </div>
              )}
              </div>
            )}
            
            {/* Submit Button */}
            <div className="fs-button-group">
              <button 
                className="fs-button bg-blue-600 text-white font-medium py-3 px-6 rounded-lg hover:bg-blue-700 transition duration-200 w-full md:w-auto"
                type="submit" 
              >
                Book Now
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CustomFormRenderer;
