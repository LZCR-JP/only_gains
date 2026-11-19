
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["scroll", "list", "pending", "pendingText", "alert"]

  connect() {
    this.waiting = false

    this.observer = new MutationObserver(() => {
      if (!this.waiting) return

      if (this.listTarget.childElementCount > this.messageCount) {
        this.settle(true)
      } else if (this.alertTarget.textContent.trim()) {
        this.settle(false)
      }
    })

    this.observer.observe(this.listTarget, {
      childList: true
    })

    this.observer.observe(this.alertTarget, {
      childList: true,
      subtree: true
    })
  }

  guard(event) {
    if (!event.target.matches(".og-dm-form")) return

    const input = event.target.querySelector("textarea")

    if (this.waiting || !input.value.trim()) {
      event.preventDefault()
    }
  }

  start(event) {
    if (!event.target.matches(".og-dm-form") || this.waiting) return

    this.form = event.target
    this.input = this.form.querySelector("textarea")
    this.draft = this.input.value.trim()

    if (!this.draft) return

    this.messageCount = this.listTarget.childElementCount
    this.alertTarget.replaceChildren()
    this.waiting = true

    this.pendingTextTarget.textContent = this.draft
    this.pendingTarget.hidden = false

    this.input.value = ""
    this.input.readOnly = true
    this.input.placeholder = "Coach is typing..."

    this.toBottom()
  }

  finish(event) {
    if (event.target !== this.form || !this.waiting) return

    const type = event.detail.fetchResponse?.contentType || ""

    if (event.detail.success || type.includes("text/vnd.turbo-stream.html")) {
      this.timer = setTimeout(() => this.unconfirmed(), 3000)
    } else {
      this.unconfirmed()
    }
  }

  unconfirmed() {
    if (!this.waiting) return

    this.alertTarget.textContent =
      "Couldn't confirm the reply. Reload the chat before resending."

    this.settle(false)
  }

  settle(saved) {
    if (!this.waiting) return

    clearTimeout(this.timer)

    this.waiting = false
    this.pendingTarget.hidden = true
    this.pendingTextTarget.textContent = ""

    if (this.input?.isConnected) {
      this.input.readOnly = false
      this.input.placeholder = "Message..."
      this.input.value = saved ? "" : this.draft
    }

    this.form = this.input = null
    this.draft = ""

    this.toBottom()
  }

  keydown(event) {
    if (event.isComposing || event.keyCode === 229) return
    if (event.key !== "Enter" || event.shiftKey) return

    event.preventDefault()

    const input = event.currentTarget

    if (this.waiting || event.repeat || !input.value.trim()) return

    input.form.requestSubmit()
  }

  toBottom() {
    requestAnimationFrame(() => {
      if (this.hasScrollTarget) {
        this.scrollTarget.scrollTop = this.scrollTarget.scrollHeight
      }
    })
  }

  beforeCache() {
    this.settle(false)
  }

  disconnect() {
    this.observer?.disconnect()
    clearTimeout(this.timer)
  }
}
