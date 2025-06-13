import React, { useState, useEffect } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { collection, getDocs, setDoc, deleteDoc, doc, deleteField, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import "./App.css";
import GenerateChecklistButton, { generateChecklistPDFBase64 } from './components/CleaningChecklist';
import ConfirmModal from './components/ConfirmModal';
import QuoteModal from './components/QuoteModal';

function App() {

  // Add these state variables to your App.js (after existing useState declarations)
const [showChecklistModal, setShowChecklistModal] = useState(false);
const [selectedBookingForChecklist, setSelectedBookingForChecklist] = useState(null);
const [selectedStaffForChecklist, setSelectedStaffForChecklist] = useState("");
const [sendingChecklist, setSendingChecklist] = useState(false);
  // Admin state variables for time slot management
  const [adminSelectedDate, setAdminSelectedDate] = useState(null);
  const [adminTimeSlots, setAdminTimeSlots] = useState({});
  const [adminFullyBooked, setAdminFullyBooked] = useState(false);
  
  // Unavailability calendar states
  const [unavailableDates, setUnavailableDates] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [timeSlotData, setTimeSlotData] = useState({});
  
  // Navigation states
  const [activeTab, setActiveTab] = useState("bookings");
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  
  // Month names for date formatting
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Bookings tab state
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingFilter, setBookingFilter] = useState("upcoming");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookingSearchTerm, setBookingSearchTerm] = useState("");
  
  // Quote modal states
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
  
  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    bookingId: null,
    title: '',
    message: ''
  });

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

  const [availabilitySettings, setAvailabilitySettings] = useState({
    useStaffAvailability: false,
    allDatesAvailable: true,
    minimumNoticeHours: 4,
    allowOverlapping: false, // We're keeping this for backward compatibility
    cleanersPerBooking: 1,
    bufferTimeBetweenBookings: 0,
    maxConcurrentBookings: 1,
    assignTwoCleanersAfterHours: 4, // New - assign 2 cleaners if booking exceeds 4 hours
    dynamicAvailability: true, // New - enable the dynamic availability system
    maxJobsPerCleaner: 1 // New - maximum number of concurrent jobs per cleaner
  });
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  // useEffect hooks
  useEffect(() => {
    if (activeTab === "bookings") {
      fetchBookings();
    }
  }, [activeTab]);

  useEffect(() => {
    filterBookings();
  }, [bookings, bookingFilter, bookingSearchTerm]);

  useEffect(() => {
    fetchUnavailability();
  }, []);

  useEffect(() => {
    if (activeTab === "staff") {
      fetchStaff();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "availability") {
      fetchAvailabilitySettings();
    }
  }, [activeTab]);

  // Function to check if a date is in the past
  const isPastDate = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = typeof date === 'string' ? new Date(date) : new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  };

  // Handle date selection in admin view
  const handleAdminDateSelect = (date) => {
    const dateStr = formatDateLocal(date);
    setAdminSelectedDate(dateStr);
    const existingTimeSlots = timeSlotData[dateStr] || {};
    setAdminTimeSlots(existingTimeSlots);
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

const openChecklistModal = (booking) => {
  console.log("Opening checklist modal, current staff count:", staff.length);
  console.log("Staff data:", staff);
  
  setSelectedBookingForChecklist(booking);
  setShowChecklistModal(true);
  
  // Always refresh staff data to ensure it's current
  fetchStaff();
};

// Add this function to send checklist via Zapier
const sendChecklistToStaff = async () => {
  if (!selectedStaffForChecklist) {
    alert("Please select a staff member");
    return;
  }
  
  setSendingChecklist(true);
  
  try {
    // Find selected staff details
    const staffMember = staff.find(s => s.id === selectedStaffForChecklist);
    
    // Generate PDF as base64 using your existing function
    const pdfBase64 = await generateChecklistPDFBase64(selectedBookingForChecklist);
    console.log(selectedBookingForChecklist.id);
    console.log(staffMember.email);
    // Send to Zapier
    const zapierData = {
      type: "checklist",
      orderId: selectedBookingForChecklist.id,
      staffName: staffMember.name,
      staffPhone: staffMember.phone,
      staffEmail: staffMember.email,
      customerName: selectedBookingForChecklist.name || selectedBookingForChecklist.customerName,
      customerAddress: selectedBookingForChecklist.address,
      service: selectedBookingForChecklist.service,
      date: selectedBookingForChecklist.date || selectedBookingForChecklist.displayDate,
      time: selectedBookingForChecklist.time || selectedBookingForChecklist.displayTimeRange,
      duration: selectedBookingForChecklist.duration,
      bookingId: selectedBookingForChecklist.id,
      //pdfBase64: pdfBase64,
      //fileName: `checklist-${(selectedBookingForChecklist.name || selectedBookingForChecklist.customerName || 'unknown').replace(/\s+/g, '_')}-${selectedBookingForChecklist.date || 'unknown'}.pdf`
    };

    await fetch('https://hooks.zapier.com/hooks/catch/22652608/uymrar6/', {
      method: 'POST',
      mode: "no-cors",
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(zapierData)
    });
    
    alert(`Checklist sent to ${staffMember.name}!`);
    setShowChecklistModal(false);
    setSelectedBookingForChecklist(null);
    setSelectedStaffForChecklist("");
    
  } catch (error) {
    console.error("Error sending checklist:", error);
    alert("Failed to send checklist. Please try again.");
  } finally {
    setSendingChecklist(false);
  }
};


  // Save admin changes to Firebase
  const saveAdminChanges = async () => {
    if (!adminSelectedDate) return;
    
    try {
      const snapshot = await getDocs(collection(db, "unavailability"));
      const existingDates = new Set(snapshot.docs.map((doc) => doc.id));
      
      if (adminFullyBooked) {
        await setDoc(doc(db, "unavailability", adminSelectedDate), { fullyBooked: true });
        
        setUnavailableDates(prev => {
          const updated = new Set(prev);
          updated.add(adminSelectedDate);
          return updated;
        });
      }
      else {
        if (Object.keys(adminTimeSlots).length > 0) {
          await setDoc(doc(db, "unavailability", adminSelectedDate), { 
            fullyBooked: false,
            bookedTimeSlots: adminTimeSlots 
          });
          
          setTimeSlotData(prev => ({
            ...prev,
            [adminSelectedDate]: adminTimeSlots
          }));
          
          const hasEnoughConsecutiveHours = checkConsecutiveAvailableHours(adminTimeSlots);
          
          if (!hasEnoughConsecutiveHours) {
            setUnavailableDates(prev => {
              const updated = new Set(prev);
              updated.add(adminSelectedDate);
              return updated;
            });
          } else {
            setUnavailableDates(prev => {
              const updated = new Set(prev);
              updated.delete(adminSelectedDate);
              return updated;
            });
          }
        }
        else if (existingDates.has(adminSelectedDate)) {
          await deleteDoc(doc(db, "unavailability", adminSelectedDate));
          
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

  // Fetch bookings
  const fetchBookings = async () => {
    try {
      setBookingsLoading(true);
      
      const bookingsMap = new Map();
      const snapshot = await getDocs(collection(db, "unavailability"));
      
      for (const dateDoc of snapshot.docs) {
        const dateStr = dateDoc.id;
        const dateData = dateDoc.data();
        
        if (dateData.fullyBooked === true && !dateData.bookedTimeSlots) {
          continue;
        }
        
        const bookedSlots = {};
        
        if (dateData.bookedTimeSlots) {
          Object.assign(bookedSlots, dateData.bookedTimeSlots);
        } else {
          for (let hour = 7; hour <= 20; hour++) {
            const timeKey = `${hour}:00`;
            if (dateData[timeKey]) {
              bookedSlots[timeKey] = dateData[timeKey];
            }
          }
        }
        
        const dateBookings = new Map();
        
        for (const [timeSlot, bookingData] of Object.entries(bookedSlots)) {
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
              status: "confirmed",
              details: bookingData,
              displayDate: formatDisplayDate(dateStr).replace("Selected Date: ", ""),
              timestamp: bookingData.bookingTimestamp || new Date().toISOString(),
              quoteSent: bookingData.quoteSent || false,
              quoteAmount: bookingData.quoteAmount,
              quoteSentDate: bookingData.quoteSentDate,
              quoteStatus: bookingData.quoteStatus,
              ...bookingData
            });
          }
          
          const hourValue = parseInt(timeSlot.split(':')[0]);
          dateBookings.get(bookingId).timeSlots.push(hourValue);
          dateBookings.get(bookingId).timeSlotDetails[timeSlot] = bookingData;
        }
        
        for (const [bookingId, booking] of dateBookings.entries()) {
          booking.timeSlots.sort((a, b) => a - b);
          
          const startHour = booking.timeSlots[0];
          const endHour = booking.timeSlots[booking.timeSlots.length - 1] + 1;
          
          booking.startTime = `${startHour}:00`;
          booking.endTime = `${endHour}:00`;
          booking.displayTimeRange = `${formatDisplayTime(booking.startTime)} - ${formatDisplayTime(booking.endTime)}`;
          booking.duration = booking.timeSlots.length;
          
          const compoundKey = `${bookingId}-${dateStr}`;
          bookingsMap.set(compoundKey, booking);
        }
      }
      
      const bookingsArray = Array.from(bookingsMap.values());
      
      bookingsArray.sort((a, b) => {
        const dateCompare = new Date(a.date) - new Date(b.date);
        if (dateCompare !== 0) return dateCompare;
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

  // Filter bookings
  const filterBookings = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const filtered = bookings.filter(booking => {
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

  // View booking details
  const viewBookingDetails = (booking) => {
    setSelectedBooking(booking);
  };

  // Close booking details
  const closeBookingDetails = () => {
    setSelectedBooking(null);
  };

  // Show quote modal
  const showSendQuoteModal = (booking) => {
    setQuoteModal({
      isOpen: true,
      booking: booking
    });
  };

  // Handle sending quotes
  const handleSendQuote = (bookingId, quoteAmount) => {
    setQuoteModal({
      isOpen: false,
      booking: null
    });
    
    setQuoteSending({
      inProgress: true,
      bookingId: bookingId,
      quoteAmount: quoteAmount,
      timer: setTimeout(() => {
        sendQuoteEmail(bookingId, quoteAmount);
      }, 0)
    });
    
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
    
    document.getElementById('undoQuoteBtn').addEventListener('click', () => {
      if (quoteSending.timer) {
        clearTimeout(quoteSending.timer);
      }
      
      setQuoteSending({
        inProgress: false,
        bookingId: null,
        timer: null,
        quoteAmount: null
      });
      
      document.body.removeChild(notification);
      
      const undoMessage = document.createElement('div');
      undoMessage.innerHTML = '<div class="fixed top-0 right-0 m-4 p-4 bg-green-500 text-white rounded shadow-lg transition-opacity duration-500">Quote cancelled!</div>';
      document.body.appendChild(undoMessage);
      
      setTimeout(() => {
        undoMessage.querySelector('div').style.opacity = '0';
        setTimeout(() => document.body.removeChild(undoMessage), 500);
      }, 3000);
    });
    
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 10000);
  };

  // Send quote email
  const sendQuoteEmail = async (bookingId, quoteAmount) => {
    try {
      const booking = bookings.find(b => b.id === bookingId);
      if (!booking) {
        console.error("Booking not found for sending quote");
        return;
      }
      const now = new Date();
      
      console.log(`Sending quote of £${quoteAmount} to ${booking.customerName} (${booking.customerEmail})`);
      const formattedQuoteDate = `${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;

      const loadingMessage = document.createElement('div');
      loadingMessage.innerHTML = `<div class="fixed top-0 right-0 m-4 p-4 bg-blue-500 text-white rounded shadow-lg">Processing quote...</div>`;
      document.body.appendChild(loadingMessage);
      
      try {
        const zapierData = {
          customerName: booking.customerName,
          customerEmail: booking.customerEmail,
          customerPhone: booking.customerPhone,
          bookingDate: booking.displayDate,
          bookingTime: booking.displayTimeRange || booking.time,
          orderId: booking.id,
          serviceType: booking.service || "Cleaning Service",
          quoteAmount: quoteAmount,
          quoteAmountInPence: Math.round(quoteAmount * 100),
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
        
        await fetch('https://hooks.zapier.com/hooks/catch/22652608/2p0nwcm/', {
          method: 'POST',
          mode: "no-cors",
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(zapierData)
        });
        
        console.log('Quote request sent to Zapier');
        
        try {
          const dateRef = doc(db, "unavailability", booking.date);
          const dateDoc = await getDoc(dateRef);
          
          if (dateDoc.exists()) {
            const dateData = dateDoc.data();
            const updatedBookedSlots = { ...dateData.bookedTimeSlots };
            
            Object.keys(updatedBookedSlots).forEach(timeSlot => {
              const slotData = updatedBookedSlots[timeSlot];
              if (slotData.bookingId === booking.id) {
                updatedBookedSlots[timeSlot] = {
                  ...slotData,
                  quoteSent: true,
                  quoteAmount: quoteAmount,
                  quoteSentDate: new Date().toISOString(),
                  quoteStatus: 'sent'
                };
              }
            });
            
            await setDoc(dateRef, {
              ...dateData,
              bookedTimeSlots: updatedBookedSlots
            });
            
            console.log('Quote information saved to Firebase');
            
            setTimeSlotData(prev => ({
              ...prev,
              [booking.date]: updatedBookedSlots
            }));
            
            await fetchBookings();
          }
        } catch (firebaseError) {
          console.error("Error updating Firebase with quote info:", firebaseError);
        }
        
        document.body.removeChild(loadingMessage);
        
        const successMessage = document.createElement('div');
        successMessage.innerHTML = `<div class="fixed top-0 right-0 m-4 p-4 bg-green-500 text-white rounded shadow-lg transition-opacity duration-500">
          Quote of £${quoteAmount} sent successfully! A payment link has been sent to the customer's email.
        </div>`;
        document.body.appendChild(successMessage);
        
        setTimeout(() => {
          successMessage.querySelector('div').style.opacity = '0';
          setTimeout(() => document.body.removeChild(successMessage), 500);
        }, 3000);
        
      } catch (zapError) {
        console.error("Error with Zapier automation:", zapError);
        
        const errorMessage = document.createElement('div');
        errorMessage.innerHTML = `<div class="fixed top-0 right-0 m-4 p-4 bg-red-500 text-white rounded shadow-lg transition-opacity duration-500">
          Error sending quote: ${zapError.message}. Please try again or contact support.
        </div>`;
        document.body.appendChild(errorMessage);
        
        setTimeout(() => {
          errorMessage.querySelector('div').style.opacity = '0';
          setTimeout(() => document.body.removeChild(errorMessage), 500);
        }, 5000);
      }
      
      setQuoteSending({
        inProgress: false,
        bookingId: null,
        timer: null,
        quoteAmount: null
      });
      
    } catch (error) {
      console.error("Error sending quote:", error);
      
      const errorMessage = document.createElement('div');
      errorMessage.innerHTML = `<div class="fixed top-0 right-0 m-4 p-4 bg-red-500 text-white rounded shadow-lg transition-opacity duration-500">Error sending quote: ${error.message}</div>`;
      document.body.appendChild(errorMessage);
      
      setTimeout(() => {
        errorMessage.querySelector('div').style.opacity = '0';
        setTimeout(() => document.body.removeChild(errorMessage), 500);
      }, 5000);
      
      setQuoteSending({
        inProgress: false,
        bookingId: null,
        timer: null,
        quoteAmount: null
      });
    }
  };

  // Show cancel booking confirmation
  const showCancelBookingConfirm = (bookingId) => {
    const bookingToCancel = bookings.find(b => b.id === bookingId);
    if (!bookingToCancel) return;
    
    setConfirmModal({
      isOpen: true,
      bookingId: bookingId,
      title: 'Cancel Booking',
      message: `Are you sure you want to cancel the booking for ${bookingToCancel.customerName} on ${bookingToCancel.displayDate}?`
    });
  };

  // Notify cancellation
  const notifyCancellation = async (booking, cancellationReason = "") => {
    const now = new Date();
    const formattedCancellationDate = `${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;

    try {
      const cancellationData = {
        orderId: booking.id || booking.orderId,
        customerName: booking.customerName || booking.name,
        customerEmail: booking.customerEmail || booking.email,
        bookingDate: booking.displayDate || booking.date,
        bookingTime: booking.displayTimeRange || booking.time,
        cancellationReason: cancellationReason || "No reason provided",
        cancellationDate: formattedCancellationDate,
        status: "CANCELLED",
        service: booking.service || "Cleaning Service",
        totalPrice: booking.totalPrice || "0.00",
        actionType: "booking_cancellation",
        source: "admin_dashboard"
      };
      
      console.log('Sending cancellation data to Zapier:', cancellationData);
      
      const response = await fetch('https://hooks.zapier.com/hooks/catch/22652608/2pje2gt/', {
        method: 'POST',
        mode: "no-cors",
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cancellationData)
      });
      
      console.log('Zapier cancellation webhook triggered');
      return true;
    } catch (error) {
      console.error('Error sending cancellation to Zapier:', error);
      return false;
    }
  };

  // Cancel booking
// Replace the existing cancelBooking function in App.js with this updated version

const cancelBooking = async (bookingId, cancellationReason = "") => {
  console.log("cancelBooking called with bookingId:", bookingId);
  
  try {
    const bookingToCancel = bookings.find(b => b.id === bookingId);
    if (!bookingToCancel) {
      console.error("Booking not found");
      return;
    }
    
    console.log("Cancelling booking:", bookingToCancel);
    
    // Send cancellation notification to Zapier first
    await notifyCancellation(bookingToCancel, cancellationReason);
    
    const dateRef = doc(db, "unavailability", bookingToCancel.date);
    const dateDoc = await getDoc(dateRef);
    
    if (!dateDoc.exists()) {
      console.error("Date document not found");
      return;
    }
    
    const dateData = dateDoc.data();
    let updatedDocData = {...dateData};
    
    console.log("Original document data:", dateData);
    
    // NEW LOGIC: Handle the compound key structure
    if (updatedDocData.bookedTimeSlots) {
      const updatedSlots = {...updatedDocData.bookedTimeSlots};
      
      // Find all time slot keys that belong to this booking
      const keysToDelete = [];
      Object.keys(updatedSlots).forEach(key => {
        const slot = updatedSlots[key];
        // Check if this slot belongs to the booking we want to cancel
        if (slot.bookingId === bookingId || slot.orderId === bookingId) {
          keysToDelete.push(key);
        }
      });
      
      console.log("Keys to delete:", keysToDelete);
      
      // Remove all time slots for this booking
      keysToDelete.forEach(key => {
        delete updatedSlots[key];
      });
      
      updatedDocData.bookedTimeSlots = updatedSlots;
      
      // Check if there are any remaining bookings
      const remainingBookings = Object.keys(updatedSlots).length;
      console.log("Remaining bookings after cancellation:", remainingBookings);
      
      if (remainingBookings === 0) {
        // No bookings left, remove fullyBooked flag and clean up
        delete updatedDocData.fullyBooked;
        
        // If no other data exists, we can delete the entire document
        if (Object.keys(updatedDocData).length === 1 && updatedDocData.bookedTimeSlots) {
          // Only bookedTimeSlots exists and it's empty, delete the document
          await deleteDoc(dateRef);
          console.log("Deleted entire date document as no bookings remain");
        } else {
          // Update with empty bookedTimeSlots
          await setDoc(dateRef, updatedDocData);
          console.log("Updated document with empty booking slots");
        }
      } else {
        // Check if remaining bookings still make the date fully booked
        const hasEnoughConsecutiveHours = checkConsecutiveAvailableHours(updatedSlots);
        updatedDocData.fullyBooked = !hasEnoughConsecutiveHours;
        
        await setDoc(dateRef, updatedDocData);
        console.log("Updated document with remaining bookings");
      }
    } else {
      // FALLBACK: Handle legacy data structure (direct time properties)
      console.log("Handling legacy data structure");
      
      // Look for direct time properties like "7:00", "8:00", etc.
      const timeKeysToDelete = [];
      
      if (bookingToCancel.timeSlots && bookingToCancel.timeSlots.length > 0) {
        // Grouped booking with timeSlots array
        bookingToCancel.timeSlots.forEach(hour => {
          const timeKey = `${hour}:00`;
          if (updatedDocData[timeKey]) {
            timeKeysToDelete.push(timeKey);
          }
        });
      } else if (bookingToCancel.time || bookingToCancel.startTime) {
        // Single booking with time property
        const timeKey = bookingToCancel.time || bookingToCancel.startTime;
        if (updatedDocData[timeKey]) {
          timeKeysToDelete.push(timeKey);
        }
      }
      
      console.log("Legacy time keys to delete:", timeKeysToDelete);
      
      // Remove the legacy time properties
      timeKeysToDelete.forEach(timeKey => {
        delete updatedDocData[timeKey];
      });
      
      // Check if any time-related properties remain
      const remainingTimeProps = Object.keys(updatedDocData).filter(key => 
        key.includes(':00') || key === 'fullyBooked'
      );
      
      if (remainingTimeProps.length <= 1) { // Only fullyBooked might remain
        delete updatedDocData.fullyBooked;
      }
      
      await setDoc(dateRef, updatedDocData);
    }
    
    // Refresh the unavailability data
    await fetchUnavailability();
    
    // Refresh bookings list
    await fetchBookings();
    
    // Close booking details if it's the cancelled booking
    if (selectedBooking && selectedBooking.id === bookingId) {
      closeBookingDetails();
    }
    
    // Show success message
    const successMessage = document.createElement('div');
    successMessage.innerHTML = '<div class="fixed top-0 right-0 m-4 p-4 bg-green-500 text-white rounded shadow-lg transition-opacity duration-500">Booking cancelled successfully!</div>';
    document.body.appendChild(successMessage);
    
    setTimeout(() => {
      successMessage.querySelector('div').style.opacity = '0';
      setTimeout(() => document.body.removeChild(successMessage), 500);
    }, 3000);
    
  } catch (error) {
    console.error("Error cancelling booking:", error);
    
    const errorMessage = document.createElement('div');
    errorMessage.innerHTML = `<div class="fixed top-0 right-0 m-4 p-4 bg-red-500 text-white rounded shadow-lg transition-opacity duration-500">Error: ${error.message}</div>`;
    document.body.appendChild(errorMessage);
    
    setTimeout(() => {
      errorMessage.querySelector('div').style.opacity = '0';
      setTimeout(() => document.body.removeChild(errorMessage), 500);
    }, 5000);
  }
};

// Update fetchUnavailability function
const fetchUnavailability = async () => {
  try {
    console.log("Starting fetchUnavailability...");
    
    // First, check availability settings
    const settingsDoc = await getDoc(doc(db, "settings", "availability"));
    const settings = settingsDoc.exists() ? settingsDoc.data() : { 
      useStaffAvailability: false,
      allDatesAvailable: false
    };
    
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

  // Check consecutive available hours
  const checkConsecutiveAvailableHours = (bookedTimeSlots, requiredConsecutiveHours = 2) => {
    const allTimeSlots = [];
    for (let hour = 7; hour <= 20; hour++) {
      allTimeSlots.push(`${hour}:00`);
    }
    
    const availabilityMap = allTimeSlots.map(slot => !bookedTimeSlots[slot]);
    
    console.log("Checking consecutive hours for bookedTimeSlots:", bookedTimeSlots);
    console.log("Availability map:", availabilityMap.map((available, i) => 
      `${allTimeSlots[i]}: ${available ? 'available' : 'booked'}`
    ));
    
    let consecutiveCount = 0;
    for (let i = 0; i < availabilityMap.length; i++) {
      if (availabilityMap[i]) {
        consecutiveCount++;
        console.log(`Found available slot at ${allTimeSlots[i]}, consecutive count: ${consecutiveCount}`);
        if (consecutiveCount >= requiredConsecutiveHours) {
          console.log(`Found ${requiredConsecutiveHours} consecutive available hours`);
          return true;
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

  // Tile class name for calendar
  const tileClassName = ({ date, view }) => {
    if (view !== "month") return null;
    const dateStr = formatDateLocal(date);
    
    if (isPastDate(date)) {
      return activeTab === "availability" ? "past-date" : "unavailable";
    }
    
    if (activeTab === "availability") {
      if (unavailableDates.has(dateStr)) {
        return "unavailable-date";
      } else {
        return "available-date";
      }
    } else {
      if (unavailableDates.has(dateStr)) {
        return "unavailable";
      } else if (date === dateStr) {
        return "selected";
      } else {
        return "available";
      }
    }
  };

  // Staff management functions
  const fetchStaff = async () => {
    try {
      setStaffLoading(true);
      const snapshot = await getDocs(collection(db, "staff"));
      const staffList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setStaff(staffList);
      setStaffLoading(false);
    } catch (error) {
      console.error("Error fetching staff:", error);
      setStaff([]);
      setStaffLoading(false);
    }
  };

  const saveStaff = async (e) => {
    e.preventDefault();
    try {
      if (editingStaff) {
        await setDoc(doc(db, "staff", editingStaff.id), {
          ...staffForm,
          updatedAt: new Date().toISOString()
        });
      } else {
        await setDoc(doc(db, "staff", Date.now().toString()), {
          ...staffForm,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      
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
      
      await fetchStaff();
      
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

  // Availability settings functions
  const fetchAvailabilitySettings = async () => {
    try {
      setAvailabilityLoading(true);
      const docRef = doc(db, "settings", "availability");
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        setAvailabilitySettings(docSnap.data());
      }
    } catch (error) {
      console.error("Error fetching availability settings:", error);
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const saveAvailabilitySettings = async () => {
    try {
      await setDoc(doc(db, "settings", "availability"), {
        ...availabilitySettings,
        updatedAt: new Date().toISOString()
      });
      
      const successMessage = document.createElement('div');
      successMessage.innerHTML = `<div class="fixed top-0 right-0 m-4 p-4 bg-green-500 text-white rounded shadow-lg transition-opacity duration-500">
        Availability settings saved successfully!
      </div>`;
      document.body.appendChild(successMessage);
      
      setTimeout(() => {
        successMessage.querySelector('div').style.opacity = '0';
        setTimeout(() => document.body.removeChild(successMessage), 500);
      }, 3000);
    } catch (error) {
      console.error("Error saving availability settings:", error);
      alert("Error saving settings. Please try again.");
    }
  };

  const handleSettingsChange = (field, value) => {
    setAvailabilitySettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Tab Buttons */}
      <div className="max-w-6xl mx-auto mb-6">
  <div className="tab-buttons-container flex gap-4 lg:flex-row">
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
      onClick={() => setActiveTab("availability")}
      className={`px-6 py-2 rounded ${activeTab === "availability" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"}`}
    >
      Availability
    </button>
    <button 
      onClick={() => window.location.href = '/booking/home'}
      className="px-6 py-2 rounded bg-gray-200 text-gray-700"
    >
      Home Clean
    </button>
    <button 
      onClick={() => window.location.href = '/booking/office'}
      className="px-6 py-2 rounded bg-gray-200 text-gray-700"
    >
      Office Clean
    </button>
  </div>
</div>

<hr className="my-6 border-gray-300" />
      
      {activeTab === "bookings" ? (
        // Bookings Management View
        <div className="container max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">Bookings Management</h1>
          
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
                            {booking.quoteSent ? (
                              <button 
                                disabled
                                className="text-gray-400 bg-gray-100 cursor-not-allowed mr-4 px-3 py-1 rounded"
                              >
                                Quote Sent (£{booking.quoteAmount})
                              </button>
                            ) : quoteSending.inProgress && quoteSending.bookingId === booking.id ? (
                              <button 
                                onClick={() => {
                                  if (quoteSending.timer) {
                                    clearTimeout(quoteSending.timer);
                                  }
                                  
                                  setQuoteSending({
                                    inProgress: false,
                                    bookingId: null,
                                    timer: null,
                                    quoteAmount: null
                                  });
                                  
                                  const cancelMessage = document.createElement('div');
                                  cancelMessage.innerHTML = '<div class="fixed top-0 right-0 m-4 p-4 bg-green-500 text-white rounded shadow-lg transition-opacity duration-500">Quote cancelled!</div>';
                                  document.body.appendChild(cancelMessage);
                                  
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
                           <GenerateChecklistButton 
  booking={booking} 
  onOpenModal={openChecklistModal}
/>
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
            onClick={closeBookingDetails}
            className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700 transition duration-200"
          >
            Close
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
      ) : activeTab === "staff" ? (
        // Staff Management View
        <div className="container max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">Staff Management</h1>
          
          <div className="mb-6">
            <button
              onClick={() => setShowAddStaffModal(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition duration-200"
            >
              Add Staff Member
            </button>
          </div>
          
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
                <table className="min-w-full divide-y divide-gray-200 staff-table">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Availability</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className=" divide-y divide-gray-200">
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
                          <div>
                          <button 
                            onClick={() => editStaff(staffMember)}
                            className="text-white mr-4"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => deleteStaff(staffMember.id)}
                            className="deleteBtn text-white hover:text-red-900"
                          >
                            Delete
                          </button>
                          </div>
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
                      className="text-white"
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
      ) : activeTab === "availability" ? (
        // Availability Management View
        <div className="container max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">Availability Settings</h1>
          
          {/* Settings Section */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            {availabilityLoading ? (
              <div className="text-center">
                <div className="spinner inline-block mr-2"></div>
                <span>Loading settings...</span>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Availability Mode */}
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold mb-4">Availability Mode</h3>
                  <div className="space-y-3">
                    <label className="flex items-center space-x-3">
                      <input
                        type="radio"
                        checked={availabilitySettings.allDatesAvailable}
                        onChange={() => {
                          handleSettingsChange('allDatesAvailable', true);
                          handleSettingsChange('useStaffAvailability', false);
                        }}
                        className="form-radio h-5 w-5 text-blue-600"
                      />
                      <span>All dates and times are available (ignore staff schedules)</span>
                    </label>
                    
                    <label className="flex items-center space-x-3">
                      <input
                        type="radio"
                        checked={availabilitySettings.useStaffAvailability}
                        onChange={() => {
                          handleSettingsChange('useStaffAvailability', true);
                          handleSettingsChange('allDatesAvailable', false);
                        }}
                        className="form-radio h-5 w-5 text-blue-600"
                      />
                      <span>Link availability to staff schedules</span>
                    </label>
                  </div>
                </div>
                
                {/* Booking Notice Period */}
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold mb-4">Minimum Notice Period</h3>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2">
                      <span>Require at least</span>
                      <input
                        type="number"
                        min="0"
                        max="72"
                        value={availabilitySettings.minimumNoticeHours}
                        onChange={(e) => handleSettingsChange('minimumNoticeHours', parseInt(e.target.value) || 0)}
                        className="w-20 px-3 py-2 border rounded"
                      />
                      <span>hours notice before booking</span>
                    </label>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    {availabilitySettings.minimumNoticeHours > 0 
                      ? `Customers must book at least ${availabilitySettings.minimumNoticeHours} hours in advance`
                      : 'Customers can book immediately'}
                  </p>
                </div>
                
                {/* Buffer Time Between Bookings */}
<div className="border-b pb-4">
  <h3 className="text-lg font-semibold mb-4">Buffer Time Between Bookings</h3>
  <div className="flex items-center space-x-4">
    <label className="flex items-center space-x-2">
      <span>Require</span>
      <input
        type="number"
        min="0"
        max="4"
        step="0.5"
        value={availabilitySettings.bufferTimeBetweenBookings}
        onChange={(e) => handleSettingsChange('bufferTimeBetweenBookings', parseFloat(e.target.value) || 0)}
        className="w-20 px-3 py-2 border rounded"
      />
      <span>hours between bookings (when no extra staff available)</span>
    </label>
  </div>
  <p className="text-sm text-gray-500 mt-2">
    {availabilitySettings.bufferTimeBetweenBookings > 0 
      ? `${availabilitySettings.bufferTimeBetweenBookings} hour(s) will be blocked after each booking when all staff are assigned`
      : 'No buffer time between bookings'}
  </p>
</div>
                

{/* Cleaner Assignment Logic - New Section */}
<div className="border-b pb-4 mt-6">
  <h3 className="text-lg font-semibold mb-4">Cleaner Assignment Logic</h3>
  <div className="flex items-center space-x-4 mb-2">
    <label className="flex items-center space-x-2">
      <span>Assign 2 cleaners if booking exceeds</span>
      <input
        type="number"
        min="0"
        max="12"
        step="0.5"
        value={availabilitySettings.assignTwoCleanersAfterHours}
        onChange={(e) => handleSettingsChange('assignTwoCleanersAfterHours', parseFloat(e.target.value) || 0)}
        className="w-20 px-3 py-2 border rounded"
      />
      <span>hours</span>
    </label>
  </div>
  <p className="text-sm text-gray-500 mt-2">
    {availabilitySettings.assignTwoCleanersAfterHours > 0 
      ? `Bookings longer than ${availabilitySettings.assignTwoCleanersAfterHours} hours will be assigned 2 cleaners, reducing time by 43% (÷1.75)`
      : 'All bookings will be assigned 1 cleaner regardless of duration'}
  </p>
</div>

             
                
                {/* Save Button */}
                <div className="flex justify-end pt-4">
                  <button
                    onClick={saveAvailabilitySettings}
                    className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition duration-200"
                  >
                    Save Settings
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Quick Actions */}
          {/* <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setAvailabilitySettings({
                    useStaffAvailability: false,
                    allDatesAvailable: true,
                    minimumNoticeHours: 0,
                    allowOverlapping: false,
                    cleanersPerBooking: 2,
                    bufferTimeBetweenBookings: 0,
                    maxConcurrentBookings: 1
                  });
                }}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition duration-200"
              >
                Reset to Default (All Available)
              </button>
              
              <button
                onClick={() => {
                  setAvailabilitySettings({
                    useStaffAvailability: true,
                    allDatesAvailable: false,
                    minimumNoticeHours: 2,
                    allowOverlapping: true,
                    cleanersPerBooking: 2,
                    bufferTimeBetweenBookings: 1,
                    maxConcurrentBookings: 2
                  });
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition duration-200"
              >
                Smart Mode (Staff-Based)
              </button>
            </div>
          </div> */}
          
          {/* Manual Date Management Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">Manual Date Management</h2>
            <p className="text-gray-600 mb-4">Click on dates to manually block or unblock them</p>
            
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
        </div>
      ) : null }

{/* Send Checklist Modal */}
{showChecklistModal && selectedBookingForChecklist && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity duration-300">
    <div 
      className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 overflow-hidden transform transition-transform duration-300 ease-in-out"
      style={{ 
        animation: 'modal-appear 0.3s ease-out forwards'
      }}
    >
      <div className="border-b border-gray-200 px-6 py-4">
        <h3 className="text-lg font-medium text-gray-900">Send Checklist to Staff</h3>
      </div>
      
      <div className="px-6 py-4">
        {/* Booking Info */}
        <div className="mb-4 p-3 bg-gray-50 rounded">
          <p className="text-sm text-gray-600 font-medium">Booking Details:</p>
          <p className="text-sm text-gray-600">{selectedBookingForChecklist.name || selectedBookingForChecklist.customerName}</p>
          <p className="text-sm text-gray-600">{selectedBookingForChecklist.date || selectedBookingForChecklist.displayDate} at {selectedBookingForChecklist.time || selectedBookingForChecklist.displayTimeRange}</p>
          <p className="text-sm text-gray-600">{selectedBookingForChecklist.service}</p>
        </div>

        {/* Staff Dropdown */}
        <div className="mb-4">
          <label htmlFor="staffSelect" className="block text-sm font-medium text-gray-700 mb-1">
            Select Staff Member:
          </label>
          <select
            id="staffSelect"
            value={selectedStaffForChecklist}
            onChange={(e) => setSelectedStaffForChecklist(e.target.value)}
            className="block w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="">Choose a staff member...</option>
            {staff.filter(staffMember => staffMember.active).map((staffMember) => (
              <option key={staffMember.id} value={staffMember.id}>
                {staffMember.name} - {staffMember.phone}
              </option>
            ))}
          </select>
          <div className="mt-1 text-xs text-gray-500">
            {staff.length === 0 ? (
              <span className="text-red-600">No staff members found. Please add staff first.</span>
            ) : (
              <span>Showing {staff.filter(s => s.active).length} active staff members</span>
            )}
          </div>
        </div>
        
        <p className="text-sm text-gray-500 italic">
          The cleaning checklist PDF will be sent to the selected staff member via WhatsApp and email.
        </p>
      </div>
      
      <div className="bg-gray-50 px-6 py-3 flex justify-end space-x-3">
        <button
          type="button"
          onClick={() => {
            setShowChecklistModal(false);
            setSelectedBookingForChecklist(null);
            setSelectedStaffForChecklist("");
          }}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50"
          disabled={sendingChecklist}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={sendChecklistToStaff}
          disabled={!selectedStaffForChecklist || sendingChecklist}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 flex items-center"
        >
          {sendingChecklist ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sending...
            </>
          ) : 'Send Checklist'}
        </button>
      </div>
    </div>
    
    <style jsx="true">{`
      @keyframes modal-appear {
        from {
          opacity: 0;
          transform: scale(0.95) translateY(-20px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }
    `}</style>
  </div>
)}


      
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