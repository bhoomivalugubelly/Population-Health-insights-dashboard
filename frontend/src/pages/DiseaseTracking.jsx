import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './DiseaseTracking.css';

// Fix Leaflet marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const DiseaseTracking = () => {
  const [diseaseData, setDiseaseData] = useState([]);
  const [mapData, setMapData] = useState([]);
  const [topDiseases, setTopDiseases] = useState([]);
  const [diseaseOptions, setDiseaseOptions] = useState([]); // Will be set dynamically
  const [filters, setFilters] = useState({ disease: 'All', location: 'All', timeRange: 'month' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [alert, setAlert] = useState(null);
  const [showHotspots, setShowHotspots] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams(filters).toString();

        // Fetch trends and disease options
        const trendsResponse = await fetch(`http://localhost:5000/api/disease_trends_detailed?${params}`);
        if (!trendsResponse.ok) throw new Error('Failed to fetch disease trends');
        const trendsJson = await trendsResponse.json();
        const formattedData = trendsJson.data.trends.map(item => ({
          date: new Date(item.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
          cases: item.cases,
          location: item.location,
          disease: filters.disease === 'All' ? 'All Conditions' : filters.disease,
          lat: item.lat || 42.3601, // Fallback coordinates
          lon: item.lon || -71.0589,
        }));
        setDiseaseData(formattedData);
        setMapData(formattedData);
        setDiseaseOptions(trendsJson.data.diseases || []); // Set dynamic disease options

        // Fetch top diseases
        const topResponse = await fetch(`http://localhost:5000/api/top_diseases?${params}`);
        if (!topResponse.ok) throw new Error('Failed to fetch top diseases');
        const topJson = await topResponse.json();
        setTopDiseases(topJson.data);

        // Set alert
        const alertCondition = formattedData.find(d => d.cases > 10);
        setAlert(alertCondition ? `Alert: High case count (${alertCondition.cases} cases on ${alertCondition.date} in ${alertCondition.location})` : null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [filters]);

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  const HotspotLayer = ({ data }) => {
    const map = useMap();
    useEffect(() => {
      if (showHotspots) {
        data.forEach(item => {
          if (item.lat && item.lon && item.cases > 10) {
            const marker = L.circleMarker([item.lat, item.lon], {
              radius: Math.min(item.cases / 2, 20),
              color: '#ff0000',
              fillOpacity: 0.5,
            }).addTo(map);
            marker.bindPopup(`${item.location}: ${item.cases} cases on ${item.date}`);
            return () => map.removeLayer(marker);
          }
        });
      }
    }, [data, map]);
    return null;
  };

  if (loading) return <div className="loading">Loading disease trends...</div>;
  if (error) return <div className="error-message">Error: {error} <button onClick={() => window.location.reload()}>Retry</button></div>;

  return (
    <div className="disease-tracking-container">
      <div className="disease-tracking-header">
        <h1>Hospital & Population Health Insights</h1>
      </div>

      <div className="navigation">
        <Link to="/">Dashboard</Link>
        <Link to="/patients">Patients</Link>
        <Link to="/disease-tracking" className="active">Disease Trends</Link>
        <Link to="/hospital-resources">Hospital Resources</Link>
        <Link to="/reports">Reports</Link>
      </div>

      <div className="page-title">
        <h2>Disease Tracking & Trends</h2>
        <p>Monitor outbreaks and trends of chronic & infectious diseases</p>
      </div>

      <div className="filters-section">
        <div className="filter-options">
          <div className="filter-group">
            <label>Condition:</label>
            <select value={filters.disease} onChange={(e) => handleFilterChange('disease', e.target.value)}>
              <option value="All">All Conditions</option>
              {diseaseOptions.map(disease => (
                <option key={disease} value={disease}>{disease}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Location:</label>
            <select value={filters.location} onChange={(e) => handleFilterChange('location', e.target.value)}>
              <option value="All">All Locations</option>
              <option value="MA">Massachusetts</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Time Range:</label>
            <select value={filters.timeRange} onChange={(e) => handleFilterChange('timeRange', e.target.value)}>
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="year">Last Year</option>
            </select>
          </div>
        </div>
      </div>

      {alert && <div className="alert-notification">{alert}</div>}

      <div className="chart-section">
        <h3>Disease Prevalence Over Time</h3>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={diseaseData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" label={{ value: 'Date', position: 'insideBottom', offset: -5 }} />
            <YAxis label={{ value: 'Number of Cases', angle: -90, position: 'insideLeft' }} />
            <Tooltip formatter={(value, name, props) => [`${value} cases`, `${props.payload.disease} in ${props.payload.location}`]} />
            <Legend />
            <Line type="monotone" dataKey="cases" stroke="#4e7cff" name={filters.disease === 'All' ? 'All Conditions' : filters.disease} dot={{ r: 4 }} activeDot={{ r: 8 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="top-diseases-section">
        <h3>Top 5 Diseases (Current vs. Previous Period)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={topDiseases}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="currentYear" fill="#4e7cff" name="Current Period" />
            <Bar dataKey="lastYear" fill="#82ca9d" name="Previous Period" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="map-section">
        <h3>Disease Hotspot Map</h3>
        <div className="hotspot-toggle">
          <label>
            <input type="checkbox" checked={showHotspots} onChange={() => setShowHotspots(!showHotspots)} />
            Show Hotspot Alerts ({'>'}10 cases)
          </label>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <MapContainer center={[42.3601, -71.0589]} zoom={8} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
            {mapData.map((item, index) => (
              <Marker key={index} position={[item.lat, item.lon]}>
                <Popup>{item.location}: {item.cases} cases on {item.date}</Popup>
              </Marker>
            ))}
            {showHotspots && <HotspotLayer data={mapData} />}
          </MapContainer>
        </ResponsiveContainer>
      </div>

      <div className="summary-section">
        <h3>Summary</h3>
        <div className="summary-stats">
          <div>Total Cases: <span>{diseaseData.reduce((sum, item) => sum + item.cases, 0)}</span></div>
          <div>Peak Day: <span>{diseaseData.reduce((max, item) => item.cases > max.cases ? item : max, diseaseData[0] || {}).date || 'N/A'}</span></div>
          <div>Average Daily Cases: <span>{(diseaseData.reduce((sum, item) => sum + item.cases, 0) / (diseaseData.length || 1)).toFixed(1)}</span></div>
        </div>
      </div>
    </div>
  );
};

export default DiseaseTracking;