<script setup lang="ts">
// Home (`/`): the site's welcome dashboard — recent papers, new features, then the usage leaderboard.
import AppPage from '@/components/AppPage.vue'
import RecentPapers from '@/components/home/RecentPapers.vue'
import UsageDashboard from '@/components/home/UsageDashboard.vue'
import FeatureList from '@/components/home/FeatureList.vue'
</script>

<template>
  <AppPage>
    <div class="space-y-6">
      <RecentPapers />
      <FeatureList />
      <UsageDashboard />
    </div>
  </AppPage>
</template>
