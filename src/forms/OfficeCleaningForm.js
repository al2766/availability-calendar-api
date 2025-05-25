// src/forms/OfficeCleaningForm.js
import React, { useState, useEffect } from "react";
import { collection, getDocs, setDoc, deleteDoc, doc, deleteField, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "../App.css";
import useBookingLogic from "../hooks/useBookingLogic";
import AddressLookup from "../components/AddressLookup";
import { handleFormSubmission, calculatePrice } from "../utils/bookingFormUtils";

function OfficeCleaningForm() {
  // Use the shared booking logic
  const booking = useBookingLogic("office-cleaning");
  
  // Form-specific states for Office Cleaning
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    officeRooms: "",
    officeSize: "",
    meetingRooms: "",
    meetingRoomSize: "",
    kitchens: "",
    bathrooms: "",
    utilityRooms: "", // Added utility rooms as separate field
    cleanliness: "",
    additionalInfo: "",
    access: "", // Added property access field
    keyLocation: "", // Added key location field
    products: "", // Added products field
    // Add address fields to formData
    address: {
      line1: "",
      line2: "",
      town: "",
      county: "",
      postcode: ""
    }
  });
  
  const [additionalAreas, setAdditionalAreas] = useState([]);
  const [addOns, setAddOns] = useState([]);
  const [priceBreakdown, setPriceBreakdown] = useState({
    basePrice: 0,
    additionalAreasPrice: 0,
    addonsPrice: 0,
    totalPrice: 0,
    estimatedHours: 0
  });

  // Navigate back function
  const navigateBack = () => {
    window.location.href = '/';
  };

  // Create a single function to recalculate prices whenever form data changes
  useEffect(() => {
    calculatePrice();
  }, [formData, additionalAreas, addOns]);
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle address selection from the AddressLookup component
  const handleAddressSelect = (selectedAddress) => {
    if (!selectedAddress) return;
    
    // Format the address for display and storage
    const formattedAddress = {
      line1: selectedAddress.line1 || "",
      line2: selectedAddress.line2 || "",
      town: selectedAddress.town || "",
      county: selectedAddress.county || "",
      postcode: selectedAddress.postcode || ""
    };
    
    // Save to form data
    setFormData(prev => ({
      ...prev,
      address: formattedAddress
    }));
    
    console.log("Address selected with postcode:", formattedAddress.postcode);
  };
  
  // Handle checkbox changes for additional areas
  const handleAreaCheckboxChange = (e) => {
    const { value, checked } = e.target;
    
    setAdditionalAreas(prev => {
      if (checked) {
        return [...prev, value];
      } else {
        return prev.filter(area => area !== value);
      }
    });
  };
  
  // Handle checkbox changes for add-ons
  const handleAddonCheckboxChange = (e) => {
    const { value, checked, dataset } = e.target;
    const price = parseInt(dataset.price);
    
    setAddOns(prev => {
      if (checked) {
        return [...prev, { value, price }];
      } else {
        return prev.filter(addon => addon.value !== value);
      }
    });
  };
 
  
  // Reset form function
  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      officeRooms: "",
      officeSize: "",
      meetingRooms: "",
      meetingRoomSize: "",
      kitchens: "",
      bathrooms: "",
      utilityRooms: "0",
      cleanliness: "",
      additionalInfo: "",
      access: "",
      keyLocation: "",
      products: "",
      address: {
        line1: "",
        line2: "",
        town: "",
        county: "",
        postcode: ""
      }
    });
    setAdditionalAreas([]);
    setAddOns([]);
    calculatePrice();
  };
  
  // Handle form submission using the shared utility
  const handleSubmit = (e) => {
    handleFormSubmission(
      e,
      booking,
      booking.selectedDate,
      booking.selectedTime,
      formData,
      additionalAreas,
      addOns,
      priceBreakdown,
      "Office Cleaning",
      resetForm
    );
  };

  return (
    <div className="container max-w-6xl mx-auto p-6">
            
      <div className="flex flex-wrap gap-6">
        {/* Calendar Container */}
        <div className="calendar-container flex-grow-0 w-full md:w-5/12 bg-white rounded-lg shadow-md p-6">
          {booking.loading ? (
            <p>Loading...</p>
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
        </div>
        
        {/* Form Container */}
        <div className="form-container flex-grow w-full md:w-6/12">
          <form className="fs-form bg-white rounded-lg shadow-md p-6" onSubmit={handleSubmit}>
            {/* Hidden inputs */}
            <input type="hidden" id="selected-date" value={booking.selectedDate || ""} />
            <input type="hidden" id="selected-time" value={booking.selectedTime} />
            
            {/* Selected Date Display */}
            <div className="fs-field mb-4">
              <span id="date-label" className="selected-date text-blue-600">
                {booking.formatDisplayDate(booking.selectedDate)}
              </span>
            </div>
            
            {/* Personal Information */}
            <div className="fs-section-title text-lg text-blue-600 font-medium mb-2 pb-2 border-b">
              Personal Information
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="fs-field">
                <label className="fs-label block text-gray-700 mb-1" htmlFor="name">Name</label>
                <input 
                  className="fs-input w-full p-2 border rounded-lg" 
                  type="text" 
                  id="name" 
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required 
                />
              </div>
              
              <div className="fs-field">
                <label className="fs-label block text-gray-700 mb-1" htmlFor="email">Email</label>
                <input 
                  className="fs-input w-full p-2 border rounded-lg" 
                  type="email" 
                  id="email" 
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required 
                />
              </div>
            </div>
            
            <div className="fs-field mb-4">
              <label className="fs-label block text-gray-700 mb-1" htmlFor="phone">Phone Number</label>
              <input 
                className="fs-input w-full p-2 border rounded-lg" 
                type="tel" 
                id="phone" 
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                required 
              />
            </div>
            
            {/* Address Lookup Component */}
            <AddressLookup onAddressSelect={handleAddressSelect} />
            
            {/* Property Access - New section */}
            <div className="fs-section-title text-lg text-blue-600 font-medium mb-2 pb-2 border-b">
              Property Access
            </div>
            
            <div className="grid grid-cols-1 gap-4 mb-4">
              <div className="fs-field">
                <label className="fs-label block text-gray-700 mb-1" htmlFor="access">
                  How will we access the property?
                </label>
                <select 
                  className="fs-select w-full p-2 border rounded-lg" 
                  id="access" 
                  name="access"
                  value={formData.access}
                  onChange={handleInputChange}
                  required
                >
                  <option value="" disabled>Select access method</option>
                  <option value="home">Someone will be present</option>
                  <option value="key">Key will be left in a location</option>
                </select>
              </div>
              
              {/* Conditional key location field */}
              {formData.access === "key" && (
                <div className="fs-field">
                  <label className="fs-label block text-gray-700 mb-1" htmlFor="keyLocation">
                    Please specify where the key will be located
                  </label>
                  <input 
                    className="fs-input w-full p-2 border rounded-lg" 
                    type="text" 
                    id="keyLocation" 
                    name="keyLocation"
                    value={formData.keyLocation}
                    onChange={handleInputChange}
                    placeholder="e.g., Reception desk, security office, etc."
                    required 
                  />
                </div>
              )}
            </div>
            
            {/* Office Details */}
            <div className="fs-section-title text-lg text-blue-600 font-medium mb-2 pb-2 border-b">
              Office Details
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="fs-field">
                <label className="fs-label block text-gray-700 mb-1" htmlFor="officeRooms">
                  How many office rooms?
                </label>
                <select 
                  className="fs-select w-full p-2 border rounded-lg" 
                  id="officeRooms" 
                  name="officeRooms"
                  value={formData.officeRooms}
                  onChange={handleInputChange}
                  required
                >
                  <option value="" disabled>Select number of offices</option>
                  <option value="0">0 (Open plan only)</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                  <option value="6">6</option>
                  <option value="7">7</option>
                  <option value="8">8</option>
                </select>
              </div>
              
              <div className="fs-field">
                <label className="fs-label block text-gray-700 mb-1" htmlFor="officeSize">
                  Office room size
                </label>
                <select 
                  className="fs-select w-full p-2 border rounded-lg" 
                  id="officeSize" 
                  name="officeSize"
                  value={formData.officeSize}
                  onChange={handleInputChange}
                  required
                >
                  <option value="" disabled>Select office size</option>
                  <option value="small">Small (1-3 workstations)</option>
                  <option value="medium">Medium (4-10 workstations)</option>
                  <option value="large">Large (11+ workstations)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="fs-field">
                <label className="fs-label block text-gray-700 mb-1" htmlFor="meetingRooms">
                  How many meeting rooms?
                </label>
                <select 
                  className="fs-select w-full p-2 border rounded-lg" 
                  id="meetingRooms" 
                  name="meetingRooms"
                  value={formData.meetingRooms}
                  onChange={handleInputChange}
                  required
                >
                  <option value="" disabled>Select number of meeting rooms</option>
                  <option value="0">0</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                </select>
              </div>
              
              <div className="fs-field">
                <label className="fs-label block text-gray-700 mb-1" htmlFor="meetingRoomSize">
                  Meeting room size
                </label>
                <select 
                  className="fs-select w-full p-2 border rounded-lg" 
                  id="meetingRoomSize" 
                  name="meetingRoomSize"
                  value={formData.meetingRoomSize}
                  onChange={handleInputChange}
                  required={formData.meetingRooms > 0}
                  disabled={formData.meetingRooms <= 0}
                >
                  <option value="" disabled>Select meeting room size</option>
                  <option value="small">Small (up to 6 people)</option>
                  <option value="medium">Medium (7-12 people)</option>
                  <option value="large">Large (13+ people)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="fs-field">
                <label className="fs-label block text-gray-700 mb-1" htmlFor="kitchens">
                  How many kitchens/break rooms?
                </label>
                <select 
                  className="fs-select w-full p-2 border rounded-lg" 
                  id="kitchens" 
                  name="kitchens"
                  value={formData.kitchens}
                  onChange={handleInputChange}
                  required
                >
                  <option value="" disabled>Select number</option>
                  <option value="0">0</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                </select>
              </div>
              
              <div className="fs-field">
                <label className="fs-label block text-gray-700 mb-1" htmlFor="bathrooms">
                  How many bathrooms?
                </label>
                <select 
                  className="fs-select w-full p-2 border rounded-lg" 
                  id="bathrooms" 
                  name="bathrooms"
                  value={formData.bathrooms}
                  onChange={handleInputChange}
                  required
                >
                  <option value="" disabled>Select number</option>
                  <option value="0">0</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                  <option value="6">6</option>
                  <option value="7">7</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Added utility rooms dropdown */}
              <div className="fs-field">
                <label className="fs-label block text-gray-700 mb-1" htmlFor="utilityRooms">
                  How many utility rooms?
                </label>
                <select 
                  className="fs-select w-full p-2 border rounded-lg" 
                  id="utilityRooms" 
                  name="utilityRooms"
                  value={formData.utilityRooms}
                  onChange={handleInputChange}
                  required
                >
                  <option value="" disabled>Select number of Utility rooms</option>
                  <option value="0">0</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                </select>
              </div>
              
              <div className="fs-field">
                <label className="fs-label block text-gray-700 mb-1" htmlFor="cleanliness">
                  How dirty is the office?
                </label>
                <select 
                  className="fs-select w-full p-2 border rounded-lg" 
                  id="cleanliness" 
                  name="cleanliness"
                  value={formData.cleanliness}
                  onChange={handleInputChange}
                  required
                >
                  <option value="" disabled>Select cleanliness level</option>
                  <option value="quite-clean">Quite clean</option>
                  <option value="average">Average</option>
                  <option value="quite-dirty">Quite dirty</option>
                  <option value="filthy">Filthy</option>
                </select>
              </div>
            </div>
            
            {/* Added products dropdown */}
            <div className="fs-field mb-4">
              <label className="fs-label block text-gray-700 mb-1" htmlFor="products">
                Cleaning Products
              </label>
              <select 
                className="fs-select w-full p-2 border rounded-lg" 
                id="products" 
                name="products"
                value={formData.products}
                onChange={handleInputChange}
                required
              >
                <option value="" disabled>Select option</option>
                <option value="bring">Bring our products</option>
                <option value="customer">Use office's products</option>
              </select>
            </div>
            
            {/* Additional Areas */}
            <div className="fs-section-title text-lg text-blue-600 font-medium mb-2 pb-2 border-b">
              Additional Areas
            </div>
            
            <div className="fs-checkbox-group mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="fs-checkbox-item flex items-center">
                  <input 
                    type="checkbox" 
                    id="reception" 
                    name="additional-areas[]" 
                    value="reception" 
                    className="fs-checkbox w-5 h-5 mr-2"
                    checked={additionalAreas.includes("reception")}
                    onChange={handleAreaCheckboxChange}
                  />
                  <label htmlFor="reception" className="fs-checkbox-label">Reception area</label>
                </div>
                <div className="fs-checkbox-item flex items-center">
                  <input 
                    type="checkbox" 
                    id="waiting-area" 
                    name="additional-areas[]" 
                    value="waiting-area" 
                    className="fs-checkbox w-5 h-5 mr-2"
                    checked={additionalAreas.includes("waiting-area")}
                    onChange={handleAreaCheckboxChange}
                  />
                  <label htmlFor="waiting-area" className="fs-checkbox-label">Waiting area</label>
                </div>
                <div className="fs-checkbox-item flex items-center">
                  <input 
                    type="checkbox" 
                    id="stairwell" 
                    name="additional-areas[]" 
                    value="stairwell" 
                    className="fs-checkbox w-5 h-5 mr-2"
                    checked={additionalAreas.includes("stairwell")}
                    onChange={handleAreaCheckboxChange}
                  />
                  <label htmlFor="stairwell" className="fs-checkbox-label">Stairwell</label>
                </div>
                <div className="fs-checkbox-item flex items-center">
                  <input 
                    type="checkbox" 
                    id="hallways" 
                    name="additional-areas[]" 
                    value="hallways" 
                    className="fs-checkbox w-5 h-5 mr-2"
                    checked={additionalAreas.includes("hallways")}
                    onChange={handleAreaCheckboxChange}
                  />
                  <label htmlFor="hallways" className="fs-checkbox-label">Hallways</label>
                </div>
              </div>
            </div>
            
            {/* Add-on Services */}
            <div className="fs-section-title text-lg text-blue-600 font-medium mb-2 pb-2 border-b">
              Add-on Services
            </div>
            
            <div className="fs-checkbox-group mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="fs-checkbox-item flex items-center">
                  <input 
                    type="checkbox" 
                    id="carpet-cleaning" 
                    name="add-ons[]" 
                    value="carpet-cleaning" 
                    className="fs-checkbox w-5 h-5 mr-2"
                    data-price="80"
                    checked={addOns.some(addon => addon.value === "carpet-cleaning")}
                    onChange={handleAddonCheckboxChange}
                  />
                  <label htmlFor="carpet-cleaning" className="fs-checkbox-label">
                    Carpet cleaning (£80)
                  </label>
                </div>
                <div className="fs-checkbox-item flex items-center">
                  <input 
                    type="checkbox" 
                    id="fridge" 
                    name="add-ons[]" 
                    value="fridge" 
                    className="fs-checkbox w-5 h-5 mr-2"
                    data-price="20"
                    checked={addOns.some(addon => addon.value === "fridge")}
                    onChange={handleAddonCheckboxChange}
                  />
                  <label htmlFor="fridge" className="fs-checkbox-label">
                    Fridge - empty (£20)
                  </label>
                </div>
                <div className="fs-checkbox-item flex items-center">
                  <input 
                    type="checkbox" 
                    id="microwave" 
                    name="add-ons[]" 
                    value="microwave" 
                    className="fs-checkbox w-5 h-5 mr-2"
                    data-price="15"
                    checked={addOns.some(addon => addon.value === "microwave")}
                    onChange={handleAddonCheckboxChange}
                  />
                  <label htmlFor="microwave" className="fs-checkbox-label">
                    Microwave (£15)
                  </label>
                </div>
                <div className="fs-checkbox-item flex items-center">
                  <input 
                    type="checkbox" 
                    id="window-cleaning" 
                    name="add-ons[]" 
                    value="window-cleaning" 
                    className="fs-checkbox w-5 h-5 mr-2"
                    data-price="40"
                    checked={addOns.some(addon => addon.value === "window-cleaning")}
                    onChange={handleAddonCheckboxChange}
                  />
                  <label htmlFor="window-cleaning" className="fs-checkbox-label">
                    Window cleaning (£40)
                  </label>
                </div>
                <div className="fs-checkbox-item flex items-center">
                  <input 
                    type="checkbox" 
                    id="blind-cleaning" 
                    name="add-ons[]" 
                    value="blind-cleaning" 
                    className="fs-checkbox w-5 h-5 mr-2"
                    data-price="35"
                    checked={addOns.some(addon => addon.value === "blind-cleaning")}
                    onChange={handleAddonCheckboxChange}
                  />
                  <label htmlFor="blind-cleaning" className="fs-checkbox-label">
                    Blind cleaning (£35)
                  </label>
                </div>
              </div>
            </div>
            
            {/* Additional Information */}
            <div className="fs-section-title text-lg text-blue-600 font-medium mb-2 pb-2 border-b">
              Additional Information
            </div>
            
            <div className="fs-field mb-4">
              <label className="fs-label block text-gray-700 mb-1" htmlFor="additionalInfo">
                Please share any other details that would help us
              </label>
              <textarea 
                className="fs-textarea w-full p-2 border rounded-lg min-h-24" 
                id="additionalInfo" 
                name="additionalInfo"
                value={formData.additionalInfo || ""}
                onChange={handleInputChange}
              ></textarea>
            </div>
            
            {/* Price Breakdown */}
            <div className="fs-price-breakdown bg-gray-50 p-4 rounded-lg mb-6">
              <div className="fs-price-item flex justify-between mb-2">
                <span>Base cleaning cost:</span>
                <span id="base-price">£{priceBreakdown.basePrice}</span>
              </div>
              <div className="fs-price-item flex justify-between mb-2">
                <span>Additional areas:</span>
                <span id="rooms-price">£{priceBreakdown.additionalAreasPrice}</span>
              </div>
              <div className="fs-price-item flex justify-between mb-2">
                <span>Add-on services:</span>
                <span id="addons-price">£{priceBreakdown.addonsPrice}</span>
              </div>
              <div className="fs-price-total flex justify-between pt-2 border-t mt-2 text-blue-600 font-medium">
                <span>Estimated Total:</span>
                <span id="total-price-display">£{priceBreakdown.totalPrice}</span>
              </div>
              <div className="fs-price-item flex justify-between mt-2 italic">
                <span>Estimated time:</span>
                <span id="estimated-time">{priceBreakdown.estimatedHours} hour{priceBreakdown.estimatedHours !== 1 ? 's' : ''}</span>
              </div>

                {/* New cleaner assignment note */}
  {priceBreakdown.assignTwoCleaners && (
    <div className="mt-2 p-2 bg-blue-50 text-blue-700 rounded text-sm">
      <span className="font-bold">✓ Two cleaners assigned:</span> This job will be completed in approximately {priceBreakdown.adjustedHours} hours.
    </div>
  )}
            </div>
            
            

            {/* Submit Button */}
            <div className="fs-button-group">
              <button 
                className="fs-button bg-blue-600 text-white font-medium py-3 px-6 rounded-lg hover:bg-blue-700 transition duration-200 w-full md:w-auto"
                type="submit" 
                id="submit-btn"
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

export default OfficeCleaningForm;