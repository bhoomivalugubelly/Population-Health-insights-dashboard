import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './DiseaseTracking.css';

const DiseaseTracking = () => {
  const [diseaseData, setDiseaseData] = useState([]);
  const [filters, setFilters] = useState({
    disease: 'All',
    location: 'All',
    timeRange: 'month', // Options: 'week', 'month', 'year'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [alert, setAlert] = useState(null);

  // Fetch disease trends
  useEffect(() => {
    const fetchDiseaseData = async () => {
      try {
        setLoading(true);
        const queryParams = new URLSearchParams({
          disease: filters.disease,
          location: filters.location,
          timeRange: filters.timeRange,
        }).toString();

        const response = await fetch(`http://localhost:5000/api/disease_trends_detailed?${queryParams}`);
        if (!response.ok) throw new Error('Failed to fetch disease trends');
        const data = await response.json();
        setDiseaseData(data.trends);

        // Check for alerts (threshold: 100 cases on any day)
        const alertCondition = data.trends.find(d => d.cases > 100);
        if (alertCondition) {
          setAlert(`Alert: High case count detected (${alertCondition.cases} cases on ${alertCondition.date})`);
        } else {
          setAlert(null);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDiseaseData();
  }, [filters]);

  // Filter handlers
  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  // Line chart data
  const lineChartData = diseaseData.map(d => ({
    date: d.date,
    cases: d.cases,
  }));

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error} <button onClick={() => window.location.reload()}>Retry</button></div>;

  return (
    <div className="disease-tracking-container">
      <h1>Disease Tracking & Trends</h1>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <label htmlFor="disease-filter">Disease: </label>
          <select
            id="disease-filter"
            value={filters.disease}
            onChange={(e) => handleFilterChange('disease', e.target.value)}
          >
            <option value="All">All</option>
            <option value="COVID-19">COVID-19</option>
            <option value="Diabetes">Diabetes</option>
            <option value="Cardiovascular">Cardiovascular</option>
            <option value="Influenza">Influenza</option>
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="location-filter">Location: </label>
          <select
            id="location-filter"
            value={filters.location}
            onChange={(e) => handleFilterChange('location', e.target.value)}
          >
            <option value="All">All</option>
            <option value="MA">Massachusetts</option>
            <option value="NY">New York</option>
            <option value="CA">California</option>
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="time-range">Time Range: </label>
          <select
            id="time-range"
            value={filters.timeRange}
            onChange={(e) => handleFilterChange('timeRange', e.target.value)}
          >
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="year">Last Year</option>
          </select>
        </div>
      </div>

      {/* Alert Notification */}
      {alert && <div className="alert-notification">{alert}</div>}

      {/* Line Chart */}
      <div className="chart-section">
        <h2>Disease Prevalence Over Time</h2>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={lineChartData}>
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="cases" stroke="#8884d8" name="Cases" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DiseaseTracking;