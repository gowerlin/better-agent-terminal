<script setup lang="ts">
import StoryIllo, { type StoryIlloKind } from './StoryIllo.vue'

defineProps<{
  time: string
  title: string
  illo: StoryIlloKind
  // 分工標籤：['BAT', '派工、啟動確認'] 之類
  roles: Array<[string, string]>
}>()
</script>

<template>
  <li class="story-chapter" :data-time="time">
    <div class="story-clock-col">
      <p class="story-clock" :class="{ 'is-words': !/^\d/.test(time) }">{{ time }}</p>
    </div>
    <article class="story-body" :aria-label="`${time}：${title}`">
      <h3 class="story-title">{{ title }}</h3>
      <div class="story-pair">
        <section class="story-card is-before">
          <h4>以前</h4>
          <p><slot name="before" /></p>
        </section>
        <section class="story-card is-after">
          <h4>BAT + CT</h4>
          <p><slot name="after" /></p>
        </section>
      </div>
      <StoryIllo :kind="illo" />
      <ul class="story-roles" aria-label="分工">
        <li v-for="[who, what] in roles" :key="who" class="story-role" :class="who === 'CT' ? 'is-ct' : 'is-bat'">
          <b>{{ who }}</b>：{{ what }}
        </li>
      </ul>
    </article>
  </li>
</template>
