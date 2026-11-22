import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Android app shell. It opens the live site, so every deploy reaches the phone without reinstalling.
 * School data needs the internet anyway (Supabase); offline.html is shown when there is no connection.
 */
const config: CapacitorConfig = {
  appId: 'in.tmhnu.schools',
  appName: 'TMHNU Schools',
  webDir: 'dist',
  server: {
    url: 'https://vigneshls.github.io/tmhnu-academic-planning/',
    errorPath: 'offline.html',
  },
  android: { backgroundColor: '#0f2744' },
}

export default config
