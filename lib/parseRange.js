'use strict'

/*!
 * Based on range-parser
 *
 * Copyright(c) 2012-2014 TJ Holowaychuk
 * Copyright(c) 2015-2016 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Parse "Range" header `str` relative to the given file `size`.
 *
 * @param {Number} size
 * @param {String} str
 * @return {Array}
 * @public
 */

function parseRange (size, str) {
  // split the range string
  const values = str.slice(str.indexOf('=') + 1)
  const ranges = []

  const len = values.length
  let i = 0
  let il = 0
  let j = 0
  let start
  let end
  let commaIdx = values.indexOf(',')
  let dashIdx = values.indexOf('-')
  let prevIdx = -1

  // parse all ranges
  while (true) {
    commaIdx === -1 && (commaIdx = len)
    start = parseInt(values.slice(prevIdx + 1, dashIdx), 10)
    end = parseInt(values.slice(dashIdx + 1, commaIdx), 10)

    // -nnn
    if (start !== start) { // eslint-disable-line no-self-compare
      start = size - end
      end = size - 1
      // nnn-
    } else if (end !== end) { // eslint-disable-line no-self-compare
      end = size - 1
      // limit last-byte-pos to current length
    } else if (end > size - 1) {
      end = size - 1
    }

    // add range only on valid ranges
    if (
      start === start && // eslint-disable-line no-self-compare
      end === end && // eslint-disable-line no-self-compare
      start > -1 &&
      start <= end
    ) {
      // add range
      ranges.push({
        start,
        end,
        index: j++
      })
    }

    if (commaIdx === len) {
      break
    }
    prevIdx = commaIdx++
    dashIdx = values.indexOf('-', commaIdx)
    commaIdx = values.indexOf(',', commaIdx)
  }

  // unsatisfiable
  if (
    j < 2
  ) {
    return ranges
  }

  ranges.sort(sortByRangeStart)

  il = j
  j = 0
  i = 1
  while (i < il) {
    const range = ranges[i++]
    const current = ranges[j]

    if (range.start > current.end + 1) {
      // next range
      ranges[++j] = range
    } else if (range.end > current.end) {
      // extend range
      current.end = range.end
      current.index > range.index && (current.index = range.index)
    }
  }

  // trim ordered array
  ranges.length = j + 1

  // generate combined range
  ranges.sort(sortByRangeIndex)

  return ranges
}

/**
 * Sort function to sort ranges by index.
 * @private
 */

function sortByRangeIndex (a, b) {
  return a.index - b.index
}

/**
 * Sort function to sort ranges by start position.
 * @private
 */

function sortByRangeStart (a, b) {
  return a.start - b.start
}

module.exports.parseRange = parseRange
