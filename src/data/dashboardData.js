import { FaChartPie, FaChartBar, FaCog, FaBoxOpen, FaStore } from 'react-icons/fa';

export const dashboardData = {
  quickLinks: [
    {
      id: 1,
      icon: FaChartPie,
      title: 'Analyze Expenses',
      description: 'View spending by category',
      to: '/analyze',
      color: 'primary' // Bootstrap text-primary veya bg-primary için
    },
    {
      id: 2,
      icon: FaChartBar,
      title: 'View Reports',
      description: 'Monthly & yearly summaries',
      to: '/reports',
      color: 'success'
    },
    {
      id: 3,
      icon: FaBoxOpen,
      title: 'Products',
      description: 'Manage purchased items',
      to: '/products',
      color: 'info'
    },
    {
      id: 4,
      icon: FaStore,
      title: 'Stores',
      description: 'View registered markets',
      to: '/stores',
      color: 'warning'
    },
    {
      id: 5,
      icon: FaCog,
      title: 'Settings',
      description: 'App & profile preferences',
      to: '/settings',
      color: 'secondary'
    },
  ]
};