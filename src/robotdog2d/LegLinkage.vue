<!--
# Copyright 2026, OpenC3, Inc.
# All Rights Reserved
-->

<!--
  One leg of the 2D Rover X1 schematic: hip motor housing, abductor yoke, thigh
  shell, calf tube and peg foot. Links are drawn as filled capsule shells outlined
  in their own motor temperature color; the parent computes all geometry so this
  component is pure drawing.
-->

<template>
  <g :opacity="draw.opacity">
    <!-- Abductor yoke stub toward the viewer -->
    <path
      :d="draw.yoke"
      :fill="shellFill"
      :stroke="draw.colors[0]"
      :stroke-width="edge"
    />

    <!-- Thigh shell -->
    <path
      :d="draw.thigh"
      :fill="shellFill"
      :stroke="draw.colors[1]"
      :stroke-width="edge"
    />
    <path
      :d="draw.thighSeam"
      fill="none"
      :stroke="draw.colors[1]"
      stroke-width="1"
      stroke-opacity="0.55"
    />

    <!-- Calf tube -->
    <path
      :d="draw.calf"
      :fill="shellFill"
      :stroke="draw.colors[2]"
      :stroke-width="edge"
    />
    <path
      :d="draw.calfSeam"
      fill="none"
      :stroke="draw.colors[2]"
      stroke-width="1"
      stroke-opacity="0.55"
    />

    <!-- Hip motor housing: the big black disc on the real rover -->
    <circle
      :cx="draw.hip.x"
      :cy="draw.hip.y"
      :r="hipRadius"
      :fill="jointFill"
      :stroke="draw.colors[1]"
      :stroke-width="edge"
    />
    <circle
      :cx="draw.hip.x"
      :cy="draw.hip.y"
      :r="hipRadius * 0.42"
      fill="none"
      :stroke="draw.colors[1]"
      stroke-width="1"
      stroke-opacity="0.7"
    />

    <!-- Knee housing -->
    <circle
      :cx="draw.knee.x"
      :cy="draw.knee.y"
      :r="kneeRadius"
      :fill="jointFill"
      :stroke="draw.colors[2]"
      :stroke-width="edge"
    />

    <!-- Peg foot: shaft off the ankle, capped by the rubber contact tip -->
    <path
      :d="draw.peg"
      :fill="shellFill"
      :stroke="draw.colors[3]"
      :stroke-width="edge"
    />

    <!-- Ankle housing -->
    <circle
      :cx="draw.foot.x"
      :cy="draw.foot.y"
      :r="ankleRadius"
      :fill="jointFill"
      :stroke="draw.colors[3]"
      :stroke-width="edge"
    />

    <circle
      :cx="draw.pegTip.x"
      :cy="draw.pegTip.y"
      :r="pegTipRadius"
      :fill="jointFill"
      :stroke="draw.colors[3]"
      :stroke-width="edge"
    />

    <text
      :x="draw.pegTip.x"
      :y="draw.pegTip.y + pegTipRadius + 20"
      class="leg__label"
      text-anchor="middle"
    >
      {{ draw.label }}
    </text>
  </g>
</template>

<script>
import { LINK } from './layout'

export default {
  name: 'LegLinkage',
  props: {
    draw: { type: Object, required: true },
    background: { type: String, default: '#080c11' },
  },
  data() {
    return {
      hipRadius: LINK.hipRadius,
      kneeRadius: LINK.kneeRadius,
      ankleRadius: LINK.ankleRadius,
      pegTipRadius: LINK.pegTipRadius,
    }
  },
  computed: {
    // Far legs get flatter fills and thinner outlines so the near pair reads as
    // the live one.
    shellFill() {
      return this.draw.near
        ? 'rgba(33, 150, 243, 0.16)'
        : 'rgba(33, 150, 243, 0.05)'
    },
    jointFill() {
      return this.draw.near ? 'rgba(8, 14, 20, 0.92)' : this.background
    },
    edge() {
      return this.draw.near ? 2 : 1.2
    },
  },
}
</script>

<style scoped>
.leg__label {
  fill: #607d8b;
  font-family: monospace;
  font-size: 12px;
}
</style>
