// src/utils/bookingFormUtils.js
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

// Shared helper functions for booking forms
export const formatDateLocal = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const formatDisplayDate = (dateStr, monthNames) => {
  if (!dateStr) return "No date selected";
  const [year, month, day] = dateStr.split('-');
  return `Selected Date: ${day} ${monthNames[parseInt(month) - 1]} ${year}`;
};

export const calculateBookedTimeSlots = (startTime, estimatedHours) => {
  const bookedSlots = {};
  const startHour = parseInt(startTime.split(':')[0]);
  
  for (let i = 0; i < estimatedHours; i++) {
    const hour = startHour + i;
    if (hour >= 7 && hour <= 20) { // Only book slots within our available range (7am-8pm)
      bookedSlots[`${hour}:00`] = true;
    }
  }
  
  return bookedSlots;
};

export const hasConsecutiveAvailableHours = (bookedTimeSlots, requiredConsecutiveHours = 2) => {
  // Generate all possible time slots (7am to 8pm)
  const allTimeSlots = [];
  for (let hour = 7; hour <= 20; hour++) {
    allTimeSlots.push(`${hour}:00`);
  }
  
  // Create an array representing all hours (true = available, false = booked)
  const availabilityMap = allTimeSlots.map(slot => !bookedTimeSlots[slot]);
  
  console.log("Checking consecutive hours for:", bookedTimeSlots);
  console.log("Availability map:", availabilityMap);
  
  // Check for consecutive available slots
  let consecutiveCount = 0;
  for (let i = 0; i < availabilityMap.length; i++) {
    if (availabilityMap[i]) {
      consecutiveCount++;
      if (consecutiveCount >= requiredConsecutiveHours) {
        console.log(`Found ${requiredConsecutiveHours} consecutive available hours`);
        return true; // Found enough consecutive slots
      }
    } else {
      consecutiveCount = 0;
    }
  }
  
  console.log("Not enough consecutive hours available");
  return false;
};

export const updateTimeSlots = async (dateStr, startTime, estimatedHours, bookingInfo) => {
  try {
    console.log(`Updating time slots for ${dateStr}, starting at ${startTime} for ${estimatedHours} hours`);
    
    // Get existing data for this date, if any
    const dateRef = doc(db, "unavailability", dateStr);
    const dateDoc = await getDoc(dateRef);
    const existingData = dateDoc.exists() ? dateDoc.data() : {};
    
    // Calculate which time slots will be booked
    const newBookedSlots = calculateBookedTimeSlots(startTime, estimatedHours);
    console.log("New booked slots:", newBookedSlots);
    
    // Merge with existing booked slots, if any
    const existingBookedSlots = existingData.bookedTimeSlots || {};
    console.log("Existing booked slots:", existingBookedSlots);
    
    const updatedBookedSlots = { ...existingBookedSlots };
    
    // Add the new booking information to each booked slot
    Object.keys(newBookedSlots).forEach(timeSlot => {
      updatedBookedSlots[timeSlot] = {
        bookedBy: bookingInfo.email,
        name: bookingInfo.name,
        phone: bookingInfo.phone,
        bookingId: bookingInfo.orderId,
        bookingTimestamp: bookingInfo.timestamp,
        // Include all relevant booking details for admin view
        bedrooms: bookingInfo.bedrooms,
        livingRooms: bookingInfo.livingRooms,
        kitchens: bookingInfo.kitchens,
        bathrooms: bookingInfo.bathrooms,
        cleanliness: bookingInfo.cleanliness,
        additionalRooms: bookingInfo.additionalRooms,
        addOns: bookingInfo.addOns,
        totalPrice: bookingInfo.totalPrice,
        estimatedHours: bookingInfo.estimatedHours,
        additionalInfo: bookingInfo.additionalInfo,
        address: bookingInfo.address,
        // Include service type if specified
        ...(bookingInfo.service ? { service: bookingInfo.service } : {})
      };
    });
    
    console.log("Updated booked slots:", updatedBookedSlots);
    
    // Check if this booking would leave at least 2 consecutive hours
    const fullyBooked = !hasConsecutiveAvailableHours(updatedBookedSlots);
    console.log(`After booking, date is ${fullyBooked ? 'fully booked' : 'partially available'}`);
    
    // Update in Firebase
    await setDoc(dateRef, {
      bookedTimeSlots: updatedBookedSlots,
      fullyBooked
    }, { merge: true });
    
    return { updatedBookedSlots, fullyBooked };
  } catch (error) {
    console.error("Error updating time slots:", error);
    throw error;
  }
};

