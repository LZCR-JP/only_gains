// The 3D arena for one coach: dark backdrop, mirror floor, rim lights, glowing
// aura, embers, a dramatic entrance and fighting-game impact effects.
//
//   const stage = new MentorStage(containerEl, style, { reduced })
//   await stage.ready        // avatar loaded, first frame scheduled
//   stage.performIdle()      // the coach's signature move + effects
//   stage.dispose()          // frees every GPU resource (call on disconnect)

import * as THREE from "three"
import { Reflector } from "three/addons/objects/Reflector.js"
import { loadAvatar } from "mentor_stage/avatars"

const BG = "#0c0b0d"
const ENTRANCE = 1.3   // seconds
const IMPACT = 0.45    // when the coach lands during the entrance

const clamp01 = (x) => Math.min(1, Math.max(0, x))
const easeOutExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x))
const easeInCubic = (x) => x * x * x

function rgba(hex, alpha) {
  const c = new THREE.Color(hex)
  return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${alpha})`
}

// The background color pushed `amount` of the way toward `hex`
function tint(hex, amount) {
  return new THREE.Color(BG).lerp(new THREE.Color(hex), amount).getStyle()
}

export class MentorStage {
  constructor(container, style, { reduced = false } = {}) {
    this.container = container
    this.style = style
    this.reduced = reduced
    this.disposed = false
    this.textures = []
    this.time = 0
    this.action = null
    this.fx = { shake: 0, shakeAmp: 0, flare: 0, pulse: 0, wave: -1 }
    this.pointer = new THREE.Vector2()
    this.pointerSmooth = new THREE.Vector2()

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setClearColor(BG, 1)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.1
    this.canvas = this.renderer.domElement
    this.canvas.className = "gf-mentor-stage-gl"
    container.appendChild(this.canvas)

    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.Fog(BG, 7, 16)
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60)

    this.buildArena()
    this.buildAura()
    this.buildParticles()

    this.frame = this.frame.bind(this)
    this.onPointer = this.onPointer.bind(this)
    this.onPointerLeave = () => this.pointer.set(0, 0)
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.visible = true
    this.intersection = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting
      this.renderer.setAnimationLoop(this.visible && this.avatar ? this.frame : null)
    })
    this.intersection.observe(container)
    if (!reduced && window.matchMedia("(hover: hover)").matches) {
      container.addEventListener("pointermove", this.onPointer)
      container.addEventListener("pointerleave", this.onPointerLeave)
    }

    this.ready = this.init()
  }

  async init() {
    const avatar = await loadAvatar(this.style)
    if (this.disposed) return
    this.avatar = avatar
    // Glowing avatar parts (blades, slash trails) draw after the floor fade
    avatar.object.traverse((obj) => { if (obj.material?.transparent) obj.renderOrder = 5 })
    this.scene.add(avatar.object)
    this.resize()
    this.last = performance.now()
    if (this.visible) this.renderer.setAnimationLoop(this.frame)
  }

  // ---------- Scene ----------

  texture(draw, w = 256, h = 256) {
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    draw(canvas.getContext("2d"), w, h)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    this.textures.push(tex)
    return tex
  }

  radial(stops) {
    return this.texture((ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
      for (const [offset, color] of stops) g.addColorStop(offset, color)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    })
  }

  glowMaterial(map, color, opacity) {
    return new THREE.MeshBasicMaterial({
      map, color, transparent: true, opacity, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false, side: THREE.DoubleSide
    })
  }

  buildArena() {
    const { color, accent } = this.style

    // Backdrop: a soft theme-colored glow behind the coach
    const backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 10),
      new THREE.MeshBasicMaterial({
        // Opaque stops (the material isn't transparent, so alpha would be ignored)
        map: this.radial([[0, tint(color, 0.42)], [0.3, tint(color, 0.16)], [0.65, tint(color, 0.04)], [1, BG]]),
        toneMapped: false, fog: false
      })
    )
    backdrop.position.set(0, 2.2, -5)
    this.scene.add(backdrop)

    // Light beams sweeping up behind the coach
    const beamTex = this.texture((ctx, w, h) => {
      const g = ctx.createLinearGradient(0, h, 0, 0)
      g.addColorStop(0, "rgba(255,255,255,0.9)")
      g.addColorStop(1, "rgba(255,255,255,0)")
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      const side = ctx.createLinearGradient(0, 0, w, 0)
      side.addColorStop(0, "rgba(0,0,0,1)")
      side.addColorStop(0.5, "rgba(0,0,0,0)")
      side.addColorStop(1, "rgba(0,0,0,1)")
      ctx.globalCompositeOperation = "destination-out"
      ctx.fillStyle = side
      ctx.fillRect(0, 0, w, h)
    }, 64, 256)
    this.beams = new THREE.Group()
    ;[[-1.6, 0.35, color], [1.7, -0.3, accent], [0.2, 0.08, color]].forEach(([x, tilt, c]) => {
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 7), this.glowMaterial(beamTex, c, 0.16))
      beam.position.set(x, 3, -3.2)
      beam.rotation.z = tilt
      this.beams.add(beam)
    })
    this.scene.add(this.beams)

    // Mirror floor, faded into the dark at its edge
    const dpr = this.renderer.getPixelRatio()
    this.reflector = new Reflector(new THREE.CircleGeometry(3.4, 64), {
      color: 0x6a6a74, clipBias: 0.003, textureWidth: 512 * dpr, textureHeight: 512 * dpr
    })
    this.reflector.rotation.x = -Math.PI / 2
    this.scene.add(this.reflector)

    const fade = new THREE.Mesh(
      new THREE.CircleGeometry(3.45, 64),
      new THREE.MeshBasicMaterial({
        map: this.radial([[0, rgba(BG, 0.5)], [0.45, rgba(BG, 0.72)], [0.85, rgba(BG, 1)], [1, rgba(BG, 1)]]),
        transparent: true, depthWrite: false, toneMapped: false
      })
    )
    fade.rotation.x = -Math.PI / 2
    fade.position.y = 0.002
    fade.renderOrder = 1
    this.scene.add(fade)

    // Contact shadow
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.75, 32),
      new THREE.MeshBasicMaterial({
        map: this.radial([[0, "rgba(0,0,0,0.75)"], [1, "rgba(0,0,0,0)"]]),
        transparent: true, depthWrite: false
      })
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.004
    shadow.renderOrder = 2
    this.scene.add(shadow)

    // Lights: soft key from the front, strong colored rims from behind
    // Cinematic three-point setup: warm key, colored fill, hard rims from behind
    this.scene.add(new THREE.HemisphereLight(0x7a8090, 0x050505, 0.35))
    const key = new THREE.DirectionalLight(0xfff1e0, 1.7)
    key.position.set(2.2, 4.5, 4)
    const fill = new THREE.DirectionalLight(color, 0.45)
    fill.position.set(-3.5, 1.2, 2.5)
    const rimA = new THREE.DirectionalLight(color, 4.5)
    rimA.position.set(-2.6, 3, -3.2)
    const rimB = new THREE.DirectionalLight(accent, 3.2)
    rimB.position.set(2.8, 2.4, -3)
    const top = new THREE.DirectionalLight(0xffffff, 1.1)
    top.position.set(0, 6, -1.5)
    this.auraLight = new THREE.PointLight(color, 3, 4, 1.2)
    this.auraLight.position.set(0, 0.4, 0.6)
    this.scene.add(key, fill, rimA, rimB, top, this.auraLight)
  }

  buildAura() {
    const { color, accent } = this.style
    this.aura = new THREE.Group()

    const disc = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 2.8),
      this.glowMaterial(this.radial([[0, "rgba(255,255,255,0.7)"], [0.4, "rgba(255,255,255,0.25)"], [1, "rgba(255,255,255,0)"]]), color, 0.55)
    )
    disc.rotation.x = -Math.PI / 2
    disc.position.y = 0.006

    const ring = new THREE.Mesh(new THREE.RingGeometry(0.66, 0.74, 72), this.glowMaterial(null, color, 0.95))
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.01
    const outer = new THREE.Mesh(new THREE.RingGeometry(0.88, 0.9, 72), this.glowMaterial(null, accent, 0.6))
    outer.rotation.x = -Math.PI / 2
    outer.position.y = 0.01

    // Rising column of energy
    const columnTex = this.texture((ctx, w, h) => {
      const g = ctx.createLinearGradient(0, h, 0, 0)
      g.addColorStop(0, "rgba(255,255,255,0.85)")
      g.addColorStop(0.35, "rgba(255,255,255,0.25)")
      g.addColorStop(1, "rgba(255,255,255,0)")
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      // Vertical streaks so the rotation reads
      ctx.globalCompositeOperation = "destination-out"
      for (let x = 0; x < w; x += 16) {
        ctx.fillStyle = `rgba(0,0,0,${0.35 + Math.random() * 0.5})`
        ctx.fillRect(x, 0, 6 + Math.random() * 6, h)
      }
    }, 128, 128)
    columnTex.wrapS = THREE.RepeatWrapping
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.72, 0.85, 2.6, 40, 1, true),
      this.glowMaterial(columnTex, color, 0.3)
    )
    column.position.y = 1.3
    // Only the far wall: the coach stands in front of it instead of being washed out
    column.material.side = THREE.BackSide

    // Shockwave, used by the "wave" effect
    this.wave = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 72), this.glowMaterial(null, accent, 0))
    this.wave.rotation.x = -Math.PI / 2
    this.wave.position.y = 0.03

    Object.assign(this, { auraDisc: disc, auraRing: ring, auraOuter: outer, auraColumn: column })
    this.aura.add(disc, ring, outer, column, this.wave)
    this.aura.children.forEach((m) => { m.renderOrder = 3 })
    this.scene.add(this.aura)
  }

  buildParticles() {
    const dot = this.radial([[0, "rgba(255,255,255,1)"], [0.3, "rgba(255,255,255,0.6)"], [1, "rgba(255,255,255,0)"]])
    const a = new THREE.Color(this.style.color)
    const b = new THREE.Color(this.style.accent)
    const material = (size) => new THREE.PointsMaterial({
      size, map: dot, vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false
    })
    const colors = (n) => {
      const arr = new Float32Array(n * 3)
      const c = new THREE.Color()
      for (let i = 0; i < n; i++) {
        c.copy(a).lerp(b, Math.random()).toArray(arr, i * 3)
      }
      return arr
    }

    // Embers drifting upward
    const n = 170
    this.embers = { n, speed: new Float32Array(n), phase: new Float32Array(n) }
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      this.resetEmber(pos, i, Math.random() * 3.4)
      this.embers.speed[i] = 0.25 + Math.random() * 0.6
      this.embers.phase[i] = Math.random() * Math.PI * 2
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    g.setAttribute("color", new THREE.BufferAttribute(colors(n), 3))
    this.embers.points = new THREE.Points(g, material(0.07))
    this.embers.points.renderOrder = 4
    this.scene.add(this.embers.points)

    // Explosion burst, reused by every impact
    const m = 160
    this.burst = { m, life: 0, vel: new Float32Array(m * 3) }
    const bg = new THREE.BufferGeometry()
    bg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(m * 3), 3))
    bg.setAttribute("color", new THREE.BufferAttribute(colors(m), 3))
    this.burst.points = new THREE.Points(bg, material(0.11))
    this.burst.points.visible = false
    this.burst.points.renderOrder = 4
    this.scene.add(this.burst.points)
  }

  resetEmber(pos, i, y = 0) {
    const r = 0.6 + Math.random() * 2.4
    const a = Math.random() * Math.PI * 2
    pos[i * 3] = Math.cos(a) * r
    pos[i * 3 + 1] = y
    pos[i * 3 + 2] = Math.sin(a) * r - 0.6
  }

  // ---------- Effects ----------

  performIdle() {
    if (!this.avatar || this.time < ENTRANCE) return
    this.action = { start: this.time, impacted: false }
  }

  // Extra energy flare when the coach speaks a line
  emphasize() {
    if (this.avatar && this.time >= ENTRANCE) this.trigger(["flare", "pulse"], 0.8)
  }

  trigger(names, scale = 1) {
    for (const name of names) {
      if (name === "shake" && !this.reduced) { this.fx.shake = 0.35; this.fx.shakeAmp = 0.06 * scale }
      if (name === "flare") this.fx.flare = 1
      if (name === "pulse" && !this.reduced) this.fx.pulse = 1
      if (name === "wave") this.fx.wave = 0
      if (name === "burst") this.spawnBurst(scale)
    }
  }

  spawnBurst(scale) {
    const { m, vel, points } = this.burst
    const pos = points.geometry.attributes.position.array
    const y = (this.avatar?.height || 2) * 0.5
    for (let i = 0; i < m; i++) {
      const dir = new THREE.Vector3().randomDirection()
      const speed = (1.5 + Math.random() * 3) * scale * (this.reduced ? 0.4 : 1)
      pos[i * 3] = dir.x * 0.2
      pos[i * 3 + 1] = y + dir.y * 0.2
      pos[i * 3 + 2] = dir.z * 0.2
      vel[i * 3] = dir.x * speed
      vel[i * 3 + 1] = Math.abs(dir.y) * speed * 0.8 + 0.5
      vel[i * 3 + 2] = dir.z * speed
    }
    points.geometry.attributes.position.needsUpdate = true
    this.burst.life = 1
    points.visible = true
  }

  // ---------- Loop ----------

  onPointer(event) {
    const rect = this.container.getBoundingClientRect()
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      ((event.clientY - rect.top) / rect.height) * 2 - 1
    )
  }

  resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (!w || !h) return
    this.renderer.setSize(w, h, false)
    const dpr = this.renderer.getPixelRatio()
    this.reflector.getRenderTarget().setSize(Math.round(w * dpr), Math.round(h * dpr))
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()

    // Fit the figure (plus some aura) vertically and horizontally
    // Extra headroom for the name HUD on top and the subtitle banner below
    const height = (this.avatar?.height || 2) + 1.15
    const vHalf = THREE.MathUtils.degToRad(this.camera.fov / 2)
    const hHalf = Math.atan(Math.tan(vHalf) * this.camera.aspect)
    this.distance = Math.max(height / 2 / Math.tan(vHalf), 1.35 / Math.tan(hHalf)) + 0.6
  }

  frame(now) {
    const dt = Math.min((now - this.last) / 1000, 0.05)
    this.last = now
    this.time += dt
    const t = this.time
    const { avatar, camera, fx } = this
    const height = avatar.height

    // Entrance: camera rushes in from far and wide; the coach drops in and lands
    const enter = easeOutExpo(clamp01(t / (this.reduced ? 0.6 : ENTRANCE)))
    const drop = this.reduced ? 0 : 1 - easeInCubic(clamp01(t / IMPACT))
    if (!this.landed && (this.reduced || t >= IMPACT)) {
      this.landed = true
      this.trigger(["shake", "flare", "burst", "wave"], 1.2)
    }

    // Signature move
    let action = null
    if (this.action) {
      const p = (t - this.action.start) / avatar.actionDuration
      if (!this.action.impacted && p >= avatar.impactAt) {
        this.action.impacted = true
        this.trigger(avatar.fx)
      }
      if (p >= 1) this.action = null
      else action = { p }
    }
    avatar.update(t, dt, action)
    avatar.object.position.y += drop * 4

    // Camera framing, entrance and pointer parallax
    this.pointerSmooth.lerp(this.pointer, 1 - Math.exp(-dt * 4))
    const dist = this.distance * (1 + 1.6 * (1 - enter))
    const angle = 0.55 * (1 - enter) + this.pointerSmooth.x * 0.18 + Math.sin(t * 0.25) * 0.04
    camera.position.set(Math.sin(angle) * dist, height * 0.55 + 0.6 * (1 - enter) - this.pointerSmooth.y * 0.15, Math.cos(angle) * dist)
    camera.lookAt(0, height * 0.43, 0)

    fx.pulse = Math.max(0, fx.pulse - dt * 2.5)
    camera.fov = 32 - 4 * fx.pulse * fx.pulse // quick zoom kick that eases back
    camera.updateProjectionMatrix()

    if (fx.shake > 0) {
      fx.shake = Math.max(0, fx.shake - dt)
      const amp = fx.shakeAmp * (fx.shake / 0.35)
      camera.position.x += (Math.random() - 0.5) * amp * 2
      camera.position.y += (Math.random() - 0.5) * amp * 2
    }

    // Aura breathes, and flares on impact
    fx.flare = Math.max(0, fx.flare - dt * 1.6)
    const breath = 0.5 + 0.5 * Math.sin(t * 2.4)
    const flare = fx.flare
    this.auraRing.scale.setScalar(1 + 0.04 * breath + 0.45 * flare)
    this.auraOuter.scale.setScalar(1 + 0.06 * Math.sin(t * 1.7) + 0.7 * flare)
    this.auraOuter.rotation.z = t * 0.4
    this.auraDisc.material.opacity = 0.45 + 0.15 * breath + 0.5 * flare
    this.auraColumn.material.opacity = 0.22 + 0.08 * breath + 0.5 * flare
    this.auraColumn.material.map.offset.x = t * 0.08
    this.auraColumn.scale.set(1 + 0.3 * flare, 1 + 0.25 * flare, 1 + 0.3 * flare)
    this.auraLight.intensity = 3 + 1.5 * breath + 10 * flare
    this.beams.children.forEach((beam, i) => {
      beam.material.opacity = 0.12 + 0.06 * Math.sin(t * 0.9 + i * 2) + 0.25 * flare
    })

    if (fx.wave >= 0) {
      fx.wave += dt / 0.8
      this.wave.scale.setScalar(1 + fx.wave * 4)
      this.wave.material.opacity = Math.max(0, 1 - fx.wave)
      if (fx.wave >= 1) fx.wave = -1
    }

    this.updateParticles(dt, flare)
    this.renderer.render(this.scene, camera)
  }

  updateParticles(dt, flare) {
    const { n, speed, phase, points } = this.embers
    const pos = points.geometry.attributes.position.array
    const boost = 1 + 4 * flare
    for (let i = 0; i < n; i++) {
      pos[i * 3 + 1] += speed[i] * dt * boost
      pos[i * 3] += Math.sin(this.time * 1.5 + phase[i]) * dt * 0.08
      if (pos[i * 3 + 1] > 3.4) this.resetEmber(pos, i)
    }
    points.geometry.attributes.position.needsUpdate = true

    const burst = this.burst
    if (burst.life > 0) {
      burst.life = Math.max(0, burst.life - dt * 0.9)
      const bpos = burst.points.geometry.attributes.position.array
      const drag = Math.exp(-dt * 2.5)
      for (let i = 0; i < burst.m * 3; i += 3) {
        burst.vel[i] *= drag
        burst.vel[i + 1] = burst.vel[i + 1] * drag - dt * 1.2
        burst.vel[i + 2] *= drag
        bpos[i] += burst.vel[i] * dt
        bpos[i + 1] += burst.vel[i + 1] * dt
        bpos[i + 2] += burst.vel[i + 2] * dt
      }
      burst.points.geometry.attributes.position.needsUpdate = true
      burst.points.material.opacity = burst.life
      burst.points.visible = burst.life > 0
    }
  }

  // ---------- Cleanup ----------

  dispose() {
    this.disposed = true
    this.renderer.setAnimationLoop(null)
    this.resizeObserver.disconnect()
    this.intersection.disconnect()
    this.container.removeEventListener("pointermove", this.onPointer)
    this.container.removeEventListener("pointerleave", this.onPointerLeave)
    this.scene.traverse((obj) => {
      if (obj === this.reflector) return
      obj.geometry?.dispose()
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
      materials.forEach((m) => m?.dispose())
    })
    this.reflector.geometry.dispose()
    this.reflector.dispose()
    this.textures.forEach((t) => t.dispose())
    this.renderer.dispose()
    this.canvas.remove()
  }
}
