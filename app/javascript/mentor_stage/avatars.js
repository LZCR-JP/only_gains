// Procedural 3D coaches for the mentor stage.
//
// Every builder returns an "avatar" object with the same small interface, so a
// real rigged .glb can replace any of them later without touching stage.js:
//
//   {
//     object:         THREE.Object3D  – feet at y = 0, facing +z (the camera)
//     height:         number          – rough top of the figure, used for framing
//     actionDuration: seconds         – length of the 4-second signature move
//     impactAt:       0..1            – when in the move the stage effects fire
//     fx:             ["shake", "burst", "flare", "wave", "pulse"] – which ones
//     update(t, dt, action)           – called every frame; action is null or { p: 0..1 }
//   }
//
// To use a .glb: set `model: "/models/<name>.glb"` in mentor_stage/styles.js,
// put the file in public/models/, and pin the loader once:
//   pin "three/addons/loaders/GLTFLoader.js", to: "three-gltf-loader.js"
// (download examples/jsm/loaders/GLTFLoader.js for three@0.160.0 into vendor/javascript).
// loadAvatar() below then wraps it with gltfAvatar().

import * as THREE from "three"

const TAU = Math.PI * 2

// ---------- Small animation helpers ----------

const clamp01 = (x) => Math.min(1, Math.max(0, x))
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x) }

// Keyframe track: keys = [[p0, v0], [p1, v1], ...] sorted by p, smoothly interpolated.
function track(p, keys) {
  if (p <= keys[0][0]) return keys[0][1]
  for (let i = 1; i < keys.length; i++) {
    const [p1, v1] = keys[i]
    if (p <= p1) {
      const [p0, v0] = keys[i - 1]
      return v0 + (v1 - v0) * smooth((p - p0) / (p1 - p0 || 1))
    }
  }
  return keys[keys.length - 1][1]
}

// During an action use the keyframes, otherwise the idle value. Tracks start and
// end at the idle value, so the move blends in and out without a pop.
const k = (action, keys, idle) => (action ? track(action.p, keys) : idle)

// ---------- Materials and meshes ----------

function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...opts })
}

function metal(color, opts = {}) {
  return std(color, { metalness: 0.9, roughness: 0.28, ...opts })
}

function glow(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending,
    depthWrite: false, toneMapped: false
  })
}

function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material)
  m.position.set(x, y, z)
  return m
}

// ---------- Shared anatomical rig ----------
//
// root
// ├─ hipL / hipR → kneeL / kneeR → shoeL / shoeR     (legs)
// └─ hips                                            (upper-body pivot: lean / twist)
//    ├─ torso (lathe-sculpted V-taper), pelvis, chest/abs/traps
//    ├─ head  (skull, jaw, nose, ears, brows, eyes)
//    └─ shoulderL / shoulderR → elbowL / elbowR → handL / handR
//
// Surfaces are faceted low-poly (flatShading) so rim lights catch every plane.
// "L" sits at +x. update() resets every joint to its rest pose each frame.

// Lathe from [radius, y] pairs listed bottom → top
function lathe(profile, segments = 12) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)), segments)
}

// A limb hanging down from its joint (y = 0 → -len) with a muscle belly.
// belly = how much it swells, bellyAt = where along the limb (0 top … 1 bottom)
function limbGeometry(len, rTop, rBottom, belly = 0.25, bellyAt = 0.35, segments = 10) {
  const pts = [[0, -len - rBottom * 0.55]]
  for (let i = 8; i >= 0; i--) {
    const t = i / 8
    const r = rTop + (rBottom - rTop) * t
    const swell = belly * rTop * Math.exp(-(((t - bellyAt) / 0.24) ** 2))
    pts.push([r + swell, -t * len])
  }
  pts.push([rTop * 0.55, rTop * 0.4], [0, rTop * 0.6])
  return lathe(pts, segments)
}

function skinMaterial(color) {
  return new THREE.MeshPhysicalMaterial({
    color, roughness: 0.5, metalness: 0, flatShading: true,
    sheen: 0.6, sheenRoughness: 0.45, sheenColor: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.35),
    clearcoat: 0.15, clearcoatRoughness: 0.6
  })
}

function clothMaterial(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.02, flatShading: true, ...opts })
}

