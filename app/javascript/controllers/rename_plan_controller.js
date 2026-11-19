import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["dialog", "input"]

  open() {
    this.dialogTarget.showModal()
    this.inputTarget.focus()
    this.inputTarget.select()
  }

  close() {
    this.dialogTarget.close()
    this.inputTarget.form.reset()
  }

  backdrop(event) {
    if (event.target === this.dialogTarget) {
      this.close()
    }
  }

  disconnect() {
    if (this.hasDialogTarget && this.dialogTarget.open) {
      this.dialogTarget.close()
    }
  }
}
