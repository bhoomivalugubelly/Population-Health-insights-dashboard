import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import './ResourceUtilization.css';

const COLORS = [
  '#3B82F6', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6',
  '#EF4444', '#14B8A6', '#F97316', '#6B7280', '#A855F7',
];

const ResourceUtilization = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [yearFilter, setYearFilter] = useState('All');
  const [encounterClassFilter, setEncounterClassFilter] = useState('All');
  const [data, setData] = useState({});

  useEffect(() => {
    fetchResourceData();
  }, [yearFilter, encounterClassFilter]);

  const fetchResourceData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/resource_utilization?year=${yearFilter}&encounterClass=${encounterClassFilter}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch resource utilization data: ${errorText}`);
      }
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

  const formatLargeNumber = (value) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString();
  };

  const renderTopOrganizations = () => (
    <section className="chart-card top-orgs-chart">
      <h3>Top Organizations by Encounter Volume</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data.top_organizations}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="ORG_SHORT"
            angle={-45}
            textAnchor="end"
            height={60}
            label={{ value: 'Organization', position: 'insideBottom', offset: -10 }}
          />
          <YAxis
            yAxisId="left"
            label={{ value: 'Encounters', angle: -90, position: 'insideLeft' }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={formatLargeNumber}
            label={{ value: 'Total Cost ($)', angle: 90, position: 'insideRight' }}
          />
          <Tooltip
            formatter={(value, name) => {
              console.log('Tooltip name (Top Orgs):', name); // Debug to see what name is passed
              if (name === 'Encounters') return [value.toLocaleString(), 'Encounters'];
              if (name === 'Total Cost') return [formatCurrency(value), 'Total Cost'];
              return [value, name]; // Fallback for debugging
            }}
          />
          <Legend />
          <Bar yAxisId="left" dataKey="count" fill="#3B82F6" name="Encounters" />
          <Bar yAxisId="right" dataKey="TOTAL_CLAIM_COST" fill="#EC4899" name="Total Cost" />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );

  const renderEncounterTypes = () => (
    <section className="chart-card pie-chart">
      <h3>Encounter Types Distribution</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data.encounter_types}
            dataKey="count"
            nameKey="class"
            cx="50%"
            cy="50%"
            outerRadius={70} // Reduced further for clarity
            label={({ name, percent }) => percent * 100 >= 1 ? `${name}: ${(percent * 100).toFixed(0)}%` : ''} // Show labels only for slices >= 1%
            labelLine={{ length: 20, length2: 10 }} // Longer label lines
          >
            {data.encounter_types?.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => [value.toLocaleString(), 'Encounters']} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </section>
  );

  const renderTopMedications = () => (
    <section className="list-card">
      <h3>Top Medications by Usage</h3>
      <div className="table-container">
        <table className="medications-table">
          <thead>
            <tr>
              <th>Medication</th>
              <th>Dispenses</th>
              <th>Total Cost</th>
              <th>Patients</th>
              <th>Avg Cost/Dispense</th>
            </tr>
          </thead>
          <tbody>
            {data.top_medications?.map((med, idx) => (
              <tr key={idx}>
                <td>{med.medication.length > 30 ? `${med.medication.substring(0, 30)}...` : med.medication}</td>
                <td>{med.dispenses.toLocaleString()}</td>
                <td>{formatCurrency(med.total_cost)}</td>
                <td>{med.patients_count.toLocaleString()}</td>
                <td>{formatCurrency(med.avg_cost_per_dispense)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderTrends = () => (
    <section className="chart-card trends-chart">
      <h3>Resource Utilization Trends</h3>
      <ResponsiveContainer width="100%" height={450}>
        <LineChart data={data.monthly_trends}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis
            dataKey="month"
            tickCount={8}
            angle={-45}
            textAnchor="end"
            height={70}
            label={{ value: 'Month', position: 'insideBottom', offset: -10 }}
          />
          <YAxis
            yAxisId="left"
            label={{ value: 'Encounters', angle: -90, position: 'insideLeft' }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={formatLargeNumber}
            label={{ value: 'Cost ($)', angle: 90, position: 'insideRight' }}
          />
          <Tooltip
            formatter={(value, name) => {
              console.log('Tooltip name:', name); // Debug to see what name is passed
              if (name === 'Encounters') return [value.toLocaleString(), 'Encounters'];
              if (name === 'Total Cost') return [formatCurrency(value), 'Total Cost'];
              if (name === 'Avg Cost/Encounter') return [formatCurrency(value), 'Avg Cost/Encounter'];
              return [value, name]; // Fallback for debugging
            }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="encounters"
            stroke="#FF6B6B"
            strokeWidth={3}
            name="Encounters"
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="total_cost"
            stroke="#1A936F"
            strokeWidth={3}
            strokeDasharray="5 5"
            name="Total Cost"
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="cost_per_encounter"
            stroke="#F48C06"
            strokeWidth={3}
            strokeDasharray="3 3"
            name="Avg Cost/Encounter"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
  const renderMetrics = () => (
    <section className="metrics-card">
      <h3>Resource Metrics</h3>
      <div className="metrics-grid">
        <div className="metric">
          <p>Total Encounters</p>
          <span>{data.resource_metrics?.total_encounters.toLocaleString()}</span>
        </div>
        <div className="metric">
          <p>Total Claims Cost</p>
          <span>{formatCurrency(data.resource_metrics?.total_claims_cost)}</span>
        </div>
        <div className="metric">
          <p>Avg Cost/Encounter</p>
          <span>{formatCurrency(data.resource_metrics?.avg_cost_per_encounter)}</span>
        </div>
        <div className="metric">
          <p>Payer Coverage</p>
          <span>{data.resource_metrics?.payer_coverage_percentage}%</span>
        </div>
      </div>
    </section>
  );

  return (
    <div className="resource-utilization-container">
      <header className="header">
        <h1>Population Health Insights</h1>
      </header>
      <nav className="navbar">
        <Link to="/">Dashboard</Link>
        <Link to="/patients">Patients</Link>
        <Link to="/disease-trends">Disease Trends</Link>
        <Link to="/resource-utilization" className="active">Hospital Resources</Link>
        <Link to="/reports">Reports</Link>
      </nav>
      <main className="main-content">
        <section className="page-header">
          <h2>Resource Utilization</h2>
        </section>

        <div className="filters">
          <div className="filter-group">
            <label>Year:</label>
            <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
              <option value="All">All Years</option>
              {data.filters?.available_years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Encounter Class:</label>
            <select value={encounterClassFilter} onChange={(e) => setEncounterClassFilter(e.target.value)}>
              <option value="All">All Classes</option>
              {data.filters?.encounter_classes.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading resource utilization...</div>
        ) : error ? (
          <div className="error">{error} <button onClick={fetchResourceData}>Retry</button></div>
        ) : (
          <div className="insights-grid">
            {renderTopOrganizations()}
            {renderEncounterTypes()}
            {renderTopMedications()}
            {renderTrends()}
            {renderMetrics()}
          </div>
        )}
      </main>
    </div>
  );
};

export default ResourceUtilization;