// Relies on utils/elem

class Workspace {
  constructor (blocks, wrapper) {
    this.blocks = blocks
    this.wrapper = wrapper
    this.svg = Elem('svg', {class: 'block-workspace'}, [], true)
    wrapper.appendChild(this.svg)
    this.scripts = []
  }

  add (script) {
    this.scripts.push(script)
    this.svg.appendChild(script.elem)
  }
}

class PaletteWorkspace {
  constructor () {
    // TODO
  }
}
