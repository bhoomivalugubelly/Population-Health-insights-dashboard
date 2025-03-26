import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import './Patients.css';

// Define color palette for pie chart
const PIE_COLORS = ['#3B82F6', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6']; // Blue, Pink, Green, Orange, Purple

function Patients() {
  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [focusArea, setFocusArea] = useState('Cost Drivers');
  const [riskData, setRiskData] = useState([]);
  const [ageCostTrends, setAgeCostTrends] = useState([]);
  const [raceCostTrends, setRaceCostTrends] = useState([]);
  const [takeaways, setTakeaways] = useState([]);
  const [ageRiskData, setAgeRiskData] = useState([]);
  const [raceRiskData, setRaceRiskData] = useState([]);

  // Fetch data on mount
  useEffect(() => {
    const fetchHealthData = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:5000/api/patients');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        processHealthInsights(data);
      } catch (err) {
        setError(`Failed to fetch data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchHealthData();
  }, []);

  // Update risk data when focus area changes
  useEffect(() => {
    setRiskData(focusArea === 'Cost Drivers' ? ageRiskData : raceRiskData);
  }, [focusArea, ageRiskData, raceRiskData]);

  // Calculate age from birthdate
  const calculateAge = (birthDate) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  // Process health insights from raw data
  const processHealthInsights = (data) => {
    const raceExpenses = {};
    const ageExpenses = { '0-18': [], '19-35': [], '36-50': [], '51-65': [], '65+': [] };

    data.forEach(patient => {
      const race = (patient.RACE || 'Unknown').toLowerCase();
      const expenses = Number(patient.HEALTHCARE_EXPENSES || 0);
      const age = calculateAge(patient.BIRTHDATE);

      // Aggregate by race
      raceExpenses[race] = (raceExpenses[race] || { total: 0, count: 0 });
      raceExpenses[race].total += expenses;
      raceExpenses[race].count += 1;

      // Aggregate by age group
      if (age <= 18) ageExpenses['0-18'].push(expenses);
      else if (age <= 35) ageExpenses['19-35'].push(expenses);
      else if (age <= 50) ageExpenses['36-50'].push(expenses);
      else if (age <= 65) ageExpenses['51-65'].push(expenses);
      else ageExpenses['65+'].push(expenses);
    });

    const riskByRace = Object.keys(raceExpenses).map(race => ({
      name: race,
      hri: (raceExpenses[race].total / raceExpenses[race].count) / 1000
    }));

    const riskByAge = Object.keys(ageExpenses).map(group => ({
      name: group,
      hri: ageExpenses[group].length ? (ageExpenses[group].reduce((a, b) => a + b, 0) / ageExpenses[group].length) / 1000 : 0
    }));

    const ageCostTrendData = Object.keys(ageExpenses).map(group => ({
      name: group,
      avgCost: ageExpenses[group].length ? (ageExpenses[group].reduce((a, b) => a + b, 0) / ageExpenses[group].length) : 0
    }));

    const raceCostTrendData = Object.keys(raceExpenses).map(race => ({
      name: race,
      avgCost: (raceExpenses[race].total / raceExpenses[race].count) || 0
    }));

    const highRiskRace = riskByRace.reduce((max, curr) => curr.hri > max.hri ? curr : max, { hri: 0 });
    const highRiskAge = riskByAge.reduce((max, curr) => curr.hri > max.hri ? curr : max, { hri: 0 });
    const totalCost = data.reduce((sum, p) => sum + Number(p.HEALTHCARE_EXPENSES || 0), 0);
    const takeaways = [
      `Highest risk age group: ${highRiskAge.name} (HRI: ${highRiskAge.hri.toFixed(2)})`,
      `Highest risk race: ${highRiskRace.name} (HRI: ${highRiskRace.hri.toFixed(2)})`,
      `Total healthcare cost: $${(totalCost / 1000000).toFixed(2)}M`
    ];

    setAgeRiskData(riskByAge);
    setRaceRiskData(riskByRace);
    setRiskData(focusArea === 'Cost Drivers' ? riskByAge : raceRiskData);
    setAgeCostTrends(ageCostTrendData);
    setRaceCostTrends(raceCostTrendData);
    setTakeaways(takeaways);
  };

  return (
    <div className="patients-page">
      {/* Header */}
      <header className="header">
        <h1>Population Health Insights</h1>
      </header>

      {/* Navigation */}
      <nav className="navbar">
        <Link to="/" className={window.location.pathname === '/' ? 'active' : ''}>Dashboard</Link>
        <Link to="/patients" className={window.location.pathname === '/patients' ? 'active' : ''}>Patients</Link>
        <Link to="/disease-trends" className={window.location.pathname === '/disease-trends' ? 'active' : ''}>Disease Trends</Link>
        <Link to="/reports" className={window.location.pathname === '/reports' ? 'active' : ''}>Reports</Link>
      </nav>
     
      
    

      {/* Main Content */}
      <main className="main-content">
        <section className="page-header">
          <h2>Patients</h2>
          <p>Strategic Insights for Population Health Management</p>
        </section>

        <div className="focus-selector">
          <label htmlFor="focus-select">Focus Area:</label>
          <select
            id="focus-select"
            value={focusArea}
            onChange={(e) => setFocusArea(e.target.value)}
          >
            <option value="Cost Drivers">Cost Drivers (Age)</option>
            <option value="Demographic Risks">Demographic Risks (Race)</option>
          </select>
        </div>

        {loading ? (
          <div className="loading">Processing health insights...</div>
        ) : error ? (
          <div className="error">
            {error} <button onClick={() => { setLoading(true); setError(null); }}>Retry</button>
          </div>
        ) : (
          <div className="insights-grid">
            {/* HRI Bar Chart */}
            <section className="insight-card risk-card">
              <h3>Health Risk Index (HRI)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={riskData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => `${value.toFixed(2)}K $ per capita`} />
                  <Bar dataKey="hri" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </section>

            {/* Cost Distribution Pie Chart */}
            <section className="insight-card trend-card">
              <h3>{focusArea === 'Cost Drivers' ? 'Cost Distribution by Age' : 'Cost Distribution by Race'}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={focusArea === 'Cost Drivers' ? ageCostTrends : raceCostTrends}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="avgCost"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {(focusArea === 'Cost Drivers' ? ageCostTrends : raceCostTrends).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            </section>

            {/* Key Takeaways */}
            <section className="insight-card takeaways-card">
              <h3>Key Takeaways</h3>
              <ul>
                {takeaways.map((takeaway, index) => (
                  <li key={index}>{takeaway}</li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

export default Patients;