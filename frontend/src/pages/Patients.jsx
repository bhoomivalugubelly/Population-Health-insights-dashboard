import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import './Patients.css';

const PIE_COLORS = ['#3B82F6', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6', '#CC8899'];

function Patients() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [focusArea, setFocusArea] = useState('Cost Drivers');
  const [rawData, setRawData] = useState([]);
  const [riskData, setRiskData] = useState([]);
  const [costTrends, setCostTrends] = useState([]);
  const [cityData, setCityData] = useState([]);
  const [topConditions, setTopConditions] = useState([]);
  const [takeaways, setTakeaways] = useState([]);

  const cityListRef = useRef(null);

  useEffect(() => {
    fetchHealthData();
  }, []);

  useEffect(() => {
    if (rawData.length > 0) {
      processHealthInsights(rawData);
    }
  }, [focusArea, rawData]);

  const fetchHealthData = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/patients');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setRawData(data);
    } catch (err) {
      setError(`Failed to fetch data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const processHealthInsights = (data) => {
    const ageGroups = { '0-18': [], '19-35': [], '36-50': [], '51-65': [], '65+': [] };
    const raceGroups = {};
    const cityCounts = {};
    const conditionCounts = {};

    data.forEach(patient => {
      const age = patient.AGE;
      const race = patient.RACE.toLowerCase();
      const city = patient.CITY;
      const hri = patient.HRI;
      const expenses = patient.HEALTHCARE_EXPENSES;
      const condition = patient.top_condition;

      if (age <= 18) ageGroups['0-18'].push({ hri, expenses });
      else if (age <= 35) ageGroups['19-35'].push({ hri, expenses });
      else if (age <= 50) ageGroups['36-50'].push({ hri, expenses });
      else if (age <= 65) ageGroups['51-65'].push({ hri, expenses });
      else ageGroups['65+'].push({ hri, expenses });

      if (!raceGroups[race]) raceGroups[race] = [];
      raceGroups[race].push({ hri, expenses });

      cityCounts[city] = (cityCounts[city] || 0) + 1;

      if (condition !== 'None') {
        conditionCounts[condition] = (conditionCounts[condition] || { count: 0, totalHRI: 0 });
        conditionCounts[condition].count += 1;
        conditionCounts[condition].totalHRI += hri;
      }
    });

    const riskByAge = Object.keys(ageGroups).map(group => ({
      name: group,
      hri: ageGroups[group].length ? ageGroups[group].reduce((sum, p) => sum + p.hri, 0) / ageGroups[group].length : 0
    }));
    const riskByRace = Object.keys(raceGroups).map(race => ({
      name: race,
      hri: raceGroups[race].length ? raceGroups[race].reduce((sum, p) => sum + p.hri, 0) / raceGroups[race].length : 0
    }));

    const ageCostTrends = Object.keys(ageGroups).map(group => ({
      name: group,
      avgCost: ageGroups[group].length ? ageGroups[group].reduce((sum, p) => sum + p.expenses, 0) / ageGroups[group].length : 0
    })).filter(group => group.avgCost > 0);
    const raceCostTrends = Object.keys(raceGroups).map(race => ({
      name: race,
      avgCost: raceGroups[race].length ? raceGroups[race].reduce((sum, p) => sum + p.expenses, 0) / raceGroups[race].length : 0
    })).filter(race => race.avgCost > 0);

    console.log('Cost Trends:', focusArea === 'Cost Drivers' ? ageCostTrends : raceCostTrends);

    setRiskData(focusArea === 'Cost Drivers' ? riskByAge : riskByRace);
    setCostTrends(focusArea === 'Cost Drivers' ? ageCostTrends : raceCostTrends);
    setCityData(Object.entries(cityCounts).map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count).slice(0, 10));

    const topConditionsData = Object.entries(conditionCounts)
      .map(([condition, { count, totalHRI }]) => ({
        name: condition,
        avgHRI: count > 0 ? totalHRI / count : 0, // Renamed to avgHRI and added fallback for count = 0
        count
      }))
      .sort((a, b) => b.avgHRI - a.avgHRI)
      .slice(0, 5);
    setTopConditions(topConditionsData);

    const highRiskAge = riskByAge.reduce((max, curr) => curr.hri > max.hri ? curr : max, { hri: 0 });
    const highRiskRace = riskByRace.reduce((max, curr) => curr.hri > max.hri ? curr : max, { hri: 0 });
    const totalCost = data.reduce((sum, p) => sum + p.HEALTHCARE_EXPENSES, 0) / 1000000;
    const topCondition = topConditionsData[0]?.name || 'Unknown';
    setTakeaways([
      `Highest Risk Age: ${highRiskAge.name} (HRI: ${highRiskAge.hri.toFixed(1)})`,
      `Highest Risk Race: ${highRiskRace.name} (HRI: ${highRiskRace.hri.toFixed(1)})`,
      `Top Condition: ${topCondition} (Avg HRI: ${topConditionsData[0]?.avgHRI ? topConditionsData[0].avgHRI.toFixed(1) : 'N/A'})`, // Fixed property name and added fallback
      `Total Cost: $${totalCost.toFixed(2)}M`
    ]);
  };

  const scrollUp = () => {
    if (cityListRef.current) {
      cityListRef.current.scrollBy({ top: -50, behavior: 'smooth' });
    }
  };

  const scrollDown = () => {
    if (cityListRef.current) {
      cityListRef.current.scrollBy({ top: 50, behavior: 'smooth' });
    }
  };

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 30;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const percentValue = (percent * 100).toFixed(1);
    if (percentValue <= 0) return null;
    return (
      <text
        x={x}
        y={y}
        fill="#1F2937"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={12}
      >
        {`${costTrends[index].name}: ${percentValue}%`}
      </text>
    );
  };

  return (
    <div className="patients-page">
      <header className="header">
        <h1>Population Health Insights</h1>
      </header>
      <nav className="navbar">
        <Link to="/">Dashboard</Link>
        <Link to="/patients" className="active">Patients</Link>
        <Link to="/disease-trends">Disease Trends</Link>
        <Link to="/hospital-resources">Hospital Resources</Link>
        <Link to="/reports">Reports</Link>
      </nav>
      <main className="main-content">
        <section className="page-header">
          <h2>Patients</h2>
        </section>

        <div className="focus-selector">
          <label htmlFor="focus-select">Focus Area:</label>
          <select id="focus-select" value={focusArea} onChange={(e) => setFocusArea(e.target.value)}>
            <option value="Cost Drivers">Cost Drivers (Age)</option>
            <option value="Demographic Risks">Demographic Risks (Race)</option>
          </select>
        </div>

        {loading ? (
          <div className="loading">Processing health insights...</div>
        ) : error ? (
          <div className="error">{error} <button onClick={fetchHealthData}>Retry</button></div>
        ) : (
          <div className="insights-grid">
            <section className="insight-card risk-card">
              <h3>Health Risk Index (HRI)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={riskData}>
                  <XAxis
                    dataKey="name"
                    label={{
                      value: focusArea === 'Cost Drivers' ? 'Age Group' : 'Race',
                      position: 'insideBottom',
                      offset: -10
                    }}
                  />
                  <YAxis
                    label={{
                      value: 'Average HRI',
                      angle: -90,
                      position: 'insideLeft',
                      offset: -20
                    }}
                  />
                  <Tooltip formatter={(value) => value.toFixed(1)} />
                  <Bar dataKey="hri" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section className="insight-card trend-card">
              <h3>{focusArea === 'Cost Drivers' ? 'Cost Distribution by Age' : 'Cost Distribution by Race'}</h3>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={costTrends}
                    cx="50%"
                    cy="50%"
                    outerRadius={130}
                    dataKey="avgCost"
                    label={renderCustomizedLabel}
                    labelLine={true}
                    paddingAngle={3}
                    minAngle={2}
                  >
                    {costTrends.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </section>

            <section className="insight-card city-card">
              <h3>Top 10 Cities by Patient Count</h3>
              <div className="city-list-container">
                <button className="scroll-button scroll-up" onClick={scrollUp} aria-label="Scroll Up">
                  ↑
                </button>
                <div className="city-list" ref={cityListRef}>
                  {cityData.map((row, index) => (
                    <div key={index} className="city-item">
                      <span className="city-rank">{index + 1}</span>
                      <div className="city-details">
                        <span className="city-name">{row.city}</span>
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{ width: `${(row.count / cityData[0].count) * 100}%` }}
                          ></div>
                        </div>
                        <span className="city-count">{row.count} patients</span>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="scroll-button scroll-down" onClick={scrollDown} aria-label="Scroll Down">
                  ↓
                </button>
              </div>
            </section>

            <section className="insight-card condition-card">
              <h3>Top Health Risks by Condition</h3>
              <div className="condition-list">
                {topConditions.map((condition, index) => (
                  <div key={index} className="condition-item">
                    <span className="condition-rank">{index + 1}</span>
                    <div className="condition-details">
                      <span className="condition-name">{condition.name}</span>
                      <span className="condition-stats">
                        Avg HRI: {condition.avgHRI ? condition.avgHRI.toFixed(1) : 'N/A'} | {condition.count} patients
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="insight-card takeaways-card">
              <h3>Key Takeaways</h3>
              <ul>
                {takeaways.map((takeaway, index) => (
                  <li key={index} className={`takeaway-${index}`}>{takeaway}</li>
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