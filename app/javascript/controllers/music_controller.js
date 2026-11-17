import { Controller } from "@hotwired/stimulus"

// Background music with a mute toggle.
//
// - One Audio object for the whole session (module scope), so the track keeps
//   playing across Turbo page visits instead of restarting.
// - Quiet by default (volumeValue, ~12%) with a short fade-in.
// - Browsers block autoplay with sound, so if play() is refused we start on
//   the user's first click / key press anywhere on the page.
// - The mute choice is remembered in localStorage.
// - Pauses while the tab is hidden.
//
// <div data-controller="music" data-music-src-value="/assets/background-music.mp3">
//   <button data-music-target="button" data-action="music#toggle">…</button>
// </div>

const STORAGE_KEY = "gf-music-muted"
let audio = null
let fadeFrame = null

function storedMuted() {
  try { return localStorage.getItem(STORAGE_KEY) === "1" } catch { return false }
}

function storeMuted(muted) {
  try { localStorage.setItem(STORAGE_KEY, muted ? "1" : "0") } catch { /* private mode */ }
}

export default class extends Controller {
  static targets = ["button"]
  static values = {
    src: String,
    volume: { type: Number, default: 0.12 }
  }

  connect() {
    if (!audio) {
      audio = new Audio(this.srcValue)
      audio.loop = true
      audio.preload = "none"
      audio.volume = 0
    }

    this.muted = storedMuted()
    this.render = this.render.bind(this)
    this.unlock = this.unlock.bind(this)
    this.onVisibility = this.onVisibility.bind(this)

    audio.addEventListener("play", this.render)
    audio.addEventListener("pause", this.render)
    document.addEventListener("visibilitychange", this.onVisibility)

    if (!this.muted && audio.paused) this.start()
    this.render()
  }

  disconnect() {
    // Don't stop the music on Turbo navigation — just detach listeners.
    audio?.removeEventListener("play", this.render)
    audio?.removeEventListener("pause", this.render)
    document.removeEventListener("visibilitychange", this.onVisibility)
    this.removeUnlockListeners()
  }

  toggle(event) {
    event?.preventDefault()
    this.muted = !this.muted
    storeMuted(this.muted)

    if (this.muted) {
      this.removeUnlockListeners()
      this.fadeTo(0, 250, () => audio.pause())
    } else {
      this.start()
    }
    this.render()
  }

  // ---- internals ----

  start() {
    audio.preload = "auto"
    audio.play()
      .then(() => this.fadeTo(this.volumeValue, 1500))
      .catch(() => this.waitForInteraction())
  }

  waitForInteraction() {
    if (this.waiting) return
    this.waiting = true
    ;["pointerdown", "keydown", "touchstart"].forEach((type) =>
      document.addEventListener(type, this.unlock, { capture: true })
    )
  }

  unlock(event) {
    // Let the mute button handle its own click.
    if (this.hasButtonTarget && this.buttonTarget.contains(event.target)) return
    this.removeUnlockListeners()
    if (!this.muted) this.start()
  }

  removeUnlockListeners() {
    this.waiting = false
    ;["pointerdown", "keydown", "touchstart"].forEach((type) =>
      document.removeEventListener(type, this.unlock, { capture: true })
    )
  }

  onVisibility() {
    if (this.muted) return
    if (document.hidden) {
      audio.pause()
    } else if (audio.paused) {
      this.start()
    }
  }

  fadeTo(target, duration, done) {
    cancelAnimationFrame(fadeFrame)
    const from = audio.volume
    const startTime = performance.now()
    const step = (now) => {
      const t = Math.min((now - startTime) / duration, 1)
      audio.volume = Math.max(0, Math.min(1, from + (target - from) * t))
      if (t < 1) fadeFrame = requestAnimationFrame(step)
      else done?.()
    }
    fadeFrame = requestAnimationFrame(step)
  }

  render() {
    if (!this.hasButtonTarget) return
    const playing = !this.muted && audio && !audio.paused
    const btn = this.buttonTarget
    btn.classList.toggle("is-playing", playing)
    btn.classList.toggle("is-muted", this.muted)
    btn.setAttribute("aria-pressed", this.muted ? "true" : "false")
    btn.setAttribute("aria-label", this.muted ? "Unmute background music" : "Mute background music")
    btn.title = this.muted ? "Music off — click to unmute" : "Music on — click to mute"
  }
}
