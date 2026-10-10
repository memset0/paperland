<script setup lang="ts">
// Home (`/`): the site's welcome dashboard.
import AppPage from '@/components/AppPage.vue'
import UsageDashboard from '@/components/home/UsageDashboard.vue'
import FeatureList from '@/components/home/FeatureList.vue'
</script>

<template>
  <AppPage>
    <div class="space-y-6">
      <UsageDashboard />
      <FeatureList />
    </div>
  </AppPage>
</template>
