<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getGun, nodes } from '$lib/services/gunService';
  import SimpleDatabaseJson from '$lib/components/admin/SimpleDatabaseJson.svelte';
  import { validateCardValueRelationships, validateAllRelationships, fixCardValueArrays } from '$lib/services/databaseDiagnostics';
  
  let activeTab = 'database';
  let isLoading = true;
  let error: string | null = null;
  
  // Diagnostics state
  let isDiagnosticRunning = false;
  let diagnosticResults: any = null;
  let fixInProgress = false;
  let fixResults: any = null;
  
  // Stats
  let nodeStats = {
    users: 0,
    games: 0,
    actors: 0,
    cards: 0,
    decks: 0,
    values: 0,
    capabilities: 0,
    agreements: 0,
    positions: 0,
    chat: 0
  };
  
  function switchTab(tab: string) {
    activeTab = tab;
  }
  
  // Fetch basic database stats
  async function fetchDatabaseStats() {
    isLoading = true;
    error = null;
    
    try {
      const gun = getGun();
      
      if (!gun) {
        error = 'Gun not initialized';
        isLoading = false;
        return;
      }
      
      // Reset stats
      nodeStats = {
        users: 0,
        games: 0,
        actors: 0,
        cards: 0,
        decks: 0,
        values: 0,
        capabilities: 0,
        agreements: 0,
        positions: 0,
        chat: 0
      };
      
      // Function to count nodes for a specific type
      const countNodes = (nodeType: string, statsKey: keyof typeof nodeStats): Promise<void> => {
        return new Promise((resolve) => {
          let count = 0;
          
          // Set a timeout to resolve in case Gun doesn't return
          const timeout = setTimeout(() => {
            console.log(`Timeout counting ${nodeType} nodes`);
            nodeStats[statsKey] = count;
            resolve();
          }, 1000);
          
          gun.get(nodeType).map().once((data, key) => {
            if (data !== null && data !== undefined) {
              count++;
            }
            
            // Clear timeout on first response
            clearTimeout(timeout);
          });
          
          // Return after a brief delay anyway to ensure we get some data
          setTimeout(() => {
            nodeStats[statsKey] = count;
            resolve();
          }, 500);
        });
      };
      
      // Count all node types
      await Promise.all([
        countNodes(nodes.users, 'users'),
        countNodes(nodes.games, 'games'),
        countNodes(nodes.actors, 'actors'),
        countNodes(nodes.cards, 'cards'),
        countNodes(nodes.decks, 'decks'),
        countNodes(nodes.values, 'values'),
        countNodes(nodes.capabilities, 'capabilities'),
        countNodes(nodes.agreements, 'agreements'),
        countNodes(nodes.positions, 'positions'),
        countNodes('chat', 'chat')
      ]);
      
    } catch (err) {
      console.error('Error fetching database stats:', err);
      error = err instanceof Error ? err.message : String(err);
    } finally {
      isLoading = false;
    }
  }
  
  onMount(async () => {
    // Fetch database stats when component mounts
    await fetchDatabaseStats();
  });
</script>

