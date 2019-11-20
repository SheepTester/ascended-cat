// Relies on utils/elem

class TextComponent {
  constructor (initText) {
    this.elem = Elem('text', {class: 'block-text-component'}, [], true)
    this.measurements = null
    if (initText) this.setText(initText)
  }

  getText () {
    return this.elem.textContent
  }

  setText (text) {
    this.elem.textContent = text
    this.measurements = null
  }

  /**
   * Calculates the width and height of the text.
   * @param {boolean} [force] - Whether everything should be remeasured regardless
   * @param {boolean} [repositionParents] - Whether the ancestors should be
   *  repositioned after the size is calculated.
   * @returns {Promise.<Measurements>} - The new measurements.
   */
  resize (force = false, repositionParents = true) {
    return new Promise(res => {
      window.requestAnimationFrame(() => {
        const rect = this.elem.getBBox()
        // `height` is zero so a Block centres it right in the middle, allowing
        // the `dominant-baseline` to deal with centring.
        this.measurements = {width: rect.width, height: rect.height}
        if (repositionParents) {
          let parent = this.parent
          while (parent) {
            parent.reposition()
            parent = parent.parent
          }
        }
        res(this.measurements)
      })
    })
  }

  setPosition (x, y) {
    this.position = {x, y}
    this.elem.setAttributeNS(null, 'transform', `translate(${x}, ${y})`)
  }

  storeAllInputsIn (arr) {
    //
  }
}

class Component {
  constructor () {
    this.elem = Elem('g', {class: 'block-component'}, [], true)
    this.components = []
    this.measurements = null
    this.setPosition(0, 0)
  }

  add (component, beforeIndex = this.components.length) {
    if (component.parent) {
      component.parent.remove(component)
    }
    if (beforeIndex < this.components.length) {
      this.elem.insertBefore(component.elem, this.components[beforeIndex].elem)
    } else {
      this.elem.appendChild(component.elem)
    }
    this.components.splice(beforeIndex, 0, component)
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

  clear () {
    for (const component of this.components) {
      this.elem.removeChild(component.elem)
      component.parent = null
    }
    this.components.splice(0, this.components.length)
  }

  /**
   * Call this when components are added; will make sure each child
   * has measurements before repositioning each of them accordinging and
   * saving its new size.
   */
  async resize (force = false, repositionParents = true) {
    await Promise.all(this.components.map(component => {
      if (!component.measurements || force) {
        return component.resize(force, false)
      }
    }))
    this.reposition()
    if (repositionParents) {
      let parent = this.parent
      while (parent) {
        parent.reposition()
        parent = parent.parent
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

  setPosition (x, y) {
    this.position = {x, y}
    this.elem.setAttributeNS(null, 'transform', `translate(${x}, ${y})`)
  }

  storeAllInputsIn (arr) {
    for (const component of this.components) {
      component.storeAllInputsIn(arr)
    }
  }

  /**
   * Does not take into account scrolling.
   */
  getWorkspaceOffset () {
    const {x, y} = this.position
    if (this.parent) {
      const {x: px, y: py} = this.parent.getWorkspaceOffset()
      return {x: px + x, y: py + y}
    } else {
      return {x, y}
    }
  }

  getWorkspace () {
    let parent = this
    while (parent && !parent.workspace) {
      parent = parent.parent
    }
    return parent.workspace
  }
}

class Space extends Component {
  constructor (height = 0) {
    super()
    this.height = height
  }

  reposition () {
    this.measurements = {width: 0, height: this.height}
  }
}
