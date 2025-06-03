<script lang="ts">
  import { page } from '$app/stores';
</script>

<svelte:head>
  <title>Terms of Service - Polycentricity3</title>
  <meta name="description" content="Terms of service for Polycentricity3 decentralized governance platform" />
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-4xl">
  <div class="prose prose-lg dark:prose-invert max-w-none">
    <h1 class="text-4xl font-bold mb-8 text-primary-500">Terms of Service</h1>
    
    <p class="text-lg mb-6 opacity-80">Last updated: June 3, 2025</p>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Overview</h2>
      <p class="mb-4">
        Welcome to Polycentricity3, a decentralized governance platform designed for DAOs, network states, 
        and collaborative communities. By using our platform, you agree to these terms of service.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Platform Status</h2>
      <p class="mb-4">
        Polycentricity3 is currently in <strong>pre-alpha version 0.35</strong>. This means:
      </p>
      <ul class="list-disc ml-6 mb-4">
        <li>The platform is under active development</li>
        <li>Features may change or be removed without notice</li>
        <li>Data persistence is not guaranteed during development phases</li>
        <li>Service availability may be intermittent</li>
        <li>Use at your own risk for non-critical governance activities</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Decentralized Architecture</h2>
      <p class="mb-4">
        Our platform operates on decentralized infrastructure using Gun.js:
      </p>
      <ul class="list-disc ml-6 mb-4">
        <li>Data is distributed across peer-to-peer networks</li>
        <li>No single entity controls all platform data</li>
        <li>Users maintain cryptographic ownership of their data</li>
        <li>Network resilience depends on peer participation</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">User Responsibilities</h2>
      <h3 class="text-xl font-medium mb-3">Account Security</h3>
      <ul class="list-disc ml-6 mb-4">
        <li>Maintain the security of your cryptographic keys</li>
        <li>Use strong, unique passwords for your account</li>
        <li>Report security vulnerabilities responsibly</li>
        <li>Do not share account credentials</li>
      </ul>

      <h3 class="text-xl font-medium mb-3">Governance Participation</h3>
      <ul class="list-disc ml-6 mb-4">
        <li>Participate in good faith in governance processes</li>
        <li>Respect diverse perspectives and collaborative decision-making</li>
        <li>Do not manipulate voting or consensus mechanisms</li>
        <li>Honor agreements and commitments made through the platform</li>
      </ul>

      <h3 class="text-xl font-medium mb-3">Prohibited Activities</h3>
      <ul class="list-disc ml-6 mb-4">
        <li>Attempting to compromise platform security</li>
        <li>Spamming or flooding the network with excessive data</li>
        <li>Impersonating other users or organizations</li>
        <li>Using the platform for illegal activities</li>
        <li>Disrupting legitimate governance processes</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Data and Privacy</h2>
      <p class="mb-4">
        <strong>Current Data Status (Pre-Alpha v0.35):</strong>
      </p>
      <ul class="list-disc ml-6 mb-4">
        <li><strong>User accounts:</strong> Encrypted and cryptographically controlled by your keys</li>
        <li><strong>Governance data:</strong> Currently stored unencrypted across the decentralized network</li>
        <li><strong>Data persistence:</strong> Data deletion may not be immediate across all network nodes</li>
        <li><strong>Public accessibility:</strong> Governance data may remain accessible even after account deletion</li>
      </ul>
      
      <p class="mb-4">
        <strong>Future Privacy Features:</strong>
      </p>
      <ul class="list-disc ml-6 mb-4">
        <li>User-controlled encryption for governance and collaboration data</li>
        <li>Peer-to-peer encrypted data sharing</li>
        <li>Group-based privacy controls</li>
        <li>Enhanced data sovereignty features</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Intellectual Property</h2>
      <p class="mb-4">
        Content and contributions on the platform:
      </p>
      <ul class="list-disc ml-6 mb-4">
        <li>You retain rights to content you create</li>
        <li>Governance proposals and discussions may become part of public record</li>
        <li>Platform code is open-source under appropriate licenses</li>
        <li>Respect others' intellectual property rights</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Service Availability</h2>
      <p class="mb-4">
        Due to our decentralized nature and pre-alpha status:
      </p>
      <ul class="list-disc ml-6 mb-4">
        <li>We do not guarantee continuous service availability</li>
        <li>Network performance depends on peer infrastructure</li>
        <li>Updates may require temporary service interruptions</li>
        <li>Critical bugs may require emergency updates</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Limitation of Liability</h2>
      <p class="mb-4">
        Given the experimental nature of the platform:
      </p>
      <ul class="list-disc ml-6 mb-4">
        <li>Use the platform at your own risk</li>
        <li>We are not liable for data loss or governance decision outcomes</li>
        <li>No warranties are provided for platform functionality</li>
        <li>Users are responsible for backing up important data</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Governance of Terms</h2>
      <p class="mb-4">
        As a governance platform, we believe in collaborative rule-making:
      </p>
      <ul class="list-disc ml-6 mb-4">
        <li>These terms may evolve through community input</li>
        <li>Significant changes will be communicated to users</li>
        <li>Community governance mechanisms may influence platform policies</li>
        <li>Users can propose improvements to these terms</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Future Development</h2>
      <p class="mb-4">
        Planned features in upcoming versions include:
      </p>
      <ul class="list-disc ml-6 mb-4">
        <li>Enhanced community analytics and network insights</li>
        <li>Multi-stakeholder governance tools</li>
        <li>Integration with other decentralized platforms</li>
        <li>Advanced consensus and decision-making mechanisms</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Contact and Disputes</h2>
      <p class="mb-4">
        For questions about these terms or platform issues:
      </p>
      <p class="mb-4">
        <strong>Email:</strong> <a href="mailto:legal@endogon.com" class="text-primary-500 hover:text-primary-400">legal@endogon.com</a>
      </p>
      <p class="mb-4">
        <strong>Developer:</strong> <a href="https://www.endogon.com" class="text-primary-500 hover:text-primary-400" target="_blank" rel="noopener noreferrer">Bjørn at Endogon.com</a>
      </p>
      <p class="mb-4">
        Disputes will be resolved through collaborative governance processes when possible, 
        falling back to traditional legal mechanisms only when necessary.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Acceptance</h2>
      <p class="mb-4">
        By using Polycentricity3, you acknowledge that you have read, understood, and agree to be bound by these terms. 
        If you do not agree to these terms, please do not use the platform.
      </p>
    </section>
  </div>
</div>