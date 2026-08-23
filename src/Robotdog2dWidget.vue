<!--
# Copyright 2026, OpenC3, Inc.
# All Rights Reserved
-->

<!--
  ROBOTDOG2D - blueprint style 2D side profile of the Inffni Rover X1 for
  monitoring joint angles, motor temperatures and bus voltages at a glance.

  Screen usage:
    ROBOTDOG2D <TARGET> <PACKET>
      SETTING HEIGHT 720          # px, WIDTH defaults to 100%
      SETTING MIRROR_REAR true    # rear legs report pitch with the opposite sign
      SETTING JOINT_SIGNS 1 1 1 1 # per joint sign flip (ABD HIP KNEE ANK)
      SETTING TEMP_WARN 60        # yellow threshold, degC
      SETTING TEMP_ALARM 75       # red threshold, degC
      SETTING GRID true           # false hides the background grid

  The canvas is static (no orbit/zoom): every leg is drawn from its live
  <LEG>_Q joint angles, tinted by the hottest motor in that leg, and each leg
  has a callout box with per joint angles plus MOTOR/MOS/MCU temperatures and
  bus voltage. IMU attitude, pack voltage, cell spread and rover state fill the
  surrounding panels.
-->

<template>
  <div class="dog2d" :style="containerStyle">
    <svg
      class="dog2d__svg"
      :viewBox="`0 0 ${view.w} ${view.h}`"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <pattern
          id="dog2dGrid"
          width="40"
          height="40"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            :stroke="colors.grid"
            stroke-width="1"
          />
        </pattern>
        <filter id="dog2dGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect :width="view.w" :height="view.h" :fill="colors.bg" />
      <rect
        v-if="showGrid"
        :width="view.w"
        :height="view.h"
        fill="url(#dog2dGrid)"
      />

      <!-- Header -->
      <text :x="24" :y="34" class="dog2d__title">
        {{ target }} X1 &mdash; STRUCTURAL &amp; THERMAL MONITOR
      </text>
      <text :x="view.w - 24" :y="34" class="dog2d__title" text-anchor="end">
        {{ packet }}
      </text>

      <!-- Ground reference -->
      <line
        :x1="body.ground.x1"
        :y1="body.ground.y"
        :x2="body.ground.x2"
        :y2="body.ground.y"
        :stroke="colors.frame"
        stroke-width="2"
      />

      <!-- Rover: far legs, then chassis, then near legs -->
      <leg-linkage
        v-for="draw in farLegs"
        :key="`far-${draw.id}`"
        :draw="draw"
        :background="colors.bg"
      />

      <g filter="url(#dog2dGlow)">
        <path
          :d="body.shell"
          :fill="colors.fill"
          :stroke="colors.line"
          stroke-width="2.5"
        />
        <path
          :d="body.head"
          :fill="colors.fill"
          :stroke="colors.line"
          stroke-width="2.5"
        />
      </g>
      <path
        :d="body.deck"
        fill="none"
        :stroke="colors.line"
        stroke-width="1"
        stroke-opacity="0.6"
      />
      <path
        :d="body.handle"
        fill="none"
        :stroke="colors.line"
        stroke-width="1.5"
        stroke-opacity="0.8"
      />
      <!-- Hip housing shrouds: where each leg bolts to the chassis -->
      <rect
        v-for="(shroud, i) in body.shrouds"
        :key="`shroud-${i}`"
        :x="shroud.x"
        :y="shroud.y"
        :width="shroud.w"
        :height="shroud.h"
        :rx="shroud.r"
        :fill="colors.fillDim"
        :stroke="colors.line"
        stroke-width="1.2"
        stroke-opacity="0.7"
      />
      <rect
        v-for="(vent, i) in body.vents"
        :key="`vent-${i}`"
        :x="vent.x"
        :y="vent.y"
        :width="vent.w"
        :height="vent.h"
        :rx="vent.h / 2"
        fill="none"
        :stroke="colors.lineDim"
        stroke-width="1"
      />
      <circle
        :cx="body.camera.cx"
        :cy="body.camera.cy"
        :r="body.camera.r"
        fill="none"
        :stroke="colors.line"
        stroke-width="1.5"
      />
      <rect
        :x="body.light.x"
        :y="body.light.y"
        :width="body.light.w"
        :height="body.light.h"
        :rx="3"
        fill="none"
        :stroke="searchLight ? colors.warn : colors.lineDim"
        stroke-width="1.5"
      />
      <rect
        :x="body.bay.x"
        :y="body.bay.y"
        :width="body.bay.w"
        :height="body.bay.h"
        :rx="4"
        :fill="colors.fillDim"
        :stroke="colors.lineDim"
        stroke-width="1"
      />
      <text
        :x="body.bay.x + body.bay.w / 2"
        :y="body.bay.y + 21"
        class="dog2d__stencil"
        text-anchor="middle"
      >
        {{ fmt(battery, 0) }}% PACK
      </text>

      <leg-linkage
        v-for="draw in nearLegs"
        :key="`near-${draw.id}`"
        :draw="draw"
        :background="colors.bg"
      />

      <!-- Leader lines from each leg hip to its callout box -->
      <g v-for="leader in leaders" :key="`lead-${leader.id}`">
        <polyline
          :points="leader.points"
          fill="none"
          :stroke="colors.leader"
          stroke-width="1.6"
          stroke-dasharray="7 4"
        />
        <circle
          :cx="leader.hip.x"
          :cy="leader.hip.y"
          r="4"
          :fill="colors.leader"
        />
        <rect
          :x="leader.end.x - 3"
          :y="leader.end.y - 3"
          width="6"
          height="6"
          :fill="colors.leader"
        />
      </g>

      <!-- Panels -->
      <g v-for="panel in panels" :key="panel.key">
        <rect
          :x="panel.box.x"
          :y="panel.box.y"
          :width="panel.box.w"
          :height="panel.box.h"
          :fill="colors.bg"
          fill-opacity="0.85"
          :stroke="panel.stroke || colors.frame"
          stroke-width="1"
        />
        <text
          :x="panel.box.x + 10"
          :y="panel.box.y + 18"
          class="dog2d__label"
        >
          {{ panel.title }}
        </text>
        <g v-for="(row, i) in panel.rows" :key="`${panel.key}-${i}`">
          <text
            :x="panel.box.x + 10"
            :y="panel.box.y + 40 + i * 22"
            class="dog2d__label"
          >
            {{ row.label }}
          </text>
          <text
            :x="panel.box.x + panel.box.w - 10"
            :y="panel.box.y + 40 + i * 22"
            class="dog2d__value"
            :fill="row.color || colors.text"
            text-anchor="end"
          >
            {{ row.value }}<tspan class="dog2d__unit"> {{ row.unit }}</tspan>
          </text>
        </g>
      </g>

      <!-- Power rail across the bottom, battery -> pack -> cells -->
      <g>
        <line
          :x1="power.box.x - 80"
          :y1="power.box.y + 32"
          :x2="power.box.x"
          :y2="power.box.y + 32"
          :stroke="colors.power"
          stroke-width="2"
        />
        <line
          :x1="power.box.x + power.box.w"
          :y1="power.box.y + 32"
          :x2="power.box.x + power.box.w + 80"
          :y2="power.box.y + 32"
          :stroke="colors.power"
          stroke-width="2"
        />
        <rect
          :x="power.box.x"
          :y="power.box.y"
          :width="power.box.w"
          :height="power.box.h"
          :fill="colors.bg"
          fill-opacity="0.9"
          :stroke="colors.frame"
        />
        <rect
          :x="power.box.x + 12"
          :y="power.box.y + 40"
          :width="power.box.w - 24"
          height="10"
          :fill="colors.fillDim"
          :stroke="colors.lineDim"
        />
        <rect
          :x="power.box.x + 12"
          :y="power.box.y + 40"
          :width="batteryBarWidth"
          height="10"
          :fill="batteryColor"
        />
        <text :x="power.box.x + 12" :y="power.box.y + 26" class="dog2d__label">
          POWER
        </text>
        <text
          v-for="(cell, i) in powerCells"
          :key="`pw-${i}`"
          :x="power.box.x + 110 + i * 100"
          :y="power.box.y + 26"
          class="dog2d__value"
          :fill="cell.color || colors.text"
        >
          {{ cell.value }}<tspan class="dog2d__unit"> {{ cell.unit }}</tspan>
        </text>
      </g>

      <!-- Thermal legend -->
      <g>
        <text :x="24" :y="view.h - 42" class="dog2d__label">MOTOR TEMP</text>
        <rect
          v-for="(stop, i) in legend"
          :key="`lg-${i}`"
          :x="24 + i * 26"
          :y="view.h - 34"
          width="26"
          height="8"
          :fill="stop.color"
        />
        <text :x="24" :y="view.h - 14" class="dog2d__unit">20</text>
        <text
          :x="24 + legend.length * 26"
          :y="view.h - 14"
          class="dog2d__unit"
          text-anchor="end"
        >
          85 &deg;C
        </text>
      </g>

      <text
        v-if="stale"
        :x="view.w / 2"
        :y="view.h / 2"
        class="dog2d__stale"
        text-anchor="middle"
      >
        STALE
      </text>
    </svg>
  </div>
