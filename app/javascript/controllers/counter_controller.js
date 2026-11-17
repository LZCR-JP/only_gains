import { Controller } from "@hotwired/stimulus"

// Counts a number up from 0 once it becomes visible.
// <strong data-controller="counter" data-counter-to-value="42">42</strong>
export default class extends Controller {
  static values = { to: Number, duration: { type: Number, default: 1200 } }

  connect() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    this.element.textContent = "0"
    this.observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      this.observer.disconnect()
      this.animate()
    })
    this.observer.observe(this.element)
  }

  disconnect() {
    this.observer?.disconnect()
    cancelAnimationFrame(this.frame)
    this.element.textContent = this.format(this.toValue)
  }

  animate() {
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min((now - start) / this.durationValue, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      this.element.textContent = this.format(Math.round(this.toValue * eased))
      if (t < 1) this.frame = requestAnimationFrame(tick)
    }
    this.frame = requestAnimationFrame(tick)
  }

  format(n) {
    return n.toLocaleString()
  }
}
