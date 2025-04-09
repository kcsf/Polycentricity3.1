// Theme configuration utilities
import { join } from 'path';
import type { CustomThemeConfig } from '@skeletonlabs/tw-plugin';

// Fennec theme configuration (if we need to customize it further)
export const fennecTheme: CustomThemeConfig = {
	name: 'fennec',
	properties: {
		// Add any custom theme properties here
	}
};

// Function to get theme variables for use in component styles
export function getThemeVariables() {
	return {
		// Add any theme variables you want to use throughout the app
		colors: {
			primary: 'var(--color-primary-500)',
			secondary: 'var(--color-secondary-500)'
		}
	};
}
