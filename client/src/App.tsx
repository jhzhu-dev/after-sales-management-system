import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import PrivateRoute from './components/PrivateRoute';
import DialogHost from './components/DialogHost';

const Login = React.lazy(() => import('./pages/Login'));
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
const BundleDetail = React.lazy(() => import('./pages/BundleDetail'));
const FeishuSettings = React.lazy(() => import('./pages/FeishuSettings'));
const CustomerRequirements = React.lazy(() => import('./pages/CustomerRequirements'));
const CustomerRequirementDetail = React.lazy(() => import('./pages/CustomerRequirementDetail'));
const TestTasks = React.lazy(() => import('./pages/TestTasks'));
const TestTaskDetail = React.lazy(() => import('./pages/TestTaskDetail'));
const OrderImport = React.lazy(() => import('./pages/OrderImport'));
const KnowledgeBasePage = React.lazy(() => import('./pages/KnowledgeBasePage'));

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
      <Router>
        <div className="App">
          <DialogHost />
          <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen">加载中...</div>}>
            <Routes>
              {/* 公开路由 */}
              <Route path="/login" element={<Login />} />

              {/* 受保护路由 */}
              <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/devices" element={<PrivateRoute><Devices /></PrivateRoute>} />
              <Route path="/devices/new" element={<PrivateRoute><Devices /></PrivateRoute>} />
              <Route path="/devices/:id" element={<PrivateRoute><DeviceDetail /></PrivateRoute>} />
              <Route path="/bundles/:id" element={<PrivateRoute><BundleDetail /></PrivateRoute>} />
              <Route path="/issues" element={<PrivateRoute><Issues /></PrivateRoute>} />
              <Route path="/issues/:id" element={<PrivateRoute><IssueDetail /></PrivateRoute>} />
              <Route path="/knowledge" element={<PrivateRoute><KnowledgeBasePage /></PrivateRoute>} />
              <Route path="/releases" element={<PrivateRoute><ReleaseLibrary /></PrivateRoute>} />
              <Route path="/product-lines" element={<PrivateRoute><ProductLines /></PrivateRoute>} />
              <Route path="/products" element={<PrivateRoute><Products /></PrivateRoute>} />
              <Route path="/products/:id" element={<PrivateRoute><ProductDetail /></PrivateRoute>} />
              <Route path="/after-sales" element={<Navigate to="/issues" replace />} />
              <Route path="/upgrades" element={<Navigate to="/issues" replace />} />
              <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
              <Route path="/feishu-settings" element={<PrivateRoute><FeishuSettings /></PrivateRoute>} />
              <Route path="/customer-requirements" element={<PrivateRoute><CustomerRequirements /></PrivateRoute>} />
              <Route path="/customer-requirements/:id" element={<PrivateRoute><CustomerRequirementDetail /></PrivateRoute>} />
              <Route path="/test-tasks" element={<PrivateRoute><TestTasks /></PrivateRoute>} />
              <Route path="/order-import" element={<PrivateRoute><OrderImport /></PrivateRoute>} />
              <Route path="/test-tasks/:id" element={<PrivateRoute><TestTaskDetail /></PrivateRoute>} />
            </Routes>
          </React.Suspense>
        </div>
      </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