</template>

<script>
import LegLinkage from './robotdog2d/LegLinkage.vue'
import {
  BODY,
  BOXES,
  BUS_BOX,
  COLORS,
  IMU_BOX,
  JOINTS,
  LEGS,
  LINK,
  POWER_BOX,
  STATE_BOX,
  VIEW,
  capsulePath,
  legPoints,
  seamPath,
  tempColor,
} from './robotdog2d/layout'

const STALE_MS = 6000

// Angle arrays are 32 elements wide in telemetry but only the first 4 joints of
// each leg are populated.
function num(array, index) {
  const value = Array.isArray(array) ? array[index] : null
  return Number.isFinite(value) ? value : null
}

function maxFinite(array) {
  const values = (Array.isArray(array) ? array : []).filter((v) =>
    Number.isFinite(v),
  )
  return values.length ? Math.max(...values) : null
}

export default {
  components: { LegLinkage },
  props: {
    parameters: { type: Array, default: () => [] },
    settings: { type: Array, default: () => [] },
    screenValues: { type: Object, default: () => ({}) },
    screenTimeZone: { type: String, default: 'local' },
    widgetIndex: { type: Number, default: null },
    line: { type: String, default: '' },
    lineNumber: { type: Number, default: 0 },
  },
  emits: ['addItem', 'deleteItem'],
  data() {
    return {
      view: VIEW,
      body: BODY,
      colors: COLORS,
      legs: LEGS,
      valueIds: [],
      stale: false,
      lastUpdate: 0,
    }
  },
  computed: {
    target() {
      return this.parameters[0] || 'ROVER'
    },
    packet() {
      return this.parameters[1] || 'GET_PROTOCOL_EXCHANGE_RESPONSE'
    },
    showGrid() {
      return this.setting('GRID') !== 'false'
    },
    tempWarn() {
      return Number(this.setting('TEMP_WARN')) || 60
    },
    tempAlarm() {
      return Number(this.setting('TEMP_ALARM')) || 75
    },
    mirrorRear() {
      return this.setting('MIRROR_REAR') !== 'false'
    },
    jointSigns() {
      const signs = this.settingArray('JOINT_SIGNS').map(Number)
      return signs.length === 4 ? signs : [1, 1, 1, 1]
    },
    containerStyle() {
      return {
        width: this.px(this.setting('WIDTH')) || '100%',
        height: this.px(this.setting('HEIGHT')) || '720px',
      }
    },
    // Drawing geometry for all four legs, derived from the live joint angles.
    legDraws() {
      return LEGS.map((leg) => {
        const angles = this.legAngles(leg)
        const { kneePt, footPt, pegPt } = legPoints(leg.hip, angles)
        const temps = this.array(`${leg.id}_MOTOR_TEMP`)
        const stub = {
          x: leg.hip.x + (leg.near ? LINK.abductor : -LINK.abductor),
          y: leg.hip.y - 4,
        }
        return {
          id: leg.id,
          label: leg.label,
          hip: leg.hip,
          knee: kneePt,
          foot: footPt,
          near: leg.near,
          opacity: leg.near ? 1 : 0.4,
          yoke: capsulePath(leg.hip, stub, ...LINK.yokeWidth),
          thigh: capsulePath(leg.hip, kneePt, ...LINK.thighWidth),
          thighSeam: seamPath(leg.hip, kneePt),
          calf: capsulePath(kneePt, footPt, ...LINK.calfWidth),
          calfSeam: seamPath(kneePt, footPt),
          pegTip: pegPt,
          peg: capsulePath(footPt, pegPt, ...LINK.pegWidth),
          // One color per joint: ABD, HIP, KNEE, ANK motor temperature. Far
          // legs stay a flat dim blue so the near pair reads as the live one.
          colors: [0, 1, 2, 3].map((i) =>
            leg.near ? tempColor(num(temps, i)) : COLORS.lineDim,
          ),
        }
      })
    },
    nearLegs() {
      return this.legDraws.filter((draw) => draw.near)
    },
    farLegs() {
      return this.legDraws.filter((draw) => !draw.near)
    },
    rpy() {
      return [0, 1, 2].map((i) => this.value(`RPY_${i}`))
    },
    battery() {
      return this.value('BATTERY_LEVEL')
    },
    packv() {
      return this.value('PACKV')
    },
    vtop() {
      return this.value('VTOP')
    },
    searchLight() {
      return this.value('SEARCH_LIGHT_STATE') === true
    },
    estop() {
      return this.value('EMERGENCY_STOP') === true
    },
    cells() {
      // CELLS_VOLTAGE is a fixed length array; trailing slots read back as 0.
      return (this.value('CELLS_VOLTAGE') || []).filter(
        (v) => Number.isFinite(v) && v > 0,
      )
    },
    batteryColor() {
      const level = this.battery
      if (!Number.isFinite(level)) {
        return COLORS.lineDim
      }
      if (level <= 15) {
        return COLORS.alarm
      }
      return level <= 35 ? COLORS.warn : COLORS.ok
    },
    batteryBarWidth() {
      const level = Number.isFinite(this.battery) ? this.battery : 0
      const span = POWER_BOX.w - 24
      return Math.max(0, Math.min(100, level)) * (span / 100)
    },
    power() {
      return { box: POWER_BOX }
    },
    powerCells() {
      const min = this.cells.length ? Math.min(...this.cells) : null
      const max = this.cells.length ? Math.max(...this.cells) : null
      const delta = min === null ? null : max - min
      return [
        { value: this.fmt(this.packv, 0), unit: 'V pack' },
        { value: this.fmt(this.vtop, 0), unit: 'V top' },
        { value: this.fmt(min, 0), unit: 'mV min' },
        {
          value: this.fmt(delta, 0),
          unit: 'mV spread',
          color:
            Number.isFinite(delta) && delta > 100 ? COLORS.warn : COLORS.text,
        },
      ]
    },
    legend() {
      return [20, 30, 40, 50, 60, 70, 80].map((t) => ({ color: tempColor(t) }))
    },
    // One callout panel per leg plus the IMU, state and bus voltage panels.
    panels() {
      const panels = LEGS.map((leg) => {
        const angles = this.legAngles(leg)
        const motor = this.array(`${leg.id}_MOTOR_TEMP`)
        const hottest = maxFinite(motor)
        const rows = JOINTS.map((name, i) => ({
          label: name,
          value: this.deg(angles[i]),
          unit: '°',
          color: COLORS.text,
        }))
        rows.push({
          label: 'MOTOR',
          value: this.fmt(hottest, 0),
          unit: '°C',
          color: this.tempTextColor(hottest),
        })
        rows.push({
          label: 'MOS / MCU',
          value: [
            this.fmt(maxFinite(this.array(`${leg.id}_MOS_TEMP`)), 0),
            this.fmt(maxFinite(this.array(`${leg.id}_MCU_TEMP`)), 0),
          ].join(' / '),
          unit: '°C',
          color: COLORS.text,
        })
        return {
          key: leg.id,
          title: `${leg.label}  ${leg.short}`,
          box: BOXES[leg.id],
          stroke: this.legFault(leg) ? COLORS.alarm : COLORS.frame,
          rows,
        }
      })

      panels.push({
        key: 'IMU',
        title: 'imu attitude',
        box: IMU_BOX,
        rows: [
          { label: 'ROLL', value: this.deg(this.rpy[0]), unit: '°' },
          { label: 'PITCH', value: this.deg(this.rpy[1]), unit: '°' },
          {
            label: 'IMU_TEMP',
            value: this.fmt(this.value('IMU_TEMP'), 1),
            unit: '°C',
            color: this.tempTextColor(this.value('IMU_TEMP')),
          },
        ],
      })

      panels.push({
        key: 'STATE',
        title: 'rover state',
        box: STATE_BOX,
        stroke: this.estop ? COLORS.alarm : COLORS.frame,
        rows: [
          {
            label: 'CURRENT_STATE',
            value: this.value('CURRENT_STATE') ?? 'NO DATA',
            unit: '',
            color: this.estop ? COLORS.alarm : COLORS.text,
          },
          {
            label: 'EMERGENCY_STOP',
            value: this.estop ? 'TRIPPED' : 'CLEAR',
            unit: '',
            color: this.estop ? COLORS.alarm : COLORS.ok,
          },
          { label: 'YAW', value: this.deg(this.rpy[2]), unit: '°' },
        ],
      })

      panels.push({
        key: 'BUS',
        title: 'leg bus voltage',
        box: BUS_BOX,
        rows: LEGS.map((leg) => {
          const bus = maxFinite(this.array(`${leg.id}_BUS_V`))
          return {
            label: `${leg.label} BUS_V`,
            value: this.fmt(bus, 0),
            unit: 'V',
            color:
              Number.isFinite(bus) && bus < 40 ? COLORS.warn : COLORS.text,
          }
        }),
      })

      return panels
    },
    // Elbowed leader lines, hip -> callout box, with both endpoints marked.
    leaders() {
      return LEGS.map((leg) => {
        const box = BOXES[leg.id]
        const right = box.x > VIEW.w / 2
        const edgeX = right ? box.x : box.x + box.w
        const edgeY = box.y + box.h - 16
        const midX = (leg.hip.x + edgeX) / 2
        return {
          id: leg.id,
          hip: leg.hip,
          end: { x: edgeX, y: edgeY },
          points: [
            `${leg.hip.x},${leg.hip.y}`,
            `${midX},${leg.hip.y}`,
            `${midX},${edgeY}`,
            `${edgeX},${edgeY}`,
          ].join(' '),
        }
      })
    },
    // Recomputes on any subscribed value change; used only to stamp freshness.
    watchAll() {
      return [
        this.rpy,
        this.battery,
        this.packv,
        LEGS.map((leg) => this.array(`${leg.id}_Q`)),
        LEGS.map((leg) => this.array(`${leg.id}_MOTOR_TEMP`)),
      ]
    },
  },
  watch: {
    watchAll() {
      this.lastUpdate = Date.now()
      if (this.stale) {
        this.stale = false
      }
    },
  },
  created() {
    const items = ['RPY_0', 'RPY_1', 'RPY_2', 'IMU_TEMP']
    for (const leg of LEGS) {
      items.push(
        `${leg.id}_Q`,
        `${leg.id}_MOTOR_TEMP`,
        `${leg.id}_MOS_TEMP`,
        `${leg.id}_MCU_TEMP`,
        `${leg.id}_BUS_V`,
        `${leg.id}_ERROR_CODE`,
      )
    }
    items.push(
      'BATTERY_LEVEL',
      'PACKV',
      'VTOP',
      'CELLS_VOLTAGE',
      'EMERGENCY_STOP',
      'SEARCH_LIGHT_STATE',
    )
    this.valueIds = items.map((item) => this.valueId(item))
    // CURRENT_STATE is an integer with STATE strings, so ask for FORMATTED
    this.valueIds.push(this.valueId('CURRENT_STATE', 'FORMATTED'))
    for (const valueId of this.valueIds) {
      this.$emit('addItem', valueId)
    }
  },
  mounted() {
    this.lastUpdate = Date.now()
    this.staleTimer = setInterval(() => {
      this.stale = Date.now() - this.lastUpdate > STALE_MS
    }, 1000)
  },
  beforeUnmount() {
    clearInterval(this.staleTimer)
    for (const valueId of this.valueIds) {
      this.$emit('deleteItem', valueId)
    }
  },
  methods: {
    valueId(item, type = 'CONVERTED') {
      return `${this.target}__${this.packet}__${item}__${type}`
    },
    value(item, type = 'CONVERTED') {
      if (item === 'CURRENT_STATE') {
        type = 'FORMATTED'
      }
      const entry = this.screenValues[this.valueId(item, type)]
      return entry ? entry[0] : null
    },
    array(item) {
      const value = this.value(item)
      return Array.isArray(value) ? value : []
    },
    setting(name) {
      return this.settings.find((s) => s[0] === name)?.[1]
    },
    settingArray(name) {
      return this.settings.find((s) => s[0] === name)?.slice(1) || []
    },
    px(value) {
      if (!value) {
        return null
      }
      return Number.isFinite(Number(value)) ? `${value}px` : value
    },
    // Raw joint angles with the sign conventions applied. The rear legs report
    // hip/knee/ankle pitch inverted relative to the front legs.
    legAngles(leg) {
      const q = this.array(`${leg.id}_Q`)
      return JOINTS.map((_, i) => {
        let angle = num(q, i)
        if (angle === null) {
          return null
        }
        angle *= this.jointSigns[i] || 1
        if (i > 0 && this.mirrorRear && leg.end < 0) {
          angle = -angle
        }
        return angle
      })
    },
    legFault(leg) {
      const codes = this.array(`${leg.id}_ERROR_CODE`)
      return codes.some((code) => Number.isFinite(code) && code !== 0)
    },
    tempTextColor(temp) {
      if (!Number.isFinite(temp)) {
        return COLORS.label
      }
      if (temp >= this.tempAlarm) {
        return COLORS.alarm
      }
      return temp >= this.tempWarn ? COLORS.warn : COLORS.text
    },
    fmt(value, digits = 1) {
      return Number.isFinite(value) ? value.toFixed(digits) : '-'
    },
    deg(radians) {
      if (!Number.isFinite(radians)) {
        return '-'
      }
      return ((radians * 180) / Math.PI).toFixed(1)
    },
  },
}
</script>

<style scoped>
.dog2d {
  position: relative;
  overflow: hidden;
  border-radius: 4px;
  background-color: #080c11;
}
.dog2d__svg {
  display: block;
  width: 100%;
  height: 100%;
}
.dog2d__title {
  fill: #607d8b;
  font-family: monospace;
  font-size: 14px;
  letter-spacing: 1px;
}
.dog2d__label {
  fill: #607d8b;
  font-family: monospace;
  font-size: 12px;
}
.dog2d__value {
  font-family: monospace;
  font-size: 15px;
}
.dog2d__unit {
  fill: #546e7a;
  font-family: monospace;
  font-size: 11px;
}
.dog2d__stencil {
  fill: #4fc3f7;
  font-family: monospace;
  font-size: 13px;
  letter-spacing: 1px;
}
.dog2d__stale {
  fill: rgba(255, 82, 82, 0.65);
  font-family: monospace;
  font-size: 64px;
  letter-spacing: 8px;
}
</style>
