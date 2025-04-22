<script lang="ts">
  import * as ionicons from 'svelte-ionicons';
  import type { ComponentType, SvelteComponent } from 'svelte';

  export let name: string;
  export let size: string | number = '24';
  export let color: string = 'currentColor';

  // Use our pre-defined mapping to convert between libraries
  const iconMap: Record<string, string> = {
    Hammer: 'HammerOutline',
    CircleDollarSign: 'CashOutline',
    DollarSign: 'LogoUsd',
    sun: 'SunnyOutline',
    link: 'LinkOutline',
    lock: 'LockClosedOutline',
    users: 'PeopleOutline',
    user: 'PersonOutline',
    leaf: 'LeafOutline',
    seedling: 'FlowerOutline',
    home: 'HomeOutline',
    building: 'BusinessOutline',
    tree: 'LeafOutline',
    garden: 'FlowerOutline',
    plant: 'LeafOutline',
    money: 'CashOutline',
    coins: 'WalletOutline',
    default: 'CubeOutline',
    farmer: 'NutritionOutline',
    funder: 'CashOutline',
    steward: 'ShieldOutline',
    investor: 'TrendingUpOutline'
  };

  // Function to get the matching ionicon component
  function getIconComponent(iconName: string) {
    const ionName = iconMap[iconName] || iconName;
    // @ts-ignore - Dynamic component access
    return ionicons[ionName] || ionicons.CubeOutline;
  }

  // Get the appropriate component
  const IconComponent = getIconComponent(name);
</script>

<div class="icon-wrapper">
  <svelte:component this={IconComponent} {size} {color} />
</div>

<style>
  .icon-wrapper {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
</style>