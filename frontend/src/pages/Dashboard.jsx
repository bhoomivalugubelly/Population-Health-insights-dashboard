import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "./Dashboard.css";
import healthImage from "../assets/healthcare.jpg";

function Dashboard() {
  const [stats, setStats] = useState({
    totalPatients: 0,
    activeEncounters: 0,
    totalClaimsCost: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/dashboard_stats");
        if (!response.ok) throw new Error("Failed to fetch stats");
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
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
        <img src={healthImage} alt="Healthcare Insights" className="header-image" />
        <h1 className="dashboard-title">Population Health Insights Dashboard</h1>
      </header>

      {/* Navigation Links */}
      <nav className="dashboard-nav">
        <Link to="/patients" className="nav-link">Patients</Link>
        <Link to="/disease-trends" className="nav-link">Disease Trends</Link>
        <Link to="/hospital-resources" className="nav-link">Hospital Resources</Link>
        <Link to="/reports" className="nav-link">Reports</Link>
      </nav>

      {/* Summary Section */}
      <section className="dashboard-summary">
        <h2>Welcome to the Population Health Insights Dashboard</h2>
        <p>
          Monitor population health, track active care, and manage costs with real-time insights and interactive tools.
        </p>
      </section>

      {/* Key Metrics Cards */}
      <section className="dashboard-stats">
        {loading ? (
          <p>Loading key metrics...</p>
        ) : (
          <div className="stats-row">
            <div className="stat-card">
              <h3>Total Patients</h3>
              <p>{stats.totalPatients.toLocaleString()}</p>
            </div>
            {/* <div className="stat-card">
              <h3>Active Encounters</h3>
              <p>{stats.activeEncounters.toLocaleString()}</p>
            </div> */}
            <div className="stat-card">
              <h3>Total Claims Cost</h3>
              <p>${stats.totalClaimsCost.toLocaleString()}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default Dashboard;