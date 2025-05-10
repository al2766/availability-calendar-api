import React, { useState, useEffect } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { collection, getDocs, setDoc, deleteDoc, doc, deleteField, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import "./App.css";
import GenerateChecklistButton from './components/CleaningChecklist';
import ConfirmModal from './components/ConfirmModal'; // Import the new modal component
import QuoteModal from './components/QuoteModal';



function App() {
  // Admin state variables for time slot management
  const [adminSelectedDate, setAdminSelectedDate] = useState(null);
  const [adminTimeSlots, setAdminTimeSlots] = useState({});
  const [adminFullyBooked, setAdminFullyBooked] = useState(false);
  
  // Unavailability calendar states
  const [unavailableDates, setUnavailableDates] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [timeSlotData, setTimeSlotData] = useState({});

  
  
  // Navigation states
  const [activeTab, setActiveTab] = useState("admin"); // "admin" or "bookings" now - booking tab routes to BookingForm
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  
  // Month names for date formatting
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Bookings tab state
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingFilter, setBookingFilter] = useState("upcoming"); // "all", "upcoming", "past", "today"
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookingSearchTerm, setBookingSearchTerm] = useState("");
  
  // Staff management states
const [staff, setStaff] = useState([]);
const [staffLoading, setStaffLoading] = useState(false);
const [showAddStaffModal, setShowAddStaffModal] = useState(false);
const [editingStaff, setEditingStaff] = useState(null);
const [staffForm, setStaffForm] = useState({
  name: '',
  email: '',
  phone: '',
  availability: {
    monday: { available: true, startTime: '07:00', endTime: '20:00' },
    tuesday: { available: true, startTime: '07:00', endTime: '20:00' },
    wednesday: { available: true, startTime: '07:00', endTime: '20:00' },
    thursday: { available: true, startTime: '07:00', endTime: '20:00' },
    friday: { available: true, startTime: '07:00', endTime: '20:00' },
    saturday: { available: true, startTime: '07:00', endTime: '20:00' },
    sunday: { available: false, startTime: '07:00', endTime: '20:00' }
  },
  active: true
});
// Add these to your component's state declarations
const [quoteModal, setQuoteModal] = useState({ 
  isOpen: false, 
  booking: null 
});
const [quoteSending, setQuoteSending] = useState({
  inProgress: false,
  bookingId: null,
  timer: null,
  quoteAmount: null
});
  // Add state for confirm modal
const [confirmModal, setConfirmModal] = useState({
  isOpen: false,
  bookingId: null,
  title: '',
  message: ''
});

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

  useEffect(() => {
    fetchUnavailability();
  }, []);

  // Function to check if a date is in the past
  const isPastDate = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to beginning of today
    
    // If a string is passed, convert it to a Date object
    const checkDate = typeof date === 'string' ? new Date(date) : new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    return checkDate < today;
  };

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

  const fetchStaff = async () => {
    try {
      setStaffLoading(true);
      const snapshot = await getDocs(collection(db, "staff"));
      const staffList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setStaff(staffList);
      setStaffLoading(false); // Make sure this is called
    } catch (error) {
      console.error("Error fetching staff:", error);
      setStaff([]); // Set empty array on error
      setStaffLoading(false); // Make sure this is called even on error
    }
  };

