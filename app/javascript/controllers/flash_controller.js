import { Controller } from "@hotwired/stimulus"

// Auto-dismissing flash toast.
export default class extends Controller {
  static values = { delay: { type: Number, default: 4500 } }

  connect() {
    this.timer = setTimeout(() => this.dismiss(), this.delayValue)
  }

  disconnect() {
    clearTimeout(this.timer)
  }

  pause() {
    clearTimeout(this.timer)
  }

  resume() {
    this.timer = setTimeout(() => this.dismiss(), 1500)
  }

  dismiss() {
    clearTimeout(this.timer)
    this.element.classList.add("is-leaving")
    setTimeout(() => this.element.remove(), 300)
  }
}
