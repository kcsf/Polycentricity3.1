<script lang="ts">
  import { 
    Leaf, 
    Network, 
    Handshake, 
    BarChart3,
    Users,
    Target,
    Lightbulb,
    Globe
  } from '@lucide/svelte';
</script>

<div class="container mx-auto px-4 py-8 max-w-4xl">
  <!-- Header -->
  <div class="text-center mb-12">
    <div class="flex justify-center mb-6">
      <div class="w-20 h-20 flex items-center justify-center">
        <Leaf class="w-10 h-10 text-primary-500" />
      </div>
    </div>
    <h1 class="h1 text-primary-500 mb-4">About Polycentricity3</h1>
    <div class="mb-2">
      <span class="badge variant-filled-primary text-sm font-bold">[PRIVATE BETA]</span>
    </div>
    <p class="text-xs opacity-60 mb-6">(more like pre-alpha)</p>
    <p class="text-lg max-w-2xl mx-auto">
      A governance simulation engine designed to help pioneers design, test, and refine decentralized community models.
    </p>
  </div>

  <!-- Mission Section -->
  <div class="card p-6 variant-glass-surface backdrop-blur-lg border border-surface-300-600/20 shadow-lg mb-8">
    <div class="flex items-center mb-4">
      <Target class="w-6 h-6 text-primary-500 mr-3" />
      <h2 class="h2">Our Mission</h2>
    </div>
    <p class="text-lg mb-4">
      Polycentricity3 empowers Web3 pioneers, DAO architects, and sovereignty advocates to experiment with governance protocols in a risk-free simulation environment. We believe the future of human coordination lies in decentralized, community-driven governance models.
    </p>
    <p>
      Our platform provides the tools to design, test, and iterate on governance systems before implementing them in the real world, reducing the risk and cost of governance experimentation.
    </p>
  </div>

  <!-- What We Do -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
    <div class="card p-6 variant-glass-surface backdrop-blur-sm border border-surface-300-600/20 shadow-lg">
      <div class="flex items-center mb-4">
        <Network class="w-6 h-6 text-primary-500 mr-3" />
        <h3 class="h3">Governance Simulation</h3>
      </div>
      <p>
        Create and test peer-to-peer governance models with real-time data synchronization, enabling resilient community-driven decision-making processes.
      </p>
    </div>

    <div class="card p-6 variant-glass-surface backdrop-blur-sm border border-surface-300-600/20 shadow-lg">
      <div class="flex items-center mb-4">
        <Handshake class="w-6 h-6 text-secondary-500 mr-3" />
        <h3 class="h3">Agreement Mechanics</h3>
      </div>
      <p>
        Design and negotiate bilateral and multilateral agreements with clear obligations and benefits, visualized through intuitive interfaces.
      </p>
    </div>

    <div class="card p-6 variant-glass-surface backdrop-blur-sm border border-surface-300-600/20 shadow-lg">
      <div class="flex items-center mb-4">
        <BarChart3 class="w-6 h-6 text-tertiary-500 mr-3" />
        <h3 class="h3">Data Visualization</h3>
      </div>
      <p>
        Interactive visualizations help track community relationships, resource flows, and governance outcomes using D3.js and Cytoscape.js.
      </p>
    </div>

    <div class="card p-6 variant-glass-surface backdrop-blur-sm border border-surface-300-600/20 shadow-lg">
      <div class="flex items-center mb-4">
        <Users class="w-6 h-6 text-warning-500 mr-3" />
        <h3 class="h3">Role-Based Actors</h3>
      </div>
      <p>
        Players take on roles with unique values, capabilities, and objectives, creating realistic governance dynamics and stakeholder interactions.
      </p>
    </div>
  </div>

  <!-- Current Status -->
  <div class="card p-6 variant-glass-surface backdrop-blur-lg border border-surface-300-600/20 shadow-lg mb-8">
    <div class="flex items-center mb-4">
      <Lightbulb class="w-6 h-6 text-primary-500 mr-3" />
      <h2 class="h2">Current Status - Pre-Alpha v0.35</h2>
    </div>
    <div class="space-y-4">
      <p>
        We're currently in private beta testing with core mechanics including:
      </p>
      <ul class="list-disc list-inside space-y-2 ml-4">
        <li>Basic actor role system with values and capabilities</li>
        <li>Agreement creation and negotiation mechanics</li>
        <li>Real-time data synchronization via Gun.js</li>
        <li>Interactive network visualizations</li>
        <li>User authentication and role management</li>
      </ul>
      <div class="mt-6 p-4 bg-primary-500/10 border border-primary-500 rounded">
        <h4 class="font-semibold mb-2">Coming in v0.4:</h4>
        <p class="text-sm">
          Real value exchange using the 8 Forms of Capital, community growth algorithms based on community entanglement, and advanced governance analytics.
        </p>
      </div>
    </div>
  </div>

  <!-- Technology -->
  <div class="card p-6 variant-glass-surface backdrop-blur-lg border border-surface-300-600/20 shadow-lg mb-8">
    <div class="flex items-center mb-4">
      <Globe class="w-6 h-6 text-primary-500 mr-3" />
      <h2 class="h2">Technology</h2>
    </div>
    <p class="mb-4">
      Built on cutting-edge decentralized technologies to ensure resilience, privacy, and community ownership:
    </p>
    <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
      <div class="text-center p-3 border border-surface-400-500 rounded">
        <p class="font-semibold">Gun.js</p>
        <p class="text-xs opacity-70">Decentralized Database</p>
      </div>
      <div class="text-center p-3 border border-surface-400-500 rounded">
        <p class="font-semibold">SvelteKit</p>
        <p class="text-xs opacity-70">Modern Web Framework</p>
      </div>
      <div class="text-center p-3 border border-surface-400-500 rounded">
        <p class="font-semibold">D3.js</p>
        <p class="text-xs opacity-70">Data Visualization</p>
      </div>
      <div class="text-center p-3 border border-surface-400-500 rounded">
        <p class="font-semibold">Cytoscape.js</p>
        <p class="text-xs opacity-70">Network Graphs</p>
      </div>
      <div class="text-center p-3 border border-surface-400-500 rounded">
        <p class="font-semibold">TypeScript</p>
        <p class="text-xs opacity-70">Type Safety</p>
      </div>
      <div class="text-center p-3 border border-surface-400-500 rounded">
        <p class="font-semibold">Skeleton UI</p>
        <p class="text-xs opacity-70">Design System</p>
      </div>
    </div>
  </div>

  <!-- Get Involved -->
  <div class="card p-8 variant-glass-surface text-center backdrop-blur-lg border border-surface-300-600/20 shadow-lg">
    <h2 class="h2 mb-4">Get Involved</h2>
    <p class="text-lg mb-6">
      Ready to help shape the future of decentralized governance? Join our private beta and contribute to the evolution of community coordination.
    </p>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
      <a href="/register" class="btn variant-filled-primary">Join Beta</a>
      <a href="/dashboard" class="btn variant-filled-secondary">View Dashboard</a>
      <a href="/games" class="btn variant-filled-tertiary">Browse Games</a>
    </div>
  </div>
</div>