import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["indicator"]

  start() {
    this.indicatorTarget.classList.remove("d-none")
  }

  finish() {
    this.indicatorTarget.classList.add("d-none")
  }
}