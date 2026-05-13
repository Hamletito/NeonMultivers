import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.6cab5cea7cad4983885e531eb2c20f22',
  appName: 'NeonMultiverse',
  webDir: 'dist',
  // Force landscape orientation across the app, on every launch.
  orientation: 'landscape',
  server: {
    url: 'https://6cab5cea-7cad-4983-885e-531eb2c20f22.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
