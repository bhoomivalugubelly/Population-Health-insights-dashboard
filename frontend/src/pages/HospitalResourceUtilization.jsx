import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import './HospitalResourceUtilization.css';

const HospitalResourceUtilization = () => {
  const [resources, setResources] = useState(null);
  const [hospitals, setHospitals] = useState(['All']); // Default to 'All'
  const [hospitalFilter, setHospitalFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('2025-03-17'); // Default to current date
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch hospital list
  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/hospitals');
        if (!response.ok) throw new Error('Failed to fetch hospitals');
        const data = await response.json();
        setHospitals(['All', ...data]);
      } catch (err) {
        setError(err.message);
      }
    };
    fetchHospitals();
  }, []);

  // Fetch hospital resource data
  useEffect(() => {
    const fetchResources = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/hospital_resources_detailed?hospital=${hospitalFilter}&date=${dateFilter}`
        );
        if (!response.ok) throw new Error('Failed to fetch resource data');
        const data = await response.json();
        setResources(data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };
    fetchResources();
  }, [hospitalFilter, dateFilter]);

  // Prepare data for Donut Chart (ICU Bed Occupancy)
  const donutData = resources
    ? [
        { name: 'Occupied', value: resources.ICU_Beds_Occupied },
        { name: 'Available', value: resources.Available_Beds },
      ]
    : [];

  // Prepare data for Bar Chart (Bed Availability)
  const barData = resources
    ? [
        { name: 'ICU Beds Occupied', value: resources.ICU_Beds_Occupied },
        { name: 'Available Beds', value: resources.Available_Beds },
        { name: 'Emergency Visits', value: resources.Emergency_Visits },
        { name: 'Outpatient Visits', value: resources.Outpatient_Visits },
      ]
    : [];

  // Staffing table data
  const staffingData = resources?.Staffing || {};

  // Colors for Donut Chart
  const COLORS = ['#FF6B6B', '#4ECDC4'];

  // Handle filter changes
  const handleHospitalFilterChange = (e) => {
    setHospitalFilter(e.target.value);
    setLoading(true);
  };

  const handleDateFilterChange = (e) => {
    setDateFilter(e.target.value);
    setLoading(true);
  };

  if (loading) return <div>Loading...</div>;
  if (error) return (
    <div>
      Error: {error}
      <button onClick={() => { setLoading(true); setError(null); }}>Retry</button>
    </div>
  );

  return (
    <div className="hospital-resource-container">
      <h1>Hospital Resource Utilization</h1>

      {/* Filter Section */}
      <div className="filter-section">
        <label htmlFor="hospital-filter">Filter by Hospital: </label>
        <select id="hospital-filter" value={hospitalFilter} onChange={handleHospitalFilterChange}>
          {hospitals.map((hospital) => (
            <option key={hospital} value={hospital}>{hospital}</option>
          ))}
        </select>
        <label htmlFor="date-filter" style={{ marginLeft: '20px' }}>Filter by Date: </label>
        <input
          type="date"
          id="date-filter"
          value={dateFilter}
          onChange={handleDateFilterChange}
        />
      </div>

      {/* ICU & Bed Availability Tracker */}
      <div className="charts-section">
        <div className="chart-container">
          <h2>ICU & Bed Occupancy</h2>
          <PieChart width={400} height={300}>
            <Pie
              data={donutData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              fill="#8884d8"
              paddingAngle={5}
              dataKey="value"
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            >
              {donutData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </div>

        <div className="chart-container">
          <h2>Resource Comparison</h2>
          <BarChart width={500} height={300} data={barData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#4e7cff" />
          </BarChart>
        </div>
      </div>

      {/* Staffing Levels */}
      <div className="staffing-section">
        <h2>Staffing Levels</h2>
        <table className="staffing-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Count</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Doctors</td>
              <td>{staffingData.Doctors}</td>
              <td>{staffingData.Doctors < 20 ? 'Shortage' : 'Adequate'}</td>
            </tr>
            <tr>
              <td>Nurses</td>
              <td>{staffingData.Nurses}</td>
              <td>{staffingData.Nurses < 40 ? 'Shortage' : 'Adequate'}</td>
            </tr>
            <tr>
              <td>Specialists</td>
              <td>{staffingData.Specialists}</td>
              <td>{staffingData.Specialists < 10 ? 'Shortage' : 'Adequate'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HospitalResourceUtilization;