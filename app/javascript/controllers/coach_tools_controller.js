import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["input"]

  insert(event) {
    const prompt = event.currentTarget.dataset.prompt
    if (!prompt || !this.hasInputTarget) return

    this.inputTarget.value = prompt
    this.inputTarget.focus()
    this.inputTarget.dispatchEvent(new Event("input", { bubbles: true }))

    this.element.querySelector(".og-dm-tools")?.removeAttribute("open")
  }
}