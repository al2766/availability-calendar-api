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
  
  // Extract booking details - handle both direct properties and nested ones
  const customerName = booking.customerName || "No name provided";
  const address = booking.address || "Address not provided";
  const bookingDate = booking.displayDate || booking.date || "No date provided";
  const bookingTime = booking.displayTimeRange || booking.time || "No time provided";
  const serviceType = booking.service || (isHomeService ? "Home Cleaning" : "Office Cleaning");
  
  // For debugging - log the booking object to console
  console.log("Cleaning Checklist - Booking data:", booking);

  return (
    <div id="pdf-container" style={{ width: '794px', padding: '40px', fontFamily: 'Arial, sans-serif', color: '#333' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #3b82f6', paddingBottom: '10px' }}>
        <h1 style={{ fontSize: '24px', color: '#3b82f6' }}>LUXEN CLEANING - STAFF CHECKLIST</h1>
        <div style={{ fontSize: '14px' }}>
          <p><strong>Date:</strong> {bookingDate} | <strong>Time:</strong> {bookingTime}</p>
          <p><strong>Service Type:</strong> {serviceType}</p>
        </div>
      </div>

      {/* Customer Details - Simplified */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', backgroundColor: '#f3f4f6', padding: '5px' }}>CUSTOMER DETAILS</h2>
        <p><strong>Name:</strong> {customerName}</p>
        <p style={{ fontSize: '16px', marginTop: '10px' }}><strong>Address:</strong></p>
        <p style={{ fontSize: '16px', marginBottom: '15px', padding: '10px', backgroundColor: '#f9fafb', borderRadius: '5px' }}>{address}</p>
      </div>

      {/* Property Details - 2 items per row */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', backgroundColor: '#f3f4f6', padding: '5px' }}>PROPERTY DETAILS</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {isHomeService ? (
            <>
              <p><strong>Bedrooms:</strong> {booking.bedrooms || "N/A"}</p>
              <p><strong>Living Rooms:</strong> {booking.livingRooms || "N/A"}</p>
              <p><strong>Bathrooms:</strong> {booking.bathrooms || "0"}</p>
              <p><strong>Kitchens:</strong> {booking.kitchens || "0"}</p>
              <p><strong>Cleanliness:</strong> {booking.cleanliness || "N/A"}</p>
              <p><strong>Additional Rooms:</strong> {booking.additionalRooms || "None"}</p>
            </>
          ) : (
            <>
              <p><strong>Office Rooms:</strong> {booking.officeRooms || "N/A"}</p>
              <p><strong>Office Size:</strong> {booking.officeSize || "N/A"}</p>
              <p><strong>Meeting Rooms:</strong> {booking.meetingRooms || "N/A"}</p>
              <p><strong>Meeting Room Size:</strong> {booking.meetingRoomSize || "N/A"}</p>
              <p><strong>Bathrooms:</strong> {booking.bathrooms || "0"}</p>
              <p><strong>Kitchens:</strong> {booking.kitchens || "0"}</p>
            </>
          )}
          <p><strong>Add-ons:</strong> {booking.addOns || "None"}</p>
        </div>
      </div>

      {/* New Cleaning Checklist */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', backgroundColor: '#f3f4f6', padding: '5px' }}>✅ DAILY CLEANING CHECKLIST FOR STAFF</h2>
        
        {/* Start of Day */}
        <h3 style={{ fontSize: '16px', marginTop: '15px' }}>🕗 Start of the Day: Preparation</h3>
        <div style={{ marginLeft: '20px' }}>
          <p>☐ Access instructions (see details above)</p>
          <p>☐ Use customer products or bring own</p>
          <p>☐ Get all cleaning items you need (gloves, masks, sponges, cloths, mop, bucket, hoover)</p>
          <p>☐ Load any specific products/tools needed for add-on services</p>
        </div>

        {/* Before Entering */}
        <h3 style={{ fontSize: '16px', marginTop: '15px' }}>📸 Before Entering the Property</h3>
        <div style={{ marginLeft: '20px' }}>
          <p>☐ Arrive on time or notify if running late</p>
          <p>☐ Greet the client politely if they're present</p>
          <p>☐ Take <strong>before photos</strong> of each room or area and send in WhatsApp</p>
        </div>

        {/* General Cleaning Tasks */}
        <h3 style={{ fontSize: '16px', marginTop: '15px' }}>🧽 General Cleaning Tasks – Every Clean</h3>
        
        <h4 style={{ fontSize: '14px', marginTop: '10px', marginLeft: '10px' }}>Living Areas & Bedrooms:</h4>
        <div style={{ marginLeft: '20px' }}>
          <p>☐ Dust all surfaces, furniture, skirting boards, and light fixtures</p>
          <p>☐ Wipe down doors, handles, and switches</p>
          <p>☐ Vacuum carpets/rugs and mop hard floors</p>
          <p>☐ Make beds (residential only)</p>
          <p>☐ Empty bins and replace liners</p>
        </div>
        
        <h4 style={{ fontSize: '14px', marginTop: '10px', marginLeft: '10px' }}>Kitchen:</h4>
        <div style={{ marginLeft: '20px' }}>
          <p>☐ Clean countertops, splashbacks, and cupboard fronts</p>
          <p>☐ Wipe down appliances (exterior only unless add-on selected)</p>
          <p>☐ Clean sink, taps, and remove any limescale</p>
          <p>☐ Sweep and mop floors</p>
          <p>☐ Empty bins and remove rubbish</p>
        </div>
        
        <h4 style={{ fontSize: '14px', marginTop: '10px', marginLeft: '10px' }}>Bathrooms:</h4>
        <div style={{ marginLeft: '20px' }}>
          <p>☐ Clean toilet (inside and out)</p>
          <p>☐ Scrub sinks, baths, showers, tiles, and taps</p>
          <p>☐ Wipe mirrors and surfaces</p>
          <p>☐ Mop floors</p>
          <p>☐ Refill toilet roll, soap, or paper towels (commercial only, if stocked)</p>
        </div>

        {/* Add-On Services */}
        <h3 style={{ fontSize: '16px', marginTop: '15px' }}>🔌 Add-On Services (if booked)</h3>
        <div style={{ marginLeft: '20px' }}>
          <p style={{ fontWeight: 'bold', fontStyle: 'italic', marginBottom: '10px' }}>Confirm add-ons in the job sheet before starting.</p>
          
          {booking.addOns && booking.addOns.includes('oven') && (
            <p>☐ <strong>Oven Cleaning</strong> – Clean racks, interior, door glass</p>
          )}
          
          {(booking.addOns && (booking.addOns.includes('fridge') || booking.addOns.includes('freezer') || booking.addOns.includes('fridge-freezer'))) && (
            <p>☐ <strong>Fridge/Freezer Cleaning</strong> – Remove contents, clean shelves and interior, return items</p>
          )}
          
          {booking.addOns && booking.addOns.includes('microwave') && (
            <p>☐ <strong>Microwave/Small Appliances</strong> – Clean inside and out</p>
          )}
          
          {booking.addOns && (booking.addOns.includes('curtain') || booking.addOns.includes('blind-cleaning')) && (
            <p>☐ <strong>Curtain/Blind Dusting</strong> – Light vacuuming or wipe-down depending on fabric</p>
          )}
          
          {booking.addOns && booking.addOns.includes('window-cleaning') && (
            <p>☐ <strong>Interior Windows</strong> – Clean with streak-free finish</p>
          )}
          
          {(!booking.addOns || booking.addOns === "None") && (
            <p>No add-on services booked for this job.</p>
          )}
        </div>

        {/* Finishing Touches */}
        <h3 style={{ fontSize: '16px', marginTop: '15px' }}>🪟 Finishing Touches</h3>
        <div style={{ marginLeft: '20px' }}>
          <p>☐ Double check all rooms – nothing missed or left behind</p>
          <p>☐ Make sure you return furniture and items how they were</p>
          <p>☐ Leave rooms tidy and presentable</p>
          <p>☐ Leave our card and diffuser in a central area like living room on a table</p>
          <p>☐ Note any damage or issues (report with photos)</p>
        </div>

        {/* End of Job */}
        <h3 style={{ fontSize: '16px', marginTop: '15px' }}>📱 End of Each Job</h3>
        <div style={{ marginLeft: '20px' }}>
          <p>☐ Take photos of each room and send into WhatsApp with feedback or issues</p>
          <p>☐ Lock up securely or hand back keys as instructed</p>
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