<div style="padding: 2rem; max-width: 1200px; margin: 0 auto;">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
    <h1 style="font-size: 2rem; font-weight: bold; margin: 0; color: #2c3e50;">Admin Dashboard</h1>
    <div>
      <a href="/" style="padding: 0.5rem 1rem; background-color: #3273dc; color: white; text-decoration: none; border-radius: 0.25rem; margin-left: 0.5rem;">Back to Home</a>
      <a href="/admin-simple" style="padding: 0.5rem 1rem; background-color: #3273dc; color: white; text-decoration: none; border-radius: 0.25rem; margin-left: 0.5rem;">Simple Admin</a>
      <a href="/dbjson" style="padding: 0.5rem 1rem; background-color: #3273dc; color: white; text-decoration: none; border-radius: 0.25rem; margin-left: 0.5rem;">Database JSON</a>
    </div>
  </div>
  
  <!-- Simple notice about the admin page -->
  <div style="padding: 1rem; background-color: #f8f9fa; border-radius: 0.5rem; margin-bottom: 2rem; border-left: 4px solid #3273dc;">
    <p style="margin: 0; color: #2c3e50;">
      This is a simplified admin dashboard that doesn't rely on Tailwind CSS or Skeleton UI. 
      It provides basic functionality to view and manage the Gun.js database.
    </p>
  </div>
  
  <!-- Show any errors -->
  {#if error}
    <div style="padding: 1rem; background-color: #feecf0; border-radius: 0.5rem; margin-bottom: 2rem; border-left: 4px solid #f14668;">
      <p style="margin: 0; color: #cd0930;">Error: {error}</p>
    </div>
  {/if}
  
  <!-- Database Stats -->
  <div style="margin-bottom: 2rem; padding: 1.5rem; background-color: #f8f9fa; border-radius: 0.5rem;">
    <h2 style="font-size: 1.5rem; font-weight: bold; margin-top: 0; margin-bottom: 1rem; color: #2c3e50;">Database Stats</h2>
    
    {#if isLoading}
      <p style="color: #3273dc;">Loading stats...</p>
    {:else}
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem;">
        <div style="padding: 1rem; background-color: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h3 style="margin: 0; font-size: 1rem; color: #2c3e50;">Users</h3>
          <p style="font-size: 2rem; font-weight: bold; margin: 0.5rem 0; color: #3273dc;">{nodeStats.users}</p>
        </div>
        
        <div style="padding: 1rem; background-color: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h3 style="margin: 0; font-size: 1rem; color: #2c3e50;">Games</h3>
          <p style="font-size: 2rem; font-weight: bold; margin: 0.5rem 0; color: #3273dc;">{nodeStats.games}</p>
        </div>
        
        <div style="padding: 1rem; background-color: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h3 style="margin: 0; font-size: 1rem; color: #2c3e50;">Actors</h3>
          <p style="font-size: 2rem; font-weight: bold; margin: 0.5rem 0; color: #3273dc;">{nodeStats.actors}</p>
        </div>
        
        <div style="padding: 1rem; background-color: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h3 style="margin: 0; font-size: 1rem; color: #2c3e50;">Cards</h3>
          <p style="font-size: 2rem; font-weight: bold; margin: 0.5rem 0; color: #3273dc;">{nodeStats.cards}</p>
        </div>
        
        <div style="padding: 1rem; background-color: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h3 style="margin: 0; font-size: 1rem; color: #2c3e50;">Decks</h3>
          <p style="font-size: 2rem; font-weight: bold; margin: 0.5rem 0; color: #3273dc;">{nodeStats.decks}</p>
        </div>
        
        <div style="padding: 1rem; background-color: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h3 style="margin: 0; font-size: 1rem; color: #2c3e50;">Values</h3>
          <p style="font-size: 2rem; font-weight: bold; margin: 0.5rem 0; color: #3273dc;">{nodeStats.values}</p>
        </div>
        
        <div style="padding: 1rem; background-color: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h3 style="margin: 0; font-size: 1rem; color: #2c3e50;">Capabilities</h3>
          <p style="font-size: 2rem; font-weight: bold; margin: 0.5rem 0; color: #3273dc;">{nodeStats.capabilities}</p>
        </div>
        
        <div style="padding: 1rem; background-color: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h3 style="margin: 0; font-size: 1rem; color: #2c3e50;">Agreements</h3>
          <p style="font-size: 2rem; font-weight: bold; margin: 0.5rem 0; color: #3273dc;">{nodeStats.agreements}</p>
        </div>
      </div>
      
      <div style="margin-top: 1rem; display: flex; justify-content: flex-end;">
        <button style="background-color: #3273dc; color: white; padding: 0.5rem 1rem; border: none; border-radius: 0.25rem; cursor: pointer; font-weight: 500;"
          on:click={fetchDatabaseStats}
        >
          Refresh Stats
        </button>
      </div>
    {/if}
  </div>
  
  <!-- Tab Navigation -->
  <div style="display: flex; margin-bottom: 1rem; border-bottom: 1px solid #dbdbdb;">
    <button 
      style="padding: 0.75rem 1.5rem; font-weight: 500; background-color: {activeTab === 'database' ? 'white' : '#f5f5f5'}; color: {activeTab === 'database' ? '#3273dc' : '#4a4a4a'}; border: 1px solid #dbdbdb; border-bottom: {activeTab === 'database' ? '2px solid #3273dc' : 'none'}; border-radius: 4px 4px 0 0; margin-right: 0.25rem; cursor: pointer;"
      on:click={() => switchTab('database')}
    >
      Database JSON
    </button>
    <button 
      style="padding: 0.75rem 1.5rem; font-weight: 500; background-color: {activeTab === 'tools' ? 'white' : '#f5f5f5'}; color: {activeTab === 'tools' ? '#3273dc' : '#4a4a4a'}; border: 1px solid #dbdbdb; border-bottom: {activeTab === 'tools' ? '2px solid #3273dc' : 'none'}; border-radius: 4px 4px 0 0; margin-right: 0.25rem; cursor: pointer;"
      on:click={() => switchTab('tools')}
    >
      Admin Tools
    </button>
  </div>
  
  <!-- Tab Content -->
  <div style="background-color: white; border-radius: 0 0 0.5rem 0.5rem; padding: 1.5rem; border: 1px solid #dbdbdb; border-top: none;">
    {#if activeTab === 'database'}
      <SimpleDatabaseJson />
    {:else if activeTab === 'tools'}
      <div>
        <h2 style="font-size: 1.5rem; font-weight: bold; margin-top: 0; margin-bottom: 1rem; color: #2c3e50;">Admin Tools</h2>
        <p style="color: #718096; margin-bottom: 1.5rem;">These tools allow you to manage the Gun.js database. Use with caution!</p>
        
        <!-- Database Diagnostics -->
        <div style="padding: 1rem; background-color: #f8f9fa; border-radius: 0.5rem; margin-bottom: 1.5rem; border-left: 4px solid #3273dc;">
          <h3 style="margin-top: 0; font-size: 1.25rem; color: #2c3e50;">Database Diagnostics</h3>
          <p style="color: #718096; margin-bottom: 1rem;">Check for issues with the database structure and data relationships.</p>
          
          <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
            <button
              style="background-color: #3273dc; color: white; padding: 0.5rem 1rem; border: none; border-radius: 0.25rem; cursor: pointer; font-weight: 500; {isDiagnosticRunning ? 'opacity: 0.7;' : ''}"
              disabled={isDiagnosticRunning}
              on:click={async () => {
                isDiagnosticRunning = true;
                diagnosticResults = null;
                try {
                  diagnosticResults = await validateCardValueRelationships();
                } catch (err) {
                  error = `Diagnostic error: ${err}`;
                } finally {
                  isDiagnosticRunning = false;
                }
              }}
            >
              Check Card-Value Relationships
            </button>
            
            <button
              style="background-color: #3273dc; color: white; padding: 0.5rem 1rem; border: none; border-radius: 0.25rem; cursor: pointer; font-weight: 500; {isDiagnosticRunning ? 'opacity: 0.7;' : ''}"
              disabled={isDiagnosticRunning}
              on:click={async () => {
                isDiagnosticRunning = true;
                diagnosticResults = null;
                try {
                  diagnosticResults = await validateAllRelationships();
                } catch (err) {
                  error = `Diagnostic error: ${err}`;
                } finally {
                  isDiagnosticRunning = false;
                }
              }}
            >
              Validate All Relationships
            </button>
          </div>
          
          {#if isDiagnosticRunning}
            <div style="padding: 1rem; background-color: #f0f8ff; border-radius: 0.25rem; margin-bottom: 1rem;">
              <p style="margin: 0; color: #3273dc;">Running diagnostics, please wait...</p>
            </div>
          {/if}
          
          {#if diagnosticResults}
            <div style="padding: 1rem; background-color: #f0f8ff; border-radius: 0.25rem; margin-top: 1rem;">
              <h4 style="margin-top: 0; font-size: 1rem; font-weight: bold; margin-bottom: 0.5rem;">Diagnostic Results</h4>
              
              {#if diagnosticResults.scanned !== undefined}
                <!-- Card-Value relationship results -->
                <div style="margin-bottom: 1rem;">
                  <p style="margin: 0 0 0.5rem 0;">Scanned <strong>{diagnosticResults.scanned}</strong> cards, found <strong style="color: {diagnosticResults.issues > 0 ? '#cd0930' : '#48c774'};">{diagnosticResults.issues}</strong> issues.</p>
                  
                  {#if diagnosticResults.issues > 0 && diagnosticResults.details && diagnosticResults.details.length}
                    <div style="max-height: 200px; overflow-y: auto; margin-top: 0.5rem; padding: 0.5rem; background-color: #f8f9fa; border-radius: 0.25rem;">
                      <ul style="margin: 0; padding-left: 1.5rem;">
                        {#each diagnosticResults.details as detail}
                          <li style="margin-bottom: 0.25rem; color: #718096;">{detail.cardId}: {detail.issue}</li>
                        {/each}
                      </ul>
                    </div>
                    
                    <div style="margin-top: 1rem;">
                      <button
                        style="background-color: #48c774; color: white; padding: 0.5rem 1rem; border: none; border-radius: 0.25rem; cursor: pointer; font-weight: 500; {fixInProgress ? 'opacity: 0.7;' : ''}"
                        disabled={fixInProgress}
                        on:click={async () => {
                          if (confirm('This will attempt to fix card value arrays by converting them to the correct Gun.js format. Continue?')) {
                            fixInProgress = true;
                            fixResults = null;
                            try {
                              fixResults = await fixCardValueArrays();
                              // Refresh diagnostics after fix
                              diagnosticResults = await validateCardValueRelationships();
                            } catch (err) {
                              error = `Fix error: ${err}`;
                            } finally {
                              fixInProgress = false;
                            }
                          }
                        }}
                      >
                        Fix Card Value Arrays
                      </button>
                    </div>
                  {/if}
                </div>
              {:else if diagnosticResults.values !== undefined}
                <!-- All relationships results -->
                <div style="margin-bottom: 1rem;">
                  <h5 style="margin: 0.5rem 0; font-size: 0.875rem;">Values</h5>
                  <p style="margin: 0 0 0.5rem 0;">
                    Valid: <strong style="color: #48c774;">{diagnosticResults.values.valid}</strong> |
                    Invalid: <strong style="color: {diagnosticResults.values.invalid > 0 ? '#cd0930' : '#48c774'};">{diagnosticResults.values.invalid}</strong>
                  </p>
                  
                  {#if diagnosticResults.values.invalid > 0 && diagnosticResults.values.details && diagnosticResults.values.details.length}
                    <div style="max-height: 100px; overflow-y: auto; margin-top: 0.5rem; padding: 0.5rem; background-color: #f8f9fa; border-radius: 0.25rem;">
                      <ul style="margin: 0; padding-left: 1.5rem;">
                        {#each diagnosticResults.values.details as detail}
                          <li style="margin-bottom: 0.25rem; color: #718096;">{detail}</li>
                        {/each}
                      </ul>
                    </div>
                  {/if}
                </div>
                
                <div style="margin-bottom: 1rem;">
                  <h5 style="margin: 0.5rem 0; font-size: 0.875rem;">Capabilities</h5>
                  <p style="margin: 0 0 0.5rem 0;">
                    Valid: <strong style="color: #48c774;">{diagnosticResults.capabilities.valid}</strong> |
                    Invalid: <strong style="color: {diagnosticResults.capabilities.invalid > 0 ? '#cd0930' : '#48c774'};">{diagnosticResults.capabilities.invalid}</strong>
                  </p>
                  
                  {#if diagnosticResults.capabilities.invalid > 0 && diagnosticResults.capabilities.details && diagnosticResults.capabilities.details.length}
                    <div style="max-height: 100px; overflow-y: auto; margin-top: 0.5rem; padding: 0.5rem; background-color: #f8f9fa; border-radius: 0.25rem;">
                      <ul style="margin: 0; padding-left: 1.5rem;">
                        {#each diagnosticResults.capabilities.details as detail}
                          <li style="margin-bottom: 0.25rem; color: #718096;">{detail}</li>
                        {/each}
                      </ul>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/if}
          
          {#if fixResults}
            <div style="padding: 1rem; background-color: #effaf5; border-radius: 0.25rem; margin-top: 1rem;">
              <h4 style="margin-top: 0; font-size: 1rem; font-weight: bold; margin-bottom: 0.5rem;">Fix Results</h4>
              <p style="margin: 0 0 0.5rem 0;">
                Scanned <strong>{fixResults.scanned}</strong> cards, fixed <strong style="color: #48c774;">{fixResults.fixed}</strong> issues.
              </p>
              
              {#if fixResults.details && fixResults.details.length}
                <div style="max-height: 150px; overflow-y: auto; margin-top: 0.5rem; padding: 0.5rem; background-color: #f8f9fa; border-radius: 0.25rem;">
                  <ul style="margin: 0; padding-left: 1.5rem;">
                    {#each fixResults.details as detail}
                      <li style="margin-bottom: 0.25rem; color: #718096;">{detail}</li>
                    {/each}
                  </ul>
                </div>
              {/if}
            </div>
          {/if}
        </div>
        
        <!-- Database Management -->
        <div style="padding: 1rem; background-color: #f8f9fa; border-radius: 0.5rem; margin-bottom: 1rem;">
          <h3 style="margin-top: 0; font-size: 1.25rem; color: #2c3e50;">Database Reset</h3>
          <p style="color: #718096; margin-bottom: 1rem;">Reset the database by clearing all data.</p>
          <button
            style="background-color: #f14668; color: white; padding: 0.5rem 1rem; border: none; border-radius: 0.25rem; cursor: pointer; font-weight: 500;"
            on:click={() => {
              alert('Database reset functionality is disabled for safety. To reset the database, please clear local storage and reload the page.');
            }}
          >
            Reset Database
          </button>
        </div>
        
        <div style="padding: 1rem; background-color: #f8f9fa; border-radius: 0.5rem; margin-bottom: 1rem;">
          <h3 style="margin-top: 0; font-size: 1.25rem; color: #2c3e50;">Initialize Sample Data</h3>
          <p style="color: #718096; margin-bottom: 1rem;">Populate the database with sample data for testing.</p>
          <button
            style="background-color: #48c774; color: white; padding: 0.5rem 1rem; border: none; border-radius: 0.25rem; cursor: pointer; font-weight: 500;"
            on:click={() => {
              alert('Sample data initialization is disabled. Please use proper import methods from the home page.');
            }}
          >
            Add Sample Data
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>