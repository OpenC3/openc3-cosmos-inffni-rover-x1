<!--
# Copyright 2026, OpenC3, Inc.
# All Rights Reserved
-->

<!--
  ROBOTDOG - live 3D visualization of the Inffni Rover X1.

  Screen usage:
    ROBOTDOG <TARGET> <PACKET>
      SETTING HEIGHT 500
      SETTING ATTITUDE QUAT      # QUAT (default) or RPY
      SETTING MIRROR_RIGHT true  # negate abduction on the right legs
      SETTING MIRROR_REAR true   # negate hip/knee/ankle pitch on the rear legs
      SETTING RIDE_HEIGHT true   # false pins the body height instead of
                                 # resting the lowest peg foot on the ground
      SETTING JOINT_SIGNS 1 1 1 1
      SETTING ABD_BIAS 0.40 0.68  # standing abduction offset, front rear (rad)
      SETTING TELEMETRY true     # false hides the numeric overlay

  It subscribes to the IMU attitude, all four <LEG>_Q joint arrays, the
  <LEG>_MOTOR_TEMP arrays, and a few status items from
  GET_PROTOCOL_EXCHANGE_RESPONSE. The rover body takes the IMU attitude and
  each leg articulates from its live joint angles; links are tinted by motor
  temperature.
-->

<template>
  <div class="robotdog" :style="containerStyle">
    <div ref="scene" class="robotdog__scene" />

    <div v-if="showTelemetry" class="robotdog__hud">
      <div class="robotdog__row">
        <span class="robotdog__chip" :class="stateClass">{{ state }}</span>
        <span class="robotdog__chip">BAT {{ battery }}%</span>
        <span class="robotdog__chip">{{ packv }} V</span>
        <span v-if="estop" class="robotdog__chip robotdog__chip--alarm">
          E-STOP
        </span>
        <span v-if="stale" class="robotdog__chip robotdog__chip--alarm">
          STALE
        </span>
      </div>
      <div class="robotdog__row">
        <span class="robotdog__chip">ROLL {{ deg(rpy[0]) }}&deg;</span>
        <span class="robotdog__chip">PITCH {{ deg(rpy[1]) }}&deg;</span>
        <span class="robotdog__chip">YAW {{ deg(rpy[2]) }}&deg;</span>
      </div>
    </div>

    <table v-if="showTelemetry" class="robotdog__joints">
      <thead>
        <tr>
          <th>LEG</th>
          <th>ABD</th>
          <th>HIP</th>
          <th>KNEE</th>
          <th>ANK</th>
          <th>&deg;C</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="leg in legs" :key="leg.id">
          <td>{{ leg.label }}</td>
          <td v-for="i in 4" :key="i">{{ deg(jointsFor(leg.id)[i - 1]) }}</td>
          <td :class="tempClass(tempFor(leg.id))">{{ tempFor(leg.id) }}</td>
        </tr>
      </tbody>
    </table>

    <div class="robotdog__hint">drag to orbit &middot; scroll to zoom</div>
  </div>
</template>

<script>
import RoverModel, { LEGS } from './robotdog/RoverModel'

const STALE_MS = 6000

