// src/forms/HomeCleaningForm.js
import React, { useState, useEffect } from "react";
import { collection, getDocs, setDoc, deleteDoc, doc, deleteField, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "../App.css";
import useBookingLogic from "../hooks/useBookingLogic";
import AddressLookup from "../components/AddressLookup";
import { handleFormSubmission, calculatePrice } from "../utils/bookingFormUtils";

function HomeCleaningForm() {
  // Use the shared booking logic
  const booking = useBookingLogic("home-cleaning");
  
  // Form-specific states for Home Cleaning
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    bedrooms: "",
    livingRooms: "",
    kitchens: "",
    bathrooms: "",
    utilityRooms: "0", // Added utility rooms as separate field
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
  
  const [additionalRooms, setAdditionalRooms] = useState([]);
  const [addOns, setAddOns] = useState([]);
  const [priceBreakdown, setPriceBreakdown] = useState({
    basePrice: 0,
    roomsPrice: 0,
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
  }, [formData, additionalRooms, addOns]);
  
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
  
  // Handle checkbox changes for additional rooms
  const handleRoomCheckboxChange = (e) => {
    const { value, checked } = e.target;
    
    setAdditionalRooms(prev => {
      if (checked) {
        return [...prev, value];
      } else {
        return prev.filter(room => room !== value);
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
  
  // Calculate price based on form inputs for home cleaning
 // Calculate price based on form inputs for home cleaning
// Calculate price based on form inputs for home cleaning
const calculatePrice = async () => {
  const hourlyRate = 28; // £28 per hour
  let baseHours = 0;
  let additionalRoomsHours = 0;
  let addonsCost = 0;
  let dirtinessMultiplier = 1;
  let assignTwoCleaners = false;
  
  // Get the assignTwoCleanersAfterHours setting
  let assignTwoCleanersThreshold = 4; // Default to 4 hours
  try {
    const settingsDoc = await getDoc(doc(db, "settings", "availability"));
    if (settingsDoc.exists()) {
      assignTwoCleanersThreshold = settingsDoc.data().assignTwoCleanersAfterHours || 4;
    }
  } catch (error) {
    console.error("Error getting cleaner assignment settings:", error);
  }
  
  // Base hours calculation based on property size
  const bedrooms = parseInt(formData.bedrooms) || 0;
  const livingRooms = parseInt(formData.livingRooms) || 0;
  const kitchens = parseInt(formData.kitchens) || 0;
  const bathrooms = parseInt(formData.bathrooms) || 0;
  const utilityRooms = parseInt(formData.utilityRooms) || 0;
  
  // Calculate base hours
  baseHours += bedrooms * 0.75; // 45 mins per bedroom
  baseHours += livingRooms * 0.5; // 30 mins per living room
  baseHours += kitchens * 1.0; // 1 hour per kitchen
  baseHours += bathrooms * 0.75; // 45 mins per bathroom
  baseHours += utilityRooms * 0.5; // 30 mins per utility room
  
  // Minimum base hours
  baseHours = Math.max(baseHours, 2); // At least 2 hours
  
  // Dirtiness multiplier
  const cleanliness = formData.cleanliness;
  if (cleanliness === "quite-clean") {
    dirtinessMultiplier = 1;
  } else if (cleanliness === "average") {
    dirtinessMultiplier = 1.2;
  } else if (cleanliness === "quite-dirty") {
    dirtinessMultiplier = 1.5;
  } else if (cleanliness === "filthy") {
    dirtinessMultiplier = 2;
  }
  
  // Apply dirtiness multiplier
  baseHours *= dirtinessMultiplier;
  
  // Calculate additional rooms hours
  additionalRooms.forEach(room => {
    if (room === "garage") {
      additionalRoomsHours += 0.5; // 30 mins for garage
    } else if (room === "dining-room") {
      additionalRoomsHours += 0.5; // 30 mins for dining room
    } else if (room === "conservatory") {
      additionalRoomsHours += 0.75; // 45 mins for conservatory
    }
  });
  
  // Calculate add-ons cost
  addOns.forEach(addon => {
    addonsCost += addon.price || 0;
  });
  
  // Calculate original hours before 2-cleaner adjustment
  let totalHours = Math.ceil(baseHours + additionalRoomsHours);
  let originalHours = totalHours; // Store original hours for reference
  
  // Calculate base price before any cleaner adjustments
  let basePrice = Math.ceil(baseHours) * hourlyRate;
  let roomsPrice = Math.ceil(additionalRoomsHours) * hourlyRate;
  let totalPrice = basePrice + roomsPrice + addonsCost;
  let originalPrice = totalPrice; // Store original price for reference
  
  // Check if we need to assign 2 cleaners (if job exceeds threshold)
  if (totalHours > assignTwoCleanersThreshold) {
    assignTwoCleaners = true;
    
    // Adjust time by dividing by 1.75 (2 cleaners complete job faster)
    totalHours = Math.ceil(totalHours / 1.75);
    
    // Adjust the price proportionally
    const priceReductionFactor = totalHours / originalHours;
    basePrice = Math.ceil(basePrice * priceReductionFactor);
    roomsPrice = Math.ceil(roomsPrice * priceReductionFactor);
    totalPrice = basePrice + roomsPrice + addonsCost;
  }
  
  // Update price breakdown
  setPriceBreakdown({
    basePrice: basePrice.toFixed(2),
    roomsPrice: roomsPrice.toFixed(2),
    addonsPrice: addonsCost.toFixed(2),
    totalPrice: totalPrice.toFixed(2),
    estimatedHours: totalHours,
    originalHours: originalHours,
    originalPrice: originalPrice.toFixed(2),
    assignTwoCleaners: assignTwoCleaners
  });
};
  
  // Reset form function
  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      bedrooms: "",
      livingRooms: "",
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
    setAdditionalRooms([]);
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
      additionalRooms,
      addOns,
      priceBreakdown,
      "Home Cleaning",
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
    
  )}{/* Add this right after the Time Slot Container div in both form files */}
  {booking.staffLimitedSelected && (
    <div className="p-3 mt-2 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-md">
      <p className="text-sm">
        <strong>Note:</strong> Limited cleaners available at this time. Bookings of 4 hours or less only.
      </p>
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
                  <option value="home">I will be home</option>
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
                    placeholder="e.g., Under the plant pot, with neighbor, etc."
                    required 
                  />
                </div>
              )}
            </div>
            
            {/* Property Details */}
            <div className="fs-section-title text-lg text-blue-600 font-medium mb-2 pb-2 border-b">
              Property Details
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="fs-field">
                <label className="fs-label block text-gray-700 mb-1" htmlFor="bedrooms">
                  How many bedrooms?
                </label>
                <select 
                  className="fs-select w-full p-2 border rounded-lg" 
                  id="bedrooms" 
                  name="bedrooms"
                  value={formData.bedrooms}
                  onChange={handleInputChange}
                  required
                >
                  <option value="" disabled>Select number of bedrooms</option>
                  <option value="0">0 (Studio)</option>
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
                <label className="fs-label block text-gray-700 mb-1" htmlFor="livingRooms">
                  How many living rooms?
                </label>
                <select 
                  className="fs-select w-full p-2 border rounded-lg" 
                  id="livingRooms" 
                  name="livingRooms"
                  value={formData.livingRooms}
                  onChange={handleInputChange}
                  required
                >
                  <option value="" disabled>Select number of living rooms</option>
                  <option value="0">0</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="fs-field">
                <label className="fs-label block text-gray-700 mb-1" htmlFor="kitchens">
                  How many kitchens?
                </label>
                <select 
                  className="fs-select w-full p-2 border rounded-lg" 
                  id="kitchens" 
                  name="kitchens"
                  value={formData.kitchens}
                  onChange={handleInputChange}
                  required
                >
                  <option value="" disabled>Select number of kitchens</option>
                  <option value="0">0</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                </select>
              </div>
              
              <div className="fs-field">
                <label className="fs-label block text-gray-700 mb-1" htmlFor="bathrooms">
                  How many bathrooms/toilets?
                </label>
                <select 
                  className="fs-select w-full p-2 border rounded-lg" 
                  id="bathrooms" 
                  name="bathrooms"
                  value={formData.bathrooms}
                  onChange={handleInputChange}
                  required
                >
                  <option value="" disabled>Select number of bathrooms</option>
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
                  <option value="0">0</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                </select>
              </div>
              
              <div className="fs-field">
                <label className="fs-label block text-gray-700 mb-1" htmlFor="cleanliness">
                  How dirty is the property?
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
                <option value="customer">Use my products</option>
              </select>
            </div>
            
            {/* Additional Rooms */}
            <div className="fs-section-title text-lg text-blue-600 font-medium mb-2 pb-2 border-b">
              Additional Rooms
            </div>
            
            <div className="fs-checkbox-group mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="fs-checkbox-item flex items-center">
                  <input 
                    type="checkbox" 
                    id="garage" 
                    name="additional-rooms[]" 
                    value="garage" 
                    className="fs-checkbox w-5 h-5 mr-2"
                    checked={additionalRooms.includes("garage")}
                    onChange={handleRoomCheckboxChange}
                  />
                  <label htmlFor="garage" className="fs-checkbox-label">Garage</label>
                </div>
                <div className="fs-checkbox-item flex items-center">
                  <input 
                    type="checkbox" 
                    id="dining-room" 
                    name="additional-rooms[]" 
                    value="dining-room" 
                    className="fs-checkbox w-5 h-5 mr-2"
                    checked={additionalRooms.includes("dining-room")}
                    onChange={handleRoomCheckboxChange}
                  />
                  <label htmlFor="dining-room" className="fs-checkbox-label">Dining room</label>
                </div>
                <div className="fs-checkbox-item flex items-center">
                  <input 
                    type="checkbox" 
                    id="conservatory" 
                    name="additional-rooms[]" 
                    value="conservatory" 
                    className="fs-checkbox w-5 h-5 mr-2"
                    checked={additionalRooms.includes("conservatory")}
                    onChange={handleRoomCheckboxChange}
                  />
                  <label htmlFor="conservatory" className="fs-checkbox-label">Conservatory</label>
                </div>
                {/* Utility room removed from here as it's now in the main form */}
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
                    id="freezer" 
                    name="add-ons[]" 
                    value="freezer" 
                    className="fs-checkbox w-5 h-5 mr-2"
                    data-price="25"
                    checked={addOns.some(addon => addon.value === "freezer")}
                    onChange={handleAddonCheckboxChange}
                  />
                  <label htmlFor="freezer" className="fs-checkbox-label">
                    Freezer - empty (£25)
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
                    id="fridge-freezer" 
                    name="add-ons[]" 
                    value="fridge-freezer" 
                    className="fs-checkbox w-5 h-5 mr-2"
                    data-price="60"
                    checked={addOns.some(addon => addon.value === "fridge-freezer")}
                    onChange={handleAddonCheckboxChange}
                  />
                  <label htmlFor="fridge-freezer" className="fs-checkbox-label">
                    Fridge + freezer clean (£60)
                  </label>
                </div>
                <div className="fs-checkbox-item flex items-center">
                  <input 
                    type="checkbox" 
                    id="ironing" 
                    name="add-ons[]" 
                    value="ironing" 
                    className="fs-checkbox w-5 h-5 mr-2"
                    data-price="30"
                    checked={addOns.some(addon => addon.value === "ironing")}
                    onChange={handleAddonCheckboxChange}
                  />
                  <label htmlFor="ironing" className="fs-checkbox-label">
                    Ironing (£30)
                  </label>
                </div>
                <div className="fs-checkbox-item flex items-center">
                  <input 
                    type="checkbox" 
                    id="oven" 
                    name="add-ons[]" 
                    value="oven" 
                    className="fs-checkbox w-5 h-5 mr-2"
                    data-price="40"
                    checked={addOns.some(addon => addon.value === "oven")}
                    onChange={handleAddonCheckboxChange}
                  />
                  <label htmlFor="oven" className="fs-checkbox-label">
                    Oven (£40)
                  </label>
                </div>
                <div className="fs-checkbox-item flex items-center">
                  <input 
                    type="checkbox" 
                    id="kitchen-cupboard" 
                    name="add-ons[]" 
                    value="kitchen-cupboard" 
                    className="fs-checkbox w-5 h-5 mr-2"
                    data-price="15"
                    checked={addOns.some(addon => addon.value === "kitchen-cupboard")}
                    onChange={handleAddonCheckboxChange}
                  />
                  <label htmlFor="kitchen-cupboard" className="fs-checkbox-label">
                    Kitchen cupboard (£15 each)
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
                <div className="fs-checkbox-item flex items-center">
                  <input 
                    type="checkbox" 
                    id="curtain" 
                    name="add-ons[]" 
                    value="curtain" 
                    className="fs-checkbox w-5 h-5 mr-2"
                    data-price="40"
                    checked={addOns.some(addon => addon.value === "curtain")}
                    onChange={handleAddonCheckboxChange}
                  />
                  <label htmlFor="curtain" className="fs-checkbox-label">
                    Curtain (£40)
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
    <span>Additional rooms:</span>
    <span id="rooms-price">£{priceBreakdown.roomsPrice}</span>
  </div>
  <div className="fs-price-item flex justify-between mb-2">
    <span>Add-on services:</span>
    <span id="addons-price">£{priceBreakdown.addonsPrice}</span>
  </div>
  <div className="fs-price-total flex justify-between pt-2 border-t mt-2 text-blue-600 font-medium">
    <span>Total:</span>
    <span id="total-price-display">£{priceBreakdown.totalPrice}</span>
  </div>
  <div className="fs-price-item flex justify-between mt-2 italic">
    <span>Estimated time:</span>
    <span id="estimated-time">{priceBreakdown.estimatedHours} hour{priceBreakdown.estimatedHours !== 1 ? 's' : ''}</span>
  </div>
  
  {/* Cleaner assignment note - simplified */}
  {priceBreakdown.assignTwoCleaners && (
    <div className="mt-2 p-2 bg-blue-50 text-blue-700 rounded text-sm">
      <span className="font-bold">✓ Two cleaners will be assigned to this booking</span>
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

export default HomeCleaningForm;