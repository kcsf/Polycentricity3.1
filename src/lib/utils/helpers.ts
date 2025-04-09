// Format date with options
export function formatDate(timestamp: number, options: Intl.DateTimeFormatOptions = {}): string {
    const date = new Date(timestamp);
    const defaultOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    };
    
    return new Intl.DateTimeFormat('en-US', { ...defaultOptions, ...options }).format(date);
}

// Format time with options
export function formatTime(timestamp: number, options: Intl.DateTimeFormatOptions = {}): string {
    const date = new Date(timestamp);
    const defaultOptions: Intl.DateTimeFormatOptions = {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    };
    
    return new Intl.DateTimeFormat('en-US', { ...defaultOptions, ...options }).format(date);
}

// Format date and time
export function formatDateTime(timestamp: number): string {
    return `${formatDate(timestamp)} at ${formatTime(timestamp)}`;
}

// Truncate text with ellipsis
export function truncateText(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) return text || '';
    return text.slice(0, maxLength) + '...';
}

// Generate a random color based on a string (e.g., user ID)
export function stringToColor(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    let color = '#';
    for (let i = 0; i < 3; i++) {
        const value = (hash >> (i * 8)) & 0xFF;
        color += ('00' + value.toString(16)).substr(-2);
    }
    
    return color;
}

// Generate user initials from name
export function getInitials(name: string): string {
    if (!name) return '';
    
    const parts = name.split(' ').filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// Debounce function
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    
    return function(...args: Parameters<T>): void {
        const later = () => {
            timeout = null;
            func(...args);
        };
        
        if (timeout !== null) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(later, wait);
    };
}

// Generate a random pastel color
export function getRandomPastelColor(): string {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 70%, 80%)`;
}

// Check if object is empty
export function isEmptyObject(obj: Record<string, any>): boolean {
    return Object.keys(obj).length === 0;
}

// Deep clone object
export function deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
}
