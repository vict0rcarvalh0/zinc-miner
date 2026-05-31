// Polyfills MUST be imported before anything that touches Buffer / crypto.
import './src/polyfills';

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
