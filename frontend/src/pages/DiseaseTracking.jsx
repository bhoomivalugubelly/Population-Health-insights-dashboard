import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import './DiseaseTracking.css';

const DiseaseTracking = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [conditionType, setConditionType] = useState('All');
  const [selectedConditions, setSelectedConditions] = useState([]);
  const [yearRange, setYearRange] = useState(10);
  const [trendsData, setTrendsData] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [topConditions, setTopConditions] = useState([]);
  const [hba1cTrend, setHba1cTrend] = useState([]);

  useEffect(() => {
    fetchDiseaseTrends();
  }, [conditionType, selectedConditions, yearRange]);

  const fetchDiseaseTrends = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        condition_type: conditionType,
        year_range: yearRange,
        ...(selectedConditions.length && { conditions: selectedConditions.join(',') })
      });
      const response = await fetch(`http://localhost:5000/api/disease_trends?${params}`, { timeout: 10000 });
      if (!response.ok) throw new Error('Failed to fetch disease trends');
      const { trends, heatmap, top_conditions, hba1c_trend } = await response.json();

      localStorage.setItem('diseaseTrends', JSON.stringify({ trends, heatmap, top_conditions, hba1c_trend, timestamp: Date.now() }));
      
      setTrendsData(trends);
      setHeatmapData(processHeatmapData(heatmap));
      setTopConditions(top_conditions);
      setHba1cTrend(hba1c_trend);

      if (!selectedConditions.length && top_conditions.length) {
        setSelectedConditions(top_conditions.slice(0, 2).map(c => c.condition));
      }
    } catch (err) {
      const cached = localStorage.getItem('diseaseTrends');
      if (cached) {
        const { trends, heatmap, top_conditions, hba1c_trend, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 300000) {
          setTrendsData(trends);
          setHeatmapData(processHeatmapData(heatmap));
          setTopConditions(top_conditions);
          setHba1cTrend(hba1c_trend);
          setError('Using cached data due to: ' + err.message);
        } else {
          setError(err.message);
        }
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const processHeatmapData = (data) => {
    const ageGroups = ['0-18', '19-35', '36-50', '51-65', '65+'];
    return ageGroups.map(age => ({
      age_group: age,
      M: data.filter(d => d.age_group === age && d.GENDER === 'M').reduce((sum, d) => sum + d.count, 0),
      F: data.filter(d => d.age_group === age && d.GENDER === 'F').reduce((sum, d) => sum + d.count, 0),
    }));
  };

  const allConditions = [...new Set(topConditions.map(c => c.condition))];
  const trendConditions = selectedConditions.length 
    ? selectedConditions 
    : [...new Set(trendsData.map(d => d.condition))];
  const colors = ['#3B82F6', '#EC4899', '#10B981', '#F59E0B']; // Added more colors for multiple conditions
  const currentYear = new Date().getFullYear();
  const minYear = trendsData.length ? Math.min(...trendsData.map(d => d.year)) : currentYear - yearRange;
  const maxYear = currentYear;

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
          <div className="filter-group">
            <label>Select Conditions (Max 2):</label>
            <select
              multiple
              size="5" // Added visible options
              value={selectedConditions}
              onChange={(e) => {
                const options = Array.from(e.target.selectedOptions)
                  .map(opt => opt.value)
                  .slice(0, 2);
                setSelectedConditions(options);
              }}
              aria-label="Select up to 2 conditions"
            >
              {allConditions.map((cond, idx) => (
                <option key={idx} value={cond}>{cond}</option>
              ))}
            </select>
            <div className="select-hint">Ctrl/Cmd + Click to select multiple (max 2)</div>
          </div>
          <div className="filter-group">
            <label>Year Range:</label>
            <input
              type="number"
              min="1"
              max="50"
              value={yearRange}
              onChange={(e) => setYearRange(Math.min(50, Math.max(1, e.target.value)))}
              aria-label="Set year range (1-50)"
            />
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading disease trends...</div>
        ) : error ? (
          <div className="error">{error} <button onClick={fetchDiseaseTrends}>Retry</button></div>
        ) : (
          <div className="insights-grid">
            <section className="chart-card">
              <h3>Condition Prevalence Over Time</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="year" 
                    domain={[minYear, maxYear]} 
                    label={{ value: 'Year', position: 'insideBottom', offset: -5 }} 
                    type="number"
                  />
                  <YAxis label={{ value: 'Number of Cases', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  {trendConditions.map((cond, idx) => (
                    <Line
                      key={cond}
                      type="monotone"
                      dataKey="count"
                      data={trendsData.filter(d => d.condition === cond)}
                      name={cond}
                      stroke={colors[idx % colors.length]}
                      dot={{ r: 4 }}
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
                  <XAxis dataKey="age_group" label={{ value: 'Age Group', position: 'insideBottom', offset: -5 }} />
                  <YAxis label={{ value: 'Number of Cases', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="M" fill="#3B82F6" name="Male" stackId="a" />
                  <Bar dataKey="F" fill="#EC4899" name="Female" stackId="a" />
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
                    domain={[minYear, maxYear]} 
                    label={{ value: 'Year', position: 'insideBottom', offset: -5 }} 
                    type="number"
                  />
                  <YAxis label={{ value: 'Avg HbA1c (%)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip formatter={(value) => `${value.toFixed(2)}%`} />
                  <Legend />
                  <Line type="monotone" dataKey="avg_hba1c" stroke="#10B981" name="Avg HbA1c" dot={{ r: 4 }} />
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
        )}
      </main>
    </div>
  );
};

export default DiseaseTracking;