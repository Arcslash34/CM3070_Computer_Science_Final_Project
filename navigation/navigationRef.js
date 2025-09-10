/**
 * navigation/navigationRef.js — Global navigation reference
 *
 * Purpose
 * - Allow navigation actions to be dispatched outside of React components
 *   (e.g., from utilities, services, or event listeners).
 *
 * Key Behaviours
 * - Exports a singleton `navigationRef` created by `createNavigationContainerRef()`.
 * - Provides a safe `navigate(name, params)` wrapper:
 *   • Checks `.isReady()` before attempting to navigate.
 *   • Prevents errors when navigation tree is not yet mounted.
 *
 * Usage
 * - Import { navigationRef } and attach it to <NavigationContainer ref={...} />.
 * - Import { navigate } anywhere to trigger navigation globally.
 */

import { createNavigationContainerRef } from "@react-navigation/native";

// Shared ref used across the app
export const navigationRef = createNavigationContainerRef();

export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}
