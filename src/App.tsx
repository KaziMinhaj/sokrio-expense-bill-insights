// App root — Phase 3
import { useState } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { Navbar } from './components/Navbar';
import { DataManagerPage } from './pages/DataManagerPage';
import { OverviewPage } from './pages/OverviewPage';
import { DaysWorkedPage } from './pages/DaysWorkedPage';
import { TrendsPage } from './pages/TrendsPage';
import { EntertainmentPage } from './pages/EntertainmentPage';

export default function App() {
  const [page, setPage] = useState('overview');

  const renderPage = () => {
    switch (page) {
      case 'overview':       return <OverviewPage />;
      case 'trends':         return <TrendsPage />;
      case 'days-worked':    return <DaysWorkedPage />;
      case 'entertainment':  return <EntertainmentPage />;
      case 'data-manager':   return <DataManagerPage />;
      default:               return <OverviewPage />;
    }
  };

  return (
    <ThemeProvider>
      <SettingsProvider>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-200">
          <Navbar activePage={page} onNavigate={setPage} />
          <main>{renderPage()}</main>
        </div>
      </SettingsProvider>
    </ThemeProvider>
  );
}
