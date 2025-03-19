import { createRouter, createWebHistory } from 'vue-router'
import ExpenseAnalysis from '../views/ExpenseAnalysis.vue'

// Lazy load components
const DeputyProfile = () => import('../views/DeputyProfile.vue')
const WallsView = () => import('../views/WallsView.vue')

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
      path: '/deputy/:slug',
      component: DeputyProfile,
      props: true,
      name: 'deputy-profile'
    },
    {
      path: '/deputy/:slug/:expenseType',
      component: DeputyProfile,
      props: true,
      name: 'deputy-profile-with-expense-type'
    },
    {
      path: '/walls',
      component: WallsView,
      name: 'walls'
    },
    {
      path: '/walls/:year',
      component: WallsView,
      props: true,
      name: 'walls-with-year'
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