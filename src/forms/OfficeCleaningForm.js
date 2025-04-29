// src/forms/OfficeCleaningForm.js
import React, { useState, useEffect } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { setDoc } from "firebase/firestore";
import { db } from "../firebase";
import "../App.css";
import useBookingLogic from "../hooks/useBookingLogic";

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
    cleanliness: "",
    additionalInfo: ""
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
  
  // Calculate price based on form inputs for office cleaning
  const calculatePrice = () => {
    const hourlyRate = 28; // £28 per hour
    let baseHours = 0;
    let additionalAreasHours = 0;
    let addonsCost = 0;
    let dirtinessMultiplier = 1;
    
    // Base hours calculation based on office size and rooms
    const officeRooms = parseInt(formData.officeRooms) || 0;
    const meetingRooms = parseInt(formData.meetingRooms) || 0;
    const kitchens = parseInt(formData.kitchens) || 0;
    const bathrooms = parseInt(formData.bathrooms) || 0;
    
    // Office rooms calculation based on size category
    if (officeRooms > 0) {
      // Adjust hours based on office size
      const roomSizeMultiplier = 
        formData.officeSize === "small" ? 0.5 :  // Small: 30 mins per office
        formData.officeSize === "medium" ? 0.75 : // Medium: 45 mins per office
        formData.officeSize === "large" ? 1.0 : 0.75; // Large: 1 hour per office, default to medium
      
      baseHours += officeRooms * roomSizeMultiplier;
    }
    
    // Meeting rooms calculation based on size category
    if (meetingRooms > 0) {
      const meetingSizeMultiplier = 
        formData.meetingRoomSize === "small" ? 0.5 :  // Small: 30 mins per meeting room
        formData.meetingRoomSize === "medium" ? 0.75 : // Medium: 45 mins per meeting room
        formData.meetingRoomSize === "large" ? 1.25 : 0.75; // Large: 1 hour 15 mins per meeting room, default to medium
      
      baseHours += meetingRooms * meetingSizeMultiplier;
    }
    
    // Add time for kitchens and bathrooms
    baseHours += kitchens * 1.0; // 1 hour per kitchen
    baseHours += bathrooms * 0.5; // 30 mins per bathroom
    
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
    
    // Calculate additional areas hours
    additionalAreas.forEach(area => {
      if (area === "reception") {
        additionalAreasHours += 0.5; // 30 mins for reception
      } else if (area === "waiting-area") {
        additionalAreasHours += 0.5; // 30 mins for waiting area
      } else if (area === "stairwell") {
        additionalAreasHours += 0.75; // 45 mins for stairwell
      } else if (area === "hallways") {
        additionalAreasHours += 0.5; // 30 mins for hallways
      }
    });
    
    // Calculate add-ons cost
    addOns.forEach(addon => {
      addonsCost += addon.price || 0;
    });
    
    // Calculate costs
    const basePrice = Math.ceil(baseHours) * hourlyRate;
    const additionalAreasPrice = Math.ceil(additionalAreasHours) * hourlyRate;
    const totalHours = Math.ceil(baseHours + additionalAreasHours);
    const totalPrice = basePrice + additionalAreasPrice + addonsCost;
    
    // Update price breakdown
    setPriceBreakdown({
      basePrice: basePrice.toFixed(2),
      additionalAreasPrice: additionalAreasPrice.toFixed(2),
      addonsPrice: addonsCost.toFixed(2),
      totalPrice: totalPrice.toFixed(2),
      estimatedHours: totalHours
    });
  };
  
  // Handle form submission with race condition prevention
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!booking.selectedDate) {
      alert("Please select a date from the calendar.");
      return;
    }
    
    if (!booking.selectedTime) {
      alert("Please select a time slot.");
      return;
    }
    
    // Get submit button
    const submitButton = document.getElementById("submit-btn");
    submitButton.disabled = true;
    submitButton.innerHTML = `<span class="spinner"></span> Submitting...`;
    
    try {
      // Generate order ID
      const orderId = "LUX" + Date.now().toString().slice(-6);
      const serviceType = "Office Cleaning"
      
      // Collect selected add-ons and additional areas
      const selectedAddOns = addOns.map(addon => addon.value);
      
      // Map office size to descriptive text
      const officeSizeText = 
        formData.officeSize === "small" ? "Small (1-3 workstations)" :
        formData.officeSize === "medium" ? "Medium (4-10 workstations)" :
        formData.officeSize === "large" ? "Large (11+ workstations)" : 
        formData.officeSize;
        
      // Map meeting room size to descriptive text
      const meetingRoomSizeText = 
        formData.meetingRoomSize === "small" ? "Small (up to 6 people)" :
        formData.meetingRoomSize === "medium" ? "Medium (7-12 people)" :
        formData.meetingRoomSize === "large" ? "Large (13+ people)" : 
        formData.meetingRoomSize;
      
      // Prepare booking info with service type
      const bookingInfo = {
        service: "Office Cleaning", // Specify service type
        email: formData.email,
        phone: formData.phone,
        name: formData.name,
        orderId: orderId,
        timestamp: new Date().toISOString(),
        officeRooms: formData.officeRooms,
        officeSize: officeSizeText,
        meetingRooms: formData.meetingRooms,
        meetingRoomSize: meetingRoomSizeText,
        kitchens: formData.kitchens,
        bathrooms: formData.bathrooms,
        cleanliness: formData.cleanliness,
        additionalAreas: additionalAreas.join(", ") || "None",
        addOns: selectedAddOns.join(", ") || "None",
        totalPrice: priceBreakdown.totalPrice,
        estimatedHours: priceBreakdown.estimatedHours,
        additionalInfo: formData.additionalInfo ?? null
      };
      
      // Prepare form data for email template
      const templateParams = {
        service: "Office Cleaning", // Add service type 
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        date: booking.formatDisplayDate(booking.selectedDate).replace("Selected Date: ", ""),
        time: booking.selectedTime,
        officeRooms: formData.officeRooms,
        officeSize: officeSizeText,
        meetingRooms: formData.meetingRooms,
        meetingRoomSize: meetingRoomSizeText,
        kitchens: formData.kitchens,
        bathrooms: formData.bathrooms,
        cleanliness: formData.cleanliness,
        additionalAreas: additionalAreas.join(", ") || "None",
        addOns: selectedAddOns.join(", ") || "None",
        totalPrice: `£${priceBreakdown.totalPrice}`,
        estimatedHours: `${priceBreakdown.estimatedHours} hour(s)`,
        order_id: orderId,
        additionalInfo: formData.additionalInfo || "None provided"
      };
      
      // FIRST: Update the time slots in Firebase
      try {
        // Update time slots for this booking
        const { updatedBookedSlots, fullyBooked } = await booking.updateTimeSlots(
          booking.selectedDate, 
          booking.selectedTime, 
          priceBreakdown.estimatedHours,
          bookingInfo
        );
      } catch (error) {
        console.error("Error updating time slots:", error);
        // Continue with the booking process even if there was an error updating time slots
      }

    // Use this function in both HomeCleaningForm.js and OfficeCleaningForm.js
const notifyZapier = async () => {
    try {
      // Prepare the data with proper flat structure for Zapier
      const zapierData = {
        // Put important fields at the top level for easy access in Zapier
        customerName: formData.name,
        customerEmail: formData.email,
        customerPhone: formData.phone,
        bookingDate: booking.formatDisplayDate(booking.selectedDate).replace("Selected Date: ", ""),
        bookingTime: booking.selectedTime,
        orderId: orderId,
        serviceType: serviceType, // "Home Cleaning" or "Office Cleaning"
        estimatedHours: priceBreakdown.estimatedHours,
        totalPrice: priceBreakdown.totalPrice,
        additionalInfo: formData.additionalInfo || "None provided",
        submittedAt: new Date().toISOString(),
        
        // Include detailed property info in a nested object
        // This keeps it organized but doesn't interfere with top-level fields

          // For Home Cleaning Form
        //   bedrooms: formData.bedrooms,
        //   livingRooms: formData.livingRooms,
        //   kitchens: formData.kitchens,
        //   bathrooms: formData.bathrooms,
        //   cleanliness: formData.cleanliness,
        //   additionalAreas: additionalAreas?.join(", ") || "None",
        //   addOns: selectedAddOns?.join(", ") || "None"
          
          // For Office Cleaning Form, include these fields instead (in OfficeCleaningForm.js)
          
          officeRooms: formData.officeRooms,
          officeSize: officeSizeText,
          meetingRooms: formData.meetingRooms,
          meetingRoomSize: meetingRoomSizeText,
          kitchens: formData.kitchens,
          bathrooms: formData.bathrooms,
          cleanliness: formData.cleanliness,
          additionalAreas: additionalAreas?.join(", ") || "None",
          addOns: selectedAddOns?.join(", ") || "None"
          
        
      };
      
      console.log('Sending data to Zapier:', zapierData);
      
      // Send booking data to Zapier webhook
      const response = await fetch('https://hooks.zapier.com/hooks/catch/22652608/2pozxou/', {
        method: 'POST',
        mode: "no-cors",
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(zapierData)
      });
      
      if (response.status) {
        console.log('Zapier webhook triggered successfully');
      } else {
        console.error('Zapier webhook failed with status:', response.status);
      }
    } catch (error) {
      console.error('Error sending data to Zapier:', error);
      // Continue with booking process even if Zapier fails
    }
  };
  
  // Call the function in your handleSubmit function:
  await notifyZapier();
      
      // SECOND: Send email confirmation
      if (window.emailjs) {
        await window.emailjs.send('service_04pgv28', 'template_0cbdpse', templateParams);
        
        submitButton.innerHTML = "Booking Confirmed!";
        alert("Your booking has been confirmed! Check your email for details.");
        
        // Reset form
        booking.setSelectedDate(null);
        booking.setSelectedTime("");
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
          cleanliness: "",
          additionalInfo: ""
        });
        setAdditionalAreas([]);
        setAddOns([]);
        calculatePrice();
        
        // Re-enable submit button after delay
        setTimeout(() => {
          submitButton.innerHTML = "Book Now";
          submitButton.disabled = false;
        }, 3000);
      } else {
        console.error("EmailJS not loaded");
        throw new Error("Email service not available");
      }
    } catch (error) {
      console.error("Error submitting booking:", error);
      submitButton.innerHTML = "Book Now";
      submitButton.disabled = false;
      alert("Sorry, there was a problem submitting your booking. Please try again.");
    }
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
                  <div 
                    key={index}
                    className={`time-slot p-3 text-center border rounded-md 
                      ${!slot.available ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'cursor-pointer hover:bg-blue-100'} 
                      ${booking.selectedTime === slot.value ? 'selected' : ''}`}
                    onClick={() => slot.available && booking.handleTimeSelect(slot.value)}
                  >
                    {slot.display}
                  </div>
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
                  <option value="5">5-8</option>
                  <option value="9">9+</option>
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
                  <option value="4">4+</option>
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
                  <option value="3">3+</option>
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
                  <option value="4">4+</option>
                </select>
              </div>
            </div>
            
            <div className="fs-field mb-4">
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
                <span>Total:</span>
                <span id="total-price-display">£{priceBreakdown.totalPrice}</span>
              </div>
              <div className="fs-price-item flex justify-between mt-2 italic">
                <span>Estimated time:</span>
                <span id="estimated-time">{priceBreakdown.estimatedHours} hour{priceBreakdown.estimatedHours !== 1 ? 's' : ''}</span>
              </div>
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