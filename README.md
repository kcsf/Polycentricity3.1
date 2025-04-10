# Polycentricity3

A decentralized multiplayer eco-village simulation game that empowers players to collaborate and build sustainable communities through innovative web technologies.

## Tech Stack

- **SvelteKit**: Frontend framework
- **Gun.js**: Decentralized database for real-time synchronization
- **Skeleton UI**: User interface framework
- **Tailwind CSS**: Utility-first CSS framework

## Getting Started

### Prerequisites

- Node.js (20.x recommended)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd polycentricity3
```

2. Install dependencies:
```bash
npm install
# or with yarn
yarn install
```

3. Start the development server:
```bash
npm run dev -- --host 0.0.0.0 --port 5000
# or with yarn
yarn dev --host 0.0.0.0 --port 5000
```

4. Open your browser and navigate to `http://localhost:5000`

## Project Structure

- `/src`: Source files
  - `/lib`: Reusable components and utilities
    - `/components`: UI components
      - `/game`: Game-specific components
    - `/services`: Service modules (Gun.js integration, auth, etc.)
    - `/stores`: Svelte stores for state management
    - `/types`: TypeScript type definitions
    - `/utils`: Utility functions
  - `/routes`: SvelteKit routes (pages)

## Data Structure

Gun.js has certain limitations with arrays, so collections like players and decks use object format with {id: true} pattern instead of arrays.

## Features

- User authentication with Gun.js
- Real-time synchronization across devices
- Game creation with predefined decks
- Role assignment
- Chat functionality
- Collaborative gameplay

## Development Notes

- Gun.js requires careful handling of data structures (avoid arrays, use objects)
- For development purposes, authentication is temporarily disabled with mock users