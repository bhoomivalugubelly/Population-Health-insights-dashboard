import React from "react";
import { Link } from "react-router-dom";
import "./Dashboard.css"; 
import healthImage from "../assets/healthcare.jpg"; // Import the saved image

function Dashboard() {
  return (
    <div className="dashboard-container">
      {/* Header Section */}
      <header className="dashboard-header">
        <img src={healthImage} alt="Population Health Insights" className="header-image" />
        <h1 className="dashboard-title">Population Health Insights Dashboard</h1>
      </header>

      {/* Navigation Links */}
      <nav className="dashboard-nav">
        <Link to="/patients" className="nav-link">Patients</Link>
        <Link to="/disease-tracking" className="nav-link">Disease Trends</Link>
        <Link to="/hospital-resources" className="nav-link">Hospital Resources</Link>
        <Link to="/medications" className="nav-link">Medications</Link>
        <Link to="/reports" className="nav-link">Reports</Link>
      </nav>

      {/* Summary Section */}
      <section className="dashboard-summary">
        <h2>Welcome to the Population Health Insights Dashboard</h2>
        <p>Analyze population health trends, track disease outbreaks, and optimize healthcare resources with interactive visualizations.</p>
      </section>
    </div>
  );
}

export default Dashboard;
