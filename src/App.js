import React, { useState, useEffect } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { collection, getDocs, setDoc, deleteDoc, doc, deleteField, getDoc, Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import "./App.css";

function App() {

  // Admin state variables for time slot management
const [adminSelectedDate, setAdminSelectedDate] = useState(null);
const [adminTimeSlots, setAdminTimeSlots] = useState({});
const [adminFullyBooked, setAdminFullyBooked] = useState(false);
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
  const [activeTab, setActiveTab] = useState("booking"); // "booking" or "admin"
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

// Add this to your App.js where you define your state variables
// Bookings tab state
const [bookings, setBookings] = useState([]);
const [filteredBookings, setFilteredBookings] = useState([]);
const [bookingsLoading, setBookingsLoading] = useState(true);
const [bookingFilter, setBookingFilter] = useState("upcoming"); // "all", "upcoming", "past", "today"
const [selectedBooking, setSelectedBooking] = useState(null);
const [bookingSearchTerm, setBookingSearchTerm] = useState("");

// Add this useEffect to fetch bookings data
useEffect(() => {
  if (activeTab === "bookings") {
    fetchBookings();
  }
}, [activeTab]);

// Add this effect to filter bookings when filter or bookings change
useEffect(() => {
  filterBookings();
}, [bookings, bookingFilter, bookingSearchTerm]);

// Add these functions for bookings management
const fetchBookings = async () => {
  try {
    setBookingsLoading(true);
    
    // Create a collection of all bookings by checking all time slots in all dates
    const bookingsMap = new Map(); // Use a Map to group by orderId
    const snapshot = await getDocs(collection(db, "unavailability"));
    
    // Process each date document
    for (const dateDoc of snapshot.docs) {
      const dateStr = dateDoc.id;
      const dateData = dateDoc.data();
      
      // Skip fully booked dates with no individual bookings
      if (dateData.fullyBooked === true && !dateData.bookedTimeSlots) {
        continue;
      }
      
      // Get booked time slots
      const bookedSlots = {};
      
      // Check if we have bookedTimeSlots object
      if (dateData.bookedTimeSlots) {
        Object.assign(bookedSlots, dateData.bookedTimeSlots);
      } else {
        // Check for direct time slots
        for (let hour = 7; hour <= 20; hour++) {
          const timeKey = `${hour}:00`;
          if (dateData[timeKey]) {
            bookedSlots[timeKey] = dateData[timeKey];
          }
        }
      }
      
      // Group time slots by booking ID for this date
      const dateBookings = new Map();
      
      // First pass: collect all time slots for each booking ID
      for (const [timeSlot, bookingData] of Object.entries(bookedSlots)) {
        // Skip admin-blocked slots
        if (bookingData.bookingId === "admin-block" || bookingData.bookedBy === "admin") {
          continue;
        }
        
        const bookingId = bookingData.bookingId || bookingData.orderId || `booking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        if (!dateBookings.has(bookingId)) {
          dateBookings.set(bookingId, {
            id: bookingId,
            date: dateStr,
            timeSlots: [],
            timeSlotDetails: {},
            customerName: bookingData.bookedBy || bookingData.name || "Unknown",
            customerEmail: bookingData.email || bookingData.bookedBy || "No email provided",
            customerPhone: bookingData.phone || "No phone provided",
            status: "confirmed", // Default status
            details: bookingData,
            displayDate: formatDisplayDate(dateStr).replace("Selected Date: ", ""),
            timestamp: bookingData.bookingTimestamp || new Date().toISOString(),
            // Add additional fields from booking data if they exist
            ...bookingData
          });
        }
        
        // Add this time slot to the booking
        const hourValue = parseInt(timeSlot.split(':')[0]);
        dateBookings.get(bookingId).timeSlots.push(hourValue);
        dateBookings.get(bookingId).timeSlotDetails[timeSlot] = bookingData;
      }
      
      // Add grouped bookings to the master map
      for (const [bookingId, booking] of dateBookings.entries()) {
        // Sort time slots
        booking.timeSlots.sort((a, b) => a - b);
        
        // Calculate time range display
        const startHour = booking.timeSlots[0];
        const endHour = booking.timeSlots[booking.timeSlots.length - 1] + 1; // Add 1 hour to show end time
        
        booking.startTime = `${startHour}:00`;
        booking.endTime = `${endHour}:00`;
        booking.displayTimeRange = `${formatDisplayTime(booking.startTime)} - ${formatDisplayTime(booking.endTime)}`;
        booking.duration = booking.timeSlots.length;
        
        // Use both booking ID and date as a compound key to handle same booking ID on different dates
        const compoundKey = `${bookingId}-${dateStr}`;
        bookingsMap.set(compoundKey, booking);
      }
    }
    
    // Convert map to array
    const bookingsArray = Array.from(bookingsMap.values());
    
    // Sort bookings by date and start time
    bookingsArray.sort((a, b) => {
      // First compare dates
      const dateCompare = new Date(a.date) - new Date(b.date);
      if (dateCompare !== 0) return dateCompare;
      
      // Then compare start times
      return a.timeSlots[0] - b.timeSlots[0];
    });
    
    setBookings(bookingsArray);
    
  } catch (error) {
    console.error("Error fetching bookings:", error);
  } finally {
    setBookingsLoading(false);
  }
};

// Helper function to format time
const formatDisplayTime = (timeStr) => {
  const hour = parseInt(timeStr.split(":")[0]);
  const displayHour = hour > 12 ? hour - 12 : hour;
  const amPm = hour >= 12 ? "PM" : "AM";
  return `${displayHour}:00 ${amPm}`;
};

// Filter bookings based on current filter and search term
const filterBookings = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const filtered = bookings.filter(booking => {
    // Apply date filter
    const bookingDate = new Date(booking.date);
    bookingDate.setHours(0, 0, 0, 0);
    
    let passesDateFilter = true;
    
    if (bookingFilter === "upcoming") {
      passesDateFilter = bookingDate >= today;
    } else if (bookingFilter === "past") {
      passesDateFilter = bookingDate < today;
    } else if (bookingFilter === "today") {
      const todayStr = formatDateLocal(today);
      passesDateFilter = booking.date === todayStr;
    }
    
    // Apply search filter if there's a search term
    let passesSearchFilter = true;
    
    if (bookingSearchTerm.trim() !== "") {
      const searchLower = bookingSearchTerm.toLowerCase();
      passesSearchFilter = 
        (booking.customerName?.toLowerCase().includes(searchLower)) || 
        (booking.customerEmail?.toLowerCase().includes(searchLower)) || 
        (booking.customerPhone?.includes(bookingSearchTerm)) ||
        (booking.id?.toLowerCase().includes(searchLower));
    }
    
    return passesDateFilter && passesSearchFilter;
  });
  
  setFilteredBookings(filtered);
};

// Function to handle viewing booking details
const viewBookingDetails = (booking) => {
  setSelectedBooking(booking);
};

// Function to close booking details
const closeBookingDetails = () => {
  setSelectedBooking(null);
};

// Function to handle booking cancellation
const cancelBooking = async (bookingId) => {
  if (!window.confirm("Are you sure you want to cancel this booking?")) {
    return;
  }
  
  try {
    // Find the booking to cancel
    const bookingToCancel = bookings.find(b => b.id === bookingId);
    if (!bookingToCancel) {
      console.error("Booking not found");
      return;
    }
    
    console.log("Cancelling booking:", bookingToCancel);
    
    // Reference to the date document
    const dateRef = doc(db, "unavailability", bookingToCancel.date);
    
    // Get current data
    const dateDoc = await getDoc(dateRef);
    if (!dateDoc.exists()) {
      console.error("Date document not found");
      return;
    }
    
    const dateData = dateDoc.data();
    let updatedDocData = {...dateData};
    
    // Handle grouped time slots
    if (bookingToCancel.timeSlots && bookingToCancel.timeSlots.length > 0) {
      console.log("Cancelling grouped booking with timeSlots:", bookingToCancel.timeSlots);
      
      // Check if we have a bookedTimeSlots object
      if (updatedDocData.bookedTimeSlots) {
        // Clone bookedTimeSlots to modify it
        const updatedSlots = {...updatedDocData.bookedTimeSlots};
        
        // Remove all time slots for this booking
        bookingToCancel.timeSlots.forEach(hour => {
          const timeKey = `${hour}:00`;
          console.log(`Removing time slot: ${timeKey}`);
          delete updatedSlots[timeKey];
        });
        
        // Update the bookedTimeSlots property
        updatedDocData.bookedTimeSlots = updatedSlots;
      } else {
        // Using direct time slot properties
        bookingToCancel.timeSlots.forEach(hour => {
          const timeKey = `${hour}:00`;
          console.log(`Removing direct time slot: ${timeKey}`);
          // Need to use null to remove a field in Firestore updates
          updatedDocData[timeKey] = deleteField();
        });
      }
    } else if (bookingToCancel.time) {
      // Handle single time slot (for backward compatibility)
      console.log(`Cancelling single booking for time: ${bookingToCancel.time}`);
      
      if (updatedDocData.bookedTimeSlots && updatedDocData.bookedTimeSlots[bookingToCancel.time]) {
        // Using bookedTimeSlots object
        const updatedSlots = {...updatedDocData.bookedTimeSlots};
        delete updatedSlots[bookingToCancel.time];
        updatedDocData.bookedTimeSlots = updatedSlots;
      } else {
        // Using direct time slot property
        updatedDocData[bookingToCancel.time] = deleteField();
      }
    }
    
    // If no slots left, update fully booked status
    const hasTimeSlots = 
      (updatedDocData.bookedTimeSlots && Object.keys(updatedDocData.bookedTimeSlots).length > 0) ||
      Object.keys(updatedDocData).some(key => key.includes(':00') && updatedDocData[key]);
      
    if (!hasTimeSlots) {
      updatedDocData.fullyBooked = false;
    }
    
    console.log("Updated document data:", updatedDocData);
    
    // Update the document
    await setDoc(dateRef, updatedDocData);
    
    // Refresh bookings
    await fetchBookings();
    
    // Close details if they were open
    if (selectedBooking && selectedBooking.id === bookingId) {
      closeBookingDetails();
    }
    
    alert("Booking cancelled successfully!");
    
  } catch (error) {
    console.error("Error cancelling booking:", error);
    alert("Error cancelling booking: " + error.message);
  }
};
  
  // Month names for date formatting
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];


// Handle date selection in admin view
const handleAdminDateSelect = (date) => {
  const dateStr = formatDateLocal(date);
  setAdminSelectedDate(dateStr);
  
  // Load existing time slot data for this date
  const existingTimeSlots = timeSlotData[dateStr] || {};
  setAdminTimeSlots(existingTimeSlots);
  
  // Check if date is fully booked
  setAdminFullyBooked(unavailableDates.has(dateStr));
};

// Toggle time slot availability in admin view
const toggleAdminTimeSlot = (timeSlot) => {
  setAdminTimeSlots(prev => {
    const updated = {...prev};
    if (updated[timeSlot]) {
      delete updated[timeSlot];
    } else {
      updated[timeSlot] = {
        // Admin blocked slot
        bookedBy: "admin",
        bookingId: "admin-block",
        bookingTimestamp: new Date().toISOString()
      };
    }
    return updated;
  });
};

// Toggle fully booked status in admin view
const toggleAdminFullyBooked = () => {
  setAdminFullyBooked(!adminFullyBooked);
};

// Generate time slots for admin UI
const generateAdminTimeSlots = () => {
  const slots = [];
  for (let hour = 7; hour <= 20; hour++) {
    const timeSlot = `${hour}:00`;
    const displayHour = hour > 12 ? hour - 12 : hour;
    const amPm = hour >= 12 ? 'PM' : 'AM';
    
    const isBlocked = !!adminTimeSlots[timeSlot];
    
    slots.push({
      display: `${displayHour} ${amPm}`,
      value: timeSlot,
      blocked: isBlocked
    });
  }
  return slots;
};

// Save admin changes to Firebase
const saveAdminChanges = async () => {
  if (!adminSelectedDate) return;
  
  try {
    // Get all documents from the unavailability collection
    const snapshot = await getDocs(collection(db, "unavailability"));
    const existingDates = new Set(snapshot.docs.map((doc) => doc.id));
    
    // Handle fully booked date
    if (adminFullyBooked) {
      await setDoc(doc(db, "unavailability", adminSelectedDate), { fullyBooked: true });
      
      // Update local state
      setUnavailableDates(prev => {
        const updated = new Set(prev);
        updated.add(adminSelectedDate);
        return updated;
      });
    }
    // Handle time slot blocking
    else {
      // If we have blocked time slots
      if (Object.keys(adminTimeSlots).length > 0) {
        await setDoc(doc(db, "unavailability", adminSelectedDate), { 
          fullyBooked: false,
          bookedTimeSlots: adminTimeSlots 
        });
        
        // Update local state
        setTimeSlotData(prev => ({
          ...prev,
          [adminSelectedDate]: adminTimeSlots
        }));
        
        // Check if there are at least 2 consecutive hours available
        const hasEnoughConsecutiveHours = checkConsecutiveAvailableHours(adminTimeSlots);
        
        // If not enough consecutive hours, add to unavailable dates
        if (!hasEnoughConsecutiveHours) {
          setUnavailableDates(prev => {
            const updated = new Set(prev);
            updated.add(adminSelectedDate);
            return updated;
          });
        } else {
          // If enough consecutive hours, remove from unavailable dates
          setUnavailableDates(prev => {
            const updated = new Set(prev);
            updated.delete(adminSelectedDate);
            return updated;
          });
        }
      }
      // If no blocked time slots, remove the document if it exists
      else if (existingDates.has(adminSelectedDate)) {
        await deleteDoc(doc(db, "unavailability", adminSelectedDate));
        
        // Update local state
        setUnavailableDates(prev => {
          const updated = new Set(prev);
          updated.delete(adminSelectedDate);
          return updated;
        });
        
        setTimeSlotData(prev => {
          const updated = {...prev};
          delete updated[adminSelectedDate];
          return updated;
        });
      }
    }
    
    alert("Availability changes saved!");
  } catch (err) {
    console.error("Error saving changes:", err);
    alert("Error saving. Try again.");
  }
};

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

// Replace your fetchUnavailability function with this one
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

  // Toggle date availability (admin functionality)
  const toggleDate = (date) => {
    const dateStr = formatDateLocal(date);
    setUnavailableDates((prevDates) => {
      const updated = new Set(prevDates);
      if (updated.has(dateStr)) {
        updated.delete(dateStr);
      } else {
        updated.add(dateStr);
      }
      return updated;
    });
  };

  const saveUnavailability = async () => {
    try {
      const allDocsSnapshot = await getDocs(collection(db, "unavailability"));
      const existingDates = new Set(allDocsSnapshot.docs.map((doc) => doc.id));
  
      const toAdd = [...unavailableDates].filter((d) => !existingDates.has(d));
      const toRemove = [...existingDates].filter((d) => !unavailableDates.has(d) && d !== adminSelectedDate);
  
      // Add or update
      await Promise.all(
        toAdd.map((date) =>
          setDoc(doc(db, "unavailability", date), { fullyBooked: true })
        )
      );
  
      // Remove
      await Promise.all(
        toRemove.map((date) => deleteDoc(doc(db, "unavailability", date)))
      );
  
      alert("Unavailability saved!");
    } catch (err) {
      console.error("Error saving unavailability:", err);
      alert("Error saving. Try again.");
    }
  };

  const tileClassName = ({ date, view }) => {
    if (view !== "month") return null;
    const dateStr = formatDateLocal(date);
    
    // Check if date is in the past
    if (isPastDate(date)) {
      return activeTab === "admin" ? "past-date" : "unavailable";
    }
    
    if (activeTab === "admin") {
      // Admin view (toggle unavailability)
      if (unavailableDates.has(dateStr)) {
        return "unavailable-date";
      } else {
        return "available-date";
      }
    } else {
      // Booking view (select available dates)
      if (unavailableDates.has(dateStr)) {
        return "unavailable";
      } else if (selectedDate === dateStr) {
        return "selected";
      } else {
        return "available";
      }
    }
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
  
// 3. Update handleDateSelect to prevent selecting past dates
const handleDateSelect = (date) => {
  if (activeTab === "admin") {
    // In admin mode, toggle the date (allow admin to toggle past dates)
    toggleDate(date);
  } else {
    // In booking mode, only select if available and not in the past
    const dateStr = formatDateLocal(date);
    if (!unavailableDates.has(dateStr) && !isPastDate(date)) {
      setSelectedDate(dateStr);
      
      // Call generateTimeSlots if it's not already being called elsewhere
      generateTimeSlots(dateStr);
    }
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
        bookingTimestamp: bookingInfo.timestamp
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

// Improved generateTimeSlots function with past time handling
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
        phone: formData.phone, // Add this line to store phone number
        name: formData.name,   // Also add name for better identification
        orderId: orderId,
        timestamp: new Date().toISOString(),
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

  // Navigate to previous month
  const goToPrevMonth = () => {
    let newMonth = currentMonth - 1;
    let newYear = currentYear;
    
    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    }
    
    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
  };

  // Navigate to next month
  const goToNextMonth = () => {
    let newMonth = currentMonth + 1;
    let newYear = currentYear;
    
    if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }
    
    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Admin/Booking Tabs */}
      <div className="max-w-6xl mx-auto mb-6 flex gap-4">
        <button 
          onClick={() => setActiveTab("booking")}
          className={`px-6 py-2 rounded ${activeTab === "booking" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"}`}
        >
          Booking
        </button>
        <button 
          onClick={() => setActiveTab("admin")}
          className={`px-6 py-2 rounded ${activeTab === "admin" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"}`}
        >
          Admin
        </button>
        <button 
  onClick={() => setActiveTab("bookings")}
  className={`px-6 py-2 rounded ${activeTab === "bookings" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"}`}
>
  Bookings
</button>
      </div>
      
{activeTab === "bookings" ? (
  // Bookings Management View
  <div className="container max-w-6xl mx-auto">
    <h1 className="text-3xl font-bold text-gray-800 mb-6">Bookings Management</h1>
    
    {/* Filters and Search */}
    <div className="flex flex-wrap items-center justify-between bg-white p-4 rounded-lg shadow-md mb-6">
      <div className="flex flex-wrap items-center gap-4 mb-4 lg:mb-0">
        <span className="text-gray-700">Filter:</span>
        <button 
          onClick={() => setBookingFilter("upcoming")}
          className={`px-3 py-1 rounded text-sm ${bookingFilter === "upcoming" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"}`}
        >
          Upcoming
        </button>
        <button 
          onClick={() => setBookingFilter("today")}
          className={`px-3 py-1 rounded text-sm ${bookingFilter === "today" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"}`}
        >
          Today
        </button>
        <button 
          onClick={() => setBookingFilter("past")}
          className={`px-3 py-1 rounded text-sm ${bookingFilter === "past" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"}`}
        >
          Past
        </button>
        <button 
          onClick={() => setBookingFilter("all")}
          className={`px-3 py-1 rounded text-sm ${bookingFilter === "all" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"}`}
        >
          All
        </button>
      </div>
      
      <div className="w-full lg:w-auto">
        <input 
          type="text" 
          placeholder="Search by name, email, phone or ID..."
          value={bookingSearchTerm}
          onChange={(e) => setBookingSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg"
        />
      </div>
    </div>
    
    {/* Bookings Table */}
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {bookingsLoading ? (
        <div className="p-8 text-center">
          <div className="spinner inline-block mr-2"></div>
          <span>Loading bookings...</span>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          {bookingSearchTerm ? (
            <p>No bookings found matching your search.</p>
          ) : bookingFilter === "upcoming" ? (
            <p>No upcoming bookings found.</p>
          ) : bookingFilter === "today" ? (
            <p>No bookings scheduled for today.</p>
          ) : bookingFilter === "past" ? (
            <p>No past bookings found.</p>
          ) : (
            <p>No bookings found.</p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredBookings.map((booking) => {
                // Determine row highlight based on date
                const bookingDate = new Date(booking.date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const isToday = bookingDate.getTime() === today.getTime();
                const isPast = bookingDate < today;
                
                let rowClass = "";
                if (isToday) rowClass = "bg-blue-50";
                if (isPast) rowClass = "bg-gray-50 text-gray-500";
                
                return (
                  <tr key={booking.id} className={rowClass}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{booking.displayDate}</div>
                      <div className="text-sm text-gray-500">{booking.displayTime}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{booking.customerName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{booking.customerEmail}</div>
                      <div className="text-sm text-gray-500">{booking.customerPhone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {booking.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button 
                        onClick={() => viewBookingDetails(booking)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        View
                      </button>
                      <button 
                        onClick={() => cancelBooking(booking.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
    
    {/* Booking Details Modal */}
    {selectedBooking && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] overflow-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Booking Details</h2>
              <button 
                onClick={closeBookingDetails}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-2 text-blue-600">Booking Information</h3>
                <p className="mb-2"><span className="font-medium">Date:</span> {selectedBooking.displayDate}</p>
                <p className="mb-2"><span className="font-medium">Time:</span> {selectedBooking.displayTime}</p>
                <p className="mb-2"><span className="font-medium">Booking ID:</span> {selectedBooking.id}</p>
                <p className="mb-2"><span className="font-medium">Status:</span> {selectedBooking.status || "Confirmed"}</p>
                <p className="mb-2"><span className="font-medium">Booked On:</span> {new Date(selectedBooking.timestamp).toLocaleString()}</p>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-2 text-blue-600">Customer Information</h3>
                <p className="mb-2"><span className="font-medium">Name:</span> {selectedBooking.customerName}</p>
                <p className="mb-2"><span className="font-medium">Email:</span> {selectedBooking.customerEmail}</p>
                <p className="mb-2"><span className="font-medium">Phone:</span> {selectedBooking.customerPhone}</p>
              </div>
            </div>
            
            {/* Service Details */}
            {selectedBooking.details && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2 text-blue-600">Service Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedBooking.bedrooms !== undefined && (
                    <p className="mb-1"><span className="font-medium">Bedrooms:</span> {selectedBooking.bedrooms}</p>
                  )}
                  {selectedBooking.livingRooms !== undefined && (
                    <p className="mb-1"><span className="font-medium">Living Rooms:</span> {selectedBooking.livingRooms}</p>
                  )}
                  {selectedBooking.kitchens !== undefined && (
                    <p className="mb-1"><span className="font-medium">Kitchens:</span> {selectedBooking.kitchens}</p>
                  )}
                  {selectedBooking.bathrooms !== undefined && (
                    <p className="mb-1"><span className="font-medium">Bathrooms:</span> {selectedBooking.bathrooms}</p>
                  )}
                  {selectedBooking.cleanliness && (
                    <p className="mb-1"><span className="font-medium">Cleanliness Level:</span> {selectedBooking.cleanliness}</p>
                  )}
                  {selectedBooking.additionalRooms && (
                    <p className="mb-1"><span className="font-medium">Additional Rooms:</span> {selectedBooking.additionalRooms}</p>
                  )}
                  {selectedBooking.addOns && (
                    <p className="mb-1"><span className="font-medium">Add-ons:</span> {selectedBooking.addOns}</p>
                  )}
                  {selectedBooking.estimatedHours && (
                    <p className="mb-1"><span className="font-medium">Estimated Duration:</span> {selectedBooking.estimatedHours}</p>
                  )}
                  {selectedBooking.totalPrice && (
                    <p className="mb-1"><span className="font-medium">Total Price:</span> £{selectedBooking.totalPrice}</p>
                  )}
                </div>
                
                {selectedBooking.additionalInfo && (
                  <div className="mt-4">
                    <p className="font-medium">Additional Information:</p>
                    <p className="mt-1 text-gray-700">{selectedBooking.additionalInfo}</p>
                  </div>
                )}
              </div>
            )}
            
            <div className="mt-8 flex justify-end">
              <button 
                onClick={() => cancelBooking(selectedBooking.id)}
                className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700 transition duration-200"
              >
                Cancel Booking
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    
    {/* Summary Stats */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
      <div className="bg-white p-4 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-2 text-blue-600">Today</h3>
        <p className="text-3xl font-bold">
          {bookings.filter(b => {
            const bookingDate = new Date(b.date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return bookingDate.getTime() === today.getTime();
          }).length}
        </p>
        <p className="text-gray-500">bookings scheduled</p>
      </div>
      
      <div className="bg-white p-4 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-2 text-blue-600">This Week</h3>
        <p className="text-3xl font-bold">
          {bookings.filter(b => {
            const bookingDate = new Date(b.date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const nextWeek = new Date(today);
            nextWeek.setDate(today.getDate() + 7);
            
            return bookingDate >= today && bookingDate < nextWeek;
          }).length}
        </p>
        <p className="text-gray-500">upcoming bookings</p>
      </div>
      
      <div className="bg-white p-4 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-2 text-blue-600">Total</h3>
        <p className="text-3xl font-bold">
          {bookings.filter(b => {
            const bookingDate = new Date(b.date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return bookingDate >= today;
          }).length}
        </p>
        <p className="text-gray-500">active bookings</p>
      </div>
    </div>
    
{/* Calendar Overview */}
<div className="mt-8 bg-white rounded-lg shadow-md p-6">
  <h3 className="text-lg font-semibold mb-4">Calendar Overview</h3>
  <p className="text-gray-600 mb-2">Colored indicators show booking density:</p>
  
  <div className="flex flex-wrap gap-2 mb-6">
    <div className="flex items-center">
      <div className="w-4 h-4 rounded mr-1" style={{backgroundColor: '#e9f7ef'}}></div>
      <span className="text-xs">1 booking</span>
    </div>
    <div className="flex items-center">
      <div className="w-4 h-4 rounded mr-1" style={{backgroundColor: '#fcf3cf'}}></div>
      <span className="text-xs">2-3 bookings</span>
    </div>
    <div className="flex items-center">
      <div className="w-4 h-4 rounded mr-1" style={{backgroundColor: '#fdebd0'}}></div>
      <span className="text-xs">4-5 bookings</span>
    </div>
    <div className="flex items-center">
      <div className="w-4 h-4 rounded mr-1" style={{backgroundColor: '#fadbd8'}}></div>
      <span className="text-xs">6+ bookings</span>
    </div>
  </div>
      
      {/* Calendar component with booking density indicators */}
      <Calendar
    activeStartDate={new Date(currentYear, currentMonth, 1)}
    className="admin-calendar bookings-calendar"
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
    tileClassName={({ date, view }) => {
      if (view !== "month") return null;
      
      const dateStr = formatDateLocal(date);
      
      // Count bookings for this date
      const bookingsForDate = bookings.filter(b => b.date === dateStr);
      const bookingsCount = bookingsForDate.length;
      
      if (bookingsCount === 0) return ""; 
      if (bookingsCount === 1) return "booking-density-1";
      if (bookingsCount <= 3) return "booking-density-2";
      if (bookingsCount <= 5) return "booking-density-3";
      return "booking-density-4";
    }}
    tileContent={({ date, view }) => {
      if (view !== "month") return null;
      
      const dateStr = formatDateLocal(date);
      
      // Count bookings for this date
      const bookingsForDate = bookings.filter(b => b.date === dateStr);
      const bookingsCount = bookingsForDate.length;
      
      if (bookingsCount === 0) return null;
      
      return (
        <div className="absolute bottom-0 right-1 text-xs font-bold">
          {bookingsCount}
        </div>
      );
    }}
  />
    </div>
  </div>
): activeTab === "admin" ? (
  // Enhanced Admin View with Time Slot Management
  <div className="max-w-6xl mx-auto">
    <h1 className="text-3xl font-bold text-gray-800 mb-6">Availability Management</h1>
    
    <div className="flex flex-wrap gap-6">
      {/* Calendar Container */}
      <div className="calendar-container flex-grow-0 w-full md:w-5/12 bg-white rounded-lg shadow-md p-6">
        {loading ? (
          <p>Loading...</p>
        ) : (
          <Calendar
            activeStartDate={new Date(currentYear, currentMonth, 1)}
            onClickDay={handleAdminDateSelect}
            tileClassName={tileClassName}
            view="month"
            className="admin-calendar"
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
          />
        )}
      </div>
      
      {/* Time Slots Management Container */}
      <div className="time-slots-container flex-grow w-full md:w-6/12">
        {adminSelectedDate ? (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">{formatDisplayDate(adminSelectedDate)}</h2>
            
            <div className="mb-6">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={adminFullyBooked} 
                  onChange={toggleAdminFullyBooked}
                  className="form-checkbox h-5 w-5 text-blue-600"
                />
                <span>Mark entire day as unavailable</span>
              </label>
            </div>
            
            {!adminFullyBooked && (
              <>
                <h3 className="text-lg font-semibold mb-3">Time Slots</h3>
                <p className="mb-3 text-gray-600">Click on time slots to mark them as unavailable:</p>
                
                <div className="time-slots-grid grid grid-cols-3 gap-2 mb-6">
                  {generateAdminTimeSlots().map((slot, index) => (
                    <div 
                      key={index}
                      className={`time-slot p-3 text-center border rounded-md cursor-pointer
                        ${slot.blocked ? 'bg-red-100 text-red-800 border-red-300' : 'hover:bg-blue-100 border-gray-300'}`}
                      onClick={() => toggleAdminTimeSlot(slot.value)}
                    >
                      {slot.display}
                      {slot.blocked && <span className="block text-xs">Blocked</span>}
                    </div>
                  ))}
                </div>
              </>
            )}
            
            <button 
              onClick={saveAdminChanges}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition duration-200"
            >
              Save Changes
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-gray-600">Please select a date from the calendar to manage availability.</p>
          </div>
        )}
      </div>
    </div>
  </div>
) : (
        // Booking View
        <div className="container max-w-6xl mx-auto">
          <div className="flex flex-wrap gap-6">
          {/* Calendar Container */}
<div className="calendar-container flex-grow-0 w-full md:w-5/12 bg-white rounded-lg shadow-md p-6">
  {loading ? (
    <p>Loading...</p>
  ) : (
   // Update your Calendar component with minDate and maxDate props
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
  minDate={getCalendarMinMaxDates().minDate} // Add this line
  maxDate={getCalendarMinMaxDates().maxDate} // Add this line
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
      )}
    </div>
  );
}

export default App;