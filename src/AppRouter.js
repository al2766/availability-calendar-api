// src/AppRouter.js
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Use React.lazy for code splitting
const App = lazy(() => import('./App'));
const HomeCleaningForm = lazy(() => import('./forms/HomeCleaningForm'));
const OfficeCleaningForm = lazy(() => import('./forms/OfficeCleaningForm'));
const CustomFormRenderer = lazy(() => import('./components/FormBuilder/CustomFormRenderer'));

// Loading component for suspense fallback
const Loading = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-100">
    <div className="spinner mr-3"></div>
    <p className="text-gray-600">Loading...</p>
  </div>
);

function AppRouter() {
  return (
    <Router>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/admin" element={<App />} />
          <Route path="/booking/home" element={<HomeCleaningForm />} />
          <Route path="/booking/office" element={<OfficeCleaningForm />} />
          <Route path="/booking/custom/:formId" element={<CustomFormRenderer />} />
          {/* Legacy route - redirect to home cleaning for backward compatibility */}
          <Route path="/booking" element={<Navigate to="/booking/home" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default AppRouter;