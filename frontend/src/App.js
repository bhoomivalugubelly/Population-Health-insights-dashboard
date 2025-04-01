import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import DiseaseTrends from './pages/DiseaseTracking'
import ResourceUtilization from "./pages/ResourceUtilization";
import Reports from "./pages/Reports"
function App() {
  return (
    <Router>
      <div className="App">

        {/* Routes */}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/hospital-resources" element={<ResourceUtilization />} />
          <Route path="/disease-trends" element={<DiseaseTrends />} />
          <Route path="/resource-utilization" element={<ResourceUtilization />} />
          <Route path="/reports" element={<Reports />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;