# Polycentricity

A collaborative governance simulation game where players assume various roles in building an eco-village or community garden. Through a graph-based data structure with actors, agreements, obligations, and benefits, the game explores how diverse stakeholders can negotiate, cooperate, and form governance structures to achieve both individual and collective goals.

## Core Technologies

- **SvelteKit 5.28.1** with Runes mode for reactive state management
- **Gun.js** for decentralized real-time data synchronization with advanced schema
- **D3.js** for interactive network visualizations and force-directed layouts
- **TypeScript** for type safety and comprehensive type definitions
- **Skeleton UI v3** with Tailwind CSS for responsive design
- **SendGrid** for email verification and notifications

## Project Summary

Polycentricity is a digital implementation of a collaborative governance simulation game, originally conceived as a workshop paper prototype by Michael Zargham. Inspired by Zargham's vision, as detailed in his [Game Plan](https://hackmd.io/o0XyDD6tRKawnIdpRQqrmw), we built the game on a decentralized graph database (Gun.js) with augmented visualizations (D3.js and Cytoscape.js) to serve as a proof-of-concept for future decentralized governance projects. In a Web3 world where individuals strive for sovereignty, education through gameplay is essential. Polycentricity aims to remind players of the separation between spirit and material identity, emphasizing that reality is a web of consensual agreements. The game challenges the layered statutory jurisdictions filled with predatory legal systems, positing that new realities can emerge and evolve rapidly in a trustless Web3 ecosystem without reliance on traditional legal frameworks. The core mechanic revolves around a graph-based data model where each player, as an **actor** with unique roles, goals, and assets, interacts to form **agreements** defined by **obligations** and **benefits**.

## Database Architecture

- **Advanced Gun.js Schema**: Comprehensive data structure using boolean maps for relationships instead of Gun.js edges for simplified querying
- **SEA Integration**: Uses SEA pubkeys as user_ids with reserved authentication fields
- **Denormalized Structure**: Agreements embed party details for single-pass UI rendering
- **ref_set Pattern**: Test implementation for Gun.js edges with metadata support
- **Technical Documentation**: See [GunSchema.md](GunSchema.md) for complete schema reference

## Completed Features

1. **Advanced Actor System** 
   - Multi-game actor persistence with cross-game identity transfer
   - Predefined deck types (eco-village, community garden) with rich character templates
   - Dynamic actor-card assignment system with game-specific roles
   - National Identity vs Sovereign Identity actor types

2. **Comprehensive Game Management**
   - Game creation with deck selection and role assignment strategies
   - Real-time game status tracking and lifecycle management
   - Advanced game browser with filtering and search capabilities
   - Multi-player support with configurable limits

3. **Robust Authentication System**
   - SEA-based user registration and session management
   - Email verification with magic link authentication
   - Role-based access control (Guest, Member, Admin)
   - Configurable admin user setup via environment variables

4. **Sophisticated Agreement System**
   - Bilateral and multilateral agreement creation
   - Obligation and benefit tracking with party-specific terms
   - Agreement status management (proposed, accepted, rejected, completed)
   - Visual agreement representation in network diagrams

5. **Advanced Visualization Framework**
   - D3.js force-directed network layouts for actors and agreements
   - Interactive card positioning with persistent layout storage
   - Real-time visualization updates with smart change detection
   - Cork board representation with visual relationship mapping

6. **Real-time Communication System**
   - Group chat in game rooms with actor-based identity
   - Private messaging between players
   - Message persistence and delivery tracking

## In Development

1. **Enhanced Gameplay Mechanics**
   - Structured game phases (setup, negotiation, reflection)
   - Time management and phase transitions
   - Facilitated gameplay experience with guided progression

2. **Resource Exchange System**
   - Implementation of rivalrous resource trading
   - Intellectual property sharing mechanics
   - Capability utilization and resource tracking

3. **Analytics and Reflection Tools**
   - Game outcome analysis and metrics
   - Collaboration effectiveness measurement
   - Post-game debrief functionality and insights

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
cd polycentricity3.1
```

2. Set up environment variables:
```bash
cp .env.example .env
```
Edit `.env` and set your email address for the `ADMIN_EMAIL` variable to automatically become an admin user upon registration.

3. Install dependencies:
```bash
npm install
```

4. Start the development server:
```bash
npm run dev -- --host 0.0.0.0 --port 5000
```

5. Open your browser and navigate to `http://localhost:5000`

## Development Notes

- **Admin Setup**: Copy `.env.example` to `.env` and add your email address to `ADMIN_EMAIL=your-email@example.com`. This will automatically make that user an admin upon creating an account.
- **Email Features**: Set `SENDGRID_API_KEY` in `.env` for email verification functionality (optional for development)
- **Database**: Uses Gun.js for decentralized data storage - no additional database setup required
- **Technical Documentation**: See [GunSchema.md](GunSchema.md) for detailed database architecture