function humanoid({
  skin = "#d9a77f",
  shirt = "#333333",   // torso; null = bare skin (shows pecs + abs)
  sleeves = shirt,     // arms; null = bare skin
  pants = "#222222",   // pelvis
  legs = pants,        // legs; can differ from pelvis (shorts)
  shoes = "#111111",
  eyes = "#1a1a1a",
  bulk = 1,            // overall muscle mass
  taper = 1.1,         // shoulder/chest width vs waist (V-taper)
  muscle = 1,          // 0 = smooth cartoon limbs, 1 = defined
  headR = 0.2,
  hipY = 0.9,
  head = true
} = {}) {
  const skinMat = skinMaterial(skin)
  const detailMat = skinMaterial(new THREE.Color(skin).multiplyScalar(0.82))
  const shirtMat = shirt ? clothMaterial(shirt) : skinMat
  const armMat = sleeves ? clothMaterial(sleeves) : skinMat
  const pantsMat = clothMaterial(pants)
  const legMat = legs === pants ? pantsMat : legs === skin ? skinMat : clothMaterial(legs)
  const shoeMat = clothMaterial(shoes, { roughness: 0.45 })
  const b = bulk
  const m = muscle

  const root = new THREE.Group()
  const parts = { root }

  // ----- Legs: thigh → knee → shin → shoe
  const thighLen = hipY * 0.5
  const shinLen = hipY - thighLen - 0.07
  for (const [side, s] of [["L", 1], ["R", -1]]) {
    const hip = new THREE.Group()
    hip.position.set(0.12 * b * s, hipY, 0)
    hip.add(new THREE.Mesh(limbGeometry(thighLen, 0.105 * b, 0.065 * b, 0.28 * m, 0.3), legMat))
    const knee = new THREE.Group()
    knee.position.y = -thighLen
    knee.add(new THREE.Mesh(limbGeometry(shinLen, 0.07 * b, 0.045 * b, 0.35 * m, 0.25), legMat))
    const shoe = mesh(new THREE.BoxGeometry(0.12 * b, 0.08, 0.26 * b), shoeMat, 0, -(shinLen + 0.03), 0.05)
    knee.add(shoe)
    hip.add(knee)
    root.add(hip)
    Object.assign(parts, { [`hip${side}`]: hip, [`knee${side}`]: knee, [`shoe${side}`]: shoe })
  }

  // ----- Upper body
  const hips = new THREE.Group()
  hips.position.y = hipY
  root.add(hips)
  parts.hips = hips

  const w = b * taper
  const waist = 0.185 * Math.pow(b, 0.6)
  const torso = new THREE.Mesh(lathe([
    [0, -0.08], [0.17 * b, -0.05], [0.205 * b, 0.06], [0.2 * b, 0.18], [waist, 0.3],
    [0.215 * w, 0.42], [0.255 * w, 0.54], [0.275 * w, 0.64], [0.265 * w, 0.72],
    [0.2 * w, 0.8], [0.1 * b, 0.86], [0, 0.88]
  ], 14), shirtMat)
  torso.scale.z = 0.62
  hips.add(torso)
  parts.torso = torso

  const pelvis = mesh(new THREE.SphereGeometry(0.2 * b, 12, 8), pantsMat, 0, 0.0)
  pelvis.scale.set(1.08, 0.55, 0.72)
  hips.add(pelvis)

  // Trapezius slope from neck to shoulders
  const traps = mesh(new THREE.SphereGeometry(0.16 * w, 10, 6, 0, TAU, 0, Math.PI / 2), shirt ? shirtMat : skinMat, 0, 0.74, -0.02)
  traps.scale.set(1.35, 0.55 + 0.25 * m * (b - 0.8), 0.6)
  hips.add(traps)

  // Bare torso: pecs and a six-pack
  if (!shirt) {
    for (const s of [1, -1]) {
      const pec = mesh(new THREE.SphereGeometry(0.105 * w, 10, 8), skinMat, 0.105 * w * s, 0.6, 0.118 * w)
      pec.scale.set(1.15, 0.72, 0.55)
      pec.rotation.z = -0.2 * s
      hips.add(pec)
      for (const [i, y] of [0.2, 0.3, 0.4].entries()) {
        const ab = mesh(new THREE.BoxGeometry(0.065 * b, 0.07, 0.03), detailMat, 0.042 * b * s, y + i * 0.005, waist * 0.6 + 0.005)
        ab.rotation.x = -0.12
        hips.add(ab)
      }
    }
  }

  // Neck
  hips.add(mesh(new THREE.CylinderGeometry(0.062 * b, 0.078 * b, 0.16, 10), skinMat, 0, 0.86))

  // ----- Head
  const headGroup = new THREE.Group()
  headGroup.position.y = 0.88 + headR * 0.95
  hips.add(headGroup)
  parts.head = headGroup
  if (head) {
    const r = headR
    const skull = mesh(new THREE.SphereGeometry(r, 14, 10), skinMat)
    skull.scale.set(0.86, 1, 0.95)
    headGroup.add(skull)
    const jaw = mesh(new THREE.SphereGeometry(r * 0.72, 10, 8), skinMat, 0, -r * 0.42, r * 0.16)
    jaw.scale.set(0.95, 0.8, 1)
    headGroup.add(jaw)
    const nose = mesh(new THREE.ConeGeometry(r * 0.13, r * 0.32, 4), skinMat, 0, -r * 0.06, r * 0.93)
    nose.rotation.x = Math.PI / 2.4
    headGroup.add(nose)
    const eyeMat = new THREE.MeshStandardMaterial({ color: eyes, roughness: 0.15 })
    for (const s of [1, -1]) {
      const ear = mesh(new THREE.SphereGeometry(r * 0.2, 8, 6), skinMat, r * 0.85 * s, -r * 0.05, 0)
      ear.scale.set(0.45, 1, 0.7)
      headGroup.add(ear)
      headGroup.add(mesh(new THREE.SphereGeometry(r * 0.1, 8, 6), eyeMat, r * 0.31 * s, r * 0.08, r * 0.8))
      const brow = mesh(new THREE.BoxGeometry(r * 0.36, r * 0.07, r * 0.1), detailMat, r * 0.31 * s, r * 0.24, r * 0.82)
      brow.rotation.z = -0.12 * s
      headGroup.add(brow)
    }
  }

  // ----- Arms: deltoid → biceps → elbow → forearm → fist
  for (const [side, s] of [["L", 1], ["R", -1]]) {
    const shoulder = new THREE.Group()
    shoulder.position.set((0.27 * w + 0.05) * s, 0.68, 0)
    const delt = mesh(new THREE.SphereGeometry(0.105 * b, 10, 8), armMat)
    delt.scale.set(1.05, 0.95, 1)
    shoulder.add(delt)
    const upper = new THREE.Mesh(limbGeometry(0.3, 0.078 * b, 0.06 * b, 0.4 * m, 0.42), armMat)
    upper.position.y = -0.03
    shoulder.add(upper)

    const elbow = new THREE.Group()
    elbow.position.y = -0.34
    elbow.add(new THREE.Mesh(limbGeometry(0.27, 0.07 * b, 0.045 * b, 0.32 * m, 0.22), sleeves ? armMat : skinMat))

    const hand = new THREE.Group()
    hand.position.y = -0.3
    const fist = mesh(new THREE.SphereGeometry(0.068 * b, 8, 6), skinMat)
    fist.scale.set(0.95, 1.15, 0.85)
    hand.add(fist)

    elbow.add(hand)
    shoulder.add(elbow)
    hips.add(shoulder)
    Object.assign(parts, {
      [`shoulder${side}`]: shoulder, [`upper${side}`]: upper,
      [`elbow${side}`]: elbow, [`hand${side}`]: hand, [`fist${side}`]: fist
    })
  }

  // Every surface gets faceted shading for the low-poly look
  root.traverse((o) => { if (o.material && !o.material.flatShading) { o.material.flatShading = true } })

  return { root, parts, skinMat }
}

