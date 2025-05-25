// src/components/AddressLookup.js
import React, { useState } from "react";

const AddressLookup = ({ onAddressSelect }) => {
  // Replace with your getAddress.io API key
  const GET_ADDRESS_API_KEY = "hzXkGrGelUuP-gKo63Ra4g46024";
  
  const [postcode, setPostcode] = useState("");
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [customAddress, setCustomAddress] = useState({
    line1: "",
    line2: "",
    town: "",
    county: "",
    postcode: ""
  });

  // Handle postcode input change
  const handlePostcodeChange = (e) => {
    setPostcode(e.target.value.toUpperCase());
    setError("");
  };

  // Search addresses by postcode using getAddress.io API
  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!postcode.trim()) {
      setError("Please enter a postcode");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      // Using getAddress.io API
      const formattedPostcode = postcode.replace(/\s+/g, '');
      const response = await fetch(`https://api.getaddress.io/find/${formattedPostcode}?api-key=${GET_ADDRESS_API_KEY}`);
      
      if (!response.ok) {
        if (response.status === 401) {
          setError("API authentication failed. Please check your API key.");
        } else if (response.status === 404) {
          setError("Postcode not found. Please check and try again.");
        } else if (response.status === 429) {
          setError("API usage limit reached. Please try again later.");
        } else {
          setError(`Error: ${response.status} - ${response.statusText}`);
        }
        setAddresses([]);
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      
      if (data.addresses && data.addresses.length > 0) {
        setAddresses(data.addresses.map((address, index) => {
          // Parse address parts
          const parts = address.split(", ").filter(part => part.trim());
          return {
            fullAddress: address,
            line1: parts[0] || "",
            line2: parts.length > 2 ? parts[1] : "",
            town: parts.length > 2 ? parts[parts.length - 2] : parts.length > 1 ? parts[1] : "",
            county: parts.length > 1 ? parts[parts.length - 1] : "",
            postcode: data.postcode
          };
        }));
      } else {
        setError("No addresses found for this postcode");
        setAddresses([]);
      }
    } catch (error) {
      console.error("Error fetching addresses:", error);
      setError("Error fetching addresses. Please try again or enter manually.");
    } finally {
      setLoading(false);
    }
  };

  // Handle address selection
  const handleAddressSelect = (e) => {
    const selectedIndex = e.target.value;
    if (selectedIndex === "manual") {
      setShowAddressForm(true);
      setSelectedAddress(null);
      
      // Pre-fill postcode in manual form
      setCustomAddress(prev => ({
        ...prev,
        postcode: postcode
      }));
    } else if (selectedIndex !== "") {
      const selected = addresses[parseInt(selectedIndex)];
      
      // Make sure postcode is included from the getAddress.io data
      const addressWithPostcode = {
        ...selected,
        postcode: selected.postcode || postcode // Ensure postcode is preserved
      };
      
      setSelectedAddress(addressWithPostcode);
      setShowAddressForm(false);
      
      // Call the parent component callback with the selected address
      if (onAddressSelect) {
        onAddressSelect(addressWithPostcode);
      }
    } else {
      setSelectedAddress(null);
    }
  };

  // Handle manual address input changes
  const handleCustomAddressChange = (e) => {
    const { name, value } = e.target;
    setCustomAddress(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Validate manual address
  const validateManualAddress = () => {
    if (!customAddress.line1) {
      setError("Address line 1 is required");
      return false;
    }
    
    if (!customAddress.town) {
      setError("Town/City is required");
      return false;
    }
    
    if (!customAddress.postcode) {
      setError("Postcode is required");
      return false;
    }
    
    return true;
  };

  // Submit custom address
  const handleCustomAddressSubmit = () => {
    // Clear any previous errors
    setError("");
    
    // Validate required fields
    if (!validateManualAddress()) {
      return;
    }
    
    // Ensure postcode is properly formatted
    const formattedPostcode = customAddress.postcode.toUpperCase().trim();
    
    const manualAddress = {
      ...customAddress,
      postcode: formattedPostcode, // Ensure postcode is consistently formatted
      fullAddress: `${customAddress.line1}, ${customAddress.line2 ? customAddress.line2 + ', ' : ''}${customAddress.town}, ${customAddress.county ? customAddress.county + ', ' : ''}${formattedPostcode}`
    };
    
    setSelectedAddress(manualAddress);
    setShowAddressForm(false);
    
    // Call the parent component callback with the manual address
    if (onAddressSelect) {
      onAddressSelect(manualAddress);
    }
  };

  return (
    <div className="address-lookup-container mb-6">
      <div className="fs-section-title text-lg text-blue-600 font-medium mb-2 pb-2 border-b">
        Address
      </div>
      
      {/* Postcode Search */}
      <div className="flex flex-wrap items-end gap-2 mb-3">
        <div className="fs-field flex-grow">
          <label className="fs-label block text-gray-700 mb-1" htmlFor="postcode">
            Enter Postcode
          </label>
          <input
            className="fs-input w-full p-2 border rounded-lg"
            type="text"
            id="postcode"
            name="postcode"
            value={postcode}
            onChange={handlePostcodeChange}
            placeholder="e.g. M1 1AA"
          />
        </div>
        <button
          className="fs-button text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-200"
          onClick={handleSearch}
          disabled={loading}
        >
          {loading ? "Searching..." : "Find Address"}
        </button>
      </div>
      
      {/* Error Message */}
      {error && (
        <div className="text-red-500 mb-3">{error}</div>
      )}
      
      {/* Address Dropdown */}
      {addresses.length > 0 && (
        <div className="fs-field mb-3">
          <label className="fs-label block text-gray-700 mb-1" htmlFor="address-select">
            Select Address
          </label>
          <select
            className="fs-select w-full p-2 border rounded-lg"
            id="address-select"
            onChange={handleAddressSelect}
            defaultValue=""
          >
            <option value="" disabled>
              Choose your address
            </option>
            {addresses.map((address, index) => (
              <option key={index} value={index}>
                {address.fullAddress}
              </option>
            ))}
            <option value="manual">Enter address manually</option>
          </select>
        </div>
      )}
      
      {/* Manual Address Form */}
      {showAddressForm && (
        <div className="manual-address-form">
          <div className="grid grid-cols-1 gap-3 mb-3">
            <div className="fs-field">
              <label className="fs-label block text-gray-700 mb-1" htmlFor="line1">
                Address Line 1
              </label>
              <input
                className="fs-input w-full p-2 border rounded-lg"
                type="text"
                id="line1"
                name="line1"
                value={customAddress.line1}
                onChange={handleCustomAddressChange}
                required
              />
            </div>
            <div className="fs-field">
              <label className="fs-label block text-gray-700 mb-1" htmlFor="line2">
                Address Line 2 (optional)
              </label>
              <input
                className="fs-input w-full p-2 border rounded-lg"
                type="text"
                id="line2"
                name="line2"
                value={customAddress.line2}
                onChange={handleCustomAddressChange}
              />
            </div>
            <div className="fs-field">
              <label className="fs-label block text-gray-700 mb-1" htmlFor="town">
                Town/City
              </label>
              <input
                className="fs-input w-full p-2 border rounded-lg"
                type="text"
                id="town"
                name="town"
                value={customAddress.town}
                onChange={handleCustomAddressChange}
                required
              />
            </div>
            <div className="fs-field">
              <label className="fs-label block text-gray-700 mb-1" htmlFor="county">
                County
              </label>
              <input
                className="fs-input w-full p-2 border rounded-lg"
                type="text"
                id="county"
                name="county"
                value={customAddress.county}
                onChange={handleCustomAddressChange}
                required
              />
            </div>
            <div className="fs-field">
              <label className="fs-label block text-gray-700 mb-1" htmlFor="manual-postcode">
                Postcode
              </label>
              <input
                className="fs-input w-full p-2 border rounded-lg"
                type="text"
                id="manual-postcode"
                name="postcode"
                value={customAddress.postcode || postcode}
                onChange={handleCustomAddressChange}
                required
              />
            </div>
          </div>
          <button
            className="fs-button bg-blue-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-200"
            onClick={handleCustomAddressSubmit}
          >
            Confirm Address
          </button>
        </div>
      )}
      
      {/* Selected Address Display - Only show when an address is selected */}
{selectedAddress && !showAddressForm && (
  <div className="selected-address bg-gray-50 p-3 rounded-lg mb-3">
    <div className="mb-1 font-medium">Selected Address:</div>
    <div>{selectedAddress.line1}</div>
    {selectedAddress.line2 && <div>{selectedAddress.line2}</div>}
    <div>{selectedAddress.town}</div>
    {selectedAddress.county && <div>{selectedAddress.county}</div>}
    <div>{selectedAddress.postcode}</div>
    <button
      className="text-white bg-[#0071bc] hover:bg-[#005a94] transition duration-200 mt-2 py-2 px-4 rounded-lg"
      onClick={() => {
        // Reset everything to initial state
        setSelectedAddress(null);
        setShowAddressForm(false);
        setAddresses([]);
        setPostcode("");
        setError("");
        setCustomAddress({
          line1: "",
          line2: "",
          town: "",
          county: "",
          postcode: ""
        });
        
        // Notify parent component that address was cleared
        if (onAddressSelect) {
          onAddressSelect(null);
        }
      }}
    >
      Change
    </button>
  </div>
)}
      
      {/* Manual entry link when no addresses are shown and no search has been performed */}
      {!showAddressForm && addresses.length === 0 && !loading && !error && (
        <div className="my-3">
          <button
            className="bg-gray-400 text-white py-2 px-4 rounded-lg hover:bg-gray-500 transition duration-200"
            onClick={() => {
              setShowAddressForm(true);
              setError("");
            }}
          >
            Enter address manually
          </button>
        </div>
      )}
    </div>
  );
};

export default AddressLookup;