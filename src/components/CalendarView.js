import React, { useState, useEffect } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import "./CalendarEdit.css"; // Reuse the same styling

const CalendarView = () => {
  // State for calendar data
  const [unavailableDates, setUnavailableDates] = useState(new Set());
  const [timeSlotData, setTimeSlotData] = useState({});
  const [loading, setLoading] = useState(true);
  
  // State for selected date and UI
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  
  // Month names for formatting
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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

  // Fetch unavailability data
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
        
        // Check for explicitly fully booked dates
        if (data.fullyBooked === true) {
          unavailableDatesSet.add(dateStr);
        } else if (data.unavailable === true) {
          // Legacy format support
          unavailableDatesSet.add(dateStr);
        } else {
          // Process individual time slots
          const bookedTimeSlots = {};
          
          // Check if we have time slots as direct properties (7:00, 8:00, etc.)
          for (let hour = 7; hour <= 20; hour++) {
            const timeKey = `${hour}:00`;
            if (data[timeKey]) {
              bookedTimeSlots[timeKey] = data[timeKey];
            }
          }
          
          // If no direct time slots found, check for bookedTimeSlots object
          if (Object.keys(bookedTimeSlots).length === 0 && data.bookedTimeSlots) {
            Object.assign(bookedTimeSlots, data.bookedTimeSlots);
          }
          
          // Store the time slots for this date
          timeSlotDataObj[dateStr] = bookedTimeSlots;
          
          // Check if there are enough consecutive available hours
          if (Object.keys(bookedTimeSlots).length > 0) {
            const hasEnoughConsecutiveHours = checkConsecutiveAvailableHours(bookedTimeSlots);
            if (!hasEnoughConsecutiveHours) {
              unavailableDatesSet.add(dateStr);
            }
          }
        }
      });
      
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
    
    // Check for consecutive available slots
    let consecutiveCount = 0;
    for (let i = 0; i < availabilityMap.length; i++) {
      if (availabilityMap[i]) {
        consecutiveCount++;
        if (consecutiveCount >= requiredConsecutiveHours) {
          return true; // Found enough consecutive slots
        }
      } else {
        consecutiveCount = 0;
      }
    }
    
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
    return `${day} ${monthNames[parseInt(month) - 1]} ${year}`;
  };

  // Handle date selection
  const handleDateSelect = (date) => {
    const dateStr = formatDateLocal(date);
    
    // Don't select unavailable dates
    if (unavailableDates.has(dateStr)) return;
    
    setSelectedDate(dateStr);
  };

  // Set tile class for calendar
  const tileClassName = ({ date, view }) => {
    if (view !== "month") return null;
    const dateStr = formatDateLocal(date);
    
    // Check if this is a past date
    if (isPastDate(date)) {
      return "past-date";
    }
    
    if (unavailableDates.has(dateStr)) {
      return "unavailable-date";
    } else if (selectedDate === dateStr) {
      return "selected-date";
    } else {
      return "available-date";
    }
  };

  // Generate time slots for UI
  const generateTimeSlots = () => {
    if (!selectedDate) return [];
    
    const slots = [];
    const bookedSlots = timeSlotData[selectedDate] || {};
    
    for (let hour = 7; hour <= 20; hour++) {
      const timeSlot = `${hour}:00`;
      const displayHour = hour > 12 ? hour - 12 : hour;
      const amPm = hour >= 12 ? 'PM' : 'AM';
      
      const isBooked = !!bookedSlots[timeSlot];
      
      slots.push({
        display: `${displayHour} ${amPm}`,
        value: timeSlot,
        available: !isBooked
      });
    }
    return slots;
  };

  return (
    <div className="admin-calendar min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Available Dates</h1>
        
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
          
          {/* Time Slots Container */}
          <div className="time-slots-container flex-grow w-full md:w-6/12">
            {selectedDate ? (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold mb-4">{formatDisplayDate(selectedDate)}</h2>
                
                <h3 className="text-lg font-semibold mb-3">Available Time Slots</h3>
                <div className="time-slots-grid grid grid-cols-3 gap-2 mb-6">
                  {generateTimeSlots().map((slot, index) => (
                    <div 
                      key={index}
                      className={`time-slot p-3 text-center border rounded-md 
                        ${!slot.available ? 'bg-red-100 text-red-800 border-red-300' : 'bg-green-100 text-green-800 border-green-300'}`}
                    >
                      {slot.display}
                      <span className="block text-xs">
                        {slot.available ? "Available" : "Booked"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-6">
                <p className="text-gray-600">Please select an available date from the calendar to view time slots.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarView;