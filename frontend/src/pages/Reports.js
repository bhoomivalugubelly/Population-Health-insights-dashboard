import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Reports.css';

const Reports = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportType, setReportType] = useState('summary');
  const [yearFilter, setYearFilter] = useState('All');
  const [reportData, setReportData] = useState(null);
  const [availableYears, setAvailableYears] = useState([]);

  useEffect(() => {
    fetchAvailableYears();
  }, []);

  const fetchAvailableYears = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/resource_utilization');
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch years: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      setAvailableYears(data.filters?.available_years || []);
    } catch (err) {
      console.error('Fetch years error:', err);
      setError(`Failed to fetch years: ${err.message}`);
      setAvailableYears([]);
    }
  };

  const fetchReport = async (format = 'json') => {
    try {
      setLoading(true);
      setError(null);
      const url = `http://localhost:5000/api/reports?report_type=${reportType}&year=${yearFilter}&format=${format}`;
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch report: ${response.status} - ${errorText}`);
      }

      if (format === 'csv') {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `${reportType}_report_${yearFilter}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
      } else {
        const data = await response.json();
        if (!data.data || (Array.isArray(data.data) && data.data.length === 0)) {
          setReportData(null);
          setError('No data available for the selected report type and year.');
        } else {
          setReportData(data.data);
        }
      }
    } catch (err) {
      console.error('Fetch report error:', err);
      setError(`Failed to fetch report: ${err.message}`);
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = () => fetchReport('json');
  const handleDownloadCSV = () => fetchReport('csv');

  const renderReportContent = () => {
    // If reportData is null or undefined, show the no-data message
    if (!reportData) {
      return <p className="no-data">Select a report type and year, then click "Generate Report".</p>;
    }

    // For summary report, expect reportData to be an object
    if (reportType === 'summary') {
      return (
        <div className="report-table">
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(reportData).map(([key, value]) => (
                <tr key={key}>
                  <td>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</td>
                  <td>
                    {typeof value === 'number' && key.toLowerCase().includes('cost')
                      ? `$${value.toLocaleString()}`
                      : value.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    // For conditions report, expect reportData to be an array
    if (reportType === 'conditions') {
      if (!Array.isArray(reportData)) {
        return <p className="no-data">No conditions data available for the selected year.</p>;
      }
      return (
        <div className="report-table">
          <table>
            <thead>
              <tr>
                <th>Condition</th>
                <th>Patient Count</th>
                <th>Total Cost</th>
                <th>Average HRI</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((row, index) => (
                <tr key={index}>
                  <td>{row.condition || 'N/A'}</td>
                  <td>{row.patientCount ? row.patientCount.toLocaleString() : 'N/A'}</td>
                  <td>${row.totalCost ? row.totalCost.toLocaleString() : '0'}</td>
                  <td>{row.avgHRI ? row.avgHRI.toFixed(1) : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    // For resources report, expect reportData to be an array
    if (reportType === 'resources') {
      if (!Array.isArray(reportData)) {
        return <p className="no-data">No resource data available for the selected year.</p>;
      }
      return (
        <div className="report-table">
          <table>
            <thead>
              <tr>
                <th>Year</th>
                <th>Encounters</th>
                <th>Total Cost</th>
                <th>Average Cost Per Encounter</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((row, index) => (
                <tr key={index}>
                  <td>{row.year || 'N/A'}</td>
                  <td>{row.encounters ? row.encounters.toLocaleString() : '0'}</td>
                  <td>${row.totalCost ? row.totalCost.toLocaleString() : '0'}</td>
                  <td>${row.avgCostPerEncounter || row.avgCostPerEncounter === 0 ? row.avgCostPerEncounter.toLocaleString() : '0'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return null; // Fallback in case none of the conditions match
  };

  return (
    <div className="reports-page">
      <header className="header">
        <h1>Population Health Insights</h1>
      </header>
      <nav className="navbar">
        <Link to="/">Dashboard</Link>
        <Link to="/patients">Patients</Link>
        <Link to="/disease-trends">Disease Trends</Link>
        <Link to="/resource-utilization">Resource Utilization</Link>
        <Link to="/reports" className="active">Reports</Link>
      </nav>
      <main className="main-content">
        <section className="page-header">
          <h2>Reports</h2>
          <p>Generate and download summaries and detailed analyses for stakeholders.</p>
        </section>

        <div className="report-controls">
          <div className="control-group">
            <label htmlFor="report-type">Report Type:</label>
            <select id="report-type" value={reportType} onChange={(e) => setReportType(e.target.value)}>
              <option value="summary">Summary Report</option>
              <option value="conditions">Top Conditions Report</option>
              <option value="resources">Resource Utilization Report</option>
            </select>
          </div>
          <div className="control-group">
            <label htmlFor="year-filter">Year:</label>
            <select id="year-filter" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
              <option value="All">All Years</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <button onClick={handleGenerateReport} disabled={loading}>
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
          <button onClick={handleDownloadCSV} disabled={loading || !reportData}>
            Download CSV
          </button>
        </div>

        {loading && <div className="loading">Generating report...</div>}
        {error && (
          <div className="error">
            {error} <button onClick={() => fetchReport('json')}>Retry</button>
          </div>
        )}
        {!loading && !error && (
          <section className="report-content">
            {renderReportContent()}
          </section>
        )}
      </main>
    </div>
  );
};

export default Reports;