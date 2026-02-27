import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Devices = React.lazy(() => import('./pages/Devices'));
const DeviceDetail = React.lazy(() => import('./pages/DeviceDetail'));
const Issues = React.lazy(() => import('./pages/Issues'));
const IssueDetail = React.lazy(() => import('./pages/IssueDetail'));
const Settings = React.lazy(() => import('./pages/Settings'));
const ReleaseLibrary = React.lazy(() => import('./pages/ReleaseLibrary'));
const ProductLines = React.lazy(() => import('./pages/ProductLines'));
const ProductDetail = React.lazy(() => import('./pages/ProductDetail'));
const Products = React.lazy(() => import('./pages/Products'));

function App() {
  return (
    <Router>
      <div className="App">
        <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen">加载中...</div>}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/devices" element={<Devices />} />
            <Route path="/devices/new" element={<Devices />} />
            <Route path="/devices/:id" element={<DeviceDetail />} />
            <Route path="/issues" element={<Issues />} />
            <Route path="/issues/:id" element={<IssueDetail />} />
            <Route path="/releases" element={<ReleaseLibrary />} />
            <Route path="/product-lines" element={<ProductLines />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/:id" element={<ProductDetail />} />
            <Route path="/after-sales" element={<Navigate to="/issues" replace />} />
            <Route path="/upgrades" element={<Navigate to="/issues" replace />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </React.Suspense>
      </div>
    </Router>
  );
}

export default App;
