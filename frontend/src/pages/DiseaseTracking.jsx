import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import './DiseaseTracking.css';

const DiseaseTracking = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [conditionType, setConditionType] = useState('All');
  const [trendsData, setTrendsData] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [topConditions, setTopConditions] = useState([]);
  const [hba1cTrend, setHba1cTrend] = useState([]);

  useEffect(() => {
    fetchDiseaseTrends();
  }, [conditionType]);

  const fetchDiseaseTrends = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/disease_trends?condition_type=${conditionType}`);
      if (!response.ok) throw new Error('Failed to fetch disease trends');
      const { trends, heatmap, top_conditions, hba1c_trend } = await response.json();
      setTrendsData(trends);
      setHeatmapData(processHeatmapData(heatmap));
      setTopConditions(top_conditions);
      setHba1cTrend(hba1c_trend);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const processHeatmapData = (data) => {
    const ageGroups = ['0-18', '19-35', '36-50', '51-65', '65+'];
    const genders = ['M', 'F'];
    return ageGroups.map(age => ({
      age_group: age,
      M: data.filter(d => d.age_group === age && d.GENDER === 'M').reduce((sum, d) => sum + d.count, 0),
      F: data.filter(d => d.age_group === age && d.GENDER === 'F').reduce((sum, d) => sum + d.count, 0),
    }));
  };

  const trendConditions = [...new Set(trendsData.map(d => d.condition))];
  const colors = ['#3B82F6', '#EC4899'];
  const minYear = trendsData.length > 0 ? Math.min(...trendsData.map(d => d.year)) : 1964;
  const maxYear = 2025;

  if (loading) return <div className="loading">Loading disease trends...</div>;
  if (error) return <div className="error">{error} <button onClick={fetchDiseaseTrends}>Retry</button></div>;

  return (
    <div className="disease-tracking-container">
      <header className="header">
        <h1>Population Health Insights</h1>
      </header>
      <nav className="navbar">
        <Link to="/">Dashboard</Link>
        <Link to="/patients">Patients</Link>
        <Link to="/disease-trends" className="active">Disease Trends</Link>
        <Link to="/reports">Reports</Link>
      </nav>
      <main className="main-content">
        <section className="page-header">
          <h2>Disease Trends</h2>
        </section>

        <div className="filters">
          <div className="filter-group">
            <label>Condition Type:</label>
            <select value={conditionType} onChange={(e) => setConditionType(e.target.value)}>
              <option value="All">All Conditions</option>
              <option value="Chronic">Chronic</option>
              <option value="Acute">Acute</option>
            </select>
          </div>
        </div>

        <div className="insights-grid">
          <section className="chart-card">
            <h3>Chronic Condition Prevalence Over Time</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="year" 
                  domain={[minYear, maxYear]} 
                  label={{ value: 'Year', position: 'insideBottom', offset: -5 }} 
                />
                <YAxis label={{ value: 'Number of Cases', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                {trendConditions.map((cond, idx) => (
                  <Line
                    key={cond}
                    data={trendsData.filter(d => d.condition === cond)}
                    type="monotone"
                    dataKey="count"
                    name={cond}
                    stroke={colors[idx % colors.length]}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </section>

          <section className="chart-card">
            <h3>Condition Frequency by Age and Gender</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={heatmapData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="age_group" 
                  label={{ value: 'Age Group', position: 'insideBottom', offset: -5 }} 
                />
                <YAxis label={{ value: 'Number of Cases', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="M" fill="#3B82F6" name="Male" />
                <Bar dataKey="F" fill="#EC4899" name="Female" />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className="chart-card">
            <h3>Hemoglobin A1c Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={hba1cTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="year" 
                  label={{ value: 'Year', position: 'insideBottom', offset: -5 }} 
                />
                <YAxis label={{ value: 'Avg HbA1c (%)', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value) => `${value.toFixed(2)}%`} />
                <Legend />
                <Line type="monotone" dataKey="avg_hba1c" stroke="#10B981" name="Avg HbA1c" />
              </LineChart>
            </ResponsiveContainer>
          </section>

          <section className="list-card">
            <h3>Top 5 Conditions</h3>
            <ul>
              {topConditions.map((cond, idx) => (
                <li key={idx}>
                  {cond.condition}: {cond.count} cases ({cond.percentage}%)
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
};

export default DiseaseTracking;