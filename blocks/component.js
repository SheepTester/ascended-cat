// Relies on utils/elem.js

class TextComponent {
  constructor () {
    this.elem = Elem('text', {className: 'text-component'}, [], true)
    this.measurements = null
  }

  setText (text) {
    this.elem.textContent = text
    this.measurements = null
  }

  /**
   * Calculates the width and height of the text.
   * @param {boolean} repositionParents - Whether the ancestors should be
   *  repositioned after the size is calculated.
   * @returns {Promise.<Measurements>} - The new measurements.
   */
  resize (repositionParents) {
    return new Promise(res => {
      window.requestAnimationFrame(() => {
        const rect = this.elem.getBBox()
        this.measurements = {width: rect.width, height: rect.height}
        res(this.measurements)
        if (repositionParents) {
          let parent = this.parent
          while (parent) {
            parent.reposition()
            parent = this.parent
          }
        }
      })
    })
  }
}

class Component {
  constructor () {
    this.elem = Elem('g', {className: 'component'}, [], true)
    this.components = []
    this.measurements = null
  }

  add (component, beforeIndex = this.components.length) {
    this.components.splice(beforeIndex, 0, component)
    if (beforeIndex < this.components.length) {
      this.elem.insertBefore(component.elem, this.elem.children[beforeIndex])
    } else {
      this.elem.appendChild(component.elem)
    }
    component.parent = this
    return component
  }

  remove (component) {
    const index = this.components.indexOf(component)
    if (~index) {
      this.components.splice(index, 1)
    }
    this.elem.removeChild(component.elem)
    component.parent = null
  }

  /**
   * Call this when components are added; will make sure each child
   * has measurements before repositioning each of them accordinging and
   * saving its new size.
   */
  async resize (repositionParents = true) {
    await Promise.all(this.components.map(component => {
      if (!component.measurements) {
        return component.resize(false)
      }
    }))
    this.reposition()
    if (repositionParents) {
      let parent = this.parent
      while (parent) {
        parent.reposition()
        parent = this.parent
      }
    }
  }

  /**
   * Called to reposition components when sizes are updated. This will update
   * its own `measurements`.
   */
  reposition () {
    this.measurements = {width: 0, height: 0}
  }
}
