import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import './Patients.css';

function Patients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    gender: 'All',
    race: 'All',
    ageGroup: 'All'
  });
  const [demographics, setDemographics] = useState({
    gender: [],
    race: [],
    age: []
  });

  // Fetch patients data
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        setLoading(true);
        // Updated URL to include all filters
        const queryParams = new URLSearchParams({
          gender: filters.gender !== 'All' ? filters.gender : '',
          age: filters.ageGroup !== 'All' ? filters.ageGroup : ''
        }).toString();

        const response = await fetch(`http://localhost:5000/api/patients?${queryParams}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setPatients(data);
        processChartData(data);
      } catch (err) {
        setError(`Failed to fetch patients: ${err.message}`);
        console.error('Error fetching patients:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPatients();
  }, [filters.gender, filters.ageGroup]); // Added ageGroup to dependency array

  // Process data for charts
  const processChartData = (data) => {
    // Gender distribution
    const genderCounts = data.reduce((acc, patient) => {
      const gender = patient.GENDER || 'Unknown';
      acc[gender] = (acc[gender] || 0) + 1;
      return acc;
    }, {});

    const genderData = Object.keys(genderCounts).map(key => ({
      name: key === 'M' ? 'Male' : key === 'F' ? 'Female' : key,
      value: genderCounts[key]
    }));

    // Race distribution
    const raceCounts = data.reduce((acc, patient) => {
      const race = patient.RACE || 'Unknown';
      acc[race] = (acc[race] || 0) + 1;
      return acc;
    }, {});

    const raceData = Object.keys(raceCounts).map(key => ({
      name: key,
      value: raceCounts[key]
    }));

    // Age distribution
    const ageCounts = {
      '0-18': 0,
      '19-35': 0,
      '36-50': 0,
      '51-65': 0,
      '65+': 0
    };

    data.forEach(patient => {
      if (!patient.BIRTHDATE) return;
      
      const birthDate = new Date(patient.BIRTHDATE);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      if (age <= 18) ageCounts['0-18']++;
      else if (age <= 35) ageCounts['19-35']++;
      else if (age <= 50) ageCounts['36-50']++;
      else if (age <= 65) ageCounts['51-65']++;
      else ageCounts['65+']++;
    });

    const ageData = Object.keys(ageCounts).map(key => ({
      name: key,
      value: ageCounts[key]
    }));

    setDemographics({
      gender: genderData,
      race: raceData,
      age: ageData
    });
  };

  // Handle filter changes
  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  // Handle search input change
  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  // Filter patients based on search term and filters
  const filteredPatients = patients.filter(patient => {
    const searchLower = searchTerm.toLowerCase();
    const fullName = `${patient.FIRST || ''} ${patient.LAST || ''}`.toLowerCase();
    
    // Apply race filter
    const matchesRace = filters.race === 'All' || patient.RACE === filters.race;
    
    // Apply age filter (client-side since backend doesn't fully support it yet)
    let matchesAge = true;
    if (filters.ageGroup !== 'All' && patient.BIRTHDATE) {
      const birthDate = new Date(patient.BIRTHDATE);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      const [min, max] = filters.ageGroup.split('-').map(Number);
      matchesAge = (!max && age >= min) || (age >= min && age <= max);
    }

    return (fullName.includes(searchLower) || 
           (patient.SSN && patient.SSN.includes(searchTerm))) &&
           matchesRace &&
           matchesAge;
  });

  // Chart colors
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  return (
    <div className="patients-container">
      {/* Header */}
      <div className="patients-header">
        <h1>Hospital & Population Health Insights</h1>
      </div>
      
      {/* Navigation */}
      <div className="navigation">
        <Link to="/">Dashboard</Link>
        <Link to="/patients" className="active">Patients</Link>
        <Link to="/disease-trends">Disease Trends</Link>
        <Link to="/resources">Hospital Resources</Link>
        <Link to="/medications">Medications</Link>
        <Link to="/reports">Reports</Link>
      </div>
      
      {/* Page title */}
      <div className="page-title">
        <h2>Patient Registry</h2>
        <p>View and manage patient records and demographics</p>
      </div>
      
      {/* Search and filter section */}
      <div className="search-filter-container">
        <div className="search-box">
          <input 
            type="text" 
            placeholder="Search patients by name or SSN..." 
            value={searchTerm}
            onChange={handleSearchChange}
          />
          <button className="search-button">Search</button>
        </div>
        
        <div className="filter-options">
          <div className="filter-group">
            <label>Gender:</label>
            <select 
              value={filters.gender} 
              onChange={(e) => handleFilterChange('gender', e.target.value)}
            >
              <option value="All">All</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Race:</label>
            <select 
              value={filters.race} 
              onChange={(e) => handleFilterChange('race', e.target.value)}
            >
              <option value="All">All</option>
              <option value="white">White</option>
              <option value="black">Black</option>
              <option value="asian">Asian</option>
              <option value="hispanic">Hispanic</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Age Group:</label>
            <select 
              value={filters.ageGroup} 
              onChange={(e) => handleFilterChange('ageGroup', e.target.value)}
            >
              <option value="All">All</option>
              <option value="0-18">0-18</option>
              <option value="19-35">19-35</option>
              <option value="36-50">36-50</option>
              <option value="51-65">51-65</option>
              <option value="65+">65+</option>
            </select>
          </div>
        </div>
      </div>

      {/* Demographics charts */}
      <div className="demographics-section">
        <h3>Patient Demographics</h3>
        <div className="charts-container">
          <div className="chart-card">
            <h4>Gender Distribution</h4>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={demographics.gender}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {demographics.gender.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="chart-card">
            <h4>Age Distribution</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={demographics.age}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#4e7cff" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="chart-card">
            <h4>Race Distribution</h4>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={demographics.race}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {demographics.race.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* Patient list */}
      <div className="patient-list-section">
        <h3>Patient List</h3>
        <div className="patient-count">
          Total patients: <span>{filteredPatients.length}</span>
        </div>
        
        {loading ? (
          <div className="loading">Loading patient data...</div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : (
          <div className="table-container">
            <table className="patient-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Gender</th>
                  <th>Birth Date</th>
                  <th>Race</th>
                  <th>Address</th>
                  <th>Healthcare Expenses</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.length === 0 ? (
                  <tr><td colSpan="7" className="no-data">No patients found.</td></tr>
                ) : (
                  filteredPatients.map((patient, index) => (
                    <tr key={patient.Id || index}>
                      <td>{`${patient.FIRST || ''} ${patient.LAST || ''}`}</td>
                      <td>{patient.GENDER === 'M' ? 'Male' : patient.GENDER === 'F' ? 'Female' : patient.GENDER || 'N/A'}</td>
                      <td>{patient.BIRTHDATE || 'N/A'}</td>
                      <td>{patient.RACE || 'N/A'}</td>
                      <td>{`${patient.ADDRESS || ''}, ${patient.CITY || ''}, ${patient.STATE || ''}`}</td>
                      <td>${patient.HEALTHCARE_EXPENSES ? Number(patient.HEALTHCARE_EXPENSES).toLocaleString() : 'N/A'}</td>
                      <td>
                        <button className="view-button">View</button>
                        <button className="edit-button">Edit</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Patients;