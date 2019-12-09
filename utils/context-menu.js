import { Elem } from './elem.js'

function contextMenu (options = [], x = 0, y = 0) {
  const menu = Elem('div', {
    className: 'context-menu',
    style: {
      left: `${x}px`,
      top: `${y}px`
    },
    onclick: e => {
      if (menu.contains(e.target) &&
        e.target.classList.contains('context-menu-option')) {
        const option = options[e.target.dataset.option]
        option.fn(option)
        close()
      }
    }
  }, options.map((data, i) => data[0] === '-'
    ? Elem('div', { className: 'context-menu-separator' })
    : Elem('button', {
      className: 'context-menu-option',
      data: {
        option: i
      }
    }, [data.label])))
  document.body.appendChild(menu)

  window.requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect()
    const windowWidth = window.innerWidth
    const windowHeight = window.innerHeight
    if (rect.right > windowWidth) {
      menu.style.left = `${x - rect.width}px`
    }
    if (rect.bottom > windowHeight) {
      menu.style.top = `${y - rect.height}px`
    }
  })

  const close = () => {
    document.removeEventListener('pointerdown', onPointerDown)
    document.body.removeChild(menu)
  }

  const onPointerDown = e => {
    if (!menu.contains(e.target)) {
      close()
    }
  }
  document.addEventListener('pointerdown', onPointerDown)
}

export { contextMenu }
