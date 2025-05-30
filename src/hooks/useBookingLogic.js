// src/hooks/useBookingLogic.js
import { useState, useEffect } from "react";
// Near the top of useBookingLogic.js with your other imports
import { formatDateLocal, formatDisplayDate, hasConsecutiveAvailableHours, updateTimeSlots } from "../utils/bookingFormUtils";
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
  const [staffLimitedSelected, setStaffLimitedSelected] = useState(false);

  
  
  // Time slots
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
  
  // Navigation states
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // Cache for settings and staff data
const [availabilitySettings, setAvailabilitySettings] = useState(null);


const [staffCache, setStaffCache] = useState(null);

// Add this effect to load settings and staff data once
useEffect(() => {
  const loadSettingsAndStaff = async () => {
    // Load settings
    const settingsDoc = await getDoc(doc(db, "settings", "availability"));
    const settings = settingsDoc.exists() ? settingsDoc.data() : {
      useStaffAvailability: false,
      allDatesAvailable: false,
      minimumNoticeHours: 0,
      bufferTimeBetweenBookings: 0,
      assignTwoCleanersAfterHours: 4,
      maxConcurrentBookings: 1,
      maxJobsPerCleaner: 1
    };
    setAvailabilitySettings(settings);
    
    // Load staff if needed
    if (settings.useStaffAvailability) {
      const staffSnapshot = await getDocs(collection(db, "staff"));
      const activeStaff = staffSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(staff => staff.active);
      setStaffCache(activeStaff);
    }
  };
  
  loadSettingsAndStaff();
}, []);
  
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

