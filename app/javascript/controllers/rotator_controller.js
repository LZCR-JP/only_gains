
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["item", "dot"]
  static values = { interval: { type: Number, default: 5000 } }

  connect() {
    this.index = 0
    this.show(0)

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.resume()
    }
  }

  disconnect() {
    this.pause()
  }

  // Next mentor
  next() {
    const total = this.itemTargets.length

    if (total > 0) {
      this.show((this.index + 1) % total)
    }
  }

  // Previous mentor
  previous() {
    const total = this.itemTargets.length

    if (total > 0) {
      this.show((this.index - 1 + total) % total)
    }
  }

  // Select mentor using dots
  go(event) {
    this.show(Number(event.currentTarget.dataset.index))
    this.pause()
    this.resume()
  }

  // Pause automatic rotation
  pause() {
    clearInterval(this.timer)
  }

  // Resume automatic rotation
  resume() {
    this.pause()

    if (this.itemTargets.length > 1) {
      this.timer = setInterval(() => this.next(), this.intervalValue)
    }
  }

  // Display selected mentor
  show(index) {
    this.index = index

    this.itemTargets.forEach((el, i) => {
      el.classList.toggle("is-active", i === index)
      el.setAttribute("aria-hidden", i === index ? "false" : "true")
    })

    this.dotTargets.forEach((el, i) => {
      el.classList.toggle("is-active", i === index)
    })
  }
}