export default {
  // Standard COSMOS screen widget props. Screen definitions pass these in and
  // screenValues is the shared reactive object of subscribed telemetry:
  //   screenValues[valueId] = [value, limitsState, counter]
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
    attitudeSource() {
      return (this.setting('ATTITUDE') || 'QUAT').toUpperCase()
    },
    showTelemetry() {
      return this.setting('TELEMETRY') !== 'false'
    },
    modelOptions() {
      const signs = this.settingArray('JOINT_SIGNS')
      const bias = this.settingArray('ABD_BIAS').map(Number)
      return {
        mirrorRight: this.setting('MIRROR_RIGHT') !== 'false',
        mirrorRear: this.setting('MIRROR_REAR') !== 'false',
        autoRideHeight: this.setting('RIDE_HEIGHT') !== 'false',
        jointSigns:
          signs.length === 4 ? signs.map(Number) : [1, 1, 1, 1],
        // Standing abduction offset to subtract, front then rear, in radians
        abdBias:
          bias.length === 2
            ? { front: bias[0], rear: bias[1] }
            : { front: 0.4, rear: 0.68 },
      }
    },
    containerStyle() {
      return {
        width: this.px(this.setting('WIDTH')) || '100%',
        height: this.px(this.setting('HEIGHT')) || '450px',
      }
    },
    rpy() {
      return [0, 1, 2].map((i) => this.value(`RPY_${i}`) || 0)
    },
    quaternion() {
      return [0, 1, 2, 3].map((i) => this.value(`Q_${i}`))
    },
    joints() {
      return LEGS.reduce((acc, leg) => {
        acc[leg.id] = this.value(`${leg.id}_Q`) || []
        return acc
      }, {})
    },
    temps() {
      return LEGS.reduce((acc, leg) => {
        acc[leg.id] = this.value(`${leg.id}_MOTOR_TEMP`) || []
        return acc
      }, {})
    },
    battery() {
      return this.value('BATTERY_LEVEL') ?? '-'
    },
    packv() {
      return this.value('PACKV') ?? '-'
    },
    estop() {
      return this.value('EMERGENCY_STOP') === true
    },
    state() {
      return this.value('CURRENT_STATE') ?? 'NO DATA'
    },
    stateClass() {
      if (this.estop) {
        return 'robotdog__chip--alarm'
      }
      return String(this.state).match(/FAILED|LOW_BATTERY|INVALID/)
        ? 'robotdog__chip--warn'
        : ''
    },
    // Recomputes whenever any subscribed value changes; the watcher below
    // pushes the new pose into the three.js rig.
    pose() {
      return {
        rpy: this.rpy,
        quaternion: this.quaternion,
        joints: this.joints,
        temps: this.temps,
        searchLight: this.value('SEARCH_LIGHT_STATE') === true,
        counter: this.value('RECEIVED_COUNT'),
      }
    },
  },
  watch: {
    pose: {
      handler(pose) {
        this.lastUpdate = Date.now()
        this.applyPose(pose)
      },
    },
  },
  created() {
    const items = ['RPY_0', 'RPY_1', 'RPY_2', 'Q_0', 'Q_1', 'Q_2', 'Q_3']
    for (const leg of LEGS) {
      items.push(`${leg.id}_Q`, `${leg.id}_MOTOR_TEMP`)
    }
    items.push(
      'BATTERY_LEVEL',
      'PACKV',
      'EMERGENCY_STOP',
      'RECEIVED_COUNT',
      'SEARCH_LIGHT_STATE',
    )
    this.valueIds = items.map((item) => this.valueId(item))
    // CURRENT_STATE is FORMATTED so we get the STATE string, not the number
    this.valueIds.push(this.valueId('CURRENT_STATE', 'FORMATTED'))
    for (const valueId of this.valueIds) {
      this.$emit('addItem', valueId)
    }
  },
  mounted() {
    this.model = new RoverModel(this.$refs.scene, this.modelOptions)
    this.lastUpdate = Date.now()
    this.applyPose(this.pose)
    this.staleTimer = setInterval(() => {
      const stale = Date.now() - this.lastUpdate > STALE_MS
      if (stale !== this.stale) {
        this.stale = stale
        this.model?.setStale(stale)
      }
    }, 1000)
  },
  beforeUnmount() {
    clearInterval(this.staleTimer)
    this.model?.dispose()
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
    applyPose(pose) {
      if (!this.model) {
        return
      }
      const [w, x, y, z] = pose.quaternion
      if (this.attitudeSource === 'QUAT' && Number.isFinite(w)) {
        this.model.setAttitudeQuaternion(w, x, y, z)
      } else {
        this.model.setAttitudeRpy(pose.rpy[0], pose.rpy[1], pose.rpy[2])
      }
      for (const leg of LEGS) {
        this.model.setLegAngles(leg.id, pose.joints[leg.id])
        this.model.setLegTemps(leg.id, pose.temps[leg.id])
      }
      this.model.setSearchLight(pose.searchLight)
    },
    jointsFor(legId) {
      return this.joints[legId] || []
    },
    tempFor(legId) {
      const temps = (this.temps[legId] || []).filter((t) => Number.isFinite(t))
      return temps.length ? Math.max(...temps) : '-'
    },
    tempClass(temp) {
      if (!Number.isFinite(temp)) {
        return ''
      }
      if (temp >= 70) {
        return 'robotdog--red'
      }
      return temp >= 55 ? 'robotdog--yellow' : ''
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
.robotdog {
  position: relative;
  overflow: hidden;
  border-radius: 4px;
  background-color: #101418;
}
.robotdog__scene {
  width: 100%;
  height: 100%;
}
.robotdog__hud {
  position: absolute;
  top: 6px;
  left: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  pointer-events: none;
}
.robotdog__row {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.robotdog__chip {
  padding: 1px 6px;
  border-radius: 3px;
  background-color: rgba(38, 50, 56, 0.85);
  color: #eceff1;
  font-family: monospace;
  font-size: 12px;
  white-space: nowrap;
}
.robotdog__chip--warn {
  background-color: rgba(255, 220, 0, 0.85);
  color: #000;
}
.robotdog__chip--alarm {
  background-color: rgba(255, 45, 45, 0.9);
  color: #fff;
}
.robotdog__joints {
  position: absolute;
  right: 8px;
  bottom: 8px;
  border-collapse: collapse;
  background-color: rgba(16, 20, 24, 0.8);
  color: #eceff1;
  font-family: monospace;
  font-size: 11px;
  pointer-events: none;
}
.robotdog__joints th,
.robotdog__joints td {
  padding: 1px 6px;
  text-align: right;
  border-bottom: 1px solid rgba(144, 164, 174, 0.25);
}
.robotdog__joints th {
  color: #90a4ae;
}
.robotdog__joints td:first-child,
.robotdog__joints th:first-child {
  text-align: left;
}
.robotdog--yellow {
  color: rgb(255, 220, 0);
}
.robotdog--red {
  color: rgb(255, 45, 45);
}
.robotdog__hint {
  position: absolute;
  left: 8px;
  bottom: 6px;
  color: #607d8b;
  font-family: monospace;
  font-size: 10px;
  pointer-events: none;
}
</style>
