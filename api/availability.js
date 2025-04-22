import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

// Firebase configuration - using client-side Firebase SDK instead of admin SDK
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Handle POST request for booking submissions
  if (req.method === 'POST') {
    try {
      // This would be where you'd handle form submissions
      // For now, just return a success response
      res.status(200).json({ success: true, message: "Booking received" });
      return;
    } catch (error) {
      console.error("Error handling booking submission:", error);
      res.status(500).json({ 
        error: "Failed to process booking", 
        message: error.message
      });
      return;
    }
  }

  // Handle GET request for unavailability data
  try {
    // Fetch unavailable dates from Firebase
    const querySnapshot = await getDocs(collection(db, "unavailability"));
    let unavailableDates = [];
    
    querySnapshot.forEach((doc) => {
      // Check if your database structure has dates as an array in each document
      if (doc.data().dates) {
        unavailableDates.push(...doc.data().dates);
      }
      // Also check if your database has documents with an 'unavailable' field
      else if (doc.data().unavailable === true) {
        unavailableDates.push(doc.id);
      }
    });

    // Return the unavailable dates
    res.status(200).json({ unavailableDates });
  } catch (error) {
    console.error("Error fetching unavailability:", error);
    res.status(500).json({ 
      error: "Failed to fetch unavailability", 
      message: error.message
    });
  }
}