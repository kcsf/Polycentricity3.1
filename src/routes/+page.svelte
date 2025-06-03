<script lang="ts">
  import { goto } from '$app/navigation';
  import { userStore } from '$lib/stores/userStore';
  import { onMount } from 'svelte';
  import { 
    Leaf, 
    Network, 
    Handshake, 
    BarChart3,
    ChevronDown,
    ChevronUp
  } from '@lucide/svelte';
  import { Accordion } from '@skeletonlabs/skeleton-svelte';
  
  // FAQ accordion state
  let faqAccordionValue = $state<string[]>([]);
</script>

<div class="min-h-screen w-screen flex flex-col bg-linear-to-br from-surface-50-950 to-surface-200-800 -mx-4 md:-mx-8">
  <!-- Hero Section -->
  <div class="flex-grow flex items-center justify-center min-h-[calc(90vh-var(--app-bar-height))] pt-[var(--app-bar-height)]">
    <div class="card p-8 variant-glass-surface backdrop-blur-lg border border-surface-300-600/20 shadow-xl max-w-4xl mx-4">
      <div class="text-center">
        <div class="flex justify-center mb-6">
          <div class="w-20 h-20 flex items-center justify-center">
            <Leaf class="w-10 h-10 text-primary-500" />
          </div>
        </div>
        <h1 class="h1 text-primary-500 mb-2">Polycentricity3</h1>
        <h3 class="h3 mb-2">A Decentralized Game Engine<br/>for Governance Protocols</h3>
        <div class="mb-2">
          <span class="badge variant-filled-primary text-sm font-bold">[PRIVATE BETA]</span>
        </div>
        <p class="text-xs opacity-60 mb-4">(more like pre-alpha)</p>
        <p class="text-lg max-w-2xl mx-auto mb-8">
          Craft and test innovative governance models in a dynamic simulation. Polycentricity empowers you to design decentralized communities, forge agreements, and experiment with value exchange mechanics—perfect for DAOs, network states, and sovereign innovators.
        </p>
        <div class="grid grid-cols-2 gap-4 max-w-md mx-auto">
          <a href="/register" class="btn btn-lg variant-filled-primary">Get Started</a>
          <a href="/login" class="btn btn-lg variant-ghost-surface">Sign In</a>
        </div>
      </div>
    </div>
  </div>

  <!-- Features Section -->
  <div class="container mx-auto px-4 py-16">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
      <!-- Feature 1 -->
      <div class="card p-6 variant-glass-surface backdrop-blur-sm border border-surface-300-600/20 shadow-lg">
        <div class="flex items-center">
          <div class="w-12 h-12 flex items-center justify-center mr-4">
            <Network class="w-6 h-6 text-primary-500" />
          </div>
          <div>
            <h3 class="h3 mb-2">Governance Protocol Sandbox</h3>
            <p>Powered by Gun.js, create and test peer-to-peer governance models with real-time data sync, enabling resilient, community-driven decision-making.</p>
          </div>
        </div>
      </div>

      <!-- Feature 2 -->
      <div class="card p-6 variant-glass-surface backdrop-blur-sm border border-surface-300-600/20 shadow-lg">
        <div class="flex items-center">
          <div class="w-12 h-12 flex items-center justify-center mr-4">
            <Handshake class="w-6 h-6 text-secondary-500" />
          </div>
          <div>
            <h3 class="h3 mb-2">Dynamic Agreement Systems</h3>
            <p>Negotiate bilateral and multilateral agreements with obligations and benefits, visualized as a digital corkboard to track stakeholder entanglements.</p>
          </div>
        </div>
      </div>

      <!-- Feature 3 -->
      <div class="card p-6 variant-glass-surface backdrop-blur-sm border border-surface-300-600/20 shadow-lg">
        <div class="flex items-center">
          <div class="w-12 h-12 flex items-center justify-center mr-4">
            <BarChart3 class="w-6 h-6 text-tertiary-500" />
          </div>
          <div>
            <h3 class="h3 mb-2">Visual Governance Insights</h3>
            <p>Use D3.js and Cytoscape.js to map relationships, resources, and outcomes, offering clear insights into your community's evolving governance structure.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Call to Action -->
    <div class="card p-8 variant-glass-surface text-center backdrop-blur-lg border border-surface-300-600/20 shadow-lg mb-12">
      <h2 class="h2 mb-4">Shape the Future of Governance</h2>
      <p class="text-lg mb-6">Join Web3 pioneers, DAO architects, and sovereignty advocates—to beta-test governance protocols and build thriving decentralized communities.</p>
      <div class="grid grid-cols-2 gap-4 max-w-md mx-auto">
        <a href="/dashboard" class="btn variant-filled-secondary">View Dashboard</a>
        <a href="/games" class="btn variant-filled-tertiary">Browse Games</a>
      </div>
    </div>

    <!-- FAQ Section -->
    <div class="card p-6 variant-glass-surface backdrop-blur-lg border border-surface-300-600/20 shadow-lg mb-12">
      <h2 class="h2 text-center mb-6">Frequently Asked Questions</h2>
      <Accordion value={faqAccordionValue} onValueChange={(e) => (faqAccordionValue = e.value as string[])} multiple>
        
        <!-- FAQ 1 -->
        <Accordion.Item value="faq1">
          {#snippet control()}
            What is Polycentricity3?
          {/snippet}
          
          {#snippet panel()}
            <div class="p-4">
              <p>
                Polycentricity3 is a pre-alpha governance simulation engine where players design and test decentralized community models. Acting as actors with unique roles, you negotiate agreements, manage resources, and experiment with success metrics tailored to your vision.
              </p>
            </div>
          {/snippet}
        </Accordion.Item>

        <!-- FAQ 2 -->
        <Accordion.Item value="faq2">
          {#snippet control()}
            How do I start playing?
          {/snippet}
          
          {#snippet panel()}
            <div class="p-4">
              <p>
                Register an account, join or create a game, select a role card aligned with your values and capabilities, and dive into collaborative governance. Current features include basic actor systems and agreement mechanics, with more coming in v0.4.
              </p>
            </div>
          {/snippet}
        </Accordion.Item>

        <!-- FAQ 3 -->
        <Accordion.Item value="faq3">
          {#snippet control()}
            Is Polycentricity competitive or collaborative?
          {/snippet}
          
          {#snippet panel()}
            <div class="p-4">
              <p>
                It's primarily collaborative, emphasizing collective success through shared goals. Competitive elements arise from strategic negotiations, but the focus is on building thriving communities, not zero-sum wins.
              </p>
            </div>
          {/snippet}
        </Accordion.Item>

        <!-- FAQ 4 -->
        <Accordion.Item value="faq4">
          {#snippet control()}
            What's next for Polycentricity?
          {/snippet}
          
          {#snippet panel()}
            <div class="p-4">
              <p>
                Our pre-alpha (v0.35) offers core mechanics like actor roles and agreements. We're seeking funding to develop v0.4, introducing real value exchange with the 8 Forms of Capital and community growth algorithms based on community entanglement (see /docs for details).
              </p>
            </div>
          {/snippet}
        </Accordion.Item>

        <!-- FAQ 5 -->
        <Accordion.Item value="faq5">
          {#snippet control()}
            Can I use Polycentricity for real-world governance?
          {/snippet}
          
          {#snippet panel()}
            <div class="p-4">
              <p>
                In its current form, it's an educational and experimental sandbox. Future versions aim to support real-world DAO and community governance with robust value-exchange systems and outcome analytics. Join us to shape this roadmap!
              </p>
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
              <ul class="list-disc list-inside space-y-2 mb-4">
                <li>Testing the platform and providing feedback</li>
                <li>Participating in governance simulations</li>
                <li>Sharing ideas for new features and improvements</li>
                <li>Joining our community discussions</li>
              </ul>
              <div class="space-y-2">
                <p class="font-semibold">Contact us:</p>
                <p>Email: <a href="mailto:bjorn@endogon.com" class="anchor">bjorn@endogon.com</a></p>
                <p>Signal Group: <a href="https://signal.group/#CjQKIADcrudwk5OpFGCxHapz6JF_yebFReILnO6Wilvq90YfEhAsVAAd38_6zAEC7kZ5YT9X" class="anchor" target="_blank" rel="noopener noreferrer">Join our Signal community</a></p>
              </div>
            </div>
          {/snippet}
        </Accordion.Item>

      </Accordion>
    </div>

    <!-- Footer -->
    <footer class="text-center py-8">
      <div class="flex justify-center space-x-4 mb-4">
        <a href="/about" class="anchor">About</a>
        <a href="/docs" class="anchor">Documentation</a>
        <a href="https://github.com/your-repo" class="anchor">GitHub</a>
      </div>
      <p class="text-sm opacity-70">© 2025 Polycentricity. All rights reserved.</p>
      <div class="flex justify-center space-x-3 mt-2">
        <a href="/privacy" class="text-xs opacity-50 hover:opacity-100">Privacy Policy</a>
        <a href="/terms" class="text-xs opacity-50 hover:opacity-100">Terms of Service</a>
        <a href="/license" class="text-xs opacity-50 hover:opacity-100">License</a>
      </div>
    </footer>
  </div>
</div>