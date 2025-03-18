import { createRouter, createWebHistory } from 'vue-router'
import App from '../App.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/expenses/deputies'
    },
    {
      path: '/expenses/:view',
      component: App,
      props: true,
      children: [
        {
          path: 'type/:expenseType',
          component: App,
          props: true
        }
      ]
    },
    // Redirect old paths to new structure
    {
      path: '/:pathMatch(.*)*',
      redirect: '/expenses/deputies'
    }
  ]
})

export default router 