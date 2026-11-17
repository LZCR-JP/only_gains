import { Controller } from "@hotwired/stimulus"

// Cycles through items (e.g. mentor quotes). Pauses on hover.
// <div data-controller="rotator" data-rotator-interval-value="5000"
//      data-action="mouseenter->rotator#pause mouseleave->rotator#resume">
//   <div data-rotator-target="item">…</div>
//   <button data-rotator-target="dot" data-action="rotator#go" data-index="0">
export default class extends Controller {
  static targets = ["item", "dot"]
  static values = { interval: { type: Number, default: 5000 } }

  connect() {
    this.index = 0
    this.show(0)
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) this.resume()
  }

  disconnect() {
    this.pause()
  }

  next() {
    if (this.itemTargets.length) this.show((this.index + 1) % this.itemTargets.length)
  }

  go(event) {
    this.show(Number(event.currentTarget.dataset.index))
    this.pause()
    this.resume()
  }

  pause() {
    clearInterval(this.timer)
  }

  resume() {
    this.pause()
    if (this.itemTargets.length > 1) this.timer = setInterval(() => this.next(), this.intervalValue)
  }

  show(index) {
    this.index = index
    this.itemTargets.forEach((el, i) => {
      el.classList.toggle("is-active", i === index)
      el.setAttribute("aria-hidden", i === index ? "false" : "true")
    })
    this.dotTargets.forEach((el, i) => el.classList.toggle("is-active", i === index))
  }
}