// Remember every part's rest transform, return a function that restores them.
function restPose(parts) {
  const saved = Object.values(parts).map((o) => [o, o.position.clone(), o.rotation.clone(), o.scale.clone()])
  return () => {
    for (const [o, p, r, s] of saved) {
      o.position.copy(p)
      o.rotation.copy(r)
      o.scale.copy(s)
    }
  }
}

function breathe(parts, t, amount = 1) {
  parts.torso.scale.y *= 1 + Math.sin(t * 2.2) * 0.02 * amount
  parts.hips.position.y += Math.sin(t * 2.2) * 0.008 * amount
}

// Weights / rings / plates spread around the figure at a given height.
function orbitRing(count, radius, y, makeItem) {
  const group = new THREE.Group()
  group.position.y = y
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU
    const item = makeItem(i)
    item.position.set(Math.cos(a) * radius, Math.sin(i * 2.1) * 0.15, Math.sin(a) * radius)
    item.rotation.y = -a
    group.add(item)
  }
  return group
}

// ---------- Coaches ----------

const AVATAR_BUILDERS = {
  // Bald, relentless, carries the boat oar. Crimson weight plates orbit him.
  goggins(style) {
    const { root, parts } = humanoid({
      skin: "#7a4b33", shirt: "#2a2a30", sleeves: null, pants: "#45454d", shoes: "#151515", bulk: 1.15, taper: 1.25
    })
    const reset = restPose(parts)

    const oar = new THREE.Group()
    oar.position.set(0, 0.45, -0.3)
    oar.rotation.z = 0.7
    oar.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.7, 8), std("#7a5230"), 0, 0))
    oar.add(mesh(new THREE.BoxGeometry(0.2, 0.45, 0.03), std(style.color, { emissive: style.color, emissiveIntensity: 0.25 }), 0, 0.95))
    parts.hips.add(oar)

    const plateMat = metal("#2a1412", { emissive: style.color, emissiveIntensity: 0.6 })
    const plates = orbitRing(3, 0.95, 1.1, () => {
      const plate = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 24), plateMat)
      plate.rotation.x = Math.PI / 2
      const g = new THREE.Group()
      g.add(plate)
      return g
    })
    root.add(plates)
    let spin = 0

    return {
      object: root, height: 2.1, actionDuration: 1.4, impactAt: 0.4,
      fx: ["shake", "burst", "flare", "wave"],
      update(t, dt, a) {
        reset()
        breathe(parts, t, 1.3)
        // Crouch, then explode into a roaring V
        root.position.y = k(a, [[0, 0], [0.32, -0.14], [0.42, 0.04], [0.75, 0], [1, 0]], 0)
        parts.hips.rotation.x = k(a, [[0, 0], [0.32, 0.38], [0.45, -0.18], [0.78, -0.18], [1, 0]], 0)
        parts.head.rotation.x = k(a, [[0, 0], [0.32, 0.2], [0.45, -0.4], [0.78, -0.4], [1, 0]], Math.sin(t * 1.3) * 0.04)
        for (const [side, s] of [["L", 1], ["R", -1]]) {
          parts[`shoulder${side}`].rotation.z = s * k(a, [[0, 0.18], [0.32, 0.1], [0.45, 2.2], [0.78, 2.2], [1, 0.18]], 0.18)
          parts[`shoulder${side}`].rotation.x = k(a, [[0, 0], [0.32, 0.45], [0.45, 0], [1, 0]], 0)
          parts[`elbow${side}`].rotation.x = k(a, [[0, -0.3], [0.32, -1.3], [0.45, -0.1], [0.78, -0.1], [1, -0.3]], -0.3)
          parts[`hip${side}`].rotation.z = s * k(a, [[0, 0.08], [0.45, 0.2], [0.78, 0.2], [1, 0.08]], 0.08)
        }
        const roar = a ? track(a.p, [[0, 0], [0.4, 0], [0.48, 1], [0.8, 1], [1, 0]]) : 0
        spin += dt * (0.6 + 7 * roar)
        plates.rotation.y = spin
        plates.scale.setScalar(1 + 0.45 * roar)
        plates.children.forEach((p, i) => { p.rotation.z = spin * 2 + i })
      }
    }
  },

  // Blue blur: big spiky head, white gloves, red shoes, golden rings in orbit.
  sonic(style) {
    const peach = "#f4c9a0"
    const blue = "#1f5fff"
    const { root, parts } = humanoid({
      skin: peach, shirt: blue, sleeves: peach, pants: blue, shoes: "#e0242c",
      bulk: 0.8, taper: 1, muscle: 0, hipY: 0.72, head: false
    })
    const blueMat = std(blue, { roughness: 0.35 })
    const peachMat = std(peach)
    const whiteMat = std("#f7f7f7", { roughness: 0.4 })

    parts.hips.add(mesh(new THREE.SphereGeometry(0.17, 16, 12), peachMat, 0, 0.36, 0.1))
    parts.head.position.y += 0.08
    const h = parts.head
    h.add(mesh(new THREE.SphereGeometry(0.34, 28, 20), blueMat))
    const muzzle = mesh(new THREE.SphereGeometry(0.18, 18, 14), peachMat, 0, -0.08, 0.22)
    muzzle.scale.set(1.25, 0.8, 0.9)
    h.add(muzzle)
    h.add(mesh(new THREE.SphereGeometry(0.045, 10, 8), std("#111", { roughness: 0.2 }), 0, -0.02, 0.4))
    for (const s of [1, -1]) {
      const eye = mesh(new THREE.SphereGeometry(0.1, 14, 12), whiteMat, 0.085 * s, 0.07, 0.26)
      eye.scale.set(0.8, 1.25, 0.55)
      h.add(eye)
      h.add(mesh(new THREE.SphereGeometry(0.042, 10, 8), std("#1fae3a", { roughness: 0.2 }), 0.075 * s, 0.07, 0.315))
      const ear = mesh(new THREE.ConeGeometry(0.08, 0.2, 10), blueMat, 0.2 * s, 0.3, -0.02)
      ear.rotation.z = -0.45 * s
      h.add(ear)
    }
    // Quills sweep back and down
    const quills = [[0, 0.2, 0], [0.13, 0.08, 0.25], [-0.13, 0.08, -0.25], [0.1, -0.1, 0.35], [-0.1, -0.1, -0.35]]
    for (const [x, y, rz] of quills) {
      const q = mesh(new THREE.ConeGeometry(0.12, 0.55, 12), blueMat, x, y, -0.24)
      q.rotation.set(-1.98, 0, rz)
      h.add(q)
    }
    for (const s of [1, -1]) {
      const back = mesh(new THREE.ConeGeometry(0.07, 0.25, 10), blueMat, 0.06 * s, 0.4, -0.2)
      back.rotation.x = -2.2
      parts.hips.add(back)
    }
    // White gloves, long red shoes
    for (const side of ["L", "R"]) {
      parts[`fist${side}`].material = whiteMat
      parts[`fist${side}`].scale.setScalar(1.45)
      parts[`shoe${side}`].scale.set(1.15, 1.3, 1.6)
      parts[`shoe${side}`].position.z += 0.07
    }
    const reset = restPose(parts)

    const ringMat = metal("#ffcc33", { emissive: style.accent, emissiveIntensity: 0.55, roughness: 0.2 })
    const rings = orbitRing(5, 0.9, 1.0, () => {
      const g = new THREE.Group()
      g.add(mesh(new THREE.TorusGeometry(0.17, 0.03, 10, 28), ringMat))
      return g
    })
    root.add(rings)
    let spin = 0

    return {
      object: root, height: 1.9, actionDuration: 1.3, impactAt: 0.76,
      fx: ["shake", "burst", "flare", "pulse"],
      update(t, dt, a) {
        reset()
        breathe(parts, t)
        // Spin dash: crouch, curl into a ball, spin 3x mid-air, land with a thumbs-up
        const p = a ? a.p : 0
        const curl = a ? track(p, [[0, 0], [0.16, 0], [0.24, 1], [0.66, 1], [0.74, 0], [1, 0]]) : 0
        const hop = a ? Math.sin(Math.PI * clamp01((p - 0.18) / 0.54)) * 0.6 : 0
        root.rotation.y = a ? smooth((p - 0.18) / 0.54) * TAU * 3 : Math.sin(t * 0.8) * 0.12
        root.position.y = hop + k(a, [[0, 0], [0.12, -0.1], [0.18, 0], [0.76, -0.08], [0.85, 0], [1, 0]], 0)
        parts.hips.rotation.x = 0.9 * curl
        parts.head.rotation.x = 0.45 * curl
        parts.head.rotation.z = (1 - curl) * 0.1
        parts.head.rotation.y = (1 - curl) * 0.15
        for (const [side, s] of [["L", 1], ["R", -1]]) {
          // Idle: hands on hips; one foot taps impatiently
          parts[`shoulder${side}`].rotation.z = s * 0.6 * (1 - curl)
          parts[`elbow${side}`].rotation.z = -s * 1.2 * (1 - curl)
          parts[`shoulder${side}`].rotation.x = -1.0 * curl
          parts[`hip${side}`].rotation.x = -1.2 * curl
        }
        if (!a) parts.hipR.rotation.x = -0.14 * Math.max(0, Math.sin(t * 9))
        const thumbs = a ? track(p, [[0, 0], [0.76, 0], [0.86, 1], [0.96, 1], [1, 0]]) : 0
        parts.shoulderR.rotation.x += -1.35 * thumbs
        parts.shoulderR.rotation.z += 0.6 * thumbs
        parts.elbowR.rotation.z += 1.2 * thumbs
        parts.elbowR.rotation.x += -0.5 * thumbs

        spin += dt * (1.2 + 10 * curl)
        rings.rotation.y = spin
        rings.scale.setScalar(1 + 0.35 * curl)
        rings.children.forEach((r, i) => { r.rotation.x = Math.sin(t * 2 + i) * 0.3 })
      }
    }
  },

  // Black bob, flowing red scarf, twin blades and hip gear.
  mikasa(style) {
    const { root, parts } = humanoid({
      skin: "#f3d5c0", shirt: "#6b7380", pants: "#e9e6df", shoes: "#3a2618", bulk: 0.9, taper: 0.95, muscle: 0.5, headR: 0.19
    })
    const hair = std("#121212", { roughness: 0.45 })
    const h = parts.head
    const cap = mesh(new THREE.SphereGeometry(0.205, 22, 16), hair, 0, 0.025, -0.035)
    h.add(cap)
    const bangs = mesh(new THREE.BoxGeometry(0.3, 0.07, 0.08), hair, 0, 0.13, 0.14)
    bangs.rotation.x = -0.35
    h.add(bangs)
    for (const s of [1, -1]) h.add(mesh(new THREE.BoxGeometry(0.06, 0.24, 0.3), hair, 0.175 * s, -0.04, -0.02))

    const scarfMat = std(style.accent, { roughness: 0.7, side: THREE.DoubleSide })
    const collar = mesh(new THREE.TorusGeometry(0.11, 0.05, 8, 20), scarfMat, 0, 0.84, 0)
    collar.rotation.x = Math.PI / 2
    parts.hips.add(collar)
    // Trailing scarf tail: a strip whose vertices ripple every frame
    const tailGeo = new THREE.PlaneGeometry(0.15, 1.0, 1, 18)
    tailGeo.translate(0, -0.5, 0)
    const base = tailGeo.attributes.position.array.slice()
    const tail = mesh(tailGeo, scarfMat, 0.04, 0.82, -0.12)
    parts.hips.add(tail)

    // ODM gear on the hips
    const gearMat = metal("#8a9099")
    for (const s of [1, -1]) parts.hips.add(mesh(new THREE.BoxGeometry(0.09, 0.15, 0.32), gearMat, 0.29 * s, 0.02, -0.02))

    // Twin blades, pointing back and down from each hand
    const bladeMat = metal("#d9e1ea", { emissive: style.color, emissiveIntensity: 0.25, roughness: 0.15 })
    for (const side of ["L", "R"]) {
      const blade = new THREE.Group()
      blade.rotation.x = 0.5
      blade.add(mesh(new THREE.BoxGeometry(0.045, 0.14, 0.06), gearMat, 0, -0.02))
      blade.add(mesh(new THREE.BoxGeometry(0.022, 0.8, 0.07), bladeMat, 0, -0.48))
      parts[`hand${side}`].add(blade)
    }

    // Slash trail, flashed during the lunge
    const slash = mesh(new THREE.RingGeometry(0.85, 1.0, 48, 1, 0, Math.PI * 0.9), glow(style.accent, 0), 0, 1.2, 0.5)
    slash.rotation.set(0.2, 0, -0.5)
    root.add(slash)

    const reset = restPose(parts)

    return {
      object: root, height: 2.05, actionDuration: 1.1, impactAt: 0.43,
      fx: ["shake", "burst", "flare"],
      update(t, dt, a) {
        reset()
        breathe(parts, t)
        // Wind up overhead, lunge forward and slash, recover
        root.position.z = k(a, [[0, 0], [0.3, -0.05], [0.45, 0.45], [0.75, 0.45], [1, 0]], 0)
        root.position.y = k(a, [[0, 0], [0.3, 0], [0.45, -0.15], [0.75, -0.15], [1, 0]], 0)
        parts.hips.rotation.x = k(a, [[0, 0], [0.3, -0.1], [0.45, 0.35], [0.75, 0.35], [1, 0]], 0)
        parts.head.rotation.y = k(a, [[0, 0], [1, 0]], Math.sin(t * 0.7) * 0.12)
        for (const [side, s] of [["L", 1], ["R", -1]]) {
          parts[`shoulder${side}`].rotation.x = k(a, [[0, -0.15], [0.25, -2.7], [0.33, -2.7], [0.45, -0.8], [0.75, -0.8], [1, -0.15]], -0.15)
          parts[`shoulder${side}`].rotation.z = s * k(a, [[0, 0.35], [0.25, 0.25], [0.45, -0.15], [0.75, -0.15], [1, 0.35]], 0.35)
          parts[`elbow${side}`].rotation.x = k(a, [[0, -0.3], [0.25, -0.1], [0.45, -0.2], [1, -0.3]], -0.3)
        }
        parts.hipL.rotation.x = k(a, [[0, 0], [0.45, -0.7], [0.75, -0.7], [1, 0]], 0)
        parts.hipR.rotation.x = k(a, [[0, 0], [0.45, 0.55], [0.75, 0.55], [1, 0]], 0)
        parts.hipL.rotation.z = 0.12
        parts.hipR.rotation.z = -0.12

        slash.material.opacity = a ? track(a.p, [[0, 0], [0.36, 0], [0.42, 0.95], [0.62, 0], [1, 0]]) : 0
        slash.rotation.z = a ? -0.5 - 1.2 * smooth((a.p - 0.36) / 0.2) : -0.5

        // Scarf ripples back; harder during the lunge
        const pos = tailGeo.attributes.position
        const gust = 1 + (a ? 2 * track(a.p, [[0, 0], [0.45, 1], [0.8, 1], [1, 0]]) : 0)
        for (let i = 0; i < pos.count; i++) {
          const y = base[i * 3 + 1] // 0 at the collar, -1 at the tip
          const d = -y
          pos.setXYZ(i,
            base[i * 3] + Math.sin(t * 3 + d * 5) * 0.03 * d * gust,
            y + d * d * 0.15,
            -d * 0.35 * gust - Math.sin(t * 4 + d * 6) * 0.07 * d * gust)
        }
        pos.needsUpdate = true
        tailGeo.computeVertexNormals()
      }
    }
  },

  // Golden-era bodybuilder, golden barbell floating behind. Signature: double biceps.
  arnold(style) {
    const { root, parts } = humanoid({
      skin: "#c98a58", shirt: null, sleeves: null, pants: "#d4a017", legs: "#c98a58",
      shoes: "#2b1d12", bulk: 1.4, taper: 1.4, muscle: 1.3, headR: 0.19
    })
    // Golden-era flat-top
    parts.head.add(mesh(new THREE.BoxGeometry(0.3, 0.09, 0.31), std("#5b3a1e"), 0, 0.17, -0.01))
    const reset = restPose(parts)

    const gold = metal("#d4a017", { emissive: style.color, emissiveIntensity: 0.25 })
    const barbell = new THREE.Group()
    barbell.position.set(0, 1.85, -0.6)
    const bar = mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.9, 10), metal("#cfcfcf"))
    bar.rotation.z = Math.PI / 2
    barbell.add(bar)
    for (const s of [1, -1]) {
      for (const [x, r] of [[0.78, 0.27], [0.87, 0.21]]) {
        const plate = mesh(new THREE.CylinderGeometry(r, r, 0.07, 28), gold, x * s, 0, 0)
        plate.rotation.z = Math.PI / 2
        barbell.add(plate)
      }
    }
    root.add(barbell)
    let spin = 0

    return {
      object: root, height: 2.2, actionDuration: 1.5, impactAt: 0.25,
      fx: ["pulse", "flare", "burst", "shake"],
      update(t, dt, a) {
        reset()
        breathe(parts, t, 1.6)
        for (const [side, s] of [["L", 1], ["R", -1]]) {
          parts[`shoulder${side}`].rotation.z = s * k(a, [[0, 0.28], [0.25, 1.45], [0.75, 1.45], [1, 0.28]], 0.28)
          parts[`shoulder${side}`].rotation.x = k(a, [[0, 0], [0.25, -0.15], [0.75, -0.15], [1, 0]], 0)
          parts[`elbow${side}`].rotation.z = s * k(a, [[0, 0], [0.25, 1.95], [0.75, 1.95], [1, 0]], 0)
          parts[`elbow${side}`].rotation.x = k(a, [[0, -0.15], [0.25, 0], [0.75, 0], [1, -0.15]], -0.15)
          parts[`hip${side}`].rotation.z = s * 0.1
        }
        // Pump: biceps throb while the pose is held
        const hold = a ? track(a.p, [[0, 0], [0.25, 0], [0.3, 1], [0.7, 1], [0.75, 0]]) : 0
        const pump = 1 + 0.12 * hold * (0.5 + 0.5 * Math.sin(t * 14))
        parts.upperL.scale.set(pump, 1, pump)
        parts.upperR.scale.set(pump, 1, pump)
        parts.hips.rotation.x = k(a, [[0, 0], [0.25, -0.08], [0.75, -0.08], [1, 0]], 0)
        parts.head.rotation.x = k(a, [[0, 0], [0.25, -0.12], [0.75, -0.12], [1, 0]], Math.sin(t * 1.1) * 0.03)

        spin += dt * (0.4 + 6 * hold)
        barbell.rotation.x = spin
        barbell.position.y = 1.85 + Math.sin(t * 1.5) * 0.05 + 0.2 * hold
      }
    }
  },

  // Small, floating, huge ears, brown robe, glowing green blade.
  yoda(style) {
    const green = "#8db86a"
    const { root, parts } = humanoid({
      skin: green, shirt: "#b8a17a", sleeves: "#6e5236", pants: "#b8a17a", shoes: green,
      eyes: "#2a1d0e", bulk: 1.0, taper: 1, muscle: 0.2, headR: 0.26, hipY: 0.7
    })
    root.scale.setScalar(0.62)
    const skin = std(green)
    parts.head.scale.set(1.15, 0.9, 1)
    const ears = []
    for (const s of [1, -1]) {
      const ear = mesh(new THREE.ConeGeometry(0.1, 0.55, 12), skin, 0.33 * s, 0.03, -0.02)
      ear.rotation.z = -s * (Math.PI / 2 + 0.25)
      ear.scale.z = 0.35
      parts.head.add(ear)
      ears.push(ear)
    }
    const robe = mesh(new THREE.ConeGeometry(0.42, 1.0, 28, 1, true), std("#6e5236", { side: THREE.DoubleSide, roughness: 0.85 }), 0, -0.05)
    parts.hips.add(robe)

    // Lightsaber-style energy blade, twirled from a pivot in the right hand
    const twirl = new THREE.Group()
    const saber = new THREE.Group()
    saber.rotation.x = 1.9
    saber.add(mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.24, 12), metal("#c9ccd1"), 0, 0))
    saber.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.05, 10), new THREE.MeshBasicMaterial({ color: "#eaffef", toneMapped: false }), 0, 0.64))
    const halo = mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 14), glow(style.color, 0.5), 0, 0.64)
    const haze = mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.15, 14), glow(style.color, 0.18), 0, 0.64)
    saber.add(halo, haze)
    twirl.add(saber)
    parts.handR.add(twirl)
    const reset = restPose({ ...parts, twirl })

    return {
      object: root, height: 1.75, actionDuration: 1.6, impactAt: 0.3,
      fx: ["wave", "burst", "flare", "shake"],
      update(t, dt, a) {
        reset()
        breathe(parts, t, 0.8)
        // Levitates; rises higher for the force push
        root.position.y = 0.28 + Math.sin(t * 1.6) * 0.06 + k(a, [[0, 0], [0.3, 0.35], [0.8, 0.35], [1, 0]], 0)
        root.rotation.y = Math.sin(t * 0.5) * 0.15
        parts.hipL.rotation.x = -0.25
        parts.hipR.rotation.x = -0.15
        parts.shoulderR.rotation.x = k(a, [[0, -0.6], [0.3, -0.9], [0.8, -0.9], [1, -0.6]], -0.6)
        parts.elbowR.rotation.x = -0.4
        parts.shoulderL.rotation.x = k(a, [[0, 0], [0.3, -1.5], [0.8, -1.5], [1, 0]], 0)
        parts.shoulderL.rotation.z = k(a, [[0, 0.2], [0.3, -0.1], [0.8, -0.1], [1, 0.2]], 0.2)
        parts.head.rotation.x = k(a, [[0, 0], [0.3, 0.15], [0.8, 0.15], [1, 0]], 0)
        twirl.rotation.z = a ? track(a.p, [[0, 0], [0.3, 0], [0.75, TAU * 2], [1, TAU * 2]]) : 0
        ears.forEach((ear, i) => { ear.rotation.x = Math.sin(t * 1.3 + i) * 0.05 })
        halo.material.opacity = 0.45 + Math.random() * 0.08
      }
    }
  },

  // Hoodie, beard, neon boxing gloves. Bounces on his toes; signature: jab-jab-cross.
  jonah(style) {
    const { root, parts } = humanoid({
      skin: "#e2b08c", shirt: "#6a1fd6", pants: style.accent, legs: "#e2b08c", shoes: "#f5f5f5",
      eyes: "#2a1a10", bulk: 1.18, taper: 1.05, muscle: 0.6, headR: 0.2
    })
    const brown = std("#3a2616", { roughness: 0.8 })
    const hair = mesh(new THREE.SphereGeometry(0.21, 20, 14), brown, 0, 0.06, -0.03)
    hair.scale.set(1.03, 0.78, 1.03)
    parts.head.add(hair)
    const beard = mesh(new THREE.SphereGeometry(0.16, 16, 12), brown, 0, -0.1, 0.06)
    beard.scale.set(1.1, 0.7, 0.85)
    parts.head.add(beard)
    const hood = mesh(new THREE.TorusGeometry(0.16, 0.07, 10, 20), std("#6a1fd6"), 0, 0.8, -0.13)
    hood.rotation.x = Math.PI / 2.6
    parts.hips.add(hood)
    const gloveMat = std(style.accent, { emissive: style.accent, emissiveIntensity: 0.35, roughness: 0.35 })
    for (const side of ["L", "R"]) {
      parts[`fist${side}`].material = gloveMat
      parts[`fist${side}`].scale.setScalar(1.55)
    }
    const reset = restPose(parts)

    return {
      object: root, height: 2.05, actionDuration: 1.2, impactAt: 0.6,
      fx: ["shake", "burst", "flare"],
      update(t, dt, a) {
        reset()
        breathe(parts, t)
        root.position.y = Math.abs(Math.sin(t * 4.5)) * 0.04
        root.position.z = k(a, [[0, 0], [0.55, 0], [0.62, 0.15], [0.85, 0], [1, 0]], 0)
        parts.hips.rotation.y = k(a, [[0, 0.2], [0.45, 0.3], [0.6, -0.45], [0.8, 0.2], [1, 0.2]], 0.2 + Math.sin(t * 1.5) * 0.05)
        parts.head.rotation.x = 0.1
        parts.hipL.rotation.x = -0.15
        parts.hipR.rotation.x = 0.2
        // Guard up; punches straighten the arm forward
        parts.shoulderL.rotation.x = k(a, [[0, -0.45], [0.1, -1.55], [0.2, -0.45], [0.3, -1.55], [0.4, -0.45], [1, -0.45]], -0.45)
        parts.elbowL.rotation.x = k(a, [[0, -2.0], [0.1, -0.05], [0.2, -2.0], [0.3, -0.05], [0.4, -2.0], [1, -2.0]], -2.0)
        parts.shoulderL.rotation.z = k(a, [[0, 0.18], [0.1, -0.1], [0.2, 0.18], [0.3, -0.1], [0.4, 0.18], [1, 0.18]], 0.18)
        parts.shoulderR.rotation.x = k(a, [[0, -0.45], [0.45, -0.45], [0.6, -1.6], [0.8, -0.45], [1, -0.45]], -0.45)
        parts.elbowR.rotation.x = k(a, [[0, -2.0], [0.45, -2.0], [0.6, -0.05], [0.8, -2.0], [1, -2.0]], -2.0)
        parts.shoulderR.rotation.z = -k(a, [[0, 0.18], [0.45, 0.18], [0.6, -0.1], [0.8, 0.18], [1, 0.18]], 0.18)
      }
    }
  },

  // Fallback for coaches without a custom look: themed figure with a power-up.
  default(style) {
    const { root, parts } = humanoid({ shirt: style.color, pants: "#222", bulk: 1.1 })
    const reset = restPose(parts)
    return {
      object: root, height: 2.05, actionDuration: 1.2, impactAt: 0.4,
      fx: ["shake", "burst", "flare", "wave"],
      update(t, dt, a) {
        reset()
        breathe(parts, t)
        root.position.y = k(a, [[0, 0], [0.3, -0.12], [0.45, 0], [1, 0]], 0)
        for (const [side, s] of [["L", 1], ["R", -1]]) {
          parts[`shoulder${side}`].rotation.z = s * k(a, [[0, 0.15], [0.3, 0.1], [0.45, 2.0], [0.8, 2.0], [1, 0.15]], 0.15)
          parts[`elbow${side}`].rotation.x = k(a, [[0, -0.2], [0.3, -1.2], [0.45, 0], [1, -0.2]], -0.2)
        }
      }
    }
  }
}

