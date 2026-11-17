import { Controller } from "@hotwired/stimulus"

// 3D tilt + glare on hover. Skipped on touch devices and reduced motion.
// <article data-controller="tilt" data-tilt-max-value="8">
export default class extends Controller {
  static values = { max: { type: Number, default: 7 } }

  connect() {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!fine || reduced) return

    this.element.classList.add("gf-tilt")
    if (!this.element.querySelector(".gf-glare")) {
      this.glare = document.createElement("span")
      this.glare.className = "gf-glare"
      this.glare.setAttribute("aria-hidden", "true")
      this.element.appendChild(this.glare)
    }

    this.move = this.move.bind(this)
    this.leave = this.leave.bind(this)
    this.element.addEventListener("pointermove", this.move)
    this.element.addEventListener("pointerleave", this.leave)
  }

  disconnect() {
    this.element.removeEventListener("pointermove", this.move)
    this.element.removeEventListener("pointerleave", this.leave)
    this.glare?.remove()
    this.leave()
  }

  move(event) {
    const rect = this.element.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height
    const rx = (0.5 - y) * this.maxValue * 2
    const ry = (x - 0.5) * this.maxValue * 2

    this.element.style.transform =
      `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-4px)`
    this.element.style.setProperty("--gx", `${(x * 100).toFixed(1)}%`)
    this.element.style.setProperty("--gy", `${(y * 100).toFixed(1)}%`)
  }

  leave() {
    this.element.style.transform = ""
  }
}
