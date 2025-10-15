import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

function TestApp() {
  return (
    <Router>
      <div style={{ padding: '20px' }}>
        <nav style={{ marginBottom: '20px' }}>
          <a href="/" style={{ marginRight: '10px' }}>Home</a>
          <a href="/test" style={{ marginRight: '10px' }}>Test</a>
          <a href="/simple" style={{ marginRight: '10px' }}>Simple</a>
        </nav>
        
        <Routes>
          <Route 
            path="/" 
            element={
              <div style={{ padding: '20px', backgroundColor: 'lightgreen' }}>
                <h1>HOME ROUTE</h1>
                <p>This is the home page</p>
              </div>
            } 
          />
          <Route 
            path="/test" 
            element={
              <div style={{ padding: '20px', backgroundColor: 'lightblue' }}>
                <h1>TEST ROUTE WORKS!</h1>
                <p>This is the test page</p>
              </div>
            } 
          />
          <Route 
            path="/simple" 
            element={
              <div style={{ padding: '20px', backgroundColor: 'lightyellow' }}>
                <h1>SIMPLE ROUTE WORKS!</h1>
                <p>This is the simple page</p>
              </div>
            } 
          />
          <Route 
            path="*" 
            element={
              <div style={{ padding: '20px', backgroundColor: 'lightcoral' }}>
                <h1>404 - Page Not Found</h1>
                <p>The requested route does not exist</p>
                <p>Current path: {window.location.pathname}</p>
              </div>
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default TestApp;