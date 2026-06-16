import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAppStore } from '../../store';

const titles = {
  '/': 'Dashboard',
  '/employees': 'Employees',
  '/leave': 'Leave Management',
  '/documents': 'Documents & Expiry',
  '/payroll': 'Payroll',
  '/indemnity': 'Indemnity & Final Settlement',
  '/settings/calculations': 'Calculation Settings',
  '/settings/general': 'Organization Settings',
  '/settings/database': 'Database Connection',
  '/ess': 'Employee Self Service',
};

export function Layout() {
  const { sidebarOpen } = useAppStore();
  const location = useLocation();

  const pathParts = location.pathname.split('/');
  let title = titles[location.pathname] || titles['/' + pathParts[1]] || 'Humanverse360';

  return (
    <div className="min-h-screen bg-secondary-50">
      <Sidebar />
      <div className={`transition-all duration-300 ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-16'}`}>
        <Header title={title} />
        <main className="pt-16 min-h-screen">
          <div className="p-4 sm:p-6 animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
