<script>
  import SimpleDatabaseJson from '$lib/components/admin/SimpleDatabaseJson.svelte';
</script>

<div style="padding: 1rem;">
  <h1 style="font-size: 2rem; font-weight: bold; margin-bottom: 1rem;">Database JSON Explorer</h1>
  <p style="margin-bottom: 2rem;">
    This page shows the raw JSON data from the Gun.js database to help diagnose any issues with data structure or format.
  </p>
  
  <SimpleDatabaseJson />
</div>