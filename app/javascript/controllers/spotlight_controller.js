import { Controller } from "@hotwired/stimulus"

// Moves a radial spotlight (CSS vars --sx/--sy) with the pointer.
export default class extends Controller {
  connect() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    this.move = this.move.bind(this)
    this.element.addEventListener("pointermove", this.move)
  }

  disconnect() {
    this.element.removeEventListener("pointermove", this.move)
    cancelAnimationFrame(this.frame)
  }

  move(event) {
    cancelAnimationFrame(this.frame)
    this.frame = requestAnimationFrame(() => {
      const rect = this.element.getBoundingClientRect()
      this.element.style.setProperty("--sx", `${event.clientX - rect.left}px`)
      this.element.style.setProperty("--sy", `${event.clientY - rect.top}px`)
    })
  }
}
