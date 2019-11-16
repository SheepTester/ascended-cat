// Relies on utils/elem.js

class Workspace {
  constructor (blocks, wrapper) {
    this.blocks = blocks
    this.wrapper = wrapper
    this.svg = Elem('svg', {}, [], true)
    wrapper.appendChild(this.svg)
  }
}
