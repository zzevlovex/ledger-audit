/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: './', // relative paths so the build works at any address, e.g. GitHub Pages /ledger-audit/
  plugins: [react(), tailwindcss()],
  test: { environment: 'node' },
})
