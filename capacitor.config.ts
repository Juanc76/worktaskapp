import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'sed.edu.co.dbeapp',
  appName: 'seddbeapp',
  webDir: 'www',
  "android": {
    "useLegacyBridge": true
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: '#ffffff',
      style: 'DARK'
    }
  }
};

export default config;
