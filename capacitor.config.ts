import type { CapacitorConfig } from '@capacitor/cli';

// Shell ("remote URL") strategy: the native app loads the already-published web
// app so cookies (sameSite=strict), Socket.IO and updates keep working unchanged,
// while native plugins (GPS, push) are injected on top.
//
// Override the target with CAP_SERVER_URL when pointing at a staging host.
const serverUrl = process.env.CAP_SERVER_URL || 'https://sakani.mase7y.org';

const config: CapacitorConfig = {
  appId: 'org.sakani.app',
  appName: 'Sakani',
  webDir: 'dist',
  server: {
    url: serverUrl,
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#ffffff',
  },
  ios: {
    contentInset: 'always',
  },
};

export default config;
