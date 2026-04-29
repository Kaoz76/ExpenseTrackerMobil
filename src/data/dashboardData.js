import { FaChartPie, FaChartBar, FaCog, FaBoxOpen, FaStore } from 'react-icons/fa';

export const dashboardData = {
quickLinks: [
    { id: 1, icon: FaChartPie, title: 'Analyze Expenses', to: '/analyze' },
    { id: 2, icon: FaChartBar, title: 'View Reports', to: '/reports' },
    { id: 3, icon: FaCog, title: 'Settings', to: '/settings' },
    { id: 4, icon: FaBoxOpen, title: 'Products', to: '/products' },
    { id: 5, icon: FaStore, title: 'Stores', to: '/stores' },
  ]
};