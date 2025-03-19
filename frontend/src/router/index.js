import { createRouter, createWebHistory } from 'vue-router'
import ExpenseAnalysis from '../views/ExpenseAnalysis.vue'

// Lazy load DeputyProfile component
const DeputyProfile = () => import('../views/DeputyProfile.vue')

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
    {
      path: '/deputy/:id',
      component: DeputyProfile,
      props: true,
      name: 'deputy-profile'
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