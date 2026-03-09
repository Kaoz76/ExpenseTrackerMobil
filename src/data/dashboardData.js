import { FaChartPie, FaChartBar, FaCog } from 'react-icons/fa';

export const dashboardData = {
quickLinks: [
    { id: 1, icon: FaChartPie, title: 'Analyze Expenses', to: '/analyze' },
    { id: 2, icon: FaChartBar, title: 'View Reports', to: '/reports' },
    { id: 3, icon: FaCog, title: 'Settings', to: '/settings' },
  ]
};