export const notifyZapier = async (booking, bookingInfo, formData, selectedAddOns, additionalItems, priceBreakdown) => {
  try {
    // Parse date components for Trello
    const bookingDateParts = booking.selectedDate.split('-'); // [YYYY, MM, DD]
    const year = bookingDateParts[0];
    const month = bookingDateParts[1];
    const day = bookingDateParts[2];
    
    // Parse the booking time
    const bookingTimeParts = booking.selectedTime.split(':'); // [hour, minute]
    const hourInt = parseInt(bookingTimeParts[0]);
    const hour = bookingTimeParts[0].padStart(2, '0');
    const minute = bookingTimeParts[1] || '00';
    
    // Calculate UTC time that will display as the desired local time in Trello
    // Based on your result, it seems Trello is treating the time as UTC+6
    // If time is showing 6 hours ahead, subtract 6 hours to compensate
    const trelloHourInt = hourInt - 6;
    // Handle underflow (if result is negative)
    const adjustedHour = (trelloHourInt < 0) ? trelloHourInt + 24 : trelloHourInt;
    const trelloHour = adjustedHour.toString().padStart(2, '0');
    
    // Create due date for Trello with adjusted time
    const trelloDueDate = `${year}-${month}-${day}T${trelloHour}:${minute}:00`;
    const SheetsDueDate = `${year}-${month}-${day}T${hour}:${minute}:00`;

    // Format booking date for display
    const formattedBookingDate = booking.formatDisplayDate(booking.selectedDate).replace("Selected Date: ", "");
    
    // Get current date for submission timestamp
    const now = new Date();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const formattedDate = `${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    
    // Format the address for display and storage
    const formattedAddress = [
      formData.address.line1,
      formData.address.line2,
      formData.address.town,
      formData.address.county,
      formData.address.postcode
    ].filter(Boolean).join(", ");
    
    // Prepare the data with proper flat structure for Zapier
    const zapierData = {
      // Put important fields at the top level for easy access in Zapier
      customerName: formData.name,
      customerEmail: formData.email,
      customerPhone: formData.phone,
      customerAddress: formattedAddress, // Full formatted address
      customerPostcode: formData.address.postcode, // Separate postcode field
      bookingDate: formattedBookingDate,
      bookingTime: booking.selectedTime,
      dueDateTime: trelloDueDate,
      SheetsDueDate: SheetsDueDate,
      orderId: bookingInfo.orderId,
      serviceType: bookingInfo.service, // "Home Cleaning" or "Office Cleaning"
      estimatedHours: priceBreakdown.estimatedHours,
      totalPrice: priceBreakdown.totalPrice,
      additionalInfo: formData.additionalInfo || "None provided",
      submittedAt: formattedDate,
      
      // Service-specific fields (adding all possible fields)
      bedrooms: formData.bedrooms,
      livingRooms: formData.livingRooms,
      kitchens: formData.kitchens,
      bathrooms: formData.bathrooms,
      cleanliness: formData.cleanliness,
      additionalRooms: additionalItems?.join(", ") || "None",
      addOns: selectedAddOns?.join(", ") || "None",
      
      // Office-specific fields if they exist
      officeRooms: formData.officeRooms,
      officeSize: formData.officeSize,
      meetingRooms: formData.meetingRooms,
      meetingRoomSize: formData.meetingRoomSize,
      additionalAreas: additionalItems?.join(", ") || "None"
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
    
    console.log('Zapier webhook triggered successfully');
    return true;
    
  } catch (error) {
    console.error('Error sending data to Zapier:', error);
    // Continue with booking process even if Zapier fails
    return false;
  }
};

// Common form submission function
export const handleFormSubmission = async (e, booking, selectedDate, selectedTime, formData, additionalItems, addOns, priceBreakdown, serviceType, resetFormFunction) => {
  e.preventDefault();
  
  if (!selectedDate) {
    alert("Please select a date from the calendar.");
    return;
  }
  
  if (!selectedTime) {
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
    
    // Collect selected add-ons and additional rooms/areas
    const selectedAddOns = addOns.map(addon => addon.value);
    
    // Format the address for display and storage
    const formattedAddress = [
      formData.address.line1,
      formData.address.line2,
      formData.address.town,
      formData.address.county,
      formData.address.postcode
    ].filter(Boolean).join(", ");
    
    // Prepare booking info
    const bookingInfo = {
      service: serviceType, // Specify service type
      email: formData.email,
      phone: formData.phone,
      name: formData.name,
      address: formattedAddress, // Full formatted address
      postcode: formData.address.postcode, // Separate postcode field for easier access
      orderId: orderId,
      timestamp: new Date().toISOString(),
      
      // Adding all possible fields - both form types
      bedrooms: formData.bedrooms === "0" ? "0 (Studio)" : formData.bedrooms,
      livingRooms: formData.livingRooms,
      kitchens: formData.kitchens,
      bathrooms: formData.bathrooms,
      cleanliness: formData.cleanliness,
      additionalRooms: additionalItems.join(", ") || "None",
      addOns: selectedAddOns.join(", ") || "None",
      totalPrice: priceBreakdown.totalPrice,
      estimatedHours: priceBreakdown.estimatedHours,
      additionalInfo: formData.additionalInfo ?? null,
      
      // Office-specific fields if they exist
      officeRooms: formData.officeRooms,
      officeSize: formData.officeSize,
      meetingRooms: formData.meetingRooms,
      meetingRoomSize: formData.meetingRoomSize,
      additionalAreas: additionalItems.join(", ") || "None"
    };
    
    // STEP 1: Update the time slots in Firebase
    try {
      // Update time slots for this booking
      const { updatedBookedSlots, fullyBooked } = await updateTimeSlots(
        selectedDate, 
        selectedTime, 
        priceBreakdown.estimatedHours,
        bookingInfo
      );
    } catch (error) {
      console.error("Error updating time slots:", error);
      // Continue with the booking process even if there was an error updating time slots
    }

    // STEP 2: Notify Zapier - This will now handle the email notification via SMTP
    const zapierSuccess = await notifyZapier(booking, bookingInfo, formData, selectedAddOns, additionalItems, priceBreakdown);
    
    if (zapierSuccess) {
      // Show success message (no EmailJS needed)
      submitButton.innerHTML = "Booking Confirmed!";
      alert("Your booking has been confirmed! Check your email for details.");
      
      // Reset form
      booking.setSelectedDate(null);
      booking.setSelectedTime("");
      resetFormFunction();
      
      // Re-enable submit button after delay
      setTimeout(() => {
        submitButton.innerHTML = "Book Now";
        submitButton.disabled = false;
      }, 3000);
    } else {
      // If Zapier notification failed
      throw new Error("There was a problem processing your booking. Please try again.");
    }
  } catch (error) {
    console.error("Error submitting booking:", error);
    submitButton.innerHTML = "Book Now";
    submitButton.disabled = false;
    alert("Sorry, there was a problem submitting your booking. Please try again.");
  }
};