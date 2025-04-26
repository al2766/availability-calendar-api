// src/hooks/useBookingLogic.js
import { useState, useEffect } from "react";
import { collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function useBookingLogic(serviceType) {
  // Unavailability calendar states
  const [unavailableDates, setUnavailableDates] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [timeSlotData, setTimeSlotData] = useState({});
  
  // Booking form states
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState("");
  
  // Time slots
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
  
  // Navigation states
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  
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
      console.log("Booking info:", bookingInfo);
      
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
          service: serviceType, // Include service type
          ...bookingInfo // Include all other booking details
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
      
      // IMPORTANT: Update local state to immediately reflect changes
      // Update time slot data in state
      setTimeSlotData(prev => ({
        ...prev,
        [dateStr]: updatedBookedSlots
      }));
      
      // If the date is now fully booked, add it to unavailable dates
      if (fullyBooked) {
        setUnavailableDates(prev => {
          const updated = new Set(prev);
          updated.add(dateStr);
          return updated;
        });
      }
      
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

  return {
    // State
    unavailableDates,
    loading,
    timeSlotData,
    selectedDate,
    selectedTime,
    availableTimeSlots,
    currentMonth,
    currentYear,
    
    // Functions
    setSelectedDate,
    setSelectedTime,
    setCurrentMonth,
    setCurrentYear,
    isPastDate,
    fetchUnavailability,
    checkConsecutiveAvailableHours,
    formatDateLocal,
    formatDisplayDate,
    getCalendarMinMaxDates,
    handleDateSelect,
    generateTimeSlots,
    handleTimeSelect,
    calculateBookedTimeSlots,
    updateTimeSlots,
    hasConsecutiveAvailableHours,
    tileClassName,
    monthNames
  };
}