// Wrap a loaded glTF so it speaks the avatar interface. Clip names are whatever
// your model exports; pass them in styles.js as `clips: { idle, action }`.
export function gltfAvatar(gltf, { clips = {}, height = 2, actionDuration = 1.2, impactAt = 0.4, fx = ["shake", "burst", "flare"] } = {}) {
  const object = gltf.scene
  const mixer = new THREE.AnimationMixer(object)
  const clip = (name) => name && THREE.AnimationClip.findByName(gltf.animations, name)
  const idle = clip(clips.idle) && mixer.clipAction(clip(clips.idle)).play()
  const move = clip(clips.action) && mixer.clipAction(clip(clips.action))
  if (move) { move.setLoop(THREE.LoopOnce); move.clampWhenFinished = false }
  let wasActive = false

  return {
    object, height, actionDuration: move ? move.getClip().duration : actionDuration, impactAt, fx,
    update(t, dt, a) {
      if (a && !wasActive && move) {
        move.reset().play()
        if (idle) move.crossFadeFrom(idle, 0.15, false)
      }
      if (!a && wasActive && move && idle) idle.reset().crossFadeFrom(move, 0.2, false).play()
      wasActive = Boolean(a)
      mixer.update(dt)
    }
  }
}

// Single entry point used by stage.js.
export async function loadAvatar(style) {
  if (style.model) {
    // Needs the GLTFLoader pin described at the top of this file.
    const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js")
    const gltf = await new GLTFLoader().loadAsync(style.model)
    return gltfAvatar(gltf, style)
  }
  const build = AVATAR_BUILDERS[style.avatar] || AVATAR_BUILDERS.default
  const avatar = build(style)
  // Faceted low-poly shading on every lit surface (hair, gear, accessories too)
  avatar.object.traverse((o) => {
    if (o.material?.isMeshStandardMaterial) o.material.flatShading = true
  })
  return avatar
}
