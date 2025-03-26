import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, 
  PieChart, Pie, Cell, 
  LineChart, Line,
  ResponsiveContainer 
} from 'recharts';
import './ResourceUtilization.css'; // Updated to match file name

const ResourceUtilization = () => {
  const [resources, setResources] = useState(null);
  const [hospitals, setHospitals] = useState(['All']);
  const [hospitalFilter, setHospitalFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/hospitals');
        if (!response.ok) throw new Error('Failed to fetch hospitals');
        const data = await response.json();
        setHospitals(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchHospitals();
  }, []);

  useEffect(() => {
    const fetchResources = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `http://localhost:5000/api/hospital_resources_detailed?hospital=${hospitalFilter}&date=${dateFilter}`
        );
        if (!response.ok) throw new Error('Failed to fetch resource data');
        const data = await response.json();
        setResources(data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchResources();
  }, [hospitalFilter, dateFilter]);

  const bedData = resources ? [
    { name: 'Occupied Beds', value: resources.Total_Beds - resources.Available_Beds },
    { name: 'Available Beds', value: resources.Available_Beds }
  ] : [];

  const visitData = resources ? [
    { name: 'Emergency Visits', value: resources.Emergency_Visits },
    { name: 'Outpatient Visits', value: resources.Outpatient_Visits },
    { name: 'Inpatient (Active)', value: resources.Total_Beds - resources.Available_Beds }
  ] : [];

  const ageData = resources ? Object.entries(resources.Demographics.Age_Distribution).map(([key, value]) => ({
    name: key,
    value
  })) : [];

  const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD'];

  if (loading) return <div className="loading">Loading hospital resources...</div>;
  if (error) return (
    <div className="error-message">
      Error: {error} <button onClick={() => setLoading(true)}>Retry</button>
    </div>
  );

  return (
    <div className="hospital-resource-container">
      <div className="hospital-resource-header">
        <h1>Hospital & Population Health Insights</h1>
      </div>
      <div className="navigation">
        <Link to="/">Dashboard</Link>
        <Link to="/patients">Patients</Link>
        <Link to="/disease-tracking">Disease Trends</Link>
        <Link to="/hospital-resources" className="active">Hospital Resources</Link>
        <Link to="/medications">Medications</Link>
        <Link to="/reports">Reports</Link>
      </div>
      <div className="page-title">
        <h2>Hospital Resource Utilization</h2>
        <p>Monitor bed occupancy, staffing, and patient trends</p>
      </div>
      <div className="filters-section">
        <div className="filter-options">
          <div className="filter-group">
            <label>Hospital:</label>
            <select value={hospitalFilter} onChange={(e) => setHospitalFilter(e.target.value)}>
              {hospitals.map((hospital) => (
                <option key={hospital} value={hospital}>{hospital}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Date:</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>
      </div>
      <div className="charts-section">
        <div className="chart-card">
          <h3>Bed Occupancy</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={bedData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {bedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Visit Types</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={visitData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#4e7cff" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="charts-section">
        <div className="chart-card">
          <h3>Patient Trends (Last 60 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={resources.Trends}>
              <XAxis dataKey="Date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="Patients" stroke="#4e7cff" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>ICU Forecast (Next 7 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={resources.Forecast}>
              <XAxis dataKey="Day" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="PredictedICUPatients" stroke="#FF6B6B" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="charts-section">
        <div className="chart-card">
          <h3>Age Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={ageData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#45B7D1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="staffing-section">
          <h3>Staffing Levels</h3>
          <div className="table-container">
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
                  <td>{resources.Staffing.Doctors}</td>
                  <td>{resources.Staffing.Doctors < 10 ? 'Critical' : resources.Staffing.Doctors < 20 ? 'Shortage' : 'Adequate'}</td>
                </tr>
                <tr>
                  <td>Nurses</td>
                  <td>{resources.Staffing.Nurses}</td>
                  <td>{resources.Staffing.Nurses < 20 ? 'Critical' : resources.Staffing.Nurses < 40 ? 'Shortage' : 'Adequate'}</td>
                </tr>
                <tr>
                  <td>Specialists</td>
                  <td>{resources.Staffing.Specialists}</td>
                  <td>{resources.Staffing.Specialists < 5 ? 'Critical' : resources.Staffing.Specialists < 10 ? 'Shortage' : 'Adequate'}</td>
                </tr>
                <tr>
                  <td>Staff-to-Patient Ratio</td>
                  <td>{resources.Staffing.StaffToPatientRatio.toFixed(2)}</td>
                  <td>{resources.Staffing.StaffToPatientRatio < 0.5 ? 'Critical' : resources.Staffing.StaffToPatientRatio < 1 ? 'Low' : 'Good'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResourceUtilization;