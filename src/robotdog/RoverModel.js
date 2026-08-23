/*
# Copyright 2026, OpenC3, Inc.
# All Rights Reserved
*/

// three.js rig for the Inffni Rover X1 quadruped.
//
// Frame convention used here (all internal, right handed):
//   +X = forward (nose)
//   +Y = up
//   +Z = starboard (right side of the rover)
//
// Joint mapping per leg, matching the 4 element q array in
// GET_PROTOCOL_EXCHANGE_RESPONSE <LEG>_Q:
//   q[0] hip abduction  - rotation about X (swings the leg outboard)
//   q[1] hip pitch      - rotation about Z (swings the leg fore/aft)
//   q[2] knee           - rotation about Z (bends the calf)
//   q[3] ankle          - rotation about Z (pitches the peg foot fore/aft)

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// Rough X1 dimensions in meters. Purely cosmetic - the joint angles are real.
const BODY = { length: 0.46, width: 0.20, height: 0.105 }
const HIP_X = 0.19 // fore/aft hip offset from body center
const HIP_Z = 0.1 // lateral hip offset from body center
const ABDUCTOR = 0.06 // hip yoke length (outboard offset to the thigh)
const THIGH = 0.2
const CALF = 0.2
// Peg foot: a slim shaft off the ankle capped by a rubber contact tip.
const PEG_LENGTH = 0.055
const PEG_RADIUS = 0.012
const PEG_TIP_RADIUS = 0.018

// Stance used before any joint telemetry arrives, and whenever a leg reports
// nothing: the splayed pose the rover ships in (see the product photo) with the
// thighs swung aft and the knees folded forward.
const REST_Q = [0.44, 0.38, -0.85, 0]

// Shell white / dark composite of the real X1. Joint housings are tinted by
// motor temperature, so they start dark and become the thermal readout.
const SHELL_COLOR = 0xf7f9fa
const DARK_COLOR = 0x1c2126

// side: -1 = port, +1 = starboard. end: +1 = front, -1 = rear.
export const LEGS = [
  { id: 'LEFT_FRONT', label: 'LF', x: HIP_X, z: -HIP_Z, side: -1, end: 1 },
  { id: 'RIGHT_FRONT', label: 'RF', x: HIP_X, z: HIP_Z, side: 1, end: 1 },
  { id: 'LEFT_REAR', label: 'LR', x: -HIP_X, z: -HIP_Z, side: -1, end: -1 },
  { id: 'RIGHT_REAR', label: 'RR', x: -HIP_X, z: HIP_Z, side: 1, end: -1 },
]

const COLD = new THREE.Color(0x2196f3)
const WARM = new THREE.Color(0x4caf50)
const HOT = new THREE.Color(0xff5252)

// Map a motor temperature to a color: blue (cold) -> green (nominal) -> red (hot)
function tempColor(temp) {
  if (temp === null || temp === undefined || Number.isNaN(temp)) {
    return WARM.clone()
  }
  if (temp <= 30) {
    return COLD.clone().lerp(WARM, Math.max(0, (temp - 10) / 20))
  }
  return WARM.clone().lerp(HOT, Math.min(1, (temp - 30) / 45))
}

export default class RoverModel {
  constructor(container, options = {}) {
    this.container = container
    this.options = {
      // The right legs report abduction with the opposite sign of the left legs
      mirrorRight: true,
      // The rear legs report pitch (hip/knee/ankle) with the opposite sign of
      // the front legs - see the sample telemetry where the front knees sit
      // near -1.34 rad while the rear knees sit near +1.35 rad in the same pose
      mirrorRear: true,
      jointSigns: [1, 1, 1, 1],
      // The rover reports abduction with a large zero offset: standing still it
      // reads about 0.40 rad on the front legs and 0.68 on the rear (see
      // docs/http_captures), yet the legs hang nearly vertical. Subtract that
      // offset so a nominal packet draws the stance in the product photo.
      abdBias: { front: 0.4, rear: 0.68 },
      autoRideHeight: true,
      ...options,
    }
    // Ankle pivot to the bottom of the peg tip, used for the ride height
    this.endRadius = PEG_LENGTH + PEG_TIP_RADIUS * 0.8
    this._tmpVec = new THREE.Vector3()
    this.disposed = false
    this.legs = {}
    this.targetQuat = new THREE.Quaternion()
    this.stale = false

    this._initScene()
    this._buildRover()
    this._observeResize()
    this._animate()
  }

  _initScene() {
    const { clientWidth: w, clientHeight: h } = this.container

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x101418)

