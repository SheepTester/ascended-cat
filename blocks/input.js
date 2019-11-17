// Relies blocks/component

class Input extends Component {
  constructor (blocks, initValue) {
    super()
    this.blocks = blocks
    this.elem.classList.add('block-input')
    this.path = Elem('path', {class: 'block-input-back'}, [], true)
    this.elem.appendChild(this.path)
    this.text = new TextComponent(typeof initValue === 'string' ? initValue : '')
    this.text.elem.classList.add('block-input-value')
    this.add(this.text)
    if (initValue instanceof Block) {
      this.insertBlock(initValue)
    }
  }

  insertBlock (block) {
    this._block = block
    if (block) {
      this.path.classList.add('block-hidden')
      this.text.classList.add('block-hidden')
    } else {
      this.path.classList.remove('block-hidden')
      this.text.classList.remove('block-hidden')
    }
  }

  setValue (value, preventUpdate = false) {
    this.text.setText(value)
    if (!preventUpdate) {
      this.text.resize()
    }
  }

  reposition () {
    this.measurements = this._block ? this._block.measurements : this.drawInputBack()
  }

  drawInputBack () {
    return this.text.measurements
  }
}

Input.renderOptions = {
  stringHorizPadding: 4,
  stringVertPadding: 2
}

class StringInput extends Input {
  constructor(blocks, initValue) {
    super(blocks, initValue)
    this.elem.classList.add('block-string-input')
  }

  drawInputBack () {
    const {
      stringHorizPadding: horizPadding,
      stringVertPadding: vertPadding
    } = Input.renderOptions
    const {width, height} = this.text.measurements
    this.text.setPosition(horizPadding, vertPadding + height / 2)
    const path = `M0 0 H${width + horizPadding * 2} V${height + vertPadding * 2} H0 z`
    this.path.setAttributeNS(null, 'd', path)
    return {width: width + horizPadding * 2, height: height + vertPadding * 2}
  }
}
