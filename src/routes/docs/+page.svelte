<script lang="ts">
  import { 
    Leaf, 
    Book, 
    Users, 
    Handshake, 
    Network,
    BarChart3,
    Target,
    Gamepad2,
    Database,
    Shield,
    MessageCircle,
    Settings,
    ArrowRight
  } from '@lucide/svelte';
  import { Accordion } from '@skeletonlabs/skeleton-svelte';
  
  // Documentation accordion state
  let docAccordionValue = $state<string[]>([]);
</script>

<div class="container mx-auto px-4 py-8 max-w-5xl">
  <!-- Header -->
  <div class="text-center mb-12">
    <div class="flex justify-center mb-6">
      <div class="w-20 h-20 flex items-center justify-center">
        <Book class="w-10 h-10 text-primary-500" />
      </div>
    </div>
    <h1 class="h1 text-primary-500 mb-4">Documentation</h1>
    <div class="mb-2">
      <span class="badge variant-filled-primary text-sm font-bold">[PRIVATE BETA]</span>
    </div>
    <p class="text-xs opacity-60 mb-6">(more like pre-alpha)</p>
    <p class="text-lg max-w-3xl mx-auto">
      Learn how to design, test, and refine governance protocols using Polycentricity3's collaborative simulation engine.
    </p>
  </div>

  <!-- Overview -->
  <div class="card p-6 variant-glass-surface backdrop-blur-lg border border-surface-300-600/20 shadow-lg mb-8">
    <div class="flex items-center mb-4">
      <Target class="w-6 h-6 text-primary-500 mr-3" />
      <h2 class="h2">What is Polycentricity3?</h2>
    </div>
    <p class="text-lg mb-4">
      Polycentricity3 is a governance simulation engine where participants design and test decentralized community models. 
      Originally inspired by Michael Zargham's workshop prototype, this digital implementation uses modern Web3 technologies 
      to create a risk-free environment for governance experimentation.
    </p>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
      <div class="p-4 bg-primary-500/10 border border-primary-500 rounded">
        <h4 class="font-semibold mb-2">For Whom?</h4>
        <p class="text-sm">Web3 pioneers, DAO architects, sovereignty advocates, and anyone interested in decentralized governance.</p>
      </div>
      <div class="p-4 bg-secondary-500/10 border border-secondary-500 rounded">
        <h4 class="font-semibold mb-2">Why Simulate?</h4>
        <p class="text-sm">Test governance models before real-world implementation, reducing risk and cost of experimentation.</p>
      </div>
    </div>
  </div>

  <!-- Core Concepts -->
  <div class="card p-6 variant-glass-surface backdrop-blur-lg border border-surface-300-600/20 shadow-lg mb-8">
    <h2 class="h2 mb-6">Core Concepts</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      
      <!-- Actors -->
      <div class="text-center">
        <div class="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-primary-500/20 rounded-full">
          <Users class="w-8 h-8 text-primary-500" />
        </div>
        <h3 class="h4 mb-2">Actors</h3>
        <p class="text-sm">
          Players take on roles with unique values, capabilities, and objectives. Each actor represents a stakeholder 
          in the governance system with specific interests and resources.
        </p>
      </div>

      <!-- Agreements -->
      <div class="text-center">
        <div class="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-secondary-500/20 rounded-full">
          <Handshake class="w-8 h-8 text-secondary-500" />
        </div>
        <h3 class="h4 mb-2">Agreements</h3>
        <p class="text-sm">
          Formal arrangements between actors that define obligations and benefits. These form the backbone 
          of governance structures and community coordination.
        </p>
      </div>

      <!-- Networks -->
      <div class="text-center">
        <div class="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-tertiary-500/20 rounded-full">
          <Network class="w-8 h-8 text-tertiary-500" />
        </div>
        <h3 class="h4 mb-2">Networks</h3>
        <p class="text-sm">
          Visual representations of relationships between actors and agreements, showing how governance 
          structures emerge and evolve over time.
        </p>
      </div>

    </div>
  </div>

  <!-- How It Works -->
  <div class="card p-6 variant-glass-surface backdrop-blur-lg border border-surface-300-600/20 shadow-lg mb-8">
    <div class="flex items-center mb-6">
      <Gamepad2 class="w-6 h-6 text-primary-500 mr-3" />
      <h2 class="h2">How It Works</h2>
    </div>
    
    <div class="space-y-6">
      <!-- Step 1 -->
      <div class="flex items-start">
        <div class="w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center mr-4 flex-shrink-0 mt-1">
          <span class="text-sm font-bold">1</span>
        </div>
        <div>
          <h3 class="h4 mb-2">Choose Your Role</h3>
          <p>Select an actor card that aligns with your values and capabilities. Each role comes with unique objectives, resources, and constraints that shape your gameplay experience.</p>
        </div>
      </div>

      <!-- Step 2 -->
      <div class="flex items-start">
        <div class="w-8 h-8 bg-secondary-500 text-white rounded-full flex items-center justify-center mr-4 flex-shrink-0 mt-1">
          <span class="text-sm font-bold">2</span>
        </div>
        <div>
          <h3 class="h4 mb-2">Form Agreements</h3>
          <p>Negotiate with other players to create formal agreements. Define clear obligations and benefits that serve both individual and collective interests.</p>
        </div>
      </div>

      <!-- Step 3 -->
      <div class="flex items-start">
        <div class="w-8 h-8 bg-tertiary-500 text-white rounded-full flex items-center justify-center mr-4 flex-shrink-0 mt-1">
          <span class="text-sm font-bold">3</span>
        </div>
        <div>
          <h3 class="h4 mb-2">Build Governance</h3>
          <p>Watch as your individual agreements combine to form larger governance structures. Track how decisions ripple through your community network.</p>
        </div>
      </div>

      <!-- Step 4 -->
      <div class="flex items-start">
        <div class="w-8 h-8 bg-warning-500 text-white rounded-full flex items-center justify-center mr-4 flex-shrink-0 mt-1">
          <span class="text-sm font-bold">4</span>
        </div>
        <div>
          <h3 class="h4 mb-2">Analyze & Iterate</h3>
          <p>Use visualization tools to understand relationship patterns and governance effectiveness. Apply learnings to refine your approach in future games.</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Current Features -->
  <div class="card p-6 variant-glass-surface backdrop-blur-lg border border-surface-300-600/20 shadow-lg mb-8">
    <div class="flex items-center mb-6">
      <Settings class="w-6 h-6 text-primary-500 mr-3" />
      <h2 class="h2">Current Features (Pre-Alpha v0.35)</h2>
    </div>
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Feature 1 -->
      <div class="p-4 border border-surface-400-500 rounded">
        <div class="flex items-center mb-3">
          <Users class="w-5 h-5 text-primary-500 mr-2" />
          <h4 class="font-semibold">Actor System</h4>
        </div>
        <ul class="text-sm space-y-1 list-disc list-inside">
          <li>Role-based character selection</li>
          <li>Predefined eco-village and community garden decks</li>
          <li>Cross-game identity persistence</li>
          <li>Dynamic role assignment</li>
        </ul>
      </div>

      <!-- Feature 2 -->
      <div class="p-4 border border-surface-400-500 rounded">
        <div class="flex items-center mb-3">
          <Handshake class="w-5 h-5 text-secondary-500 mr-2" />
          <h4 class="font-semibold">Agreement Creation</h4>
        </div>
        <ul class="text-sm space-y-1 list-disc list-inside">
          <li>Bilateral and multilateral agreements</li>
          <li>Obligation and benefit tracking</li>
          <li>Status management (proposed, accepted, completed)</li>
          <li>Visual relationship mapping</li>
        </ul>
      </div>

      <!-- Feature 3 -->
      <div class="p-4 border border-surface-400-500 rounded">
        <div class="flex items-center mb-3">
          <BarChart3 class="w-5 h-5 text-tertiary-500 mr-2" />
          <h4 class="font-semibold">Visualization Tools</h4>
        </div>
        <ul class="text-sm space-y-1 list-disc list-inside">
          <li>Interactive network diagrams</li>
          <li>Force-directed layouts</li>
          <li>Real-time relationship updates</li>
          <li>Cork board representation</li>
        </ul>
      </div>

      <!-- Feature 4 -->
      <div class="p-4 border border-surface-400-500 rounded">
        <div class="flex items-center mb-3">
          <MessageCircle class="w-5 h-5 text-warning-500 mr-2" />
          <h4 class="font-semibold">Communication</h4>
        </div>
        <ul class="text-sm space-y-1 list-disc list-inside">
          <li>Group chat in game rooms</li>
          <li>Private messaging between players</li>
          <li>Actor-based identity in conversations</li>
          <li>Message persistence</li>
        </ul>
      </div>
    </div>
  </div>

  <!-- FAQ Accordion -->
  <div class="card p-6 variant-glass-surface backdrop-blur-lg border border-surface-300-600/20 shadow-lg mb-8">
    <h2 class="h2 text-center mb-6">Frequently Asked Questions</h2>
    <Accordion value={docAccordionValue} onValueChange={(e) => (docAccordionValue = e.value as string[])} multiple>
      
      <!-- FAQ 1 -->
      <Accordion.Item value="faq1">
        {#snippet control()}
          How do I get started playing?
        {/snippet}
        
        {#snippet panel()}
          <div class="p-4">
            <p class="mb-3">Getting started is simple:</p>
            <ol class="list-decimal list-inside space-y-2 text-sm">
              <li>Register for an account on the homepage</li>
              <li>Browse available games or create a new one</li>
              <li>Select an actor card that matches your interests</li>
              <li>Begin interacting with other players to form agreements</li>
              <li>Use the visualization tools to track your governance network</li>
            </ol>
          </div>
        {/snippet}
      </Accordion.Item>

      <!-- FAQ 2 -->
      <Accordion.Item value="faq2">
        {#snippet control()}
          What makes this different from other governance tools?
        {/snippet}
        
        {#snippet panel()}
          <div class="p-4">
            <p class="mb-3">Polycentricity3 is unique because it:</p>
            <ul class="list-disc list-inside space-y-2 text-sm">
              <li>Uses decentralized technology (Gun.js) for peer-to-peer data sharing</li>
              <li>Focuses on simulation before real-world implementation</li>
              <li>Emphasizes collaborative rather than competitive dynamics</li>
              <li>Provides visual tools to understand complex governance relationships</li>
              <li>Allows experimentation without real-world consequences</li>
            </ul>
          </div>
        {/snippet}
      </Accordion.Item>

      <!-- FAQ 3 -->
      <Accordion.Item value="faq3">
        {#snippet control()}
          What are the 8 Forms of Capital mentioned in development?
        {/snippet}
        
        {#snippet panel()}
          <div class="p-4">
            <p class="mb-3">The 8 Forms of Capital represent different types of value that communities can exchange:</p>
            <div class="grid grid-cols-2 gap-2 text-sm">
              <div>• Financial Capital</div>
              <div>• Material Capital</div>
              <div>• Living Capital</div>
              <div>• Intellectual Capital</div>
              <div>• Experiential Capital</div>
              <div>• Social Capital</div>
              <div>• Cultural Capital</div>
              <div>• Spiritual Capital</div>
            </div>
            <p class="mt-3 text-sm">Future versions will incorporate these for more realistic resource and value exchange simulation.</p>
          </div>
        {/snippet}
      </Accordion.Item>

      <!-- FAQ 4 -->
      <Accordion.Item value="faq4">
        {#snippet control()}
          How does the decentralized database work?
        {/snippet}
        
        {#snippet panel()}
          <div class="p-4">
            <p class="mb-3">We use Gun.js, a decentralized database that:</p>
            <ul class="list-disc list-inside space-y-2 text-sm">
              <li>Stores data across multiple peers instead of a central server</li>
              <li>Automatically synchronizes changes in real-time</li>
              <li>Works offline and syncs when connection is restored</li>
              <li>Ensures data resilience and community ownership</li>
              <li>Reduces dependence on centralized infrastructure</li>
            </ul>
            <p class="mt-3 text-sm">This aligns with our goal of demonstrating decentralized governance principles through the technology itself.</p>
          </div>
        {/snippet}
      </Accordion.Item>

      <!-- FAQ 5 -->
      <Accordion.Item value="faq5">
        {#snippet control()}
          Can I use this for my real DAO or community?
        {/snippet}
        
        {#snippet panel()}
          <div class="p-4">
            <p class="mb-3">Currently, Polycentricity3 is designed for education and experimentation. However:</p>
            <ul class="list-disc list-inside space-y-2 text-sm">
              <li>The simulation helps you test governance models before implementing them</li>
              <li>Insights gained can inform real-world governance design</li>
              <li>Future versions aim to support actual governance processes</li>
              <li>The decentralized architecture provides a foundation for real applications</li>
            </ul>
            <p class="mt-3 text-sm">We encourage using the simulation to prototype and refine your governance ideas before real-world deployment.</p>
          </div>
        {/snippet}
      </Accordion.Item>

      <!-- FAQ 6 -->
      <Accordion.Item value="faq6">
        {#snippet control()}
          How can I contribute?
        {/snippet}
        
        {#snippet panel()}
          <div class="p-4">
            <p class="mb-3">
              We welcome contributors to help shape the future of decentralized governance! Get involved by:
            </p>
            <ul class="list-disc list-inside space-y-2 mb-4 text-sm">
              <li>Testing the platform and providing feedback on user experience</li>
              <li>Participating in governance simulations and sharing insights</li>
              <li>Contributing ideas for new features and improvements</li>
              <li>Joining community discussions about governance design</li>
              <li>Helping with documentation and educational content</li>
              <li>Sharing the project with other governance enthusiasts</li>
            </ul>
            <div class="space-y-3">
              <a 
                href="https://www.paypal.com/ncp/payment/WKRUV7VBP8EBS" 
                class="inline-block bg-primary-500 hover:bg-primary-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                target="_blank" 
                rel="noopener noreferrer"
              >
                💰 Donate Capital
              </a>
              <p class="font-semibold mt-4">Contact us:</p>
              <p class="text-sm">Email: <a href="mailto:bjorn@endogon.com" class="anchor">bjorn@endogon.com</a></p>
              <p class="text-sm">Signal Group: <a href="https://signal.group/#CjQKIADcrudwk5OpFGCxHapz6JF_yebFReILnO6Wilvq90YfEhAsVAAd38_6zAEC7kZ5YT9X" class="anchor" target="_blank" rel="noopener noreferrer">Join our Signal community</a></p>
            </div>
          </div>
        {/snippet}
      </Accordion.Item>

    </Accordion>
  </div>

  <!-- Coming Soon -->
  <div class="card p-6 variant-glass-surface backdrop-blur-lg border border-surface-300-600/20 shadow-lg mb-8">
    <div class="flex items-center mb-4">
      <ArrowRight class="w-6 h-6 text-primary-500 mr-3" />
      <h2 class="h2">Coming in v0.4</h2>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="space-y-3">
        <h4 class="font-semibold">Enhanced Mechanics</h4>
        <ul class="text-sm space-y-1 list-disc list-inside">
          <li>Real value exchange using 8 Forms of Capital</li>
          <li>Resource trading and intellectual property sharing</li>
          <li>Structured game phases with time management</li>
          <li>Community growth algorithms</li>
        </ul>
      </div>
      <div class="space-y-3">
        <h4 class="font-semibold">Analytics & Insights</h4>
        <ul class="text-sm space-y-1 list-disc list-inside">
          <li>Game outcome analysis and metrics</li>
          <li>Collaboration effectiveness measurement</li>
          <li>Post-game debrief functionality</li>
          <li>Advanced governance analytics</li>
        </ul>
      </div>
    </div>
  </div>

  <!-- Technical Details (Simplified) -->
  <div class="card p-6 variant-glass-surface backdrop-blur-lg border border-surface-300-600/20 shadow-lg mb-8">
    <div class="flex items-center mb-4">
      <Database class="w-6 h-6 text-primary-500 mr-3" />
      <h2 class="h2">Technical Foundation</h2>
    </div>
    <p class="mb-4">
      Built on modern Web3 technologies to ensure reliability, scalability, and decentralization:
    </p>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="text-center p-3 border border-surface-400-500 rounded">
        <p class="font-semibold text-sm">Gun.js</p>
        <p class="text-xs opacity-70">Decentralized Data</p>
      </div>
      <div class="text-center p-3 border border-surface-400-500 rounded">
        <p class="font-semibold text-sm">SvelteKit 5</p>
        <p class="text-xs opacity-70">Modern Frontend</p>
      </div>
      <div class="text-center p-3 border border-surface-400-500 rounded">
        <p class="font-semibold text-sm">TypeScript</p>
        <p class="text-xs opacity-70">Type Safety</p>
      </div>
      <div class="text-center p-3 border border-surface-400-500 rounded">
        <p class="font-semibold text-sm">D3.js</p>
        <p class="text-xs opacity-70">Visualizations</p>
      </div>
    </div>
  </div>

  <!-- Get Started CTA -->
  <div class="card p-8 variant-glass-surface text-center backdrop-blur-lg border border-surface-300-600/20 shadow-lg">
    <h2 class="h2 mb-4">Ready to Begin?</h2>
    <p class="text-lg mb-6">
      Join our private beta and start experimenting with decentralized governance today.
    </p>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
      <a href="/register" class="btn variant-filled-primary">Join Beta</a>
      <a href="/games" class="btn variant-filled-secondary">Browse Games</a>
      <a href="/dashboard" class="btn variant-filled-tertiary">View Dashboard</a>
    </div>
  </div>
</div>