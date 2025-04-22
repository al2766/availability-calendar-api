import React, { useState, useEffect } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { collection, getDocs, setDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "./firebase";
import "./App.css";

function App() {
  const [unavailableDates, setUnavailableDates] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUnavailability = async () => {
      try {
        const snapshot = await getDocs(collection(db, "unavailability"));
        const fetchedDates = new Set(snapshot.docs.map((doc) => doc.id));
        setUnavailableDates(fetchedDates);
      } catch (error) {
        console.error("Error fetching unavailability:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUnavailability();
  }, []);

  const formatDateLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  
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
      const toRemove = [...existingDates].filter((d) => !unavailableDates.has(d));

      // Add or update
      await Promise.all(
        toAdd.map((date) =>
          setDoc(doc(db, "unavailability", date), { unavailable: true })
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
    if (unavailableDates.has(dateStr)) {
      return "unavailable-date";
    } else {
      return "available-date";
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Unavailability Calendar</h1>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <Calendar
          onClickDay={toggleDate}
          tileClassName={tileClassName}
        />
      )}
      <button
        onClick={saveUnavailability}
        className="mt-6 bg-blue-600 text-white font-semibold px-6 py-2 rounded hover:bg-blue-700 transition duration-200"
      >
        Set Unavailability
      </button>
    </div>
  );
}

export default App;