import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({base:process.env.BASE_PATH || '/',plugins:[react()],define:{'process.env.NODE_ENV':JSON.stringify(process.env.NODE_ENV||'production')}});
