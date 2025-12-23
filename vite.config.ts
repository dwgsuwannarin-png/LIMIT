import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, '.', '');

  // Retrieve API Key: Try loaded env file first, then fallback to system environment variable
  // This ensures it works even if the key is set in the deployment secrets/shell but not in a .env file
  const apiKey = env.API_KEY || process.env.API_KEY;

  return {
    plugins: [react()],
    // Explicitly define process.env.API_KEY so it acts as a global variable in the browser
    define: {
      'process.env.API_KEY': JSON.stringify(apiKey)
    },
    server: {
      host: true
    }
  }
})