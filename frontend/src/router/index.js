import { createRouter, createWebHistory } from 'vue-router'
import ExpenseAnalysis from '../views/ExpenseAnalysis.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/expenses/deputies'
    },
    {
      path: '/expenses/:view',
      component: ExpenseAnalysis,
      props: true
    },
    {
      path: '/expenses/:view/:expenseType',
      component: ExpenseAnalysis,
      props: true
    },
    // Redirect old paths to new structure
    {
      path: '/expenses/:view/type/:expenseType',  // Handle old URL format if needed
      redirect: to => `/expenses/${to.params.view}/${to.params.expenseType}`
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/expenses/deputies'
    }
  ]
})

export default router 