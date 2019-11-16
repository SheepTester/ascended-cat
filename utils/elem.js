const svgNS = 'http://www.w3.org/2000/svg'

/**
 * Creates a DOM element with properties set from parameters.
 * @param {String} [tag] - The HTML tag of the element (defaults to a div).
 * @param {Object} [data] - An object of HTML attributes and properties;
 *   `className` can be an array of classes, `style` can be an object of CSS
 *   property-value pairs, and similarly `data` will set data- attributes
 *   from an object of property-value pairs.
 * @param {Array.<Node|string>} [children] - An array of child nodes or strings,
 *   which will be converted to text nodes
 * @param {Boolean} [svg] - Whether or not this element is for SVG (defaults to false).
 * @returns {HTMLElement} - The created DOM element.
 */
function Elem (tag = 'div', data = {}, children = [], svg = false) {
  const elem = svg
    ? document.createElementNS(svgNS, tag)
    : document.createElement(tag)
  for (const [prop, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue
    if (prop === 'data') {
      for (const [dataProp, dataValue] of Object.entries(value)) {
        if (dataValue === null || dataValue === undefined) continue
        elem.dataset[dataProp] = dataValue
      }
    } else if (prop === 'style') {
      for (const [cssProp, cssValue] of Object.entries(value)) {
        if (cssValue === null || cssValue === undefined) continue
        if (cssProp.includes('-')) {
          elem.style.setProperty(cssProp, cssValue)
        } else {
          elem.style[cssProp] = cssValue
        }
      }
    } else if (prop.slice(0, 2) === 'on') {
      elem.addEventListener(prop.slice(2), value)
    } else if (prop === 'className' && Array.isArray(value)) {
      for (const className of value) {
        if (className === null || className === undefined) continue
        elem.classList.add(className)
      }
    } else if (elem[prop] === undefined) {
      if (svg) {
        elem.setAttributeNS(null, attr, value)
      } else {
        elem.setAttribute(attr, value)
      }
    } else {
      elem[attr] = value
    }
  }
  for (const child of children) {
    if (child === null || child === undefined) continue
    if (child instanceof Node) {
      elem.appendChild(child)
    } else {
      elem.appendChild(document.createTextNode(child))
    }
  }
  return elem
}

/**
 * Creates a DocumentFragment, which is useful for adding multiple elements
 * into the document at once.
 * @param {Array.<Node|string>} elems - An array of elements to be added (strings
 *   are converted to text nodes)
 * @returns {DocumentFragment} - The created DocumentFragment.
 */
function Fragment (elems) {
  const fragment = document.createDocumentFragment()
  for (const elem of elems) {
    if (elem === null || elem === undefined) continue
    if (elem instanceof Node) {
      fragment.appendChild(elem)
    } else {
      fragment.appendChild(document.createTextNode(elem))
    }
  }
  return fragment
}
