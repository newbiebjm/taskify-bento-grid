import { createApp } from 'vue'
import './main.css'
import App from './App.vue'
import { autoAnimatePlugin } from '@formkit/auto-animate/vue'

createApp(App)
  .use(autoAnimatePlugin)
  .mount('#app')
