<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="app">
    <nav class="navbar">
      <div class="nav-brand">
        <RouterLink to="/" class="brand">Paperland</RouterLink>
      </div>
      <div class="nav-links">
        <RouterLink to="/" class="nav-link">论文管理</RouterLink>
        <RouterLink to="/qa" class="nav-link">Q&A</RouterLink>
        <RouterLink to="/services" class="nav-link">服务管理</RouterLink>
        <RouterLink to="/settings" class="nav-link">设置</RouterLink>
      </div>
    </nav>
    <main class="main-content">
      <RouterView />
    </main>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #333;
  background: #f5f5f5;
}

.app {
  min-height: 100vh;
}

.navbar {
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
  padding: 0 24px;
  display: flex;
  align-items: center;
  height: 56px;
  gap: 32px;
}

.nav-brand .brand {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a1a;
  text-decoration: none;
}

.nav-links {
  display: flex;
  gap: 8px;
}

.nav-link {
  padding: 8px 16px;
  border-radius: 6px;
  text-decoration: none;
  color: #666;
  font-size: 14px;
  transition: background 0.2s, color 0.2s;
}

.nav-link:hover {
  background: #f0f0f0;
  color: #333;
}

.nav-link.router-link-active {
  background: #e8f0fe;
  color: #1a73e8;
}

.main-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
}
</style>