// In useBookingLogic.js - replace the existing fetchUnavailability with this:
const fetchUnavailability = async () => {
  try {
    console.log("Starting fetchUnavailability...");
    
    // First, check availability settings
    const settingsDoc = await getDoc(doc(db, "settings", "availability"));
    const settings = settingsDoc.exists() ? settingsDoc.data() : { 
      useStaffAvailability: false,
      allDatesAvailable: false
    };
    
    // Cache the settings for use in generateTimeSlots
    // Add this line to save settings for later use
    setAvailabilitySettings(settings);
    
    // If all dates are available, skip other checks
    if (settings.allDatesAvailable) {
      console.log("All dates available setting is ON - showing all dates as available");
      setUnavailableDates(new Set()); // Empty set = all dates available
      setTimeSlotData({});
      setLoading(false);
      return;
    }
    
    // Start with unavailable dates from bookings
    const snapshot = await getDocs(collection(db, "unavailability"));
    const unavailableDatesSet = new Set();
    const timeSlotDataObj = {};
    
    // First load explicitly unavailable dates
    snapshot.docs.forEach((doc) => {
      const dateStr = doc.id;
      const data = doc.data();
      
      if (data.fullyBooked === true || data.unavailable === true) {
        unavailableDatesSet.add(dateStr);
      } else {
        // Process individual time slots
        const bookedTimeSlots = {};
        
        // Check if we have time slots as direct properties
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
        
        // Check if there are at least 2 consecutive hours available
        if (Object.keys(bookedTimeSlots).length > 0) {
          const hasEnoughConsecutiveHours = checkConsecutiveAvailableHours(bookedTimeSlots);
          if (!hasEnoughConsecutiveHours) {
            unavailableDatesSet.add(dateStr);
          }
        }
      }
    });
    
    // If using staff availability, check staff schedules
    if (settings.useStaffAvailability) {
      console.log("Using staff availability to determine available dates");
      
      // Get active staff members
      const staffSnapshot = await getDocs(collection(db, "staff"));
      const activeStaff = staffSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(staff => staff.active);
      
      // Cache the staff for use in generateTimeSlots
      // Add this line to save staff data for later use
      setStaffCache(activeStaff);
      
      // If no active staff, mark all dates as unavailable
      if (activeStaff.length === 0) {
        console.log("No active staff - all dates unavailable");
        
        // Generate unavailable dates for the next 90 days
        const today = new Date();
        for (let i = 0; i < 90; i++) {
          const date = new Date(today);
          date.setDate(today.getDate() + i);
          unavailableDatesSet.add(formatDateLocal(date));
        }
      } else {
        // Create a map of which days of the week have staff available
        const daysWithStaff = {
          'sunday': false,
          'monday': false,
          'tuesday': false,
          'wednesday': false,
          'thursday': false,
          'friday': false,
          'saturday': false
        };
        
        // Check which days have at least one staff member available
        activeStaff.forEach(staff => {
          Object.entries(staff.availability || {}).forEach(([day, schedule]) => {
            if (schedule.available) {
              daysWithStaff[day] = true;
            }
          });
        });
        
        console.log("Days with staff available:", daysWithStaff);
        
        // Mark dates as unavailable if no staff works on that day
        const today = new Date();
        const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        
        // Check the next 90 days
        for (let i = 0; i < 90; i++) {
          const date = new Date(today);
          date.setDate(today.getDate() + i);
          const dayStr = formatDateLocal(date);
          
          // Skip if already marked as unavailable
          if (unavailableDatesSet.has(dayStr)) {
            continue;
          }
          
          // Check if this day of week has staff
          const dayOfWeek = daysOfWeek[date.getDay()];
          if (!daysWithStaff[dayOfWeek]) {
            unavailableDatesSet.add(dayStr);
          }
        }
      }
    }
    
    console.log("Unavailable dates:", Array.from(unavailableDatesSet));
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




// Replace your existing generateTimeSlots with this implementation
const generateTimeSlots = async (date) => {
  console.log(`Generating time slots for date: ${date}`);
  
  if (!date) {
    setAvailableTimeSlots([]);
    return;
  }
  
  setAvailableTimeSlots([{ display: "Loading...", value: "", available: false, isLoading: true }]);
  
  try {
    // Get settings (existing logic)
    let settings = availabilitySettings;
    if (!settings) {
      const settingsDoc = await getDoc(doc(db, "settings", "availability"));
      settings = settingsDoc.exists() ? settingsDoc.data() : {
        minimumNoticeHours: 0,
        bufferTimeBetweenBookings: 0,
        assignTwoCleanersAfterHours: 4,
        useStaffAvailability: false
      };
      setAvailabilitySettings(settings);
    }
    
    const bookedTimeSlotData = timeSlotData[date] || {};
    
    // Get staff info (existing logic)
    let activeStaff = staffCache;
    if (!activeStaff && settings.useStaffAvailability) {
      const staffSnapshot = await getDocs(collection(db, "staff"));
      activeStaff = staffSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(staff => staff.active);
      setStaffCache(activeStaff);
    }
    
    const totalStaffCount = activeStaff?.length || 2;
    console.log(`Total active staff: ${totalStaffCount}`);
    
    // Calculate staff assignment by hour (existing logic)
    const staffAssignedByHour = {};
    const bookingGroups = {};
    
    // Process bookings (existing logic)
    for (const [timeSlot, booking] of Object.entries(bookedTimeSlotData)) {
      const bookingId = booking.bookingId || booking.orderId || 'unknown';
      const hour = parseInt(timeSlot.split(':')[0]);
      
      if (!bookingGroups[bookingId]) {
        const requiresTwoStaff = 
          booking.staffRequired === 2 || 
          booking.assignTwoCleaners === true ||
          (booking.originalHours && settings.assignTwoCleanersAfterHours > 0 && 
            parseFloat(booking.originalHours) > settings.assignTwoCleanersAfterHours);
        
        bookingGroups[bookingId] = {
          hours: [hour],
          staffNeeded: requiresTwoStaff ? 2 : 1,
          booking: booking
        };
      } else {
        bookingGroups[bookingId].hours.push(hour);
      }
    }
    
    // Calculate staff assigned by hour
    for (let hour = 7; hour <= 20; hour++) {
      staffAssignedByHour[hour] = 0;
      for (const [bookingId, bookingData] of Object.entries(bookingGroups)) {
        if (bookingData.hours.includes(hour)) {
          staffAssignedByHour[hour] += bookingData.staffNeeded;
        }
      }
    }
    
    // NEW: Calculate remaining staff and find minimum
    const remainingStaffByHour = {};
    let minRemainingStaff = totalStaffCount;
    
    for (let hour = 7; hour <= 20; hour++) {
      remainingStaffByHour[hour] = totalStaffCount - staffAssignedByHour[hour];
      minRemainingStaff = Math.min(minRemainingStaff, remainingStaffByHour[hour]);
      console.log(`Hour ${hour}:00 - Assigned: ${staffAssignedByHour[hour]}, Remaining: ${remainingStaffByHour[hour]}`);
    }
    
    console.log(`Minimum remaining staff across all hours: ${minRemainingStaff}`);
    
    // NEW: Apply blocking/warning logic based on minimum remaining staff
    const blockedHours = new Set();
    const warningHours = new Set();
    
    if (minRemainingStaff === 0) {
      // 0 extra staff logic: Block booking times + buffer + 2 extra hours before
      console.log("Applying 0 extra staff logic");
      
      Object.values(bookingGroups).forEach(bookingData => {
        const minHour = Math.min(...bookingData.hours);
        const maxHour = Math.max(...bookingData.hours);
        
        // Block booking times
        bookingData.hours.forEach(hour => blockedHours.add(hour));
        
        // Block buffer before and after
        const bufferHours = settings.bufferTimeBetweenBookings || 0;
        for (let i = 1; i <= bufferHours; i++) {
          if (minHour - i >= 7) blockedHours.add(minHour - i);
          if (maxHour + i <= 20) blockedHours.add(maxHour + i);
        }
        
        // Block extra 2 hours before (for minimum booking possibility)
        for (let i = bufferHours + 1; i <= bufferHours + 2; i++) {
          if (minHour - i >= 7) blockedHours.add(minHour - i);
        }
        
        // Add dynamic warnings for hours before blocked section
        const firstBlockedHour = minHour - bufferHours - 2;
        for (let hour = 7; hour < firstBlockedHour; hour++) {
          const maxPossibleHours = firstBlockedHour - hour;
          if (maxPossibleHours >= 2) {
            warningHours.add(hour);
          } else {
            blockedHours.add(hour); // Less than 2 hours, block it
          }
        }
      });
      
    } else if (minRemainingStaff === 1) {
      // 1 extra staff logic: 4hr warnings for booking times + buffer + assignTwoCleanersAfterHours before
      console.log("Applying 1 extra staff logic");
      
      Object.values(bookingGroups).forEach(bookingData => {
        const minHour = Math.min(...bookingData.hours);
        const maxHour = Math.max(...bookingData.hours);
        
        // Add warnings for booking times
        bookingData.hours.forEach(hour => warningHours.add(hour));
        
        // Add warnings for buffer before and after
        const bufferHours = settings.bufferTimeBetweenBookings || 0;
        for (let i = 1; i <= bufferHours; i++) {
          if (minHour - i >= 7) warningHours.add(minHour - i);
          if (maxHour + i <= 20) warningHours.add(maxHour + i);
        }
        
        // Add warnings for assignTwoCleanersAfterHours before
        const extraHours = settings.assignTwoCleanersAfterHours || 4;
        for (let i = bufferHours + 1; i <= bufferHours + extraHours; i++) {
          if (minHour - i >= 7) warningHours.add(minHour - i);
        }
      });
    }
    // If minRemainingStaff >= 2, no blocks or warnings needed
    
    // Time constraints (existing logic)
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentHour = now.getHours();
    const minimumNoticeHours = settings.minimumNoticeHours || 0;
    
    let earliestAvailableHour = currentHour;
    if (date === today && minimumNoticeHours > 0) {
      earliestAvailableHour = currentHour + minimumNoticeHours;
      if (now.getMinutes() > 0) {
        earliestAvailableHour += 1;
      }
    }
    
    // Generate time slots
    const tempSlots = [];
    
    for (let hour = 7; hour <= 20; hour++) {
      const timeSlot = `${hour}:00`;
      const displayHour = hour > 12 ? hour - 12 : hour;
      const amPm = hour >= 12 ? 'PM' : 'AM';
      
      // Basic time checks
      const isPast = (date === today && hour <= currentHour);
      const isWithinMinNotice = (date === today && hour > currentHour && hour < earliestAvailableHour);
      
      if (isPast || isWithinMinNotice) {
        tempSlots.push({
          display: `${displayHour} ${amPm}`,
          value: timeSlot,
          available: false,
          isPast: true,
          staffLimited: false
        });
        continue;
      }
      
      // Apply our logic
      let isAvailable = true;
      let staffLimited = false;
      let limitedMessage = '';
      
      if (blockedHours.has(hour)) {
        isAvailable = false;
      } else if (warningHours.has(hour)) {
        isAvailable = true;
        staffLimited = true;
        
        if (minRemainingStaff === 0) {
          // Calculate dynamic hours for 0 staff scenario
          const availableHours = Math.min(8, hour - 7 + 1); // Simplified calculation
          limitedMessage = `Only bookings of ${Math.max(2, availableHours)} hours or less available at this time`;
        } else if (minRemainingStaff === 1) {
          limitedMessage = 'Only 4 hour bookings or less available due to limited availability';
        }
      }
      
      tempSlots.push({
        display: `${displayHour} ${amPm}`,
        value: timeSlot,
        available: isAvailable,
        isPast: false,
        staffLimited: staffLimited,
        limitedMessage: limitedMessage
      });
    }
    
    setAvailableTimeSlots(tempSlots);
    
  } catch (error) {
    console.error("Error generating time slots:", error);
    setAvailableTimeSlots([{ display: "Error loading slots", value: "", available: false, isError: true }]);
  }
};

// Replace your existing handleTimeSelect with this implementation
const handleTimeSelect = (time) => {
  const slot = availableTimeSlots.find(slot => slot.value === time);
  if (slot && slot.available) {
    setSelectedTime(time);
    
    // Set staffLimitedSelected flag if this slot has limited staff
    setStaffLimitedSelected(slot.staffLimited || false);
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
    staffLimitedSelected,
    
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