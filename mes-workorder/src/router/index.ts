import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'workorder',
      component: () => import('../views/WorkOrderView.vue'),
      meta: { tab: 'workorder' },
    },
    {
      path: '/scan',
      name: 'scan',
      component: () => import('../views/ScanQR.vue'),
      meta: { tab: 'scan' },
    },
    {
      path: '/statistics',
      name: 'statistics',
      component: () => import('../views/Statistics.vue'),
      meta: { tab: 'statistics' },
    },
    {
      path: '/equipment',
      name: 'equipment',
      component: () => import('../views/Equipment.vue'),
      meta: { tab: 'equipment' },
    },
    {
      path: '/order-detail/:id',
      name: 'order-detail',
      component: () => import('../views/OrderDetail.vue'),
    },
    {
      path: '/report',
      name: 'report',
      component: () => import('../views/ReportAbnormal.vue'),
    },
  ],
})

export default router
