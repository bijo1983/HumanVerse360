import { create } from 'zustand';

export const useAppStore = create((set) => ({
  sidebarOpen: true,
  mobileSidebarOpen: false,

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
}));
