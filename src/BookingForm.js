import React, { useState, useEffect } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import "./App.css";

function BookingForm() {
  // Unavailability calendar states
  const [unavailableDates, setUnavailableDates] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [timeSlotData, setTimeSlotData] = useState({});
  
  // Booking form states
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    bedrooms: "",
    livingRooms: "",
    kitchens: "",
    bathrooms: "",
    cleanliness: "",
    additionalInfo: ""
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
  
  // Time slots
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
  
  // Navigation states
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

    // Navigation states
    const [activeTab, setActiveTab] = useState("booking"); // "admin" or "bookings" now - booking tab routes to BookingForm
    // Navigate to the booking form page

  const navigateBack = () => {
    window.location.href = '/';
  };
  
  // Month names for date formatting
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  useEffect(() => {
    fetchUnavailability();
    generateTimeSlots();
  }, []);

  // Update the useEffect hook to regenerate time slots when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      generateTimeSlots(selectedDate);
    }
  }, [selectedDate, timeSlotData]);

  // Create a single function to recalculate prices whenever form data changes
  useEffect(() => {
    calculatePrice();
  }, [formData, additionalRooms, addOns]);

  // Function to check if a date is in the past
  const isPastDate = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to beginning of today
    
    // If a string is passed, convert it to a Date object
    const checkDate = typeof date === 'string' ? new Date(date) : new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    return checkDate < today;
  };

  // Helper function to check if a time slot is in the past for today
  const isPastTimeSlot = (timeSlot, dateStr) => {
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Only check times for today
    if (dateStr !== today) {
      return false;
    }
    
    const hour = parseInt(timeSlot.split(':')[0]);
    const currentHour = now.getHours();
    
    // Consider slots in the current hour as past (not available)
    return hour <= currentHour;
  };

  const fetchUnavailability = async () => {
    try {
      console.log("Starting fetchUnavailability...");
      
      // Get all documents from the unavailability collection
      const snapshot = await getDocs(collection(db, "unavailability"));
      const unavailableDatesSet = new Set();
      const timeSlotDataObj = {};
      
      snapshot.docs.forEach((doc) => {
        const dateStr = doc.id;
        const data = doc.data();
        
        console.log(`Processing date: ${dateStr}`, data);
        
        // Check for explicitly fully booked dates
        if (data.fullyBooked === true) {
          console.log(`Date ${dateStr} is explicitly marked as fully booked`);
          unavailableDatesSet.add(dateStr);
        } else if (data.unavailable === true) {
          // Legacy format support
          console.log(`Date ${dateStr} has the legacy 'unavailable' flag`);
          unavailableDatesSet.add(dateStr);
        } else {
          // Process individual time slots
          // Extract booked time slots from the document
          const bookedTimeSlots = {};
          
          // Check if we have time slots as direct properties (7:00, 8:00, etc.)
          let hasDirectTimeSlots = false;
          for (let hour = 7; hour <= 20; hour++) {
            const timeKey = `${hour}:00`;
            if (data[timeKey]) {
              bookedTimeSlots[timeKey] = data[timeKey];
              hasDirectTimeSlots = true;
            }
          }
          
          // If no direct time slots found, check for bookedTimeSlots object
          if (!hasDirectTimeSlots && data.bookedTimeSlots) {
            Object.assign(bookedTimeSlots, data.bookedTimeSlots);
          }
          
          // Store the time slots for this date
          timeSlotDataObj[dateStr] = bookedTimeSlots;
          
          // Only check consecutive hours if there are actually booked slots
          if (Object.keys(bookedTimeSlots).length > 0) {
            // Check if there are at least 2 consecutive hours available
            const hasEnoughConsecutiveHours = checkConsecutiveAvailableHours(bookedTimeSlots);
            console.log(`Date ${dateStr} has enough consecutive hours: ${hasEnoughConsecutiveHours}`);
            
            if (!hasEnoughConsecutiveHours) {
              unavailableDatesSet.add(dateStr);
            }
          }
        }
      });
      
      console.log("Unavailable dates:", Array.from(unavailableDatesSet));
      console.log("Time slot data:", timeSlotDataObj);
      
      setUnavailableDates(unavailableDatesSet);
      setTimeSlotData(timeSlotDataObj);
    } catch (error) {
      console.error("Error fetching unavailability:", error);
    } finally {
      setLoading(false);
    }
  };

  // Function to check for consecutive available hours
  const checkConsecutiveAvailableHours = (bookedTimeSlots, requiredConsecutiveHours = 2) => {
    // Generate all possible time slots (7am to 8pm)
    const allTimeSlots = [];
    for (let hour = 7; hour <= 20; hour++) {
      allTimeSlots.push(`${hour}:00`);
    }
    
    // Create an array representing all hours (true = available, false = booked)
    const availabilityMap = allTimeSlots.map(slot => !bookedTimeSlots[slot]);
    
    console.log("Checking consecutive hours for bookedTimeSlots:", bookedTimeSlots);
    console.log("Availability map:", availabilityMap.map((available, i) => 
      `${allTimeSlots[i]}: ${available ? 'available' : 'booked'}`
    ));
    
    // Check for consecutive available slots
    let consecutiveCount = 0;
    for (let i = 0; i < availabilityMap.length; i++) {
      if (availabilityMap[i]) {
        consecutiveCount++;
        console.log(`Found available slot at ${allTimeSlots[i]}, consecutive count: ${consecutiveCount}`);
        if (consecutiveCount >= requiredConsecutiveHours) {
          console.log(`Found ${requiredConsecutiveHours} consecutive available hours`);
          return true; // Found enough consecutive slots
        }
      } else {
        console.log(`Slot at ${allTimeSlots[i]} is booked, resetting consecutive count`);
        consecutiveCount = 0;
      }
    }
    
    console.log("Not enough consecutive hours available");
    return false;
  };

  // Format date to YYYY-MM-DD
  const formatDateLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  
  // Format date for display
  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return "No date selected";
    const [year, month, day] = dateStr.split('-');
    return `Selected Date: ${day} ${monthNames[parseInt(month) - 1]} ${year}`;
  };

  // Function to get min/max dates for calendar
  const getCalendarMinMaxDates = () => {
    // Today's date as minimum
    const minDate = new Date();
    minDate.setHours(0, 0, 0, 0);
    
    // Maximum date (today + 3 months)
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);
    maxDate.setDate(0); // Last day of the 3rd month
    
    return { minDate, maxDate };
  };

  // Handle date selection
  const handleDateSelect = (date) => {
    // Only select if available and not in the past
    const dateStr = formatDateLocal(date);
    if (!unavailableDates.has(dateStr) && !isPastDate(date)) {
      setSelectedDate(dateStr);
      
      // Call generateTimeSlots if it's not already being called elsewhere
      generateTimeSlots(dateStr);
    }
  };

  // Helper functions for time slot handling
  // Generate all possible time slots (7am to 8pm)
  const generateAllTimeSlots = () => {
    const slots = [];
    for (let hour = 7; hour <= 20; hour++) {
      slots.push(`${hour}:00`);
    }
    return slots;
  };

  // Convert time string to hour number (e.g., "14:00" -> 14)
  const timeToHour = (timeStr) => {
    return parseInt(timeStr.split(':')[0]);
  };

  // Check if a date has at least 2 consecutive hours available
  const hasConsecutiveAvailableHours = (bookedTimeSlots, requiredConsecutiveHours = 2) => {
    const allTimeSlots = generateAllTimeSlots();
    
    // Create an array representing all hours (true = available, false = booked)
    const availabilityMap = allTimeSlots.map(slot => !bookedTimeSlots[slot]);
    
    // Debug output
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

  // Calculate which time slots to mark as booked based on booking hours
  const calculateBookedTimeSlots = (startTime, estimatedHours) => {
    const bookedSlots = {};
    const startHour = timeToHour(startTime);
    
    for (let i = 0; i < estimatedHours; i++) {
      const hour = startHour + i;
      if (hour >= 7 && hour <= 20) { // Only book slots within our available range (7am-8pm)
        bookedSlots[`${hour}:00`] = true;
      }
    }
    
    return bookedSlots;
  };

  // Update time slots in Firebase when a booking is made
  const updateTimeSlots = async (dateStr, startTime, estimatedHours, bookingInfo) => {
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
          additionalInfo: bookingInfo.additionalInfo
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

  // Generate time slots for UI
  const generateTimeSlots = (date) => {
    console.log(`Generating time slots for date: ${date}`);
    
    // If no date is selected, return empty slots
    if (!date) {
      setAvailableTimeSlots([]);
      return;
    }
    
    // Get the booked time slots for this date from timeSlotData
    const bookedTimeSlotData = timeSlotData[date] || {};
    console.log(`Booked slots for ${date}:`, bookedTimeSlotData);
    
    const slots = [];
    
    for (let hour = 7; hour <= 20; hour++) {
      const timeSlot = `${hour}:00`;
      // Check if this slot is booked
      const isBooked = bookedTimeSlotData[timeSlot] ? true : false;
      
      // Check if this slot is in the past (for today)
      const isPast = isPastTimeSlot(timeSlot, date);
      
      const displayHour = hour > 12 ? hour - 12 : hour;
      const amPm = hour >= 12 ? 'PM' : 'AM';
      
      slots.push({
        display: `${displayHour} ${amPm}`,
        value: timeSlot,
        available: !isBooked && !isPast,
        isPast: isPast
      });
    }
    
    console.log(`Generated time slots for ${date}:`, slots);
    setAvailableTimeSlots(slots);
  };

  // Update time slot selection to only allow selecting available slots
  const handleTimeSelect = (time) => {
    const slot = availableTimeSlots.find(slot => slot.value === time);
    if (slot && slot.available) {
      setSelectedTime(time);
    }
  };
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
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
  
  // Calculate price based on form inputs
  const calculatePrice = () => {
    const hourlyRate = 28; // £28 per hour
    let baseHours = 0;
    let additionalRoomsHours = 0;
    let addonsCost = 0;
    let dirtinessMultiplier = 1;
    
    // Base hours calculation based on property size
    const bedrooms = parseInt(formData.bedrooms) || 0;
    const livingRooms = parseInt(formData.livingRooms) || 0;
    const kitchens = parseInt(formData.kitchens) || 0;
    const bathrooms = parseInt(formData.bathrooms) || 0;
    
    // Calculate base hours
    baseHours += bedrooms * 0.75; // 45 mins per bedroom
    baseHours += livingRooms * 0.5; // 30 mins per living room
    baseHours += kitchens * 1.0; // 1 hour per kitchen
    baseHours += bathrooms * 0.75; // 45 mins per bathroom
    
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
      } else if (room === "utility-room") {
        additionalRoomsHours += 0.5; // 30 mins for utility room
      }
    });
    
    // Calculate add-ons cost
    addOns.forEach(addon => {
      addonsCost += addon.price || 0;
    });
    
    // Calculate costs
    const basePrice = Math.ceil(baseHours) * hourlyRate;
    const roomsPrice = Math.ceil(additionalRoomsHours) * hourlyRate;
    const totalHours = Math.ceil(baseHours + additionalRoomsHours);
    const totalPrice = basePrice + roomsPrice + addonsCost;
    
    // Update price breakdown
    setPriceBreakdown({
      basePrice: basePrice.toFixed(2),
      roomsPrice: roomsPrice.toFixed(2),
      addonsPrice: addonsCost.toFixed(2),
      totalPrice: totalPrice.toFixed(2),
      estimatedHours: totalHours
    });
  };
  
  // Handle form submission with race condition prevention
  const handleSubmit = async (e) => {
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
      // Step 1: Double check availability before proceeding
      // Re-fetch just this specific date to make sure it's still available
      const dateRef = doc(db, "unavailability", selectedDate);
      const dateDoc = await getDoc(dateRef);
      const dateData = dateDoc.exists() ? dateDoc.data() : {};
      const bookedTimeSlots = dateData.bookedTimeSlots || {};
      
      // Check if our selected time slot is still available
      if (bookedTimeSlots[selectedTime]) {
        submitButton.innerHTML = "Book Now";
        submitButton.disabled = false;
        alert("Sorry, this time slot has just been booked by someone else. Please select another time.");
        
        // Refresh time slots
        await fetchUnavailability();
        if (selectedDate) {
          generateTimeSlots(selectedDate);
        }
        return;
      }
      
      // Step 2: Proceed with booking
      const orderId = "LUX" + Date.now().toString().slice(-6);
      
      // Collect selected add-ons and additional rooms
      const selectedAddOns = addOns.map(addon => addon.value);
      
      // Prepare form data for email
      const templateParams = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        date: formatDisplayDate(selectedDate).replace("Selected Date: ", ""),
        time: selectedTime,
        bedrooms: formData.bedrooms === "0" ? "0 (Studio)" : formData.bedrooms,
        livingRooms: formData.livingRooms,
        kitchens: formData.kitchens,
        bathrooms: formData.bathrooms,
        cleanliness: formData.cleanliness,
        additionalRooms: additionalRooms.join(", ") || "None",
        addOns: selectedAddOns.join(", ") || "None",
        totalPrice: `£${priceBreakdown.totalPrice}`,
        estimatedHours: `${priceBreakdown.estimatedHours} hour(s)`,
        order_id: orderId,
        service: "Cleaning Service",
        additionalInfo: formData.additionalInfo || "None provided"
      };
      
      // FIRST: Update the time slots in Firebase
      try {
        const bookingInfo = {
          email: formData.email,
          phone: formData.phone,
          name: formData.name,
          orderId: orderId,
          timestamp: new Date().toISOString(),
          bedrooms: formData.bedrooms === "0" ? "0 (Studio)" : formData.bedrooms,
          livingRooms: formData.livingRooms,
          kitchens: formData.kitchens,
          bathrooms: formData.bathrooms,
          cleanliness: formData.cleanliness,
          additionalRooms: additionalRooms.join(", ") || "None",
          addOns: selectedAddOns.join(", ") || "None",
          totalPrice: priceBreakdown.totalPrice,
          estimatedHours: priceBreakdown.estimatedHours,
          additionalInfo: formData.additionalInfo ?? null
        };
        
        // Update time slots for this booking
        const { updatedBookedSlots, fullyBooked } = await updateTimeSlots(
          selectedDate, 
          selectedTime, 
          priceBreakdown.estimatedHours,
          bookingInfo
        );
        
        console.log(`Date ${selectedDate} updated with booked time slots`);
        console.log(`Date is ${fullyBooked ? 'fully booked' : 'partially available'}`);
        
        // Update time slot data in state
        setTimeSlotData(prev => ({
          ...prev,
          [selectedDate]: updatedBookedSlots
        }));
        
        // If the date is now fully booked, add it to unavailable dates
        if (fullyBooked) {
          setUnavailableDates(prev => {
            const updated = new Set(prev);
            updated.add(selectedDate);
            return updated;
          });
        }
      } catch (error) {
        console.error("Error updating time slots:", error);
        // Continue with the booking process even if there was an error updating time slots
      }

      // In your handleSubmit function after successfully updating Firebase
