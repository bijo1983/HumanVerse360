import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { Header } from './Header';
import { useAppStore } from '../../store';

export function AdminLayout() {
  const { sidebarOpen } = useAppStore();

  return (
    <div className="min-h-screen bg-secondary-50">
      <AdminSidebar />
      <div className={`transition-all duration-300 ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-16'}`}>
        <Header title="Platform Administration" />
        <main className="pt-16 min-h-screen">
          <div className="p-4 sm:p-6 animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
