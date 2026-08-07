import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:5000'

  return {
    plugins: [react()],

    server: {
      port: 5174,
      // Accept requests from any Cloudflare Quick Tunnel subdomain so we can
      // expose this dev server publicly for phone testing without editing
      // config every time cloudflared assigns a new random hostname.
      allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok.io', '.loca.lt'],
      proxy: {
        "/api": {
          target: backendTarget,
          changeOrigin: true,
        },
        "/uploads": {
          target: backendTarget,
          changeOrigin: true,
        }
      },
    }
  }
})
