import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["list"]

  connect() {
    this.scrollToBottom(false)
    this.observer = new MutationObserver(() => this.scrollToBottom(true))
    this.observer.observe(this.listTarget, { childList: true })
  }

  disconnect() {
    this.observer?.disconnect()
  }

  scrollToBottom(smooth) {
    this.element.scrollTo({
      top: this.element.scrollHeight,
      behavior: smooth ? "smooth" : "auto"
    })
  }
}