import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "./Dashboard.css";
import healthImage from "../assets/healthcare.jpg";

function Dashboard() {
  const [stats, setStats] = useState({
    totalPatients: 0,
    activeCases: 0,
    resourceStrain: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/dashboard_stats");
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

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
        <Link to="/reports" className="nav-link">Reports</Link>
      </nav>

      {/* Summary Section */}
      <section className="dashboard-summary">
        <h2>Welcome to the Population Health Insights Dashboard</h2>
        <p>Analyze population health trends, track disease outbreaks, and optimize healthcare resources with interactive visualizations.</p>
        {loading ? (
          <p>Loading key stats...</p>
        ) : (
          <div className="dashboard-stats">
            <div className="stat-card">
              <h3>Total Patients</h3>
              <p>{stats.totalPatients.toLocaleString()}</p>
            </div>
            <div className="stat-card">
              <h3>Active Cases</h3>
              <p>{stats.activeCases.toLocaleString()}</p>
            </div>
            <div className="stat-card">
              <h3>Resource Strain</h3>
              <p>{stats.resourceStrain.toFixed(2)}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default Dashboard;