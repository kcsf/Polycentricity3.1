<script lang="ts">
  import { page } from '$app/stores';
</script>

<svelte:head>
  <title>Privacy Policy - Polycentricity3</title>
  <meta name="description" content="Privacy policy for Polycentricity3 decentralized governance platform" />
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-4xl">
  <div class="prose prose-lg dark:prose-invert max-w-none">
    <h1 class="text-4xl font-bold mb-8 text-primary-500">Privacy Policy</h1>
    
    <p class="text-lg mb-6 opacity-80">Last updated: June 3, 2025</p>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Overview</h2>
      <p class="mb-4">
        Polycentricity3 is a decentralized governance platform that prioritizes user privacy and data sovereignty. 
        This privacy policy explains how we handle data in our decentralized system built on Gun.js technology.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Decentralized Data Architecture</h2>
      <p class="mb-4">
        Our platform uses Gun.js, a decentralized database that stores data across a peer-to-peer network. 
        This means:
      </p>
      <ul class="list-disc ml-6 mb-4">
        <li>Your data is distributed across multiple nodes, not stored on a single central server</li>
        <li>You maintain cryptographic control over your data through SEA (Security, Encryption, Authorization)</li>
        <li>Data synchronization happens peer-to-peer, reducing single points of failure</li>
        <li>The platform operates without traditional centralized data collection</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Data We Process</h2>
      <h3 class="text-xl font-medium mb-3">User Account Data</h3>
      <ul class="list-disc ml-6 mb-4">
        <li>Email address (for authentication and communication)</li>
        <li>Encrypted user credentials via Gun.js SEA</li>
        <li>User preferences and settings</li>
        <li>Governance participation history</li>
      </ul>

      <h3 class="text-xl font-medium mb-3">Governance Data</h3>
      <ul class="list-disc ml-6 mb-4">
        <li>Proposals, votes, and collaborative decisions</li>
        <li>Community interaction data</li>
        <li>Network analytics for governance insights</li>
        <li>Multi-stakeholder agreement records</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Data Security</h2>
      <p class="mb-4">
        Security is built into our decentralized architecture:
      </p>
      <ul class="list-disc ml-6 mb-4">
        <li><strong>End-to-end encryption:</strong> Data is encrypted before leaving your device</li>
        <li><strong>Cryptographic signatures:</strong> All data is cryptographically signed</li>
        <li><strong>Distributed storage:</strong> No single point of data compromise</li>
        <li><strong>User-controlled keys:</strong> You control your cryptographic keys</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Third-Party Services</h2>
      <p class="mb-4">
        We use minimal third-party services:
      </p>
      <ul class="list-disc ml-6 mb-4">
        <li><strong>SendGrid:</strong> For email verification and notifications (email addresses only)</li>
        <li><strong>Cloudflare Turnstile:</strong> For anti-spam protection (no personal data stored)</li>
        <li><strong>Gun.js relay peers:</strong> For data synchronization across the network</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Your Rights</h2>
      <p class="mb-4">
        In our decentralized system, you have enhanced control:
      </p>
      <ul class="list-disc ml-6 mb-4">
        <li><strong>Data ownership:</strong> You cryptographically own your data</li>
        <li><strong>Access:</strong> View all your data through the platform interface</li>
        <li><strong>Portability:</strong> Export your data using Gun.js protocols</li>
        <li><strong>Deletion:</strong> Mark data for deletion (distributed deletion takes time)</li>
        <li><strong>Governance participation:</strong> Participate in platform governance decisions</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Cookies and Tracking</h2>
      <p class="mb-4">
        We use minimal browser storage:
      </p>
      <ul class="list-disc ml-6 mb-4">
        <li>LocalStorage for Gun.js data synchronization</li>
        <li>Session storage for temporary interface state</li>
        <li>No third-party tracking cookies</li>
        <li>No advertising or analytics tracking</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Platform Development</h2>
      <p class="mb-4">
        Polycentricity3 is currently in pre-alpha (v0.35) with ongoing development. 
        Privacy practices may evolve as we add features like:
      </p>
      <ul class="list-disc ml-6 mb-4">
        <li>Enhanced community analytics</li>
        <li>Cross-platform governance tools</li>
        <li>Advanced encryption features</li>
      </ul>
      <p class="mb-4">
        We will notify users of significant privacy policy changes through the platform.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Contact</h2>
      <p class="mb-4">
        For privacy questions or concerns, contact us at:
      </p>
      <p class="mb-4">
        <strong>Email:</strong> <a href="mailto:privacy@endogon.com" class="text-primary-500 hover:text-primary-400">privacy@endogon.com</a>
      </p>
      <p class="mb-4">
        <strong>Developer:</strong> <a href="https://www.endogon.com" class="text-primary-500 hover:text-primary-400" target="_blank" rel="noopener noreferrer">Bjørn at Endogon.com</a>
      </p>
    </section>
  </div>
</div>