const saveStaff = async (e) => {
  e.preventDefault();
  try {
    if (editingStaff) {
      // Update existing staff
      await setDoc(doc(db, "staff", editingStaff.id), {
        ...staffForm,
        updatedAt: new Date().toISOString()
      });
    } else {
      // Add new staff (use timestamp as ID)
      await setDoc(doc(db, "staff", Date.now().toString()), {
        ...staffForm,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    // Reset form and close modal
    setStaffForm({
      name: '',
      email: '',
      phone: '',
      availability: {
        monday: { available: true, startTime: '07:00', endTime: '20:00' },
        tuesday: { available: true, startTime: '07:00', endTime: '20:00' },
        wednesday: { available: true, startTime: '07:00', endTime: '20:00' },
        thursday: { available: true, startTime: '07:00', endTime: '20:00' },
        friday: { available: true, startTime: '07:00', endTime: '20:00' },
        saturday: { available: true, startTime: '07:00', endTime: '20:00' },
        sunday: { available: false, startTime: '07:00', endTime: '20:00' }
      },
      active: true
    });
    setShowAddStaffModal(false);
    setEditingStaff(null);
    
    // Refresh staff list
    await fetchStaff();
    
    // Show success message
    const successMessage = document.createElement('div');
    successMessage.innerHTML = `<div class="fixed top-0 right-0 m-4 p-4 bg-green-500 text-white rounded shadow-lg transition-opacity duration-500">
      Staff ${editingStaff ? 'updated' : 'added'} successfully!
    </div>`;
    document.body.appendChild(successMessage);
    
    setTimeout(() => {
      successMessage.querySelector('div').style.opacity = '0';
      setTimeout(() => document.body.removeChild(successMessage), 500);
    }, 3000);
    
  } catch (error) {
    console.error("Error saving staff:", error);
    alert(`Error saving staff: ${error.message}. Please check your Firebase permissions and try again.`);
  }
};

const deleteStaff = async (staffId) => {
  if (window.confirm("Are you sure you want to delete this staff member?")) {
    try {
      await deleteDoc(doc(db, "staff", staffId));
      await fetchStaff();
      
      // Show success message
      const successMessage = document.createElement('div');
      successMessage.innerHTML = '<div class="fixed top-0 right-0 m-4 p-4 bg-green-500 text-white rounded shadow-lg transition-opacity duration-500">Staff member deleted successfully!</div>';
      document.body.appendChild(successMessage);
      
      setTimeout(() => {
        successMessage.querySelector('div').style.opacity = '0';
        setTimeout(() => document.body.removeChild(successMessage), 500);
      }, 3000);
    } catch (error) {
      console.error("Error deleting staff:", error);
      alert("Error deleting staff. Please try again.");
    }
  }
};

const editStaff = (staffMember) => {
  setEditingStaff(staffMember);
  setStaffForm({
    name: staffMember.name,
    email: staffMember.email,
    phone: staffMember.phone,
    availability: staffMember.availability,
    active: staffMember.active
  });
  setShowAddStaffModal(true);
};

const handleStaffFormChange = (e) => {
  const { name, value, type, checked } = e.target;
  if (type === 'checkbox') {
    setStaffForm(prev => ({
      ...prev,
      [name]: checked
    }));
  } else {
    setStaffForm(prev => ({
      ...prev,
      [name]: value
    }));
  }
};

const handleAvailabilityChange = (day, field, value) => {
  setStaffForm(prev => ({
    ...prev,
    availability: {
      ...prev.availability,
      [day]: {
        ...prev.availability[day],
        [field]: value
      }
    }
  }));
};

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
              customerName: bookingData.name || "Unknown",
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

// Function to show the quote modal
const showSendQuoteModal = (booking) => {
  setQuoteModal({
    isOpen: true,
    booking: booking
  });
};

// Function to handle sending quotes with undo capability
const handleSendQuote = (bookingId, quoteAmount) => {
  // Close the modal
  setQuoteModal({
    isOpen: false,
    booking: null
  });
  
  // Set quote sending in progress
  setQuoteSending({
    inProgress: true,
    bookingId: bookingId,
    quoteAmount: quoteAmount,
    timer: setTimeout(() => {
      // This will execute after the grace period
      sendQuoteEmail(bookingId, quoteAmount);
    }, 0) // 10 second grace period
  });
  
  // Show toast notification with undo option
  const notification = document.createElement('div');
  notification.className = 'fixed bottom-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg z-50 flex items-center';
  notification.innerHTML = `
    <div class="mr-3">
      <p class="font-medium">Quote £${quoteAmount} will be sent in 10 seconds</p>
      <p class="text-sm">Click undo to cancel</p>
    </div>
    <button id="undoQuoteBtn" class="bg-white text-blue-600 px-3 py-1 rounded hover:bg-blue-100">
      Undo
    </button>
  `;
  document.body.appendChild(notification);
  
  // Add event listener to undo button
  document.getElementById('undoQuoteBtn').addEventListener('click', () => {
    // Clear the timeout
    if (quoteSending.timer) {
      clearTimeout(quoteSending.timer);
    }
    
    // Reset quote sending state
    setQuoteSending({
      inProgress: false,
      bookingId: null,
      timer: null,
      quoteAmount: null
    });
    
    // Remove the notification
    document.body.removeChild(notification);
    
    // Show success message
    const undoMessage = document.createElement('div');
    undoMessage.innerHTML = '<div class="fixed top-0 right-0 m-4 p-4 bg-green-500 text-white rounded shadow-lg transition-opacity duration-500">Quote cancelled!</div>';
    document.body.appendChild(undoMessage);
    
    // Remove the message after a delay
    setTimeout(() => {
      undoMessage.querySelector('div').style.opacity = '0';
      setTimeout(() => document.body.removeChild(undoMessage), 500);
    }, 3000);
  });
  
  // Remove the notification after the grace period
  setTimeout(() => {
    if (document.body.contains(notification)) {
      document.body.removeChild(notification);
    }
  }, 10000);
};

const sendQuoteEmail = async (bookingId, quoteAmount) => {
  try {
    // Find the booking
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) {
      console.error("Booking not found for sending quote");
      return;
    }
    const now = new Date();
    
    console.log(`Sending quote of £${quoteAmount} to ${booking.customerName} (${booking.customerEmail})`);
    const formattedQuoteDate = `${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;

    // Show loading indicator
    const loadingMessage = document.createElement('div');
    loadingMessage.innerHTML = `<div class="fixed top-0 right-0 m-4 p-4 bg-blue-500 text-white rounded shadow-lg">Processing quote...</div>`;
    document.body.appendChild(loadingMessage);
    
    try {
      // Create a single consolidated data object for Zapier
      const zapierData = {
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        customerPhone: booking.customerPhone,
        bookingDate: booking.displayDate,
        bookingTime: booking.displayTimeRange || booking.time,
        orderId: booking.id,
        serviceType: booking.service || "Cleaning Service",
        quoteAmount: quoteAmount,
        stripeQuoteAmount: quoteAmount * 100,
        quoteDate: formattedQuoteDate,
        submittedAt: new Date().toISOString(),
        bedrooms: booking.bedrooms,
        livingRooms: booking.livingRooms,
        kitchens: booking.kitchens,
        bathrooms: booking.bathrooms,
        cleanliness: booking.cleanliness,
        additionalRooms: booking.additionalRooms,
        addOns: booking.addOns,
        estimatedHours: booking.estimatedHours,
        totalPrice: booking.totalPrice,
        additionalInfo: booking.additionalInfo || "None provided"
      };
      
      console.log('Sending consolidated data to Zapier:', zapierData);
      
      // Single Zapier call
      await fetch('https://hooks.zapier.com/hooks/catch/22652608/2p0nwcm/', {
        method: 'POST',
        mode: "no-cors",
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(zapierData)
      });
      
      console.log('Quote request sent to Zapier');
      
      // UPDATE FIREBASE WITH QUOTE INFORMATION
      try {
        // Find the date document
        const dateRef = doc(db, "unavailability", booking.date);
        const dateDoc = await getDoc(dateRef);
        
        if (dateDoc.exists()) {
          const dateData = dateDoc.data();
          const updatedBookedSlots = { ...dateData.bookedTimeSlots };
          
          // Update the booking information in each time slot for this booking
          Object.keys(updatedBookedSlots).forEach(timeSlot => {
            const slotData = updatedBookedSlots[timeSlot];
            if (slotData.bookingId === booking.id) {
              // Add quote information to the time slot data
              updatedBookedSlots[timeSlot] = {
                ...slotData,
                quoteSent: true,
                quoteAmount: quoteAmount,
                quoteSentDate: new Date().toISOString(),
                quoteStatus: 'sent'
              };
            }
          });
          
          // Update Firebase with the new data
          await setDoc(dateRef, {
            ...dateData,
            bookedTimeSlots: updatedBookedSlots
          });
          
          console.log('Quote information saved to Firebase');
          
          // Update local state to immediately reflect the change
          setTimeSlotData(prev => ({
            ...prev,
            [booking.date]: updatedBookedSlots
          }));
          
          // Refresh bookings to show the updated quote status
          await fetchBookings();
        }
      } catch (firebaseError) {
        console.error("Error updating Firebase with quote info:", firebaseError);
        // Don't fail the whole process if Firebase update fails
      }
      
      // Remove loading message
      document.body.removeChild(loadingMessage);
      
      // Show success message 
      const successMessage = document.createElement('div');
      successMessage.innerHTML = `<div class="fixed top-0 right-0 m-4 p-4 bg-green-500 text-white rounded shadow-lg transition-opacity duration-500">
        Quote of £${quoteAmount} sent successfully! A payment link has been sent to the customer's email.
      </div>`;
      document.body.appendChild(successMessage);
      
      // Remove the message after a delay
      setTimeout(() => {
        successMessage.querySelector('div').style.opacity = '0';
        setTimeout(() => document.body.removeChild(successMessage), 500);
      }, 3000);
      
    } catch (zapError) {
      console.error("Error with Zapier automation:", zapError);
      
      // Show error message
      const errorMessage = document.createElement('div');
      errorMessage.innerHTML = `<div class="fixed top-0 right-0 m-4 p-4 bg-red-500 text-white rounded shadow-lg transition-opacity duration-500">
        Error sending quote: ${zapError.message}. Please try again or contact support.
      </div>`;
      document.body.appendChild(errorMessage);
      
      // Remove the message after a delay
      setTimeout(() => {
        errorMessage.querySelector('div').style.opacity = '0';
        setTimeout(() => document.body.removeChild(errorMessage), 500);
      }, 5000);
    }
    
    // Reset quote sending state
    setQuoteSending({
      inProgress: false,
      bookingId: null,
      timer: null,
      quoteAmount: null
    });
    
  } catch (error) {
    console.error("Error sending quote:", error);
    
    // Show error message
    const errorMessage = document.createElement('div');
    errorMessage.innerHTML = `<div class="fixed top-0 right-0 m-4 p-4 bg-red-500 text-white rounded shadow-lg transition-opacity duration-500">Error sending quote: ${error.message}</div>`;
    document.body.appendChild(errorMessage);
    
    // Remove the message after a delay
    setTimeout(() => {
      errorMessage.querySelector('div').style.opacity = '0';
      setTimeout(() => document.body.removeChild(errorMessage), 500);
    }, 5000);
    
    // Reset quote sending state
    setQuoteSending({
      inProgress: false,
      bookingId: null,
      timer: null,
      quoteAmount: null
    });
  }
};

// First you have your showCancelBookingConfirm function:
const showCancelBookingConfirm = (bookingId) => {
  // Find the booking to get details
  const bookingToCancel = bookings.find(b => b.id === bookingId);
  if (!bookingToCancel) return;
  
  // Set modal state with booking details
  setConfirmModal({
    isOpen: true,
    bookingId: bookingId,
    title: 'Cancel Booking',
    message: `Are you sure you want to cancel the booking for ${bookingToCancel.customerName} on ${bookingToCancel.displayDate}?`
  });
};

// Add this function to your App.js file
const notifyCancellation = async (booking, cancellationReason = "") => {
  const now = new Date();
    
  const formattedCanellationDate = `${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;

  try {
    // Prepare the data for Zapier
    const cancellationData = {
      // Essential booking identification
      orderId: booking.id || booking.orderId,
      customerName: booking.customerName || booking.name,
      customerEmail: booking.customerEmail || booking.email,
      bookingDate: booking.displayDate || booking.date,
      bookingTime: booking.displayTimeRange || booking.time,
      
      // Add cancellation information
      cancellationReason: cancellationReason || "No reason provided",
      cancellationDate: formattedCanellationDate,
      status: "CANCELLED",
      
      // Include any other relevant booking details that Zapier might need
      service: booking.service || "Cleaning Service",
      totalPrice: booking.totalPrice || "0.00",
      
      // Add metadata to help Zapier routing
      actionType: "booking_cancellation",
      source: "admin_dashboard"
    };
    
    console.log('Sending cancellation data to Zapier:', cancellationData);
    
    // Send the data to your Zapier webhook - create a new webhook specifically for cancellations
    const response = await fetch('https://hooks.zapier.com/hooks/catch/22652608/2pje2gt/', {
      method: 'POST',
      mode: "no-cors",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cancellationData)
    });
    
    console.log('Zapier cancellation webhook triggered');
    
    // We can't get a detailed response with no-cors mode
    // But we can check if the request was sent
    return true;
  } catch (error) {
    console.error('Error sending cancellation to Zapier:', error);
    // Continue with booking cancellation process even if Zapier notification fails
    return false;
  }
};

// Now modify your existing cancelBooking function to include the Zapier notification
const cancelBooking = async (bookingId, cancellationReason = "") => {
  console.log("cancelBooking called with bookingId:", bookingId);
  
  try {
    // Find the booking to cancel
    const bookingToCancel = bookings.find(b => b.id === bookingId);
    if (!bookingToCancel) {
      console.error("Booking not found");
      return;
    }
    
    console.log("Cancelling booking:", bookingToCancel);

    
    
    // FIRST: Notify Zapier about the cancellation
    // This will update Trello and Google Sheets
    await notifyCancellation(bookingToCancel, cancellationReason);

    
    // Reference to the date document
    const dateRef = doc(db, "unavailability", bookingToCancel.date);
    
    // Rest of your existing cancelBooking code
    // [Your existing code for updating Firestore...]
    
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
      // [Your existing time slot handling code...]
      
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
            // Need to use deleteField() to remove a field in Firestore updates
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
    
    // Show success message
    const successMessage = document.createElement('div');
    successMessage.innerHTML = '<div class="fixed top-0 right-0 m-4 p-4 bg-green-500 text-white rounded shadow-lg transition-opacity duration-500">Booking cancelled successfully!</div>';
    document.body.appendChild(successMessage);
    
    // Remove the message after a delay
    setTimeout(() => {
      successMessage.querySelector('div').style.opacity = '0';
      setTimeout(() => document.body.removeChild(successMessage), 500);
    }, 3000);
    
  } catch (error) {
    console.error("Error cancelling booking:", error);
    
    // Show error message
    const errorMessage = document.createElement('div');
    errorMessage.innerHTML = `<div class="fixed top-0 right-0 m-4 p-4 bg-red-500 text-white rounded shadow-lg transition-opacity duration-500">Error: ${error.message}</div>`;
    document.body.appendChild(errorMessage);
    
    // Remove the message after a delay
    setTimeout(() => {
      errorMessage.querySelector('div').style.opacity = '0';
      setTimeout(() => document.body.removeChild(errorMessage), 500);
    }, 5000);
  }
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
    } else if (date === dateStr) {
      return "selected";
    } else {
      return "available";
    }
  }
};


return (
  <div className="min-h-screen bg-gray-100 p-6">
    {/* Admin/Booking Tabs */}
   {/* Admin/Booking Tabs */}
<div className="max-w-6xl mx-auto mb-6 flex gap-4">
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
  <button 
    onClick={() => setActiveTab("staff")}
    className={`px-6 py-2 rounded ${activeTab === "staff" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"}`}
  >
    Staff
  </button>
  <button 
    onClick={() => window.location.href = '/booking/home'}
    className="px-6 py-2 rounded bg-gray-200 text-gray-700"
  >
    Home Cleaning Form
  </button>
  <button 
    onClick={() => window.location.href = '/booking/office'}
    className="px-6 py-2 rounded bg-gray-200 text-gray-700"
  >
    Office Cleaning Form
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
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
                      <tr key={booking.id + '-' + booking.date} className={rowClass}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{booking.displayDate}</div>
                          <div className="text-sm text-gray-500">{booking.displayTimeRange || booking.displayTime}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{booking.duration || 1} hour{booking.duration !== 1 ? 's' : ''}</div>
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
                {/* Add Send Quote button that changes to Undo during grace period */}
  {/* Check if quote has been sent */}
{/* Check if quote has been sent */}
{booking.quoteSent ? (
  <button 
    disabled
    className="text-gray-400 bg-gray-100 cursor-not-allowed mr-4 px-3 py-1 rounded"
  >
    Quote Sent
  </button>
) : quoteSending.inProgress && quoteSending.bookingId === booking.id ? (
  <button 
    onClick={() => {
      // Clear the timeout
      if (quoteSending.timer) {
        clearTimeout(quoteSending.timer);
      }
      
      // Reset quote sending state
      setQuoteSending({
        inProgress: false,
        bookingId: null,
        timer: null,
        quoteAmount: null
      });
      
      // Show cancelled message
      const cancelMessage = document.createElement('div');
      cancelMessage.innerHTML = '<div class="fixed top-0 right-0 m-4 p-4 bg-green-500 text-white rounded shadow-lg transition-opacity duration-500">Quote cancelled!</div>';
      document.body.appendChild(cancelMessage);
      
      // Remove the message after a delay
      setTimeout(() => {
        cancelMessage.querySelector('div').style.opacity = '0';
        setTimeout(() => document.body.removeChild(cancelMessage), 500);
      }, 3000);
    }}
    className="text-orange-600 hover:text-orange-900 mr-4"
  >
    Undo Quote (£{quoteSending.quoteAmount})
  </button>
) : (
  <button 
    onClick={() => showSendQuoteModal(booking)}
    className="text-green-600 hover:text-green-900 mr-4"
  >
    Send Quote
  </button>
)}
                          <button 
                            onClick={() => viewBookingDetails(booking)}
                            className="text-white-600 hover:text-white-900 mr-4"
                          >
                            View
                          </button>
                          <GenerateChecklistButton booking={booking} />

                          <button 
  onClick={() => showCancelBookingConfirm(booking.id)}
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
                    <p className="mb-2"><span className="font-medium">Time:</span> {selectedBooking.displayTimeRange || selectedBooking.displayTime}</p>
                    <p className="mb-2"><span className="font-medium">Duration:</span> {selectedBooking.duration || 1} hour{selectedBooking.duration !== 1 ? 's' : ''}</p>
                    <p className="mb-2"><span className="font-medium">Booking ID:</span> {selectedBooking.id}</p>
                    <p className="mb-2"><span className="font-medium">Status:</span> {selectedBooking.status || "Confirmed"}</p>
                    <p className="mb-2"><span className="font-medium">Booked On:</span> {new Date(selectedBooking.timestamp).toLocaleString()}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold mb-2 text-blue-600">Customer Information</h3>
                    <p className="mb-2"><span className="font-medium">Name:</span> {selectedBooking.customerName}</p>
                    <p className="mb-2"><span className="font-medium">Email:</span> {selectedBooking.customerEmail}</p>
                    <p className="mb-2"><span className="font-medium">Phone:</span> {selectedBooking.customerPhone}</p>
                    <p className="mb-2"><span className="font-medium">Address:</span> {selectedBooking.address}</p>
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
                    {/* In the Booking Details Modal - add this section after the service details or customer information */}
{selectedBooking.quoteSent && (
  <div className="mt-6">
    <h3 className="text-lg font-semibold mb-2 text-blue-600">Quote Information</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <p className="mb-1"><span className="font-medium">Quote Amount:</span> £{selectedBooking.quoteAmount}</p>
      <p className="mb-1"><span className="font-medium">Quote Sent Date:</span> {selectedBooking.quoteSentDate ? new Date(selectedBooking.quoteSentDate).toLocaleDateString('en-GB', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      }) : 'N/A'}</p>
      <p className="mb-1"><span className="font-medium">Status:</span> <span className="text-green-600 font-medium">Sent</span></p>
    </div>
  </div>
)}
                  </div>
                  
                )}
                
                <div className="mt-8 flex justify-end">
                <button 
  onClick={() => showCancelBookingConfirm(selectedBooking.id)}
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
      ) : activeTab === "admin" ? (
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
      ) : activeTab === "staff" ? (
        // Staff Management View
        <div className="container max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">Staff Management</h1>
          
          {/* Add Staff Button */}
          <div className="mb-6">
            <button
              onClick={() => setShowAddStaffModal(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition duration-200"
            >
              Add Staff Member
            </button>
          </div>
          
          {/* Staff List */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {staffLoading ? (
              <div className="p-8 text-center">
                <div className="spinner inline-block mr-2"></div>
                <span>Loading staff...</span>
              </div>
            ) : staff.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No staff members found. Add your first staff member.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Availability</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {staff.map((staffMember) => (
                      <tr key={staffMember.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{staffMember.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{staffMember.email}</div>
                          <div className="text-sm text-gray-500">{staffMember.phone}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            staffMember.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {staffMember.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {Object.entries(staffMember.availability).map(([day, hours]) => (
                              <div key={day} className="mb-1">
                                <span className="font-medium capitalize">{day}:</span> {
                                  hours.available ? `${hours.startTime} - ${hours.endTime}` : 'Not Available'
                                }
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button 
                            onClick={() => editStaff(staffMember)}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => deleteStaff(staffMember.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
          {/* Add/Edit Staff Modal */}
          {showAddStaffModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] overflow-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">{editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}</h2>
                    <button 
                      onClick={() => {
                        setShowAddStaffModal(false);
                        setEditingStaff(null);
                        setStaffForm({
                          name: '',
                          email: '',
                          phone: '',
                          availability: {
                            monday: { available: true, startTime: '07:00', endTime: '20:00' },
                            tuesday: { available: true, startTime: '07:00', endTime: '20:00' },
                            wednesday: { available: true, startTime: '07:00', endTime: '20:00' },
                            thursday: { available: true, startTime: '07:00', endTime: '20:00' },
                            friday: { available: true, startTime: '07:00', endTime: '20:00' },
                            saturday: { available: true, startTime: '07:00', endTime: '20:00' },
                            sunday: { available: false, startTime: '07:00', endTime: '20:00' }
                          },
                          active: true
                        });
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  <form onSubmit={saveStaff}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input
                          type="text"
                          name="name"
                          value={staffForm.name}
                          onChange={handleStaffFormChange}
                          className="w-full p-2 border rounded-lg"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                          type="email"
                          name="email"
                          value={staffForm.email}
                          onChange={handleStaffFormChange}
                          className="w-full p-2 border rounded-lg"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <input
                          type="tel"
                          name="phone"
                          value={staffForm.phone}
                          onChange={handleStaffFormChange}
                          className="w-full p-2 border rounded-lg"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <div className="flex items-center mt-2">
                          <input
                            type="checkbox"
                            name="active"
                            checked={staffForm.active}
                            onChange={handleStaffFormChange}
                            className="mr-2"
                          />
                          <span>Active</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold mb-3">Availability</h3>
                      <div className="space-y-3">
                        {Object.entries(staffForm.availability).map(([day, hours]) => (
                          <div key={day} className="flex items-center space-x-4">
                            <div className="w-24">
                              <span className="capitalize font-medium">{day}</span>
                            </div>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={hours.available}
                                onChange={(e) => handleAvailabilityChange(day, 'available', e.target.checked)}
                                className="mr-2"
                              />
                              <span className="mr-4">Available</span>
                            </div>
                            {hours.available && (
                              <>
                                <input
                                  type="time"
                                  value={hours.startTime}
                                  onChange={(e) => handleAvailabilityChange(day, 'startTime', e.target.value)}
                                  className="border rounded px-2 py-1"
                                />
                                <span>to</span>
                                <input
                                  type="time"
                                  value={hours.endTime}
                                  onChange={(e) => handleAvailabilityChange(day, 'endTime', e.target.value)}
                                  className="border rounded px-2 py-1"
                                />
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddStaffModal(false);
                          setEditingStaff(null);
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition duration-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition duration-200"
                      >
                        {editingStaff ? 'Update Staff' : 'Add Staff'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null }
      {/* Confirmation Modal */}
      <ConfirmModal
  isOpen={confirmModal.isOpen}
  onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
  onConfirm={(reason) => cancelBooking(confirmModal.bookingId, reason)}
  title={confirmModal.title}
  message={confirmModal.message}
/>
<QuoteModal
  isOpen={quoteModal.isOpen}
  onClose={() => setQuoteModal({ isOpen: false, booking: null })}
  onSendQuote={(amount) => handleSendQuote(quoteModal.booking?.id, amount)}
  booking={quoteModal.booking}
/>
    </div>
  );
}

export default App;