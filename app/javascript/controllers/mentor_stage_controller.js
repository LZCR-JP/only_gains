import { Controller } from "@hotwired/stimulus"
import { styleFor, DEFAULT_STYLE } from "mentor_stage/styles"
import { MentorVoice, VOICE_PROFILES } from "mentor_stage/voice"

const VOICE_PREF_KEY = "og:mentor-voice"

// 3D coach on the "Set up your workout" step.
//
// Timeline (from page load):
//   0.65s  entrance lands, first quote spoken + subtitle
//   every 4s   signature move / energy flare        (MOVE_EVERY)
//   every 8s   next quote spoken + subtitle          (every 2nd move)
//
// Voice: neural MP3 from POST /mentor_voice (edge-tts, cached server-side), with
// the browser's speechSynthesis as fallback. Quotes come from Rails
// (MentorVoice::PROFILES) via data-mentor-stage-quotes-value.
//
// Three.js loads lazily (dynamic import), so other pages never pay for it. Without
// WebGL a CSS aura is shown and the voice/subtitles still run.
export default class extends Controller {
  static targets = ["canvas", "subtitle", "subtitleText", "voiceButton", "voiceLabel"]
  static values = {
    name: String,
    slug: String,
    quotes: Array,
    voiceUrl: String,
    moveEvery: { type: Number, default: 4000 },
    quoteEvery: { type: Number, default: 8000 }
  }

  connect() {
    this.alive = true
    this.style = styleFor(this.nameValue)
    this.element.style.setProperty("--stage-color", this.style.color)
    this.element.style.setProperty("--stage-accent", this.style.accent)
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    this.quoteIndex = -1
    this.beats = 0

    this.quotes = this.quotesValue.length ? this.quotesValue : (this.style.quotes || DEFAULT_STYLE.quotes)
    this.voice = new MentorVoice(
      VOICE_PROFILES[this.slugValue] || VOICE_PROFILES[this.style.avatar] || VOICE_PROFILES.default,
      { url: this.voiceUrlValue, slug: this.slugValue }
    )
    this.voiceOn = readPref() !== "off"
    if (this.voiceOn) this.voice.prefetch(this.quotes)
    this.voiceBlocked = false
    this.voiceButtonTarget.hidden = !this.voice.supported
    this.renderVoiceButton()

    // A Turbo cache snapshot may contain a stale, blank canvas
    this.canvasTarget.replaceChildren()

    const movesPerQuote = Math.max(1, Math.round(this.quoteEveryValue / this.moveEveryValue))
    this.startTimer = setTimeout(() => {
      this.nextQuote()
      this.timer = setInterval(() => {
        this.beats += 1
        this.stage?.performIdle()
        if (this.beats % movesPerQuote === 0) {
          this.stage?.emphasize()
          this.nextQuote()
        }
      }, this.moveEveryValue)
    }, 650)

    this.onVisibility = () => { if (document.hidden) this.voice.cancel() }
    document.addEventListener("visibilitychange", this.onVisibility)

    this.boot()
  }

  disconnect() {
    this.alive = false
    clearTimeout(this.startTimer)
    clearInterval(this.timer)
    clearTimeout(this.hideTimer)
    document.removeEventListener("visibilitychange", this.onVisibility)
    this.voice.dispose()
    this.stage?.dispose()
    this.stage = null
  }

  async boot() {
    if (!webglAvailable()) return this.fallback()
    try {
      const { MentorStage } = await import("mentor_stage/stage")
      if (!this.alive) return
      this.stage = new MentorStage(this.canvasTarget, this.style, { reduced: this.reduced })
      await this.stage.ready
      if (this.alive) this.element.classList.add("is-live")
    } catch (error) {
      console.warn("[mentor-stage] 3D disabled, showing fallback.", error)
      this.stage?.dispose()
      this.stage = null
      this.fallback()
    }
  }

  // ---------- Quotes: subtitle + voice ----------

  nextQuote() {
    const quotes = this.quotes
    this.quoteIndex = (this.quoteIndex + 1) % quotes.length
    this.showQuote(quotes[this.quoteIndex])
  }

  async showQuote(text) {
    const id = (this.quoteId = (this.quoteId || 0) + 1)
    clearTimeout(this.hideTimer)
    this.subtitleTextTarget.textContent = text
    this.subtitleTarget.classList.remove("is-visible")
    void this.subtitleTarget.offsetWidth // restart the entrance animation
    this.subtitleTarget.classList.add("is-visible")

    // Subtitle stays while the line is spoken, or ~5.5s when silent
    let minimum = 5500
    if (this.voiceOn && !this.voiceBlocked && this.voice.supported) {
      this.element.classList.add("is-speaking")
      const result = await this.voice.speak(text)
      if (!this.alive || id !== this.quoteId) return
      this.element.classList.remove("is-speaking")
      if (result === "blocked") {
        this.voiceBlocked = true
        this.renderVoiceButton()
      } else {
        minimum = 1200 // already on screen for the whole line
      }
    }
    this.hideTimer = setTimeout(() => {
      if (id === this.quoteId) this.subtitleTarget.classList.remove("is-visible")
    }, minimum)
  }

  // Click = a user gesture, which also unlocks speech if the browser blocked it
  toggleVoice() {
    if (this.voiceBlocked) {
      this.voiceBlocked = false
      this.voiceOn = true
    } else {
      this.voiceOn = !this.voiceOn
    }
    writePref(this.voiceOn ? "on" : "off")
    this.renderVoiceButton()
    if (this.voiceOn) {
      this.voice.prefetch(this.quotes)
      this.showQuote(this.quotes[Math.max(0, this.quoteIndex)])
    } else {
      this.voice.cancel()
      this.element.classList.remove("is-speaking")
    }
  }

  renderVoiceButton() {
    const on = this.voiceOn && !this.voiceBlocked
    this.voiceButtonTarget.setAttribute("aria-pressed", String(on))
    this.voiceButtonTarget.classList.toggle("is-blocked", this.voiceBlocked && this.voiceOn)
    // Blocked by the browser = silent, so it reads OFF and pulses until clicked
    this.voiceLabelTarget.textContent = on ? "Sound ON" : "Sound OFF"
    this.voiceButtonTarget.title = this.voiceBlocked && this.voiceOn
      ? "Your browser paused the voice. Click to turn sound on."
      : on ? "Mute the coach's voice" : "Turn the coach's voice on"
  }

  fallback() {
    if (this.alive) this.element.classList.add("is-fallback")
  }
}

function webglAvailable() {
  try {
    const canvas = document.createElement("canvas")
    return Boolean(window.WebGLRenderingContext && (canvas.getContext("webgl2") || canvas.getContext("webgl")))
  } catch {
    return false
  }
}

// localStorage can throw (private mode, blocked storage); the voice still works without it
function readPref() {
  try { return window.localStorage.getItem(VOICE_PREF_KEY) } catch { return null }
}

function writePref(value) {
  try { window.localStorage.setItem(VOICE_PREF_KEY, value) } catch { /* ignore */ }
}
