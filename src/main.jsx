

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import TermsPage from './Pages/TermsPage.jsx';
import PdpaPage from './Pages/PdpaPage.jsx';
import SignUpPage from './Pages/SignUpPage.jsx';
import './Styles/index.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

ReactDOM.createRoot(document.getElementById('root')).render(
	<React.StrictMode>
		<BrowserRouter>
			<Routes>
				<Route path="/*" element={<App />} />
				<Route path="/terms" element={<TermsPage />} />
				<Route path="/pdpa" element={<PdpaPage />} />
        <Route path="/signup" element={<SignUpPage />} />
			</Routes>
		</BrowserRouter>
	</React.StrictMode>
);