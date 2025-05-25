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

// In bookingFormUtils.js
export const formatDisplayDate = (dateStr, monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]) => {
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

// In bookingFormUtils.js - Modify the existing updateTimeSlots function:

export const updateTimeSlots = async (dateStr, startTime, estimatedHours, bookingInfo) => {
  try {
    console.log(`Updating time slots for ${dateStr}, starting at ${startTime} for ${estimatedHours} hours`);
    console.log("Booking info:", bookingInfo);
    
    // Get existing data for this date, if any
    const dateRef = doc(db, "unavailability", dateStr);
    const dateDoc = await getDoc(dateRef);
    const existingData = dateDoc.exists() ? dateDoc.data() : {};
    
    // CRITICAL FIX: Get original hours and assignment status from bookingInfo if available
    // This handles the case where the estimatedHours is already adjusted for 2 cleaners
    let originalHours = bookingInfo.originalHours || estimatedHours;
    let assignTwoCleaners = bookingInfo.assignTwoCleaners || false;
    
    // If assignTwoCleaners isn't explicitly provided, check based on original hours
    if (!assignTwoCleaners) {
      try {
        const settingsDoc = await getDoc(doc(db, "settings", "availability"));
        const settings = settingsDoc.exists() ? settingsDoc.data() : {};
        
        // Using originalHours for the check, not adjusted estimatedHours
        if (settings.assignTwoCleanersAfterHours > 0 && 
            originalHours > settings.assignTwoCleanersAfterHours) {
          assignTwoCleaners = true;
          console.log(`Job requires 2 cleaners based on original hours: ${originalHours} > ${settings.assignTwoCleanersAfterHours}`);
        }
      } catch (error) {
        console.error("Error getting cleaner assignment settings:", error);
      }
    } else {
      console.log(`Job already flagged as requiring 2 cleaners`);
    }
    
    // Calculate which time slots will be booked - using the provided estimatedHours
    // which might already be adjusted for 2 cleaners
    const newBookedSlots = calculateBookedTimeSlots(startTime, estimatedHours);
    console.log("New booked slots:", newBookedSlots);
    
    // Merge with existing booked slots, if any
    const existingBookedSlots = existingData.bookedTimeSlots || {};
    console.log("Existing booked slots:", existingBookedSlots);
    
    const updatedBookedSlots = { ...existingBookedSlots };
    
    // Add the new booking information to each booked slot
Object.keys(newBookedSlots).forEach(timeSlot => {
  updatedBookedSlots[`${timeSlot}-${bookingInfo.orderId}`] = {
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
        ...(bookingInfo.service ? { service: bookingInfo.service } : {}),
        
        // FIXED: Store accurate staff assignment information
        assignTwoCleaners: assignTwoCleaners,
        originalHours: originalHours, // Store the true original hours, not adjusted
        actualHours: assignTwoCleaners ? Math.ceil(originalHours / 1.75) : originalHours, // Adjusted hours
        staffRequired: assignTwoCleaners ? 2 : 1, // Explicitly store staff requirement
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

      // Add the new fields with exact naming to match your Trello/Sheets setup
      accessInstructions: formData.access === "home" ? "Customer will be present" : 
                         formData.access === "key" ? `Key left at: ${formData.keyLocation || "N/A"}` : 
                         "Not specified",
      productPreference: formData.products === "bring" ? "Bring our products" : 
                        formData.products === "customer" ? "Use customer's products" : 
                        "Not specified",
      
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

export const calculatePrice = async (serviceType, formData, additionalItems, addOns) => {
  const hourlyRate = 28; // £28 per hour
  let baseHours = 0;
  let additionalItemsHours = 0;
  let addonsHours = 0; // Changed from addonsCost to addonsHours
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
  
  // Handle Home Cleaning calculation
  if (serviceType === "home-cleaning") {
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
    
    // Calculate additional rooms hours
    if (additionalItems && additionalItems.length > 0) {
      additionalItems.forEach(room => {
        if (room === "garage") {
          additionalItemsHours += 0.5; // 30 mins for garage
        } else if (room === "dining-room") {
          additionalItemsHours += 0.5; // 30 mins for dining room
        } else if (room === "conservatory") {
          additionalItemsHours += 0.75; // 45 mins for conservatory
        }
      });
    }
    
    // Apply dirtiness multiplier
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
    
    // Calculate add-ons hours (convert prices to hours at £28/hour)
    if (addOns && addOns.length > 0) {
      addOns.forEach(addon => {
        const addonPrice = addon.price || 0;
        addonsHours += addonPrice / hourlyRate; // Convert price to hours
      });
    }
    
    // Calculate original hours before 2-cleaner adjustment
    let totalHours = Math.ceil(baseHours + additionalItemsHours + addonsHours);
    let originalHours = totalHours; // Store original hours for reference
    
    // Check if we need to assign 2 cleaners (if job exceeds threshold)
    if (totalHours > assignTwoCleanersThreshold) {
      assignTwoCleaners = true;
      
      // Adjust time by dividing by 1.75 (2 cleaners complete job faster)
      totalHours = Math.ceil(totalHours / 1.75);
    }
    
    // Calculate costs - everything at hourly rate now
    const basePrice = Math.ceil(baseHours) * hourlyRate;
    const roomsPrice = Math.ceil(additionalItemsHours) * hourlyRate;
    const addonsPrice = Math.ceil(addonsHours) * hourlyRate; // Now calculated at hourly rate
    const totalPrice = basePrice + roomsPrice + addonsPrice;
    
    // Return the price breakdown
    return {
      basePrice: basePrice.toFixed(2),
      roomsPrice: roomsPrice.toFixed(2),
      addonsPrice: addonsPrice.toFixed(2),
      totalPrice: totalPrice.toFixed(2),
      estimatedHours: totalHours,
      originalHours: originalHours,
      assignTwoCleaners: assignTwoCleaners
    };
  } 
  // Handle Office Cleaning calculation
  else if (serviceType === "office-cleaning") {
    // Base hours calculation based on office size and rooms
    const officeRooms = parseInt(formData.officeRooms) || 0;
    const meetingRooms = parseInt(formData.meetingRooms) || 0;
    const kitchens = parseInt(formData.kitchens) || 0;
    const bathrooms = parseInt(formData.bathrooms) || 0;
    const utilityRooms = parseInt(formData.utilityRooms) || 0;
    
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
    
    // Add time for kitchens, bathrooms, and utility rooms
    baseHours += kitchens * 1.0; // 1 hour per kitchen
    baseHours += bathrooms * 0.5; // 30 mins per bathroom
    baseHours += utilityRooms * 0.5; // 30 mins per utility room
    
    // Minimum base hours
    baseHours = Math.max(baseHours, 2); // At least 2 hours
    
    // Apply dirtiness multiplier
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
    if (additionalItems && additionalItems.length > 0) {
      additionalItems.forEach(area => {
        if (area === "reception") {
          additionalItemsHours += 0.5; // 30 mins for reception
        } else if (area === "waiting-area") {
          additionalItemsHours += 0.5; // 30 mins for waiting area
        } else if (area === "stairwell") {
          additionalItemsHours += 0.75; // 45 mins for stairwell
        } else if (area === "hallways") {
          additionalItemsHours += 0.5; // 30 mins for hallways
        }
      });
    }
    
    // Calculate add-ons hours (convert prices to hours at £28/hour)
    if (addOns && addOns.length > 0) {
      addOns.forEach(addon => {
        const addonPrice = addon.price || 0;
        addonsHours += addonPrice / hourlyRate; // Convert price to hours
      });
    }
    
    // Calculate original hours before 2-cleaner adjustment
    let totalHours = Math.ceil(baseHours + additionalItemsHours + addonsHours);
    let originalHours = totalHours; // Store original hours for reference
    
    // Check if we need to assign 2 cleaners (if job exceeds threshold)
    if (totalHours > assignTwoCleanersThreshold) {
      assignTwoCleaners = true;
      
      // Adjust time by dividing by 1.75 (2 cleaners complete job faster)
      totalHours = Math.ceil(totalHours / 1.75);
    }
    
    // Calculate costs - everything at hourly rate now
    const basePrice = Math.ceil(baseHours) * hourlyRate;
    const additionalAreasPrice = Math.ceil(additionalItemsHours) * hourlyRate;
    const addonsPrice = Math.ceil(addonsHours) * hourlyRate; // Now calculated at hourly rate
    const totalPrice = basePrice + additionalAreasPrice + addonsPrice;
    
    // Return the price breakdown
    return {
      basePrice: basePrice.toFixed(2),
      additionalAreasPrice: additionalAreasPrice.toFixed(2),
      addonsPrice: addonsPrice.toFixed(2),
      totalPrice: totalPrice.toFixed(2),
      estimatedHours: totalHours,
      originalHours: originalHours,
      assignTwoCleaners: assignTwoCleaners
    };
  }
  
  // Default return (should never reach here)
  return {
    basePrice: "0.00",
    additionalAreasPrice: "0.00",
    roomsPrice: "0.00",
    addonsPrice: "0.00",
    totalPrice: "0.00",
    estimatedHours: 0,
    originalHours: 0,
    assignTwoCleaners: false
  };
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
  
  if (booking.staffLimitedSelected && priceBreakdown.estimatedHours > 4) {
    alert("Due to limited staff availability at this time, only bookings of 4 hours or less can be accommodated.");
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
    
    // Prepare booking info - CRITICAL FIX: Include original hours and two cleaner flag
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
      estimatedHours: priceBreakdown.estimatedHours, // This might be adjusted hours
      
      // CRITICAL FIX: Add these fields to ensure staff assignment works correctly
      originalHours: priceBreakdown.originalHours || priceBreakdown.estimatedHours, // Original hours before adjusting for 2 cleaners
      assignTwoCleaners: priceBreakdown.assignTwoCleaners || false, // Flag whether this booking needs 2 cleaners
      
      additionalInfo: formData.additionalInfo ?? null,
      
      // Office-specific fields if they exist
      officeRooms: formData.officeRooms,
      officeSize: formData.officeSize,
      meetingRooms: formData.meetingRooms,
      meetingRoomSize: formData.meetingRoomSize,
      additionalAreas: additionalItems.join(", ") || "None"
    };
    
    console.log("BOOKING INFO - hours:", bookingInfo.estimatedHours, "original:", bookingInfo.originalHours, "2 cleaners:", bookingInfo.assignTwoCleaners);
    
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