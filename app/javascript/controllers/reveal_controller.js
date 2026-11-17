import { Controller } from "@hotwired/stimulus"

// Fades/slides children in as they scroll into view.
// <div data-controller="reveal" data-reveal-stagger-value="90">
//   <div data-reveal-target="item">…</div>
export default class extends Controller {
  static targets = ["item"]
  static values = { stagger: { type: Number, default: 80 } }

  connect() {
    const items = this.itemTargets.length ? this.itemTargets : [this.element]
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    items.forEach((el, i) => {
      el.classList.add("gf-reveal")
      el.style.setProperty("--gf-delay", `${(i % 6) * this.staggerValue}ms`)
    })

    if (reduced || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-visible"))
      return
    }

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add("is-visible")
        this.observer.unobserve(entry.target)
      })
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" })

    items.forEach((el) => this.observer.observe(el))
  }

  disconnect() {
    this.observer?.disconnect()
  }
}