    // Low three quarter view from the front starboard side, matching the
    // reference product photo.
    this.camera = new THREE.PerspectiveCamera(42, (w || 640) / (h || 400), 0.05, 50)
    this.camera.position.set(0.95, 0.38, 0.85)

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(w || 640, h || 400)
    this.renderer.shadowMap.enabled = true
    this.container.appendChild(this.renderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.target.set(0, 0.22, 0)
    this.controls.minDistance = 0.4
    this.controls.maxDistance = 5

    this.scene.add(new THREE.HemisphereLight(0xdce8ff, 0x2a2f33, 1.35))
    const sun = new THREE.DirectionalLight(0xffffff, 1.4)
    sun.position.set(1, 2, 1.5)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    this.scene.add(sun)

    // Ground plane + grid. The rover pitches/rolls above a fixed world ground
    // so attitude reads intuitively.
    const grid = new THREE.GridHelper(4, 40, 0x37474f, 0x263238)
    this.scene.add(grid)
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 4),
      new THREE.ShadowMaterial({ opacity: 0.35 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.001
    ground.receiveShadow = true
    this.scene.add(ground)

    // World axes: red = forward(X), green = up(Y), blue = starboard(Z)
    const axes = new THREE.AxesHelper(0.35)
    axes.position.set(0, 0.001, 0)
    this.scene.add(axes)
  }

  _buildRover() {
    // bodyGroup carries the IMU attitude; everything below it is body-fixed.
    this.bodyGroup = new THREE.Group()
    this.bodyGroup.position.y = 0.42
    this.scene.add(this.bodyGroup)

    // Chassis: white upper shell over a dark underbody, with a recessed deck
    // plate on top - the three tones the real rover reads as from a distance.
    const shell = new THREE.Mesh(
      this._roundedSlab(BODY.length, BODY.height, BODY.width * 0.92, 0.035),
      this._shellMat(),
    )
    shell.castShadow = true
    this.bodyGroup.add(shell)

    const belly = new THREE.Mesh(
      this._roundedSlab(BODY.length * 0.94, 0.05, BODY.width * 0.86, 0.02),
      this._darkMat(),
    )
    belly.position.y = -BODY.height / 2 - 0.015
    belly.castShadow = true
    this.bodyGroup.add(belly)

    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(BODY.length * 0.62, 0.012, BODY.width * 0.88),
      new THREE.MeshStandardMaterial({
        color: 0xb0bec5,
        metalness: 0.6,
        roughness: 0.35,
      }),
    )
    deck.position.set(-0.03, BODY.height / 2 + 0.002, 0)
    this.bodyGroup.add(deck)

    // Sensor head: dark pod, white cap, carry handle and the search light bar.
    const head = new THREE.Group()
    head.position.set(BODY.length / 2 + 0.045, 0.005, 0)
    this.bodyGroup.add(head)

    const pod = new THREE.Mesh(
      new THREE.BoxGeometry(0.085, 0.135, BODY.width * 0.95),
      this._darkMat(),
    )
    pod.castShadow = true
    head.add(pod)

    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.095, 0.02, BODY.width * 0.97),
      this._shellMat(),
    )
    cap.position.y = 0.077
    head.add(cap)

    // Carry handle: two posts and a top bar, like the loop on the real head
    for (const dz of [-BODY.width * 0.38, BODY.width * 0.38]) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.01, 0.05, 0.012),
        this._shellMat(),
      )
      post.position.set(0.05, 0.05, dz)
      head.add(post)
    }
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.012, BODY.width * 0.82),
      this._shellMat(),
    )
    handle.position.set(0.05, 0.072, 0)
    head.add(handle)

    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.012, 20),
      new THREE.MeshStandardMaterial({ color: 0x0d1114, roughness: 0.2 }),
    )
    lens.rotation.z = Math.PI / 2
    lens.position.set(0.048, 0.055, 0)
    head.add(lens)

    this.searchLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, 0.03, 0.1),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xfff3c4,
        emissiveIntensity: 0.8,
      }),
    )
    this.searchLight.position.set(0.05, -0.02, 0)
    head.add(this.searchLight)

    for (const leg of LEGS) {
      const shoulder = new THREE.Mesh(
        this._roundedSlab(0.092, 0.088, 0.04, 0.018),
        this._darkMat(),
      )
      shoulder.position.set(leg.x, -0.01, leg.z * 0.82 + leg.side * 0.02)
      shoulder.castShadow = true
      this.bodyGroup.add(shoulder)
      this.legs[leg.id] = this._buildLeg(leg)
    }
  }

  // Rounded slab: a rounded rectangle in the XZ side profile extruded across
  // the rover's width. Gives the moulded shell look of the real chassis instead
  // of a hard edged box.
  _roundedSlab(length, height, depth, radius) {
    const x = -length / 2
    const y = -height / 2
    const shape = new THREE.Shape()
    shape.moveTo(x + radius, y)
    shape.lineTo(x + length - radius, y)
    shape.quadraticCurveTo(x + length, y, x + length, y + radius)
    shape.lineTo(x + length, y + height - radius)
    shape.quadraticCurveTo(x + length, y + height, x + length - radius, y + height)
    shape.lineTo(x + radius, y + height)
    shape.quadraticCurveTo(x, y + height, x, y + height - radius)
    shape.lineTo(x, y + radius)
    shape.quadraticCurveTo(x, y, x + radius, y)
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSize: 0.008,
      bevelThickness: 0.008,
      bevelSegments: 3,
      curveSegments: 8,
    })
    geometry.translate(0, 0, -depth / 2)
    return geometry
  }

  _shellMat() {
    return new THREE.MeshStandardMaterial({
      color: SHELL_COLOR,
      metalness: 0.25,
      roughness: 0.35,
    })
  }

  _darkMat() {
    return new THREE.MeshStandardMaterial({
      color: DARK_COLOR,
      metalness: 0.3,
      roughness: 0.6,
    })
  }

  _buildLeg(leg) {
    // hip: abduction about X
    const hip = new THREE.Group()
    hip.position.set(leg.x, -BODY.height / 2 + 0.02, leg.z)
    this.bodyGroup.add(hip)

    // Abductor housing: the big dark motor can at the shoulder. Tinted by the
    // abduction motor temperature.
    const hipHousing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, 0.05, 24),
      this._darkMat(),
    )
    hipHousing.rotation.x = Math.PI / 2
    hipHousing.position.z = leg.side * 0.028
    hipHousing.castShadow = true
    hip.add(hipHousing)

    // yoke: fixed outboard offset from the abductor to the thigh pivot
    const yoke = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.06, ABDUCTOR),
      this._shellMat(),
    )
    yoke.position.z = (leg.side * ABDUCTOR) / 2
    yoke.castShadow = true
    hip.add(yoke)

    // thigh: pitch about Z. A broad white shell tapering into the knee, with a
    // dark inboard strip so the link reads as a moulded part, not a stick.
    const thigh = new THREE.Group()
    thigh.position.z = leg.side * ABDUCTOR
    hip.add(thigh)

    const thighShell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.028, THIGH, 16),
      this._shellMat(),
    )
    thighShell.scale.z = 0.55
    thighShell.position.y = -THIGH / 2
    thighShell.castShadow = true
    thigh.add(thighShell)

    // Thigh accent strip, tinted by the hip pitch motor temperature.
    const thighAccent = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, THIGH * 0.8, 0.012),
      this._darkMat(),
    )
    thighAccent.position.set(0, -THIGH / 2, -leg.side * 0.03)
    thigh.add(thighAccent)

    // knee: dark housing between the thigh shell and the slim calf tube
    const knee = new THREE.Group()
    knee.position.y = -THIGH
    thigh.add(knee)

    const kneeHousing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 0.045, 20),
      this._darkMat(),
    )
    kneeHousing.rotation.x = Math.PI / 2
    kneeHousing.castShadow = true
    knee.add(kneeHousing)

    const calfShell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.019, 0.014, CALF, 14),
      this._shellMat(),
    )
    calfShell.scale.z = 0.85
    calfShell.position.y = -CALF / 2
    calfShell.castShadow = true
    knee.add(calfShell)

    // peg foot - pitches fore/aft with q[3]
    const ankle = new THREE.Group()
    ankle.position.y = -CALF
    knee.add(ankle)

    // Ankle housing carries the fourth motor temperature.
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.036, 18),
      this._darkMat(),
    )
    hub.rotation.x = Math.PI / 2
    hub.castShadow = true
    ankle.add(hub)

    // Peg shaft, tapering into the rubber contact tip.
    const peg = new THREE.Mesh(
      new THREE.CylinderGeometry(PEG_RADIUS, PEG_RADIUS * 0.8, PEG_LENGTH, 14),
      this._shellMat(),
    )
    peg.position.y = -PEG_LENGTH / 2
    peg.castShadow = true
    ankle.add(peg)

    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(PEG_TIP_RADIUS, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0x15181b, roughness: 0.95 }),
    )
    tip.position.y = -PEG_LENGTH
    tip.scale.y = 0.8
    tip.castShadow = true
    ankle.add(tip)

    const parts = {
      def: leg,
      hip,
      thigh,
      knee,
      ankle,
      // One mesh per joint, in <LEG>_MOTOR_TEMP order: ABD, HIP, KNEE, ANK
      thermal: [hipHousing, thighAccent, kneeHousing, hub],
    }
    // Sit in the shipped stance until joint telemetry shows up.
    this._applyAngles(parts, REST_Q)
    return parts
  }

  // --- telemetry inputs -----------------------------------------------------

  // rpy: [roll, pitch, yaw] radians from $.imu.rpy
  setAttitudeRpy(roll, pitch, yaw) {
    const q = new THREE.Quaternion()
    const qy = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      -(yaw || 0), // +yaw = nose right, which is -Y in this frame
    )
    const qp = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      pitch || 0, // +pitch = nose up
    )
    const qr = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      -(roll || 0), // +roll = right side down
    )
    q.multiply(qy).multiply(qp).multiply(qr)
    this.targetQuat.copy(q)
  }

  // quat: [w, x, y, z] from $.imu.quaternion, body frame X fwd / Y left / Z up.
  // Remap into this scene's X fwd / Y up / Z right frame.
  setAttitudeQuaternion(w, x, y, z) {
    this.targetQuat.set(x, z, -y, w).normalize()
  }

  // q: 4 element joint array in radians. Falls back to the rest stance so the
  // rover stands like the reference photo before telemetry arrives.
  setLegAngles(legId, q) {
    const leg = this.legs[legId]
    if (!leg) {
      return
    }
    const angles = Number.isFinite(q?.[1]) ? q : REST_Q
    this._applyAngles(leg, angles)
  }

  _applyAngles(leg, q) {
    const s = this.options.jointSigns
    // Rotation about +X swings a foot to port, so a leg splays outboard on a
    // negative rotation to starboard and a positive one to port: hence the
    // -side factor. mirrorRight then undoes the rover reporting the starboard
    // legs' abduction with the opposite sign.
    const mirror = this.options.mirrorRight && leg.def.side > 0 ? -1 : 1
    const bias =
      leg.def.end > 0 ? this.options.abdBias.front : this.options.abdBias.rear
    // Outboard-positive abduction on both sides, less its standing offset
    const splay = mirror * (q[0] || 0) - bias
    // rotation.z about +Z (starboard) swings a link forward, but the telemetry
    // convention is positive-aft (see the 2D widget), so the base sign is -1.
    // The rear legs then report pitch inverted relative to the front pair.
    const pitch = this.options.mirrorRear && leg.def.end < 0 ? 1 : -1
    leg.hip.rotation.x = -leg.def.side * s[0] * splay
    leg.thigh.rotation.z = pitch * s[1] * (q[1] || 0)
    leg.knee.rotation.z = pitch * s[2] * (q[2] || 0)
    leg.ankle.rotation.z = pitch * s[3] * (q[3] || 0)
  }

  // temps: 4 element motor_temp array. Each joint housing takes its own motor
  // temperature so the white shells stay white and the dark joints read as the
  // thermal display.
  setLegTemps(legId, temps) {
    const leg = this.legs[legId]
    if (!leg || !temps) {
      return
    }
    leg.thermal.forEach((mesh, i) => {
      if (!mesh) {
        return
      }
      const temp = temps[i]
      if (Number.isFinite(temp)) {
        mesh.material.color.copy(tempColor(temp))
      } else {
        mesh.material.color.setHex(DARK_COLOR)
      }
    })
  }

  // Light the search light bar when the rover reports it on
  setSearchLight(on) {
    if (this.searchLight) {
      this.searchLight.material.emissiveIntensity = on ? 1.6 : 0.15
    }
  }

  // Dim the whole rover when telemetry has stopped updating
  setStale(stale) {
    if (stale === this.stale) {
      return
    }
    this.stale = stale
    this.bodyGroup.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        obj.material.opacity = stale ? 0.35 : 1
        obj.material.transparent = stale
      }
    })
  }

  // --- plumbing -------------------------------------------------------------

  // The telemetry has no body height, so derive a ride height by dropping the
  // rover until its lowest peg foot rests on the ground plane. Applied as an
  // eased delta each frame so it tracks the gait instead of popping.
  _settleOnGround() {
    this.bodyGroup.updateMatrixWorld(true)
    let lowest = Infinity
    for (const leg of Object.values(this.legs)) {
      const y = leg.ankle.getWorldPosition(this._tmpVec).y - this.endRadius
      if (y < lowest) {
        lowest = y
      }
    }
    if (Number.isFinite(lowest)) {
      this.bodyGroup.position.y -= lowest * 0.3
    }
  }

  _observeResize() {
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(this.container)
  }

  resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (!w || !h) {
      return
    }
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  _animate() {
    if (this.disposed) {
      return
    }
    this.frame = requestAnimationFrame(() => this._animate())
    // Slew toward the commanded attitude so 1 Hz telemetry looks smooth
    this.bodyGroup.quaternion.slerp(this.targetQuat, 0.2)
    if (this.options.autoRideHeight) {
      this._settleOnGround()
    }
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.resizeObserver?.disconnect()
    this.controls?.dispose()
    this.scene?.traverse((obj) => {
      if (obj.isMesh) {
        obj.geometry?.dispose()
        obj.material?.dispose()
      }
    })
    this.renderer?.dispose()
    if (this.renderer?.domElement?.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement)
    }
  }
}
