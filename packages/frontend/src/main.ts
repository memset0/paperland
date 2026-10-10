import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router/index'
import { registerServiceWorker } from './composables/usePwaInstall'
import './assets/main.css'
import 'vue-sonner/style.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
registerServiceWorker()
