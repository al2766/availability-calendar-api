// src/components/CleaningChecklist.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Component that will be converted to PDF
const ChecklistTemplate = ({ booking }) => {
  // Check what type of booking we're dealing with
  const isHomeService = 
    booking.service === "Home Cleaning" || 
    (booking.bedrooms !== undefined && booking.livingRooms !== undefined);
  console.log(booking);
  // Extract booking details - handle both direct properties and nested ones
  const customerName = booking.customerName || "No name provided";
  const customerEmail = booking.customerEmail || booking.email || "No email provided";
  const customerPhone = booking.customerPhone || booking.phone || "No phone provided";
  const bookingDate = booking.displayDate || booking.date || "No date provided";
  const bookingTime = booking.displayTimeRange || booking.time || "No time provided";
  const serviceType = booking.service || (isHomeService ? "Home Cleaning" : "Office Cleaning");
  const additionalInfo = booking.additionalInfo || "None provided";
  
  // For address - this might not be available in current data structure
  const address = booking.address || "Address not provided";
  
  // Home cleaning specific fields
  const bedrooms = booking.bedrooms || "N/A";
  const livingRooms = booking.livingRooms || "N/A";
  const bathrooms = booking.bathrooms || "0";
  const kitchens = booking.kitchens || "0";
  
  // Office cleaning specific fields
  const officeRooms = booking.officeRooms || "N/A";
  const officeSize = booking.officeSize || "N/A";
  const meetingRooms = booking.meetingRooms || "N/A";
  const meetingRoomSize = booking.meetingRoomSize || "N/A";
  const cleanliness = booking.cleanliness || "N/A";
  

  // Add-ons and additional areas/rooms
  const addOns = booking.addOns || "None";
  const additionalAreas = booking.additionalAreas || booking.additionalRooms || "None";

  // For debugging - log the booking object to console
  console.log("Cleaning Checklist - Booking data:", booking);
  console.log("Service type detected:", serviceType, "isHomeService:", isHomeService);

  return (
    <div id="pdf-container" style={{ width: '794px', padding: '40px', fontFamily: 'Arial, sans-serif', color: '#333' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #3b82f6', paddingBottom: '10px' }}>
        <h1 style={{ fontSize: '24px', color: '#3b82f6' }}>LUXEN CLEANING - JOB CHECKLIST</h1>
        <div style={{ fontSize: '14px' }}>
          <p><strong>Date:</strong> {bookingDate} | <strong>Time:</strong> {bookingTime}</p>
          <p><strong>Service Type:</strong> {serviceType}</p>
        </div>
      </div>

      {/* Customer Details */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', backgroundColor: '#f3f4f6', padding: '5px' }}>CUSTOMER DETAILS</h2>
        <p><strong>Name:</strong> {customerName}</p>
        <p><strong>Email:</strong> {customerEmail}</p>
        <p><strong>Phone:</strong> {customerPhone}</p>
        <p><strong>Address:</strong> {address}</p>
      </div>

      {/* Property Details */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', backgroundColor: '#f3f4f6', padding: '5px' }}>PROPERTY DETAILS</h2>
        {isHomeService ? (
          <div>
            <p><strong>Bedrooms:</strong> {bedrooms}</p>
            <p><strong>Living Rooms:</strong> {livingRooms}</p>
            <p><strong>Bathrooms:</strong> {bathrooms}</p>
            <p><strong>Kitchens:</strong> {kitchens}</p>
            <p><strong>Cleanliness:</strong> {cleanliness}</p>
            <p><strong>Additional Rooms:</strong> {additionalAreas}</p>
          </div>
        ) : (
          <div>
            <p><strong>Office Rooms:</strong> {officeRooms}</p>
            <p><strong>Office Size:</strong> {officeSize}</p>
            <p><strong>Meeting Rooms:</strong> {meetingRooms}</p>
            <p><strong>Meeting Size:</strong> {meetingRoomSize}</p>
            <p><strong>Bathrooms:</strong> {bathrooms}</p>
            <p><strong>Kitchens:</strong> {kitchens}</p>
            <p><strong>Cleanliness:</strong> {cleanliness}</p>
            <p><strong>Additional Areas:</strong> {additionalAreas}</p>
          </div>
        )}
        <p><strong>Add-ons:</strong> {addOns}</p>
        {additionalInfo && <p><strong>Additional Info:</strong> {additionalInfo}</p>}
      </div>

      {/* Cleaning Checklist */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', backgroundColor: '#f3f4f6', padding: '5px' }}>CLEANING CHECKLIST</h2>
        
        {/* General Tasks */}
        <h3 style={{ fontSize: '16px', marginTop: '10px' }}>General Tasks:</h3>
        <div style={{ marginLeft: '20px' }}>
          <p>☐ Arrival confirmation (take photo and text to manager)</p>
          <p>☐ Wear appropriate uniform/PPE</p>
          <p>☐ Check all cleaning supplies are available</p>
          <p>☐ Test any equipment before starting</p>
        </div>

        {/* Before Photos */}
        <h3 style={{ fontSize: '16px', marginTop: '15px' }}>Before Photos:</h3>
        <div style={{ marginLeft: '20px' }}>
          <p>☐ Take photos of each room before cleaning</p>
          <p>☐ Document any pre-existing damage</p>
          <p>☐ Document any unusually dirty areas</p>
        </div>

        {/* Service-Specific Tasks */}
        <h3 style={{ fontSize: '16px', marginTop: '15px' }}>{isHomeService ? 'Home Cleaning Tasks:' : 'Office Cleaning Tasks:'}</h3>
        <div style={{ marginLeft: '20px' }}>
          {isHomeService ? (
            <>
              <p>☐ Dust all surfaces</p>
              <p>☐ Vacuum all floors and furniture</p>
              <p>☐ Mop hard floors</p>
              <p>☐ Clean bathrooms (toilet, shower, sink, mirrors)</p>
              <p>☐ Clean kitchen (counters, sink, appliance exteriors)</p>
              <p>☐ Empty trash bins</p>
              <p>☐ Make beds (if requested)</p>
              <p>☐ Clean windows (interior only)</p>
            </>
          ) : (
            <>
              <p>☐ Clean and dust all desks and workstations</p>
              <p>☐ Clean meeting room tables and chairs</p>
              <p>☐ Clean and sanitize bathrooms</p>
              <p>☐ Clean kitchen/break areas</p>
              <p>☐ Empty all trash bins</p>
              <p>☐ Vacuum carpets</p>
              <p>☐ Mop hard floors</p>
              <p>☐ Clean entrance and reception</p>
            </>
          )}
        </div>

        {/* Add-on Tasks */}
        {addOns && addOns !== "None" && (
          <>
            <h3 style={{ fontSize: '16px', marginTop: '15px' }}>Add-on Tasks:</h3>
            <div style={{ marginLeft: '20px' }}>
              {addOns.includes('carpet-cleaning') && <p>☐ Deep clean carpets</p>}
              {addOns.includes('oven') && <p>☐ Clean oven interior and racks</p>}
              {addOns.includes('fridge') && <p>☐ Clean refrigerator interior</p>}
              {addOns.includes('freezer') && <p>☐ Clean freezer interior</p>}
              {addOns.includes('fridge-freezer') && <p>☐ Clean fridge and freezer interior</p>}
              {addOns.includes('ironing') && <p>☐ Iron clothes as requested</p>}
              {addOns.includes('kitchen-cupboard') && <p>☐ Clean kitchen cupboards (inside)</p>}
              {addOns.includes('blind-cleaning') && <p>☐ Clean blinds</p>}
              {addOns.includes('curtain') && <p>☐ Clean curtains</p>}
              {addOns.includes('window-cleaning') && <p>☐ Clean windows</p>}
              {addOns.includes('microwave') && <p>☐ Clean microwave interior and exterior</p>}
            </div>
          </>
        )}

        {/* After Photos */}
        <h3 style={{ fontSize: '16px', marginTop: '15px' }}>After Photos:</h3>
        <div style={{ marginLeft: '20px' }}>
          <p>☐ Take photos of each room after cleaning</p>
          <p>☐ Take close-up photos of detailed work</p>
          <p>☐ Document any areas that couldn't be cleaned and why</p>
        </div>

        {/* Final Steps */}
        <h3 style={{ fontSize: '16px', marginTop: '15px' }}>Final Steps:</h3>
        <div style={{ marginLeft: '20px' }}>
          <p>☐ Final walkthrough of all areas</p>
          <p>☐ Return keys/secure property</p>
          <p>☐ Text manager when job complete</p>
          <p>☐ Send all photos via WhatsApp to manager</p>
        </div>
      </div>

      {/* Signature Section */}
      <div style={{ marginTop: '30px', borderTop: '1px solid #ccc', paddingTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ width: '45%' }}>
            <p><strong>Cleaner Name:</strong> ___________________________</p>
            <p style={{ marginTop: '30px' }}><strong>Signature:</strong> ___________________________</p>
          </div>
          <div style={{ width: '45%' }}>
            <p><strong>Completion Time:</strong> ___________________</p>
            <p style={{ marginTop: '30px' }}><strong>Date:</strong> ___________________</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: '40px', textAlign: 'center', fontSize: '12px', borderTop: '1px solid #ccc', paddingTop: '10px' }}>
        <p>For any questions or issues, contact: office@luxencleaning.com | 07123 456789</p>
      </div>
    </div>
  );
};

// Function to generate and download PDF
const generatePDF = (booking) => {
  // Log the booking data to console for debugging
  console.log("Generating PDF for booking:", booking);
  
  // First render the component to a hidden div
  const hiddenDiv = document.createElement('div');
  hiddenDiv.id = 'pdf-checklist-container';
  hiddenDiv.style.position = 'absolute';
  hiddenDiv.style.left = '-9999px';
  document.body.appendChild(hiddenDiv);
  
  // Render the component to the hidden div
  const root = ReactDOM.createRoot(hiddenDiv);
  root.render(<ChecklistTemplate booking={booking} />);
  
  // Wait for rendering to complete
  setTimeout(() => {
    // Generate PDF
    html2canvas(hiddenDiv, { scale: 2 }).then(canvas => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'pt', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 30;
      
      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      
      // Create a filename using the customer name or order ID
      const customerName = booking.customerName || booking.name || "unknown";
      const orderId = booking.id || booking.orderId || Date.now();
      const filename = `Cleaning_Checklist_${customerName.replace(/\s+/g, '_')}_${orderId}.pdf`;
      
      pdf.save(filename);
      
      // Clean up
      document.body.removeChild(hiddenDiv);
    });
  }, 500);
};

// Button component to generate checklist
const GenerateChecklistButton = ({ booking }) => {
  return (
    <button
      onClick={() => generatePDF(booking)}
      className="text-white-600 hover:text-white-900 mr-4"
    >
      Generate Checklist
    </button>
  );
};

export default GenerateChecklistButton;