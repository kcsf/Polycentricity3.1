# Polycentricity

A collaborative governance simulation game where players assume various roles in building an eco-village or community garden. Through a graph-based data structure with actors, agreements, obligations, and benefits, the game explores how diverse stakeholders can negotiate, cooperate, and form governance structures to achieve both individual and collective goals.

## Core Technologies

- **SvelteKit 5.25.9** with Runes mode for reactive state management
- **Gun.js** for decentralized real-time data synchronization
- **Cytoscape.js and D3.js** for interactive network visualizations
- **TypeScript** for type safety and advanced error handling
- **Skeleton UI** with Tailwind CSS for responsive design

## Project Summary

Polycentricity is a digital implementation of a collaborative governance simulation game, originally conceived as a workshop paper prototype by Michael Zargham. Inspired by Zargham's vision, as detailed in his [Game Plan](https://hackmd.io/o0XyDD6tRKawnIdpRQqrmw), we built the game on a decentralized graph database (Gun.js) with augmented visualizations (D3.js and Cytoscape.js) to serve as a proof-of-concept for future decentralized governance projects. In a Web3 world where individuals strive for sovereignty, education through gameplay is essential. Polycentricity aims to remind players of the separation between spirit and material identity, emphasizing that reality is a web of consensual agreements. The game challenges the layered statutory jurisdictions filled with predatory legal systems, positing that new realities can emerge and evolve rapidly in a trustless Web3 ecosystem without reliance on traditional legal frameworks. The core mechanic revolves around a graph-based data model where each player, as an **actor** with unique roles, goals, and assets, interacts to form **agreements** defined by **obligations** and **benefits**.

## Completed Features

1. **Basic Actor System** 
   - Implementation of actor roles with different capabilities, values, and resources
   - Predefined deck types (eco-village, community garden) with character templates
   - Actor assignment and role selection during game join process

2. **Game Creation and Management**
   - Game creation with name, deck selection, and role assignment options
   - Game status tracking and management
   - Game listing/browser with filtering capabilities
   - Admin tools for game oversight

3. **Authentication System**
   - User registration, login, and session management
   - Role-based access control (Guest, Member, Admin)
   - Quick login bypass for testing (Admin)

4. **Basic Database Structure**
   - Gun.js implementation for decentralized data
   - Database visualization tools for administrators
   - Caching mechanisms for performance enhancement

5. **Visualization Framework**
   - D3.js implementation for displaying relationships
   - Interactive card-based display of actors
   - Basic UI layout with sidebar navigation and game board

6. **Communication System**
   - Group chat in game rooms
   - Private messaging between actors

## In Development

1. **Agreement Formation Mechanics**
   - Complete implementation of bilateral/multilateral agreements
   - Agreement templates with obligation and benefit tracking
   - Visual representation of agreements on the game board with proper connected edges
   - Agreement lifecycle management (creation, modification, termination)

2. **Cork Board Representation**
   - Digital equivalent of the physical design with strings connecting actors and agreements
   - Visual distinction between symmetric and asymmetric agreements
   - Proper visualization of obligations and benefits as directional relationships

3. **Gameplay Phases**
   - Structured phases for game progression (setup, free play, debrief)
   - Time management and phase transitions
   - Facilitated gameplay experience with guided progression

4. **Resource Exchange System**
   - Implementation of rivalrous resources and their exchange
   - Tracking of intellectual property sharing
   - Capability utilization mechanics

5. **Reflection and Outcome Analysis**
   - Tools for analyzing game outcomes
   - Metrics for collaboration effectiveness
   - Debrief functionality to discuss "did we win?"

## Extended Features

1. **Extended Database Management**
   - Advanced admin panel for database exploration and maintenance
   - Real-time data synchronization across clients
   - Interactive database visualization tools

2. **Actor Identity Persistence**
   - Local storage integration for maintaining actor assignment between sessions
   - Cross-game actor transfer capabilities
   - User-actor relationship management

3. **Decentralized Data Structure**
   - Gun.js implementation enabling peer-to-peer data synchronization
   - Offline capability and local-first data architecture
   - Cross-device data consistency

## Getting Started

### Prerequisites

- Node.js (20.x recommended)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd polycentricity
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev -- --host 0.0.0.0 --port 5000
```

4. Open your browser and navigate to `http://localhost:5000`

## Development Notes

- Admin login: bjorn@endogon.com
- Current development focus: Agreement system and proper database schema redesign