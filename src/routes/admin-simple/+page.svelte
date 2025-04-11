<script>
  import SimpleDatabaseJson from '$lib/components/admin/SimpleDatabaseJson.svelte';
</script>

<div style="padding: 1rem;">
  <h1 style="font-size: 2rem; font-weight: bold; margin-bottom: 1rem; color: #0e172c;">Admin Dashboard (Simple)</h1>
  <p style="margin-bottom: 2rem; color: #374151;">
    This is a simplified version of the admin dashboard without Tailwind CSS or Skeleton UI dependencies.
  </p>
  
  <div style="margin-bottom: 2rem; padding: 1rem; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.5rem;">
    <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
      <a href="/dbjson" style="padding: 0.5rem 1rem; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 0.25rem; font-weight: 500;">Database JSON</a>
      <a href="/admin" style="padding: 0.5rem 1rem; background-color: #64748b; color: white; text-decoration: none; border-radius: 0.25rem; font-weight: 500;">Full Admin</a>
      <a href="/" style="padding: 0.5rem 1rem; background-color: #64748b; color: white; text-decoration: none; border-radius: 0.25rem; font-weight: 500;">Home</a>
    </div>
    <p style="color: #64748b; font-size: 0.875rem;">
      Note: The full admin dashboard requires Tailwind CSS and Skeleton UI, which are currently experiencing configuration issues.
      Use this simplified version for basic admin tasks.
    </p>
  </div>
  
  <SimpleDatabaseJson />
</div>