// Add this code after the Firebase update but before the email confirmation

const notifyZapier = async (bookingData) => {
    try {
      // Send booking data to Zapier webhook
      const response = await fetch('https://hooks.zapier.com/hooks/catch/22652608/2pozxou/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Include all relevant booking information
          customerName: formData.name,
          customerEmail: formData.email,
          customerPhone: formData.phone,
          bookingDate: selectedDate,
          bookingTime: selectedTime,
          orderId: orderId,
          propertyDetails: {
            bedrooms: formData.bedrooms,
            livingRooms: formData.livingRooms,
            kitchens: formData.kitchens,
            bathrooms: formData.bathrooms,
            cleanliness: formData.cleanliness,
            additionalRooms: additionalRooms.join(", ") || "None",
            addOns: selectedAddOns.join(", ") || "None"
          },
          estimatedHours: priceBreakdown.estimatedHours,
          totalPrice: priceBreakdown.totalPrice,
          additionalInfo: formData.additionalInfo || "None provided",
          // Add a timestamp for sorting in your task management system
          submittedAt: new Date().toISOString()
        })
      });
      
      console.log('Zapier webhook triggered successfully');
      
    } catch (error) {
      console.error('Error sending data to Zapier:', error);
      // Continue with booking process even if Zapier fails
    }
  };
  
  // Call the function
  await notifyZapier();
      
      // SECOND: Send email confirmation
      if (window.emailjs) {
        await window.emailjs.send('service_04pgv28', 'template_0cbdpse', templateParams);
        
        submitButton.innerHTML = "Booking Confirmed!";
        alert("Your booking has been confirmed! Check your email for details.");
        
        // Reset form
        setSelectedDate(null);
        setSelectedTime("");
        setFormData({
          name: "",
          email: "",
          phone: "",
          bedrooms: "",
          livingRooms: "",
          kitchens: "",
          bathrooms: "",
          cleanliness: "",
          additionalInfo: ""
        });
        setAdditionalRooms([]);
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

  // Set tile class for calendar
  const tileClassName = ({ date, view }) => {
    if (view !== "month") return null;
    const dateStr = formatDateLocal(date);
    
    // Check if date is in the past
    if (isPastDate(date)) {
      return "unavailable";
    }
    
    if (unavailableDates.has(dateStr)) {
      return "unavailable";
    } else if (selectedDate === dateStr) {
      return "selected";
    } else {
      return "available";
    }
  };

  return (
    
    <div className="container max-w-6xl mx-auto p-6">
         <div className="max-w-6xl mx-auto mb-6 flex gap-4">
      <button 
        onClick={navigateBack}
        className="px-6 py-2 rounded bg-gray-200 text-gray-700"
      >
       Back
      </button>
    </div>
      <div className="flex flex-wrap gap-6">
        {/* Calendar Container */}
        <div className="calendar-container flex-grow-0 w-full md:w-5/12 bg-white rounded-lg shadow-md p-6">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <Calendar
              activeStartDate={new Date(currentYear, currentMonth, 1)}
              onClickDay={handleDateSelect}
              tileClassName={tileClassName}
              view="month"
              className="booking-calendar"
              formatShortWeekday={(locale, date) => 
                ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][date.getDay()]
              }
              prevLabel="< Prev"
              nextLabel="Next >"
              navigationLabel={({ date }) => `${monthNames[date.getMonth()]} ${date.getFullYear()}`}
              onActiveStartDateChange={({ activeStartDate }) => {
                setCurrentMonth(activeStartDate.getMonth());
                setCurrentYear(activeStartDate.getFullYear());
              }}
              minDate={getCalendarMinMaxDates().minDate}
              maxDate={getCalendarMinMaxDates().maxDate}
            />
          )}
          
          {/* Time Slot Container */}
          <div className="time-slot-container mt-6 p-6 bg-white rounded-lg">
            <h2 className="time-slot-title text-lg text-blue-600 font-medium mb-4">
              {selectedDate ? "Select a Time" : "Please select a date first"}
            </h2>
            {selectedDate && (
              <div className="time-slots-grid grid grid-cols-3 gap-2 md:gap-3">
                {availableTimeSlots.map((slot, index) => (
                  <div 
                    key={index}
                    className={`time-slot p-3 text-center border rounded-md 
                      ${!slot.available ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'cursor-pointer hover:bg-blue-100'} 
                      ${selectedTime === slot.value ? 'selected' : ''}`}
                    onClick={() => slot.available && handleTimeSelect(slot.value)}
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
            <input type="hidden" id="selected-date" value={selectedDate || ""} />
            <input type="hidden" id="selected-time" value={selectedTime} />
            
            {/* Selected Date Display */}
            <div className="fs-field mb-4">
              <span id="date-label" className="selected-date text-blue-600">
                {formatDisplayDate(selectedDate)}
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
                  <option value="5">5+</option>
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
                  <option value="3">3+</option>
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
                  <option value="2">2+</option>
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
                  <option value="4">4+</option>
                </select>
              </div>
            </div>
            
            <div className="fs-field mb-4">
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
                <div className="fs-checkbox-item flex items-center">
                  <input 
                    type="checkbox" 
                    id="utility-room" 
                    name="additional-rooms[]" 
                    value="utility-room" 
                    className="fs-checkbox w-5 h-5 mr-2"
                    checked={additionalRooms.includes("utility-room")}
                    onChange={handleRoomCheckboxChange}
                  />
                  <label htmlFor="utility-room" className="fs-checkbox-label">Utility room</label>
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
                    data-price="40"
                    checked={addOns.some(addon => addon.value === "carpet-cleaning")}
                    onChange={handleAddonCheckboxChange}
                  />
                  <label htmlFor="carpet-cleaning" className="fs-checkbox-label">
                    Carpet cleaning (£40)
                  </label>
                </div>
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

export default BookingForm;