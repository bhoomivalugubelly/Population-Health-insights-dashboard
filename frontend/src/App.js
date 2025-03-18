import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import HospitalResourceUtilization from './pages/HospitalResourceUtilization';
import DiseaseTracking from './pages/DiseaseTracking';

function App() {
  return (
    <Router>
      <div className="App">
        {/* Persistent Navigation */}
        <nav className="app-nav">
          <Link to="/" className="nav-link">Dashboard</Link>
          <Link to="/patients" className="nav-link">Patients</Link>
          <Link to="/hospital-resources" className="nav-link">Hospital Resources</Link>
          <Link to="/disease-tracking" className="nav-link">Disease Tracking</Link>
        </nav>

        {/* Routes */}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/hospital-resources" element={<HospitalResourceUtilization />} />
          <Route path="/disease-tracking" element={<DiseaseTracking />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;