import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["panel", "summary"]

  connect() {
    this.closeOnOutsideClick = (event) => {
      if (!this.element.contains(event.target)) this.close()
    }
    document.addEventListener("click", this.closeOnOutsideClick)
    this.update()
  }

  disconnect() {
    document.removeEventListener("click", this.closeOnOutsideClick)
  }

  toggle() {
    this.panelTarget.hidden = !this.panelTarget.hidden
  }

  close() {
    this.panelTarget.hidden = true
  }

  update() {
    const checked = this.element.querySelectorAll("input[type=checkbox]:checked")
    this.summaryTarget.replaceChildren()

    if (checked.length === 0) {
      this.summaryTarget.textContent = "Select your equipment..."
      return
    }

    checked.forEach((box) => {
      const chip = document.createElement("span")
      chip.className = "badge rounded-pill text-bg-primary"
      chip.textContent = box.value
      this.summaryTarget.appendChild(chip)
    })
  }
}