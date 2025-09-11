import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';

const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Devices = React.lazy(() => import('./pages/Devices'));
const DeviceDetail = React.lazy(() => import('./pages/DeviceDetail'));
const Issues = React.lazy(() => import('./pages/Issues'));
const IssueDetail = React.lazy(() => import('./pages/IssueDetail'));
const Reports = React.lazy(() => import('./pages/Reports'));
const Settings = React.lazy(() => import('./pages/Settings'));

function App() {
  return (
    <Router>
      <div className="App">
        <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen">加载中...</div>}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/devices" element={<Devices />} />
            <Route path="/devices/:id" element={<DeviceDetail />} />
            <Route path="/devices/new" element={<div>新增设备页面</div>} />
            <Route path="/issues" element={<Issues />} />
            <Route path="/issues/:id" element={<IssueDetail />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </React.Suspense>
      </div>
    </Router>
  );
}

export default App;
