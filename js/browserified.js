(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
// base-x encoding
// Forked from https://github.com/cryptocoinjs/bs58
// Originally written by Mike Hearn for BitcoinJ
// Copyright (c) 2011 Google Inc
// Ported to JavaScript by Stefan Thomas
// Merged Buffer refactorings from base58-native by Stephen Pair
// Copyright (c) 2013 BitPay Inc

var Buffer = require('safe-buffer').Buffer

module.exports = function base (ALPHABET) {
  var ALPHABET_MAP = {}
  var BASE = ALPHABET.length
  var LEADER = ALPHABET.charAt(0)

  // pre-compute lookup table
  for (var z = 0; z < ALPHABET.length; z++) {
    var x = ALPHABET.charAt(z)

    if (ALPHABET_MAP[x] !== undefined) throw new TypeError(x + ' is ambiguous')
    ALPHABET_MAP[x] = z
  }

  function encode (source) {
    if (source.length === 0) return ''

    var digits = [0]
    for (var i = 0; i < source.length; ++i) {
      for (var j = 0, carry = source[i]; j < digits.length; ++j) {
        carry += digits[j] << 8
        digits[j] = carry % BASE
        carry = (carry / BASE) | 0
      }

      while (carry > 0) {
        digits.push(carry % BASE)
        carry = (carry / BASE) | 0
      }
    }

    var string = ''

    // deal with leading zeros
    for (var k = 0; source[k] === 0 && k < source.length - 1; ++k) string += LEADER
    // convert digits to a string
    for (var q = digits.length - 1; q >= 0; --q) string += ALPHABET[digits[q]]

    return string
  }

  function decodeUnsafe (string) {
    if (typeof string !== 'string') throw new TypeError('Expected String')
    if (string.length === 0) return Buffer.allocUnsafe(0)

    var bytes = [0]
    for (var i = 0; i < string.length; i++) {
      var value = ALPHABET_MAP[string[i]]
      if (value === undefined) return

      for (var j = 0, carry = value; j < bytes.length; ++j) {
        carry += bytes[j] * BASE
        bytes[j] = carry & 0xff
        carry >>= 8
      }

      while (carry > 0) {
        bytes.push(carry & 0xff)
        carry >>= 8
      }
    }

    // deal with leading zeros
    for (var k = 0; string[k] === LEADER && k < string.length - 1; ++k) {
      bytes.push(0)
    }

    return Buffer.from(bytes.reverse())
  }

  function decode (string) {
    var buffer = decodeUnsafe(string)
    if (buffer) return buffer

    throw new Error('Non-base' + BASE + ' character')
  }

  return {
    encode: encode,
    decodeUnsafe: decodeUnsafe,
    decode: decode
  }
}

},{"safe-buffer":15}],2:[function(require,module,exports){
var basex = require('base-x')
var ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

module.exports = basex(ALPHABET)

},{"base-x":1}],3:[function(require,module,exports){
'use strict'

var base58 = require('bs58')
var Buffer = require('safe-buffer').Buffer

module.exports = function (checksumFn) {
  // Encode a buffer as a base58-check encoded string
  function encode (payload) {
    var checksum = checksumFn(payload)

    return base58.encode(Buffer.concat([
      payload,
      checksum
    ], payload.length + 4))
  }

  function decodeRaw (buffer) {
    var payload = buffer.slice(0, -4)
    var checksum = buffer.slice(-4)
    var newChecksum = checksumFn(payload)

    if (checksum[0] ^ newChecksum[0] |
        checksum[1] ^ newChecksum[1] |
        checksum[2] ^ newChecksum[2] |
        checksum[3] ^ newChecksum[3]) return

    return payload
  }

  // Decode a base58-check encoded string to a buffer, no result if checksum is wrong
  function decodeUnsafe (string) {
    var buffer = base58.decodeUnsafe(string)
    if (!buffer) return

    return decodeRaw(buffer)
  }

  function decode (string) {
    var buffer = base58.decode(string)
    var payload = decodeRaw(buffer, checksumFn)
    if (!payload) throw new Error('Invalid checksum')
    return payload
  }

  return {
    encode: encode,
    decode: decode,
    decodeUnsafe: decodeUnsafe
  }
}

},{"bs58":2,"safe-buffer":15}],4:[function(require,module,exports){
(function (Buffer){
'use strict'

var createHash = require('create-hash')
var bs58grscheckBase = require('./base')
var groestlhash = require('groestl-hash-js')

// GROESTL512(GROESTL512(buffer))
function groestl (buffer) {
  return Buffer(groestlhash.groestl_2(buffer, 1, 1))
}

module.exports = bs58grscheckBase(groestl)

}).call(this,require("buffer").Buffer)
},{"./base":3,"buffer":27,"create-hash":6,"groestl-hash-js":7}],5:[function(require,module,exports){
var Buffer = require('safe-buffer').Buffer
var Transform = require('stream').Transform
var StringDecoder = require('string_decoder').StringDecoder
var inherits = require('inherits')

function CipherBase (hashMode) {
  Transform.call(this)
  this.hashMode = typeof hashMode === 'string'
  if (this.hashMode) {
    this[hashMode] = this._finalOrDigest
  } else {
    this.final = this._finalOrDigest
  }
  if (this._final) {
    this.__final = this._final
    this._final = null
  }
  this._decoder = null
  this._encoding = null
}
inherits(CipherBase, Transform)

CipherBase.prototype.update = function (data, inputEnc, outputEnc) {
  if (typeof data === 'string') {
    data = Buffer.from(data, inputEnc)
  }

  var outData = this._update(data)
  if (this.hashMode) return this

  if (outputEnc) {
    outData = this._toString(outData, outputEnc)
  }

  return outData
}

CipherBase.prototype.setAutoPadding = function () {}
CipherBase.prototype.getAuthTag = function () {
  throw new Error('trying to get auth tag in unsupported state')
}

CipherBase.prototype.setAuthTag = function () {
  throw new Error('trying to set auth tag in unsupported state')
}

CipherBase.prototype.setAAD = function () {
  throw new Error('trying to set aad in unsupported state')
}

CipherBase.prototype._transform = function (data, _, next) {
  var err
  try {
    if (this.hashMode) {
      this._update(data)
    } else {
      this.push(this._update(data))
    }
  } catch (e) {
    err = e
  } finally {
    next(err)
  }
}
CipherBase.prototype._flush = function (done) {
  var err
  try {
    this.push(this.__final())
  } catch (e) {
    err = e
  }

  done(err)
}
CipherBase.prototype._finalOrDigest = function (outputEnc) {
  var outData = this.__final() || Buffer.alloc(0)
  if (outputEnc) {
    outData = this._toString(outData, outputEnc, true)
  }
  return outData
}

CipherBase.prototype._toString = function (value, enc, fin) {
  if (!this._decoder) {
    this._decoder = new StringDecoder(enc)
    this._encoding = enc
  }

  if (this._encoding !== enc) throw new Error('can\'t switch encodings')

  var out = this._decoder.write(value)
  if (fin) {
    out += this._decoder.end()
  }

  return out
}

module.exports = CipherBase

},{"inherits":12,"safe-buffer":15,"stream":51,"string_decoder":52}],6:[function(require,module,exports){
'use strict'
var inherits = require('inherits')
var MD5 = require('md5.js')
var RIPEMD160 = require('ripemd160')
var sha = require('sha.js')
var Base = require('cipher-base')

function Hash (hash) {
  Base.call(this, 'digest')

  this._hash = hash
}

inherits(Hash, Base)

Hash.prototype._update = function (data) {
  this._hash.update(data)
}

Hash.prototype._final = function () {
  return this._hash.digest()
}

module.exports = function createHash (alg) {
  alg = alg.toLowerCase()
  if (alg === 'md5') return new MD5()
  if (alg === 'rmd160' || alg === 'ripemd160') return new RIPEMD160()

  return new Hash(sha(alg))
}

},{"cipher-base":5,"inherits":12,"md5.js":13,"ripemd160":14,"sha.js":17}],7:[function(require,module,exports){
'use strict';

var groestl = require('./lib/groestl');
var h = require('./lib/helper');

var x11hash = module.exports;

module.exports.groestl512 = function(str,format, output) {
  return groestl(str,format,output);
}

module.exports.groestl = function(str,format, output) {
  var a = groestl(str,format,2);
  a = a.slice(0,8);
  if (output === 2) {
    return a;
  }
  else if (output === 1) {
    return h.int32Buffer2Bytes(a);
  }
  else {
    return h.int32ArrayToHexString(a);
  }
}

module.exports.groestl_2 = function(str,format, output) {
  var a = groestl(str,format,2);
  a = groestl(a,2,2);
  a = a.slice(0,8);
  if (output === 2) {
    return a;
  }
  else if (output === 1) {
    return h.int32Buffer2Bytes(a);
  }
  else {
    return h.int32ArrayToHexString(a);
  }
}
},{"./lib/groestl":8,"./lib/helper":9}],8:[function(require,module,exports){
/////////////////////////////////////
////////////  groestl ///////////////

//// Written by Quantum Explorer ////
////////// Dash Foundation //////////
/// Released under the MIT License //
/////////////////////////////////////

var o = require('./op');
var h = require('./helper');

var T0 = h.bytes2Int64Buffer(h.b64Decode("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"));
var T1 = h.bytes2Int64Buffer(h.b64Decode("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"));
var T2 = h.bytes2Int64Buffer(h.b64Decode("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"));
var T3 = h.bytes2Int64Buffer(h.b64Decode("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"));
var T4 = h.bytes2Int64Buffer(h.b64Decode("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"));
var T5 = h.bytes2Int64Buffer(h.b64Decode("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"));
var T6 = h.bytes2Int64Buffer(h.b64Decode("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"));
var T7 = h.bytes2Int64Buffer(h.b64Decode("MvSl9JelxsZvl4SX64T4+F6wmbDHme7ueoyNjPeN9vboFw0X5Q3//wrcvdy3vdbWFsixyKex3t5t/FT8OVSRkZDwUPDAUGBgBwUDBQQDAgIu4Kngh6nOztGHfYesfVZWzCsZK9UZ5+cTpmKmcWK1tXwx5jGa5k1NWbWatcOa7OxAz0XPBUWPj6O8nbw+nR8fScBAwAlAiYlokoeS74f6+tA/FT/FFe/vlCbrJn/rsrLOQMlAB8mOjuYdCx3tC/v7bi/sL4LsQUEaqWepfWezs0Mc/Ry+/V9fYCXqJYrqRUX52r/aRr8jI1EC9wKm91NTRaGWodOW5OR27VvtLVubmyhdwl3qwnV1xSQcJNkc4eHU6a7peq49PfK+ar6YakxMgu5a7thabGy9w0HD/EF+fvMGAgbxAvX1UtFP0R1Pg4OM5Fzk0FxoaFYH9Aei9FFRjVw0XLk00dHhGAgY6Qj5+Uyuk67fk+LiPpVzlU1zq6uX9VP1xFNiYmtBP0FUPyoqHBQMFBAMCAhj9lL2MVKVlemvZa+MZUZGf+Je4iFenZ1IeCh4YCgwMM/4ofhuoTc3GxEPERQPCgrrxLXEXrUvLxUbCRscCQ4Oflo2Wkg2JCSttpu2NpsbG5hHPUelPd/fp2omaoEmzc31u2m7nGlOTjNMzUz+zX9/ULqfus+f6uo/LRstJBsSEqS5nrk6nh0dxJx0nLB0WFhGci5yaC40NEF3LXdsLTY2Ec2yzaOy3NydKe4pc+60tE0W+xa2+1tbpQH2AVP2pKSh103X7E12dhSjYaN1Ybe3NEnOSfrOfX3fjXuNpHtSUp9CPkKhPt3dzZNxk7xxXl6xopeiJpcTE6IE9QRX9aamAbhouGloubkAAAAAAAAAALV0LHSZLMHB4KBgoIBgQEDCIR8h3R/j4zpDyEPyyHl5miztLHfttrYN2b7Zs77U1EfKRsoBRo2NF3DZcM7ZZ2ev3Uvd5Etycu153nkz3pSU/2fUZyvUmJiTI+gje+iwsFveSt4RSoWFBr1rvW1ru7u7fip+kSrFxXs05TSe5U9P1zoWOsEW7e3SVMVUF8WGhvhi12Iv15qamf9V/8xVZma2p5SnIpQREcBKz0oPz4qK2TAQMMkQ6ekOCgYKCAYEBGaYgZjngf7+qwvwC1vwoKC0zETM8ER4ePDVutVKuiUldT7jPpbjS0usDvMOX/OiokQZ/hm6/l1d21vAWxvAgICAhYqFCooFBdPsrex+rT8//t+830K8ISGo2EjY4EhwcP0MBAz5BPHxGXrfesbfY2MvWMFY7sF3dzCfdZ9Fda+v56VjpYRjQkJwUDBQQDAgIMsuGi7RGuXl7xIOEuEO/f0It223ZW2/v1XUTNQZTIGBJDwUPDAUGBh5XzVfTDUmJrJxL3GdL8PDhjjhOGfhvr7I/aL9aqI1NcdPzE8LzIiIZUs5S1w5Li5q+Vf5PVeTk1gN8g2q8lVVYZ2CneOC/PyzyUfJ9Ed6eifvrO+LrMjIiDLnMm/nurpPfSt9ZCsyMkKklaTXlebmO/ug+5ugwMCqs5izMpgZGfZo0Wgn0Z6eIoF/gV1/o6PuqmaqiGZERNaCfoKoflRU3ear5narOzuVnoOeFoMLC8lFykUDyoyMvHspe5Upx8cFbtNu1tNra2xEPERQPCgoLIt5i1V5p6eBPeI9Y+K8vDEnHScsHRYWN5p2mkF2ra2WTTtNrTvb2576VvrIVmRkptJO0uhOdHQ2Ih4iKB4UFOR223Y/25KSEh4KHhgKDAz8tGy0kGxISI835Ddr5Li4eOdd5yVdn58Psm6yYW69vWkq7yqG70NDNfGm8ZOmxMTa46jjcqg5Ocb3pPdipDExilk3Wb0309N0houG/4vy8oNWMlaxMtXVTsVDxQ1Di4uF61nr3FlubhjCt8Kvt9rajo+MjwKMAQEdrGSseWSxsfFt0m0j0pyccjvgO5LgSUkfx7THq7TY2LkV+hVD+qys+gkHCf0H8/OgbyVvhSXPzyDqr+qPr8rKfYmOifOO9PRnIOkgjulHRzgoGCggGBAQC2TVZN7Vb29zg4iD+4jw8Puxb7GUb0pKypZylrhyXFxUbCRscCQ4OF8I8Qiu8VdXIVLHUubHc3Nk81HzNVGXl65lI2WNI8vLJYR8hFl8oaFXv5y/y5zo6F1jIWN8IT4+6nzdfDfdlpYef9x/wtxhYZyRhpEahg0Nm5SFlB6FDw9Lq5Cr25Dg4LrGQsb4Qnx8JlfEV+LEcXEp5arlg6rMzONz2HM72JCQCQ8FDwwFBgb0AwED9QH39yo2EjY4EhwcPP6j/p+jwsKL4V/h1F9qar4Q+RBH+a6uAmvQa9LQaWm/qJGoLpEXF3HoWOgpWJmZU2knaXQnOjr30LnQTrknJ5FIOEipONnZ3jUTNc0T6+vlzrPOVrMrK3dVM1VEMyIiBNa71r+70tI5kHCQSXCpqYeAiYAOiQcHwfKn8manMzPswbbBWrYtLVpmImZ4Ijw8uK2SrSqSFRWpYCBgiSDJyVzbSdsVSYeHsBr/Gk//qqrYiHiIoHhQUCuOeo5ReqWliYqPigaPAwNKE/gTsvhZWZKbgJsSgAkJIzkXOTQXGhoQddp1ytplZYRTMVO1MdfX1VHGURPGhIQD07jTu7jQ0Nxew14fw4KC4suwy1KwKSnDmXeZtHdaWi0zETM8ER4ePUbLRvbLe3u3H/wfS/yoqAxh1mHa1m1tYk46Tlg6LCw="));

// var T0 = [
//   o.u(0xc632f4a5, 0xf497a5c6), o.u(0xf86f9784, 0x97eb84f8),
//   o.u(0xee5eb099, 0xb0c799ee), o.u(0xf67a8c8d, 0x8cf78df6),
//   o.u(0xffe8170d, 0x17e50dff), o.u(0xd60adcbd, 0xdcb7bdd6),
//   o.u(0xde16c8b1, 0xc8a7b1de), o.u(0x916dfc54, 0xfc395491),
//   o.u(0x6090f050, 0xf0c05060), o.u(0x02070503, 0x05040302),
//   o.u(0xce2ee0a9, 0xe087a9ce), o.u(0x56d1877d, 0x87ac7d56),
//   o.u(0xe7cc2b19, 0x2bd519e7), o.u(0xb513a662, 0xa67162b5),
//   o.u(0x4d7c31e6, 0x319ae64d), o.u(0xec59b59a, 0xb5c39aec),
//   o.u(0x8f40cf45, 0xcf05458f), o.u(0x1fa3bc9d, 0xbc3e9d1f),
//   o.u(0x8949c040, 0xc0094089), o.u(0xfa689287, 0x92ef87fa),
//   o.u(0xefd03f15, 0x3fc515ef), o.u(0xb29426eb, 0x267febb2),
//   o.u(0x8ece40c9, 0x4007c98e), o.u(0xfbe61d0b, 0x1ded0bfb),
//   o.u(0x416e2fec, 0x2f82ec41), o.u(0xb31aa967, 0xa97d67b3),
//   o.u(0x5f431cfd, 0x1cbefd5f), o.u(0x456025ea, 0x258aea45),
//   o.u(0x23f9dabf, 0xda46bf23), o.u(0x535102f7, 0x02a6f753),
//   o.u(0xe445a196, 0xa1d396e4), o.u(0x9b76ed5b, 0xed2d5b9b),
//   o.u(0x75285dc2, 0x5deac275), o.u(0xe1c5241c, 0x24d91ce1),
//   o.u(0x3dd4e9ae, 0xe97aae3d), o.u(0x4cf2be6a, 0xbe986a4c),
//   o.u(0x6c82ee5a, 0xeed85a6c), o.u(0x7ebdc341, 0xc3fc417e),
//   o.u(0xf5f30602, 0x06f102f5), o.u(0x8352d14f, 0xd11d4f83),
//   o.u(0x688ce45c, 0xe4d05c68), o.u(0x515607f4, 0x07a2f451),
//   o.u(0xd18d5c34, 0x5cb934d1), o.u(0xf9e11808, 0x18e908f9),
//   o.u(0xe24cae93, 0xaedf93e2), o.u(0xab3e9573, 0x954d73ab),
//   o.u(0x6297f553, 0xf5c45362), o.u(0x2a6b413f, 0x41543f2a),
//   o.u(0x081c140c, 0x14100c08), o.u(0x9563f652, 0xf6315295),
//   o.u(0x46e9af65, 0xaf8c6546), o.u(0x9d7fe25e, 0xe2215e9d),
//   o.u(0x30487828, 0x78602830), o.u(0x37cff8a1, 0xf86ea137),
//   o.u(0x0a1b110f, 0x11140f0a), o.u(0x2febc4b5, 0xc45eb52f),
//   o.u(0x0e151b09, 0x1b1c090e), o.u(0x247e5a36, 0x5a483624),
//   o.u(0x1badb69b, 0xb6369b1b), o.u(0xdf98473d, 0x47a53ddf),
//   o.u(0xcda76a26, 0x6a8126cd), o.u(0x4ef5bb69, 0xbb9c694e),
//   o.u(0x7f334ccd, 0x4cfecd7f), o.u(0xea50ba9f, 0xbacf9fea),
//   o.u(0x123f2d1b, 0x2d241b12), o.u(0x1da4b99e, 0xb93a9e1d),
//   o.u(0x58c49c74, 0x9cb07458), o.u(0x3446722e, 0x72682e34),
//   o.u(0x3641772d, 0x776c2d36), o.u(0xdc11cdb2, 0xcda3b2dc),
//   o.u(0xb49d29ee, 0x2973eeb4), o.u(0x5b4d16fb, 0x16b6fb5b),
//   o.u(0xa4a501f6, 0x0153f6a4), o.u(0x76a1d74d, 0xd7ec4d76),
//   o.u(0xb714a361, 0xa37561b7), o.u(0x7d3449ce, 0x49face7d),
//   o.u(0x52df8d7b, 0x8da47b52), o.u(0xdd9f423e, 0x42a13edd),
//   o.u(0x5ecd9371, 0x93bc715e), o.u(0x13b1a297, 0xa2269713),
//   o.u(0xa6a204f5, 0x0457f5a6), o.u(0xb901b868, 0xb86968b9),
//   o.u(0x00000000, 0x00000000), o.u(0xc1b5742c, 0x74992cc1),
//   o.u(0x40e0a060, 0xa0806040), o.u(0xe3c2211f, 0x21dd1fe3),
//   o.u(0x793a43c8, 0x43f2c879), o.u(0xb69a2ced, 0x2c77edb6),
//   o.u(0xd40dd9be, 0xd9b3bed4), o.u(0x8d47ca46, 0xca01468d),
//   o.u(0x671770d9, 0x70ced967), o.u(0x72afdd4b, 0xdde44b72),
//   o.u(0x94ed79de, 0x7933de94), o.u(0x98ff67d4, 0x672bd498),
//   o.u(0xb09323e8, 0x237be8b0), o.u(0x855bde4a, 0xde114a85),
//   o.u(0xbb06bd6b, 0xbd6d6bbb), o.u(0xc5bb7e2a, 0x7e912ac5),
//   o.u(0x4f7b34e5, 0x349ee54f), o.u(0xedd73a16, 0x3ac116ed),
//   o.u(0x86d254c5, 0x5417c586), o.u(0x9af862d7, 0x622fd79a),
//   o.u(0x6699ff55, 0xffcc5566), o.u(0x11b6a794, 0xa7229411),
//   o.u(0x8ac04acf, 0x4a0fcf8a), o.u(0xe9d93010, 0x30c910e9),
//   o.u(0x040e0a06, 0x0a080604), o.u(0xfe669881, 0x98e781fe),
//   o.u(0xa0ab0bf0, 0x0b5bf0a0), o.u(0x78b4cc44, 0xccf04478),
//   o.u(0x25f0d5ba, 0xd54aba25), o.u(0x4b753ee3, 0x3e96e34b),
//   o.u(0xa2ac0ef3, 0x0e5ff3a2), o.u(0x5d4419fe, 0x19bafe5d),
//   o.u(0x80db5bc0, 0x5b1bc080), o.u(0x0580858a, 0x850a8a05),
//   o.u(0x3fd3ecad, 0xec7ead3f), o.u(0x21fedfbc, 0xdf42bc21),
//   o.u(0x70a8d848, 0xd8e04870), o.u(0xf1fd0c04, 0x0cf904f1),
//   o.u(0x63197adf, 0x7ac6df63), o.u(0x772f58c1, 0x58eec177),
//   o.u(0xaf309f75, 0x9f4575af), o.u(0x42e7a563, 0xa5846342),
//   o.u(0x20705030, 0x50403020), o.u(0xe5cb2e1a, 0x2ed11ae5),
//   o.u(0xfdef120e, 0x12e10efd), o.u(0xbf08b76d, 0xb7656dbf),
//   o.u(0x8155d44c, 0xd4194c81), o.u(0x18243c14, 0x3c301418),
//   o.u(0x26795f35, 0x5f4c3526), o.u(0xc3b2712f, 0x719d2fc3),
//   o.u(0xbe8638e1, 0x3867e1be), o.u(0x35c8fda2, 0xfd6aa235),
//   o.u(0x88c74fcc, 0x4f0bcc88), o.u(0x2e654b39, 0x4b5c392e),
//   o.u(0x936af957, 0xf93d5793), o.u(0x55580df2, 0x0daaf255),
//   o.u(0xfc619d82, 0x9de382fc), o.u(0x7ab3c947, 0xc9f4477a),
//   o.u(0xc827efac, 0xef8bacc8), o.u(0xba8832e7, 0x326fe7ba),
//   o.u(0x324f7d2b, 0x7d642b32), o.u(0xe642a495, 0xa4d795e6),
//   o.u(0xc03bfba0, 0xfb9ba0c0), o.u(0x19aab398, 0xb3329819),
//   o.u(0x9ef668d1, 0x6827d19e), o.u(0xa322817f, 0x815d7fa3),
//   o.u(0x44eeaa66, 0xaa886644), o.u(0x54d6827e, 0x82a87e54),
//   o.u(0x3bdde6ab, 0xe676ab3b), o.u(0x0b959e83, 0x9e16830b),
//   o.u(0x8cc945ca, 0x4503ca8c), o.u(0xc7bc7b29, 0x7b9529c7),
//   o.u(0x6b056ed3, 0x6ed6d36b), o.u(0x286c443c, 0x44503c28),
//   o.u(0xa72c8b79, 0x8b5579a7), o.u(0xbc813de2, 0x3d63e2bc),
//   o.u(0x1631271d, 0x272c1d16), o.u(0xad379a76, 0x9a4176ad),
//   o.u(0xdb964d3b, 0x4dad3bdb), o.u(0x649efa56, 0xfac85664),
//   o.u(0x74a6d24e, 0xd2e84e74), o.u(0x1436221e, 0x22281e14),
//   o.u(0x92e476db, 0x763fdb92), o.u(0x0c121e0a, 0x1e180a0c),
//   o.u(0x48fcb46c, 0xb4906c48), o.u(0xb88f37e4, 0x376be4b8),
//   o.u(0x9f78e75d, 0xe7255d9f), o.u(0xbd0fb26e, 0xb2616ebd),
//   o.u(0x43692aef, 0x2a86ef43), o.u(0xc435f1a6, 0xf193a6c4),
//   o.u(0x39dae3a8, 0xe372a839), o.u(0x31c6f7a4, 0xf762a431),
//   o.u(0xd38a5937, 0x59bd37d3), o.u(0xf274868b, 0x86ff8bf2),
//   o.u(0xd5835632, 0x56b132d5), o.u(0x8b4ec543, 0xc50d438b),
//   o.u(0x6e85eb59, 0xebdc596e), o.u(0xda18c2b7, 0xc2afb7da),
//   o.u(0x018e8f8c, 0x8f028c01), o.u(0xb11dac64, 0xac7964b1),
//   o.u(0x9cf16dd2, 0x6d23d29c), o.u(0x49723be0, 0x3b92e049),
//   o.u(0xd81fc7b4, 0xc7abb4d8), o.u(0xacb915fa, 0x1543faac),
//   o.u(0xf3fa0907, 0x09fd07f3), o.u(0xcfa06f25, 0x6f8525cf),
//   o.u(0xca20eaaf, 0xea8fafca), o.u(0xf47d898e, 0x89f38ef4),
//   o.u(0x476720e9, 0x208ee947), o.u(0x10382818, 0x28201810),
//   o.u(0x6f0b64d5, 0x64ded56f), o.u(0xf0738388, 0x83fb88f0),
//   o.u(0x4afbb16f, 0xb1946f4a), o.u(0x5cca9672, 0x96b8725c),
//   o.u(0x38546c24, 0x6c702438), o.u(0x575f08f1, 0x08aef157),
//   o.u(0x732152c7, 0x52e6c773), o.u(0x9764f351, 0xf3355197),
//   o.u(0xcbae6523, 0x658d23cb), o.u(0xa125847c, 0x84597ca1),
//   o.u(0xe857bf9c, 0xbfcb9ce8), o.u(0x3e5d6321, 0x637c213e),
//   o.u(0x96ea7cdd, 0x7c37dd96), o.u(0x611e7fdc, 0x7fc2dc61),
//   o.u(0x0d9c9186, 0x911a860d), o.u(0x0f9b9485, 0x941e850f),
//   o.u(0xe04bab90, 0xabdb90e0), o.u(0x7cbac642, 0xc6f8427c),
//   o.u(0x712657c4, 0x57e2c471), o.u(0xcc29e5aa, 0xe583aacc),
//   o.u(0x90e373d8, 0x733bd890), o.u(0x06090f05, 0x0f0c0506),
//   o.u(0xf7f40301, 0x03f501f7), o.u(0x1c2a3612, 0x3638121c),
//   o.u(0xc23cfea3, 0xfe9fa3c2), o.u(0x6a8be15f, 0xe1d45f6a),
//   o.u(0xaebe10f9, 0x1047f9ae), o.u(0x69026bd0, 0x6bd2d069),
//   o.u(0x17bfa891, 0xa82e9117), o.u(0x9971e858, 0xe8295899),
//   o.u(0x3a536927, 0x6974273a), o.u(0x27f7d0b9, 0xd04eb927),
//   o.u(0xd9914838, 0x48a938d9), o.u(0xebde3513, 0x35cd13eb),
//   o.u(0x2be5ceb3, 0xce56b32b), o.u(0x22775533, 0x55443322),
//   o.u(0xd204d6bb, 0xd6bfbbd2), o.u(0xa9399070, 0x904970a9),
//   o.u(0x07878089, 0x800e8907), o.u(0x33c1f2a7, 0xf266a733),
//   o.u(0x2decc1b6, 0xc15ab62d), o.u(0x3c5a6622, 0x6678223c),
//   o.u(0x15b8ad92, 0xad2a9215), o.u(0xc9a96020, 0x608920c9),
//   o.u(0x875cdb49, 0xdb154987), o.u(0xaab01aff, 0x1a4fffaa),
//   o.u(0x50d88878, 0x88a07850), o.u(0xa52b8e7a, 0x8e517aa5),
//   o.u(0x03898a8f, 0x8a068f03), o.u(0x594a13f8, 0x13b2f859),
//   o.u(0x09929b80, 0x9b128009), o.u(0x1a233917, 0x3934171a),
//   o.u(0x651075da, 0x75cada65), o.u(0xd7845331, 0x53b531d7),
//   o.u(0x84d551c6, 0x5113c684), o.u(0xd003d3b8, 0xd3bbb8d0),
//   o.u(0x82dc5ec3, 0x5e1fc382), o.u(0x29e2cbb0, 0xcb52b029),
//   o.u(0x5ac39977, 0x99b4775a), o.u(0x1e2d3311, 0x333c111e),
//   o.u(0x7b3d46cb, 0x46f6cb7b), o.u(0xa8b71ffc, 0x1f4bfca8),
//   o.u(0x6d0c61d6, 0x61dad66d), o.u(0x2c624e3a, 0x4e583a2c)
// ];

// var T1 = [
//   o.u(0xc6c632f4, 0xa5f497a5), o.u(0xf8f86f97, 0x8497eb84),
//   o.u(0xeeee5eb0, 0x99b0c799), o.u(0xf6f67a8c, 0x8d8cf78d),
//   o.u(0xffffe817, 0xd17e50d), o.u(0xd6d60adc, 0xbddcb7bd),
//   o.u(0xdede16c8, 0xb1c8a7b1), o.u(0x91916dfc, 0x54fc3954),
//   o.u(0x606090f0, 0x50f0c050), o.u(0x2020705, 0x3050403),
//   o.u(0xcece2ee0, 0xa9e087a9), o.u(0x5656d187, 0x7d87ac7d),
//   o.u(0xe7e7cc2b, 0x192bd519), o.u(0xb5b513a6, 0x62a67162),
//   o.u(0x4d4d7c31, 0xe6319ae6), o.u(0xecec59b5, 0x9ab5c39a),
//   o.u(0x8f8f40cf, 0x45cf0545), o.u(0x1f1fa3bc, 0x9dbc3e9d),
//   o.u(0x898949c0, 0x40c00940), o.u(0xfafa6892, 0x8792ef87),
//   o.u(0xefefd03f, 0x153fc515), o.u(0xb2b29426, 0xeb267feb),
//   o.u(0x8e8ece40, 0xc94007c9), o.u(0xfbfbe61d, 0xb1ded0b),
//   o.u(0x41416e2f, 0xec2f82ec), o.u(0xb3b31aa9, 0x67a97d67),
//   o.u(0x5f5f431c, 0xfd1cbefd), o.u(0x45456025, 0xea258aea),
//   o.u(0x2323f9da, 0xbfda46bf), o.u(0x53535102, 0xf702a6f7),
//   o.u(0xe4e445a1, 0x96a1d396), o.u(0x9b9b76ed, 0x5bed2d5b),
//   o.u(0x7575285d, 0xc25deac2), o.u(0xe1e1c524, 0x1c24d91c),
//   o.u(0x3d3dd4e9, 0xaee97aae), o.u(0x4c4cf2be, 0x6abe986a),
//   o.u(0x6c6c82ee, 0x5aeed85a), o.u(0x7e7ebdc3, 0x41c3fc41),
//   o.u(0xf5f5f306, 0x206f102), o.u(0x838352d1, 0x4fd11d4f),
//   o.u(0x68688ce4, 0x5ce4d05c), o.u(0x51515607, 0xf407a2f4),
//   o.u(0xd1d18d5c, 0x345cb934), o.u(0xf9f9e118, 0x818e908),
//   o.u(0xe2e24cae, 0x93aedf93), o.u(0xabab3e95, 0x73954d73),
//   o.u(0x626297f5, 0x53f5c453), o.u(0x2a2a6b41, 0x3f41543f),
//   o.u(0x8081c14, 0xc14100c), o.u(0x959563f6, 0x52f63152),
//   o.u(0x4646e9af, 0x65af8c65), o.u(0x9d9d7fe2, 0x5ee2215e),
//   o.u(0x30304878, 0x28786028), o.u(0x3737cff8, 0xa1f86ea1),
//   o.u(0xa0a1b11, 0xf11140f), o.u(0x2f2febc4, 0xb5c45eb5),
//   o.u(0xe0e151b, 0x91b1c09), o.u(0x24247e5a, 0x365a4836),
//   o.u(0x1b1badb6, 0x9bb6369b), o.u(0xdfdf9847, 0x3d47a53d),
//   o.u(0xcdcda76a, 0x266a8126), o.u(0x4e4ef5bb, 0x69bb9c69),
//   o.u(0x7f7f334c, 0xcd4cfecd), o.u(0xeaea50ba, 0x9fbacf9f),
//   o.u(0x12123f2d, 0x1b2d241b), o.u(0x1d1da4b9, 0x9eb93a9e),
//   o.u(0x5858c49c, 0x749cb074), o.u(0x34344672, 0x2e72682e),
//   o.u(0x36364177, 0x2d776c2d), o.u(0xdcdc11cd, 0xb2cda3b2),
//   o.u(0xb4b49d29, 0xee2973ee), o.u(0x5b5b4d16, 0xfb16b6fb),
//   o.u(0xa4a4a501, 0xf60153f6), o.u(0x7676a1d7, 0x4dd7ec4d),
//   o.u(0xb7b714a3, 0x61a37561), o.u(0x7d7d3449, 0xce49face),
//   o.u(0x5252df8d, 0x7b8da47b), o.u(0xdddd9f42, 0x3e42a13e),
//   o.u(0x5e5ecd93, 0x7193bc71), o.u(0x1313b1a2, 0x97a22697),
//   o.u(0xa6a6a204, 0xf50457f5), o.u(0xb9b901b8, 0x68b86968),
//   o.u(0x0, 0x0), o.u(0xc1c1b574, 0x2c74992c),
//   o.u(0x4040e0a0, 0x60a08060), o.u(0xe3e3c221, 0x1f21dd1f),
//   o.u(0x79793a43, 0xc843f2c8), o.u(0xb6b69a2c, 0xed2c77ed),
//   o.u(0xd4d40dd9, 0xbed9b3be), o.u(0x8d8d47ca, 0x46ca0146),
//   o.u(0x67671770, 0xd970ced9), o.u(0x7272afdd, 0x4bdde44b),
//   o.u(0x9494ed79, 0xde7933de), o.u(0x9898ff67, 0xd4672bd4),
//   o.u(0xb0b09323, 0xe8237be8), o.u(0x85855bde, 0x4ade114a),
//   o.u(0xbbbb06bd, 0x6bbd6d6b), o.u(0xc5c5bb7e, 0x2a7e912a),
//   o.u(0x4f4f7b34, 0xe5349ee5), o.u(0xededd73a, 0x163ac116),
//   o.u(0x8686d254, 0xc55417c5), o.u(0x9a9af862, 0xd7622fd7),
//   o.u(0x666699ff, 0x55ffcc55), o.u(0x1111b6a7, 0x94a72294),
//   o.u(0x8a8ac04a, 0xcf4a0fcf), o.u(0xe9e9d930, 0x1030c910),
//   o.u(0x4040e0a, 0x60a0806), o.u(0xfefe6698, 0x8198e781),
//   o.u(0xa0a0ab0b, 0xf00b5bf0), o.u(0x7878b4cc, 0x44ccf044),
//   o.u(0x2525f0d5, 0xbad54aba), o.u(0x4b4b753e, 0xe33e96e3),
//   o.u(0xa2a2ac0e, 0xf30e5ff3), o.u(0x5d5d4419, 0xfe19bafe),
//   o.u(0x8080db5b, 0xc05b1bc0), o.u(0x5058085, 0x8a850a8a),
//   o.u(0x3f3fd3ec, 0xadec7ead), o.u(0x2121fedf, 0xbcdf42bc),
//   o.u(0x7070a8d8, 0x48d8e048), o.u(0xf1f1fd0c, 0x40cf904),
//   o.u(0x6363197a, 0xdf7ac6df), o.u(0x77772f58, 0xc158eec1),
//   o.u(0xafaf309f, 0x759f4575), o.u(0x4242e7a5, 0x63a58463),
//   o.u(0x20207050, 0x30504030), o.u(0xe5e5cb2e, 0x1a2ed11a),
//   o.u(0xfdfdef12, 0xe12e10e), o.u(0xbfbf08b7, 0x6db7656d),
//   o.u(0x818155d4, 0x4cd4194c), o.u(0x1818243c, 0x143c3014),
//   o.u(0x2626795f, 0x355f4c35), o.u(0xc3c3b271, 0x2f719d2f),
//   o.u(0xbebe8638, 0xe13867e1), o.u(0x3535c8fd, 0xa2fd6aa2),
//   o.u(0x8888c74f, 0xcc4f0bcc), o.u(0x2e2e654b, 0x394b5c39),
//   o.u(0x93936af9, 0x57f93d57), o.u(0x5555580d, 0xf20daaf2),
//   o.u(0xfcfc619d, 0x829de382), o.u(0x7a7ab3c9, 0x47c9f447),
//   o.u(0xc8c827ef, 0xacef8bac), o.u(0xbaba8832, 0xe7326fe7),
//   o.u(0x32324f7d, 0x2b7d642b), o.u(0xe6e642a4, 0x95a4d795),
//   o.u(0xc0c03bfb, 0xa0fb9ba0), o.u(0x1919aab3, 0x98b33298),
//   o.u(0x9e9ef668, 0xd16827d1), o.u(0xa3a32281, 0x7f815d7f),
//   o.u(0x4444eeaa, 0x66aa8866), o.u(0x5454d682, 0x7e82a87e),
//   o.u(0x3b3bdde6, 0xabe676ab), o.u(0xb0b959e, 0x839e1683),
//   o.u(0x8c8cc945, 0xca4503ca), o.u(0xc7c7bc7b, 0x297b9529),
//   o.u(0x6b6b056e, 0xd36ed6d3), o.u(0x28286c44, 0x3c44503c),
//   o.u(0xa7a72c8b, 0x798b5579), o.u(0xbcbc813d, 0xe23d63e2),
//   o.u(0x16163127, 0x1d272c1d), o.u(0xadad379a, 0x769a4176),
//   o.u(0xdbdb964d, 0x3b4dad3b), o.u(0x64649efa, 0x56fac856),
//   o.u(0x7474a6d2, 0x4ed2e84e), o.u(0x14143622, 0x1e22281e),
//   o.u(0x9292e476, 0xdb763fdb), o.u(0xc0c121e, 0xa1e180a),
//   o.u(0x4848fcb4, 0x6cb4906c), o.u(0xb8b88f37, 0xe4376be4),
//   o.u(0x9f9f78e7, 0x5de7255d), o.u(0xbdbd0fb2, 0x6eb2616e),
//   o.u(0x4343692a, 0xef2a86ef), o.u(0xc4c435f1, 0xa6f193a6),
//   o.u(0x3939dae3, 0xa8e372a8), o.u(0x3131c6f7, 0xa4f762a4),
//   o.u(0xd3d38a59, 0x3759bd37), o.u(0xf2f27486, 0x8b86ff8b),
//   o.u(0xd5d58356, 0x3256b132), o.u(0x8b8b4ec5, 0x43c50d43),
//   o.u(0x6e6e85eb, 0x59ebdc59), o.u(0xdada18c2, 0xb7c2afb7),
//   o.u(0x1018e8f, 0x8c8f028c), o.u(0xb1b11dac, 0x64ac7964),
//   o.u(0x9c9cf16d, 0xd26d23d2), o.u(0x4949723b, 0xe03b92e0),
//   o.u(0xd8d81fc7, 0xb4c7abb4), o.u(0xacacb915, 0xfa1543fa),
//   o.u(0xf3f3fa09, 0x709fd07), o.u(0xcfcfa06f, 0x256f8525),
//   o.u(0xcaca20ea, 0xafea8faf), o.u(0xf4f47d89, 0x8e89f38e),
//   o.u(0x47476720, 0xe9208ee9), o.u(0x10103828, 0x18282018),
//   o.u(0x6f6f0b64, 0xd564ded5), o.u(0xf0f07383, 0x8883fb88),
//   o.u(0x4a4afbb1, 0x6fb1946f), o.u(0x5c5cca96, 0x7296b872),
//   o.u(0x3838546c, 0x246c7024), o.u(0x57575f08, 0xf108aef1),
//   o.u(0x73732152, 0xc752e6c7), o.u(0x979764f3, 0x51f33551),
//   o.u(0xcbcbae65, 0x23658d23), o.u(0xa1a12584, 0x7c84597c),
//   o.u(0xe8e857bf, 0x9cbfcb9c), o.u(0x3e3e5d63, 0x21637c21),
//   o.u(0x9696ea7c, 0xdd7c37dd), o.u(0x61611e7f, 0xdc7fc2dc),
//   o.u(0xd0d9c91, 0x86911a86), o.u(0xf0f9b94, 0x85941e85),
//   o.u(0xe0e04bab, 0x90abdb90), o.u(0x7c7cbac6, 0x42c6f842),
//   o.u(0x71712657, 0xc457e2c4), o.u(0xcccc29e5, 0xaae583aa),
//   o.u(0x9090e373, 0xd8733bd8), o.u(0x606090f, 0x50f0c05),
//   o.u(0xf7f7f403, 0x103f501), o.u(0x1c1c2a36, 0x12363812),
//   o.u(0xc2c23cfe, 0xa3fe9fa3), o.u(0x6a6a8be1, 0x5fe1d45f),
//   o.u(0xaeaebe10, 0xf91047f9), o.u(0x6969026b, 0xd06bd2d0),
//   o.u(0x1717bfa8, 0x91a82e91), o.u(0x999971e8, 0x58e82958),
//   o.u(0x3a3a5369, 0x27697427), o.u(0x2727f7d0, 0xb9d04eb9),
//   o.u(0xd9d99148, 0x3848a938), o.u(0xebebde35, 0x1335cd13),
//   o.u(0x2b2be5ce, 0xb3ce56b3), o.u(0x22227755, 0x33554433),
//   o.u(0xd2d204d6, 0xbbd6bfbb), o.u(0xa9a93990, 0x70904970),
//   o.u(0x7078780, 0x89800e89), o.u(0x3333c1f2, 0xa7f266a7),
//   o.u(0x2d2decc1, 0xb6c15ab6), o.u(0x3c3c5a66, 0x22667822),
//   o.u(0x1515b8ad, 0x92ad2a92), o.u(0xc9c9a960, 0x20608920),
//   o.u(0x87875cdb, 0x49db1549), o.u(0xaaaab01a, 0xff1a4fff),
//   o.u(0x5050d888, 0x7888a078), o.u(0xa5a52b8e, 0x7a8e517a),
//   o.u(0x303898a, 0x8f8a068f), o.u(0x59594a13, 0xf813b2f8),
//   o.u(0x909929b, 0x809b1280), o.u(0x1a1a2339, 0x17393417),
//   o.u(0x65651075, 0xda75cada), o.u(0xd7d78453, 0x3153b531),
//   o.u(0x8484d551, 0xc65113c6), o.u(0xd0d003d3, 0xb8d3bbb8),
//   o.u(0x8282dc5e, 0xc35e1fc3), o.u(0x2929e2cb, 0xb0cb52b0),
//   o.u(0x5a5ac399, 0x7799b477), o.u(0x1e1e2d33, 0x11333c11),
//   o.u(0x7b7b3d46, 0xcb46f6cb), o.u(0xa8a8b71f, 0xfc1f4bfc),
//   o.u(0x6d6d0c61, 0xd661dad6), o.u(0x2c2c624e, 0x3a4e583a)
// ];

// var T2 = [
//   o.u(0xa5c6c632, 0xf4a5f497), o.u(0x84f8f86f, 0x978497eb),
//   o.u(0x99eeee5e, 0xb099b0c7), o.u(0x8df6f67a, 0x8c8d8cf7),
//   o.u(0xdffffe8, 0x170d17e5), o.u(0xbdd6d60a, 0xdcbddcb7),
//   o.u(0xb1dede16, 0xc8b1c8a7), o.u(0x5491916d, 0xfc54fc39),
//   o.u(0x50606090, 0xf050f0c0), o.u(0x3020207, 0x5030504),
//   o.u(0xa9cece2e, 0xe0a9e087), o.u(0x7d5656d1, 0x877d87ac),
//   o.u(0x19e7e7cc, 0x2b192bd5), o.u(0x62b5b513, 0xa662a671),
//   o.u(0xe64d4d7c, 0x31e6319a), o.u(0x9aecec59, 0xb59ab5c3),
//   o.u(0x458f8f40, 0xcf45cf05), o.u(0x9d1f1fa3, 0xbc9dbc3e),
//   o.u(0x40898949, 0xc040c009), o.u(0x87fafa68, 0x928792ef),
//   o.u(0x15efefd0, 0x3f153fc5), o.u(0xebb2b294, 0x26eb267f),
//   o.u(0xc98e8ece, 0x40c94007), o.u(0xbfbfbe6, 0x1d0b1ded),
//   o.u(0xec41416e, 0x2fec2f82), o.u(0x67b3b31a, 0xa967a97d),
//   o.u(0xfd5f5f43, 0x1cfd1cbe), o.u(0xea454560, 0x25ea258a),
//   o.u(0xbf2323f9, 0xdabfda46), o.u(0xf7535351, 0x2f702a6),
//   o.u(0x96e4e445, 0xa196a1d3), o.u(0x5b9b9b76, 0xed5bed2d),
//   o.u(0xc2757528, 0x5dc25dea), o.u(0x1ce1e1c5, 0x241c24d9),
//   o.u(0xae3d3dd4, 0xe9aee97a), o.u(0x6a4c4cf2, 0xbe6abe98),
//   o.u(0x5a6c6c82, 0xee5aeed8), o.u(0x417e7ebd, 0xc341c3fc),
//   o.u(0x2f5f5f3, 0x60206f1), o.u(0x4f838352, 0xd14fd11d),
//   o.u(0x5c68688c, 0xe45ce4d0), o.u(0xf4515156, 0x7f407a2),
//   o.u(0x34d1d18d, 0x5c345cb9), o.u(0x8f9f9e1, 0x180818e9),
//   o.u(0x93e2e24c, 0xae93aedf), o.u(0x73abab3e, 0x9573954d),
//   o.u(0x53626297, 0xf553f5c4), o.u(0x3f2a2a6b, 0x413f4154),
//   o.u(0xc08081c, 0x140c1410), o.u(0x52959563, 0xf652f631),
//   o.u(0x654646e9, 0xaf65af8c), o.u(0x5e9d9d7f, 0xe25ee221),
//   o.u(0x28303048, 0x78287860), o.u(0xa13737cf, 0xf8a1f86e),
//   o.u(0xf0a0a1b, 0x110f1114), o.u(0xb52f2feb, 0xc4b5c45e),
//   o.u(0x90e0e15, 0x1b091b1c), o.u(0x3624247e, 0x5a365a48),
//   o.u(0x9b1b1bad, 0xb69bb636), o.u(0x3ddfdf98, 0x473d47a5),
//   o.u(0x26cdcda7, 0x6a266a81), o.u(0x694e4ef5, 0xbb69bb9c),
//   o.u(0xcd7f7f33, 0x4ccd4cfe), o.u(0x9feaea50, 0xba9fbacf),
//   o.u(0x1b12123f, 0x2d1b2d24), o.u(0x9e1d1da4, 0xb99eb93a),
//   o.u(0x745858c4, 0x9c749cb0), o.u(0x2e343446, 0x722e7268),
//   o.u(0x2d363641, 0x772d776c), o.u(0xb2dcdc11, 0xcdb2cda3),
//   o.u(0xeeb4b49d, 0x29ee2973), o.u(0xfb5b5b4d, 0x16fb16b6),
//   o.u(0xf6a4a4a5, 0x1f60153), o.u(0x4d7676a1, 0xd74dd7ec),
//   o.u(0x61b7b714, 0xa361a375), o.u(0xce7d7d34, 0x49ce49fa),
//   o.u(0x7b5252df, 0x8d7b8da4), o.u(0x3edddd9f, 0x423e42a1),
//   o.u(0x715e5ecd, 0x937193bc), o.u(0x971313b1, 0xa297a226),
//   o.u(0xf5a6a6a2, 0x4f50457), o.u(0x68b9b901, 0xb868b869),
//   o.u(0x0, 0x0), o.u(0x2cc1c1b5, 0x742c7499),
//   o.u(0x604040e0, 0xa060a080), o.u(0x1fe3e3c2, 0x211f21dd),
//   o.u(0xc879793a, 0x43c843f2), o.u(0xedb6b69a, 0x2ced2c77),
//   o.u(0xbed4d40d, 0xd9bed9b3), o.u(0x468d8d47, 0xca46ca01),
//   o.u(0xd9676717, 0x70d970ce), o.u(0x4b7272af, 0xdd4bdde4),
//   o.u(0xde9494ed, 0x79de7933), o.u(0xd49898ff, 0x67d4672b),
//   o.u(0xe8b0b093, 0x23e8237b), o.u(0x4a85855b, 0xde4ade11),
//   o.u(0x6bbbbb06, 0xbd6bbd6d), o.u(0x2ac5c5bb, 0x7e2a7e91),
//   o.u(0xe54f4f7b, 0x34e5349e), o.u(0x16ededd7, 0x3a163ac1),
//   o.u(0xc58686d2, 0x54c55417), o.u(0xd79a9af8, 0x62d7622f),
//   o.u(0x55666699, 0xff55ffcc), o.u(0x941111b6, 0xa794a722),
//   o.u(0xcf8a8ac0, 0x4acf4a0f), o.u(0x10e9e9d9, 0x301030c9),
//   o.u(0x604040e, 0xa060a08), o.u(0x81fefe66, 0x988198e7),
//   o.u(0xf0a0a0ab, 0xbf00b5b), o.u(0x447878b4, 0xcc44ccf0),
//   o.u(0xba2525f0, 0xd5bad54a), o.u(0xe34b4b75, 0x3ee33e96),
//   o.u(0xf3a2a2ac, 0xef30e5f), o.u(0xfe5d5d44, 0x19fe19ba),
//   o.u(0xc08080db, 0x5bc05b1b), o.u(0x8a050580, 0x858a850a),
//   o.u(0xad3f3fd3, 0xecadec7e), o.u(0xbc2121fe, 0xdfbcdf42),
//   o.u(0x487070a8, 0xd848d8e0), o.u(0x4f1f1fd, 0xc040cf9),
//   o.u(0xdf636319, 0x7adf7ac6), o.u(0xc177772f, 0x58c158ee),
//   o.u(0x75afaf30, 0x9f759f45), o.u(0x634242e7, 0xa563a584),
//   o.u(0x30202070, 0x50305040), o.u(0x1ae5e5cb, 0x2e1a2ed1),
//   o.u(0xefdfdef, 0x120e12e1), o.u(0x6dbfbf08, 0xb76db765),
//   o.u(0x4c818155, 0xd44cd419), o.u(0x14181824, 0x3c143c30),
//   o.u(0x35262679, 0x5f355f4c), o.u(0x2fc3c3b2, 0x712f719d),
//   o.u(0xe1bebe86, 0x38e13867), o.u(0xa23535c8, 0xfda2fd6a),
//   o.u(0xcc8888c7, 0x4fcc4f0b), o.u(0x392e2e65, 0x4b394b5c),
//   o.u(0x5793936a, 0xf957f93d), o.u(0xf2555558, 0xdf20daa),
//   o.u(0x82fcfc61, 0x9d829de3), o.u(0x477a7ab3, 0xc947c9f4),
//   o.u(0xacc8c827, 0xefacef8b), o.u(0xe7baba88, 0x32e7326f),
//   o.u(0x2b32324f, 0x7d2b7d64), o.u(0x95e6e642, 0xa495a4d7),
//   o.u(0xa0c0c03b, 0xfba0fb9b), o.u(0x981919aa, 0xb398b332),
//   o.u(0xd19e9ef6, 0x68d16827), o.u(0x7fa3a322, 0x817f815d),
//   o.u(0x664444ee, 0xaa66aa88), o.u(0x7e5454d6, 0x827e82a8),
//   o.u(0xab3b3bdd, 0xe6abe676), o.u(0x830b0b95, 0x9e839e16),
//   o.u(0xca8c8cc9, 0x45ca4503), o.u(0x29c7c7bc, 0x7b297b95),
//   o.u(0xd36b6b05, 0x6ed36ed6), o.u(0x3c28286c, 0x443c4450),
//   o.u(0x79a7a72c, 0x8b798b55), o.u(0xe2bcbc81, 0x3de23d63),
//   o.u(0x1d161631, 0x271d272c), o.u(0x76adad37, 0x9a769a41),
//   o.u(0x3bdbdb96, 0x4d3b4dad), o.u(0x5664649e, 0xfa56fac8),
//   o.u(0x4e7474a6, 0xd24ed2e8), o.u(0x1e141436, 0x221e2228),
//   o.u(0xdb9292e4, 0x76db763f), o.u(0xa0c0c12, 0x1e0a1e18),
//   o.u(0x6c4848fc, 0xb46cb490), o.u(0xe4b8b88f, 0x37e4376b),
//   o.u(0x5d9f9f78, 0xe75de725), o.u(0x6ebdbd0f, 0xb26eb261),
//   o.u(0xef434369, 0x2aef2a86), o.u(0xa6c4c435, 0xf1a6f193),
//   o.u(0xa83939da, 0xe3a8e372), o.u(0xa43131c6, 0xf7a4f762),
//   o.u(0x37d3d38a, 0x593759bd), o.u(0x8bf2f274, 0x868b86ff),
//   o.u(0x32d5d583, 0x563256b1), o.u(0x438b8b4e, 0xc543c50d),
//   o.u(0x596e6e85, 0xeb59ebdc), o.u(0xb7dada18, 0xc2b7c2af),
//   o.u(0x8c01018e, 0x8f8c8f02), o.u(0x64b1b11d, 0xac64ac79),
//   o.u(0xd29c9cf1, 0x6dd26d23), o.u(0xe0494972, 0x3be03b92),
//   o.u(0xb4d8d81f, 0xc7b4c7ab), o.u(0xfaacacb9, 0x15fa1543),
//   o.u(0x7f3f3fa, 0x90709fd), o.u(0x25cfcfa0, 0x6f256f85),
//   o.u(0xafcaca20, 0xeaafea8f), o.u(0x8ef4f47d, 0x898e89f3),
//   o.u(0xe9474767, 0x20e9208e), o.u(0x18101038, 0x28182820),
//   o.u(0xd56f6f0b, 0x64d564de), o.u(0x88f0f073, 0x838883fb),
//   o.u(0x6f4a4afb, 0xb16fb194), o.u(0x725c5cca, 0x967296b8),
//   o.u(0x24383854, 0x6c246c70), o.u(0xf157575f, 0x8f108ae),
//   o.u(0xc7737321, 0x52c752e6), o.u(0x51979764, 0xf351f335),
//   o.u(0x23cbcbae, 0x6523658d), o.u(0x7ca1a125, 0x847c8459),
//   o.u(0x9ce8e857, 0xbf9cbfcb), o.u(0x213e3e5d, 0x6321637c),
//   o.u(0xdd9696ea, 0x7cdd7c37), o.u(0xdc61611e, 0x7fdc7fc2),
//   o.u(0x860d0d9c, 0x9186911a), o.u(0x850f0f9b, 0x9485941e),
//   o.u(0x90e0e04b, 0xab90abdb), o.u(0x427c7cba, 0xc642c6f8),
//   o.u(0xc4717126, 0x57c457e2), o.u(0xaacccc29, 0xe5aae583),
//   o.u(0xd89090e3, 0x73d8733b), o.u(0x5060609, 0xf050f0c),
//   o.u(0x1f7f7f4, 0x30103f5), o.u(0x121c1c2a, 0x36123638),
//   o.u(0xa3c2c23c, 0xfea3fe9f), o.u(0x5f6a6a8b, 0xe15fe1d4),
//   o.u(0xf9aeaebe, 0x10f91047), o.u(0xd0696902, 0x6bd06bd2),
//   o.u(0x911717bf, 0xa891a82e), o.u(0x58999971, 0xe858e829),
//   o.u(0x273a3a53, 0x69276974), o.u(0xb92727f7, 0xd0b9d04e),
//   o.u(0x38d9d991, 0x483848a9), o.u(0x13ebebde, 0x351335cd),
//   o.u(0xb32b2be5, 0xceb3ce56), o.u(0x33222277, 0x55335544),
//   o.u(0xbbd2d204, 0xd6bbd6bf), o.u(0x70a9a939, 0x90709049),
//   o.u(0x89070787, 0x8089800e), o.u(0xa73333c1, 0xf2a7f266),
//   o.u(0xb62d2dec, 0xc1b6c15a), o.u(0x223c3c5a, 0x66226678),
//   o.u(0x921515b8, 0xad92ad2a), o.u(0x20c9c9a9, 0x60206089),
//   o.u(0x4987875c, 0xdb49db15), o.u(0xffaaaab0, 0x1aff1a4f),
//   o.u(0x785050d8, 0x887888a0), o.u(0x7aa5a52b, 0x8e7a8e51),
//   o.u(0x8f030389, 0x8a8f8a06), o.u(0xf859594a, 0x13f813b2),
//   o.u(0x80090992, 0x9b809b12), o.u(0x171a1a23, 0x39173934),
//   o.u(0xda656510, 0x75da75ca), o.u(0x31d7d784, 0x533153b5),
//   o.u(0xc68484d5, 0x51c65113), o.u(0xb8d0d003, 0xd3b8d3bb),
//   o.u(0xc38282dc, 0x5ec35e1f), o.u(0xb02929e2, 0xcbb0cb52),
//   o.u(0x775a5ac3, 0x997799b4), o.u(0x111e1e2d, 0x3311333c),
//   o.u(0xcb7b7b3d, 0x46cb46f6), o.u(0xfca8a8b7, 0x1ffc1f4b),
//   o.u(0xd66d6d0c, 0x61d661da), o.u(0x3a2c2c62, 0x4e3a4e58)
// ];

// var T3 = [
//   o.u(0x97a5c6c6, 0x32f4a5f4), o.u(0xeb84f8f8, 0x6f978497),
//   o.u(0xc799eeee, 0x5eb099b0), o.u(0xf78df6f6, 0x7a8c8d8c),
//   o.u(0xe50dffff, 0xe8170d17), o.u(0xb7bdd6d6, 0xadcbddc),
//   o.u(0xa7b1dede, 0x16c8b1c8), o.u(0x39549191, 0x6dfc54fc),
//   o.u(0xc0506060, 0x90f050f0), o.u(0x4030202, 0x7050305),
//   o.u(0x87a9cece, 0x2ee0a9e0), o.u(0xac7d5656, 0xd1877d87),
//   o.u(0xd519e7e7, 0xcc2b192b), o.u(0x7162b5b5, 0x13a662a6),
//   o.u(0x9ae64d4d, 0x7c31e631), o.u(0xc39aecec, 0x59b59ab5),
//   o.u(0x5458f8f, 0x40cf45cf), o.u(0x3e9d1f1f, 0xa3bc9dbc),
//   o.u(0x9408989, 0x49c040c0), o.u(0xef87fafa, 0x68928792),
//   o.u(0xc515efef, 0xd03f153f), o.u(0x7febb2b2, 0x9426eb26),
//   o.u(0x7c98e8e, 0xce40c940), o.u(0xed0bfbfb, 0xe61d0b1d),
//   o.u(0x82ec4141, 0x6e2fec2f), o.u(0x7d67b3b3, 0x1aa967a9),
//   o.u(0xbefd5f5f, 0x431cfd1c), o.u(0x8aea4545, 0x6025ea25),
//   o.u(0x46bf2323, 0xf9dabfda), o.u(0xa6f75353, 0x5102f702),
//   o.u(0xd396e4e4, 0x45a196a1), o.u(0x2d5b9b9b, 0x76ed5bed),
//   o.u(0xeac27575, 0x285dc25d), o.u(0xd91ce1e1, 0xc5241c24),
//   o.u(0x7aae3d3d, 0xd4e9aee9), o.u(0x986a4c4c, 0xf2be6abe),
//   o.u(0xd85a6c6c, 0x82ee5aee), o.u(0xfc417e7e, 0xbdc341c3),
//   o.u(0xf102f5f5, 0xf3060206), o.u(0x1d4f8383, 0x52d14fd1),
//   o.u(0xd05c6868, 0x8ce45ce4), o.u(0xa2f45151, 0x5607f407),
//   o.u(0xb934d1d1, 0x8d5c345c), o.u(0xe908f9f9, 0xe1180818),
//   o.u(0xdf93e2e2, 0x4cae93ae), o.u(0x4d73abab, 0x3e957395),
//   o.u(0xc4536262, 0x97f553f5), o.u(0x543f2a2a, 0x6b413f41),
//   o.u(0x100c0808, 0x1c140c14), o.u(0x31529595, 0x63f652f6),
//   o.u(0x8c654646, 0xe9af65af), o.u(0x215e9d9d, 0x7fe25ee2),
//   o.u(0x60283030, 0x48782878), o.u(0x6ea13737, 0xcff8a1f8),
//   o.u(0x140f0a0a, 0x1b110f11), o.u(0x5eb52f2f, 0xebc4b5c4),
//   o.u(0x1c090e0e, 0x151b091b), o.u(0x48362424, 0x7e5a365a),
//   o.u(0x369b1b1b, 0xadb69bb6), o.u(0xa53ddfdf, 0x98473d47),
//   o.u(0x8126cdcd, 0xa76a266a), o.u(0x9c694e4e, 0xf5bb69bb),
//   o.u(0xfecd7f7f, 0x334ccd4c), o.u(0xcf9feaea, 0x50ba9fba),
//   o.u(0x241b1212, 0x3f2d1b2d), o.u(0x3a9e1d1d, 0xa4b99eb9),
//   o.u(0xb0745858, 0xc49c749c), o.u(0x682e3434, 0x46722e72),
//   o.u(0x6c2d3636, 0x41772d77), o.u(0xa3b2dcdc, 0x11cdb2cd),
//   o.u(0x73eeb4b4, 0x9d29ee29), o.u(0xb6fb5b5b, 0x4d16fb16),
//   o.u(0x53f6a4a4, 0xa501f601), o.u(0xec4d7676, 0xa1d74dd7),
//   o.u(0x7561b7b7, 0x14a361a3), o.u(0xface7d7d, 0x3449ce49),
//   o.u(0xa47b5252, 0xdf8d7b8d), o.u(0xa13edddd, 0x9f423e42),
//   o.u(0xbc715e5e, 0xcd937193), o.u(0x26971313, 0xb1a297a2),
//   o.u(0x57f5a6a6, 0xa204f504), o.u(0x6968b9b9, 0x1b868b8),
//   o.u(0x0, 0x0), o.u(0x992cc1c1, 0xb5742c74),
//   o.u(0x80604040, 0xe0a060a0), o.u(0xdd1fe3e3, 0xc2211f21),
//   o.u(0xf2c87979, 0x3a43c843), o.u(0x77edb6b6, 0x9a2ced2c),
//   o.u(0xb3bed4d4, 0xdd9bed9), o.u(0x1468d8d, 0x47ca46ca),
//   o.u(0xced96767, 0x1770d970), o.u(0xe44b7272, 0xafdd4bdd),
//   o.u(0x33de9494, 0xed79de79), o.u(0x2bd49898, 0xff67d467),
//   o.u(0x7be8b0b0, 0x9323e823), o.u(0x114a8585, 0x5bde4ade),
//   o.u(0x6d6bbbbb, 0x6bd6bbd), o.u(0x912ac5c5, 0xbb7e2a7e),
//   o.u(0x9ee54f4f, 0x7b34e534), o.u(0xc116eded, 0xd73a163a),
//   o.u(0x17c58686, 0xd254c554), o.u(0x2fd79a9a, 0xf862d762),
//   o.u(0xcc556666, 0x99ff55ff), o.u(0x22941111, 0xb6a794a7),
//   o.u(0xfcf8a8a, 0xc04acf4a), o.u(0xc910e9e9, 0xd9301030),
//   o.u(0x8060404, 0xe0a060a), o.u(0xe781fefe, 0x66988198),
//   o.u(0x5bf0a0a0, 0xab0bf00b), o.u(0xf0447878, 0xb4cc44cc),
//   o.u(0x4aba2525, 0xf0d5bad5), o.u(0x96e34b4b, 0x753ee33e),
//   o.u(0x5ff3a2a2, 0xac0ef30e), o.u(0xbafe5d5d, 0x4419fe19),
//   o.u(0x1bc08080, 0xdb5bc05b), o.u(0xa8a0505, 0x80858a85),
//   o.u(0x7ead3f3f, 0xd3ecadec), o.u(0x42bc2121, 0xfedfbcdf),
//   o.u(0xe0487070, 0xa8d848d8), o.u(0xf904f1f1, 0xfd0c040c),
//   o.u(0xc6df6363, 0x197adf7a), o.u(0xeec17777, 0x2f58c158),
//   o.u(0x4575afaf, 0x309f759f), o.u(0x84634242, 0xe7a563a5),
//   o.u(0x40302020, 0x70503050), o.u(0xd11ae5e5, 0xcb2e1a2e),
//   o.u(0xe10efdfd, 0xef120e12), o.u(0x656dbfbf, 0x8b76db7),
//   o.u(0x194c8181, 0x55d44cd4), o.u(0x30141818, 0x243c143c),
//   o.u(0x4c352626, 0x795f355f), o.u(0x9d2fc3c3, 0xb2712f71),
//   o.u(0x67e1bebe, 0x8638e138), o.u(0x6aa23535, 0xc8fda2fd),
//   o.u(0xbcc8888, 0xc74fcc4f), o.u(0x5c392e2e, 0x654b394b),
//   o.u(0x3d579393, 0x6af957f9), o.u(0xaaf25555, 0x580df20d),
//   o.u(0xe382fcfc, 0x619d829d), o.u(0xf4477a7a, 0xb3c947c9),
//   o.u(0x8bacc8c8, 0x27efacef), o.u(0x6fe7baba, 0x8832e732),
//   o.u(0x642b3232, 0x4f7d2b7d), o.u(0xd795e6e6, 0x42a495a4),
//   o.u(0x9ba0c0c0, 0x3bfba0fb), o.u(0x32981919, 0xaab398b3),
//   o.u(0x27d19e9e, 0xf668d168), o.u(0x5d7fa3a3, 0x22817f81),
//   o.u(0x88664444, 0xeeaa66aa), o.u(0xa87e5454, 0xd6827e82),
//   o.u(0x76ab3b3b, 0xdde6abe6), o.u(0x16830b0b, 0x959e839e),
//   o.u(0x3ca8c8c, 0xc945ca45), o.u(0x9529c7c7, 0xbc7b297b),
//   o.u(0xd6d36b6b, 0x56ed36e), o.u(0x503c2828, 0x6c443c44),
//   o.u(0x5579a7a7, 0x2c8b798b), o.u(0x63e2bcbc, 0x813de23d),
//   o.u(0x2c1d1616, 0x31271d27), o.u(0x4176adad, 0x379a769a),
//   o.u(0xad3bdbdb, 0x964d3b4d), o.u(0xc8566464, 0x9efa56fa),
//   o.u(0xe84e7474, 0xa6d24ed2), o.u(0x281e1414, 0x36221e22),
//   o.u(0x3fdb9292, 0xe476db76), o.u(0x180a0c0c, 0x121e0a1e),
//   o.u(0x906c4848, 0xfcb46cb4), o.u(0x6be4b8b8, 0x8f37e437),
//   o.u(0x255d9f9f, 0x78e75de7), o.u(0x616ebdbd, 0xfb26eb2),
//   o.u(0x86ef4343, 0x692aef2a), o.u(0x93a6c4c4, 0x35f1a6f1),
//   o.u(0x72a83939, 0xdae3a8e3), o.u(0x62a43131, 0xc6f7a4f7),
//   o.u(0xbd37d3d3, 0x8a593759), o.u(0xff8bf2f2, 0x74868b86),
//   o.u(0xb132d5d5, 0x83563256), o.u(0xd438b8b, 0x4ec543c5),
//   o.u(0xdc596e6e, 0x85eb59eb), o.u(0xafb7dada, 0x18c2b7c2),
//   o.u(0x28c0101, 0x8e8f8c8f), o.u(0x7964b1b1, 0x1dac64ac),
//   o.u(0x23d29c9c, 0xf16dd26d), o.u(0x92e04949, 0x723be03b),
//   o.u(0xabb4d8d8, 0x1fc7b4c7), o.u(0x43faacac, 0xb915fa15),
//   o.u(0xfd07f3f3, 0xfa090709), o.u(0x8525cfcf, 0xa06f256f),
//   o.u(0x8fafcaca, 0x20eaafea), o.u(0xf38ef4f4, 0x7d898e89),
//   o.u(0x8ee94747, 0x6720e920), o.u(0x20181010, 0x38281828),
//   o.u(0xded56f6f, 0xb64d564), o.u(0xfb88f0f0, 0x73838883),
//   o.u(0x946f4a4a, 0xfbb16fb1), o.u(0xb8725c5c, 0xca967296),
//   o.u(0x70243838, 0x546c246c), o.u(0xaef15757, 0x5f08f108),
//   o.u(0xe6c77373, 0x2152c752), o.u(0x35519797, 0x64f351f3),
//   o.u(0x8d23cbcb, 0xae652365), o.u(0x597ca1a1, 0x25847c84),
//   o.u(0xcb9ce8e8, 0x57bf9cbf), o.u(0x7c213e3e, 0x5d632163),
//   o.u(0x37dd9696, 0xea7cdd7c), o.u(0xc2dc6161, 0x1e7fdc7f),
//   o.u(0x1a860d0d, 0x9c918691), o.u(0x1e850f0f, 0x9b948594),
//   o.u(0xdb90e0e0, 0x4bab90ab), o.u(0xf8427c7c, 0xbac642c6),
//   o.u(0xe2c47171, 0x2657c457), o.u(0x83aacccc, 0x29e5aae5),
//   o.u(0x3bd89090, 0xe373d873), o.u(0xc050606, 0x90f050f),
//   o.u(0xf501f7f7, 0xf4030103), o.u(0x38121c1c, 0x2a361236),
//   o.u(0x9fa3c2c2, 0x3cfea3fe), o.u(0xd45f6a6a, 0x8be15fe1),
//   o.u(0x47f9aeae, 0xbe10f910), o.u(0xd2d06969, 0x26bd06b),
//   o.u(0x2e911717, 0xbfa891a8), o.u(0x29589999, 0x71e858e8),
//   o.u(0x74273a3a, 0x53692769), o.u(0x4eb92727, 0xf7d0b9d0),
//   o.u(0xa938d9d9, 0x91483848), o.u(0xcd13ebeb, 0xde351335),
//   o.u(0x56b32b2b, 0xe5ceb3ce), o.u(0x44332222, 0x77553355),
//   o.u(0xbfbbd2d2, 0x4d6bbd6), o.u(0x4970a9a9, 0x39907090),
//   o.u(0xe890707, 0x87808980), o.u(0x66a73333, 0xc1f2a7f2),
//   o.u(0x5ab62d2d, 0xecc1b6c1), o.u(0x78223c3c, 0x5a662266),
//   o.u(0x2a921515, 0xb8ad92ad), o.u(0x8920c9c9, 0xa9602060),
//   o.u(0x15498787, 0x5cdb49db), o.u(0x4fffaaaa, 0xb01aff1a),
//   o.u(0xa0785050, 0xd8887888), o.u(0x517aa5a5, 0x2b8e7a8e),
//   o.u(0x68f0303, 0x898a8f8a), o.u(0xb2f85959, 0x4a13f813),
//   o.u(0x12800909, 0x929b809b), o.u(0x34171a1a, 0x23391739),
//   o.u(0xcada6565, 0x1075da75), o.u(0xb531d7d7, 0x84533153),
//   o.u(0x13c68484, 0xd551c651), o.u(0xbbb8d0d0, 0x3d3b8d3),
//   o.u(0x1fc38282, 0xdc5ec35e), o.u(0x52b02929, 0xe2cbb0cb),
//   o.u(0xb4775a5a, 0xc3997799), o.u(0x3c111e1e, 0x2d331133),
//   o.u(0xf6cb7b7b, 0x3d46cb46), o.u(0x4bfca8a8, 0xb71ffc1f),
//   o.u(0xdad66d6d, 0xc61d661), o.u(0x583a2c2c, 0x624e3a4e)
// ]

// var T4 = [
//   o.u(0xf497a5c6, 0xc632f4a5), o.u(0x97eb84f8, 0xf86f9784),
//   o.u(0xb0c799ee, 0xee5eb099), o.u(0x8cf78df6, 0xf67a8c8d),
//   o.u(0x17e50dff, 0xffe8170d), o.u(0xdcb7bdd6, 0xd60adcbd),
//   o.u(0xc8a7b1de, 0xde16c8b1), o.u(0xfc395491, 0x916dfc54),
//   o.u(0xf0c05060, 0x6090f050), o.u(0x05040302, 0x02070503),
//   o.u(0xe087a9ce, 0xce2ee0a9), o.u(0x87ac7d56, 0x56d1877d),
//   o.u(0x2bd519e7, 0xe7cc2b19), o.u(0xa67162b5, 0xb513a662),
//   o.u(0x319ae64d, 0x4d7c31e6), o.u(0xb5c39aec, 0xec59b59a),
//   o.u(0xcf05458f, 0x8f40cf45), o.u(0xbc3e9d1f, 0x1fa3bc9d),
//   o.u(0xc0094089, 0x8949c040), o.u(0x92ef87fa, 0xfa689287),
//   o.u(0x3fc515ef, 0xefd03f15), o.u(0x267febb2, 0xb29426eb),
//   o.u(0x4007c98e, 0x8ece40c9), o.u(0x1ded0bfb, 0xfbe61d0b),
//   o.u(0x2f82ec41, 0x416e2fec), o.u(0xa97d67b3, 0xb31aa967),
//   o.u(0x1cbefd5f, 0x5f431cfd), o.u(0x258aea45, 0x456025ea),
//   o.u(0xda46bf23, 0x23f9dabf), o.u(0x02a6f753, 0x535102f7),
//   o.u(0xa1d396e4, 0xe445a196), o.u(0xed2d5b9b, 0x9b76ed5b),
//   o.u(0x5deac275, 0x75285dc2), o.u(0x24d91ce1, 0xe1c5241c),
//   o.u(0xe97aae3d, 0x3dd4e9ae), o.u(0xbe986a4c, 0x4cf2be6a),
//   o.u(0xeed85a6c, 0x6c82ee5a), o.u(0xc3fc417e, 0x7ebdc341),
//   o.u(0x06f102f5, 0xf5f30602), o.u(0xd11d4f83, 0x8352d14f),
//   o.u(0xe4d05c68, 0x688ce45c), o.u(0x07a2f451, 0x515607f4),
//   o.u(0x5cb934d1, 0xd18d5c34), o.u(0x18e908f9, 0xf9e11808),
//   o.u(0xaedf93e2, 0xe24cae93), o.u(0x954d73ab, 0xab3e9573),
//   o.u(0xf5c45362, 0x6297f553), o.u(0x41543f2a, 0x2a6b413f),
//   o.u(0x14100c08, 0x081c140c), o.u(0xf6315295, 0x9563f652),
//   o.u(0xaf8c6546, 0x46e9af65), o.u(0xe2215e9d, 0x9d7fe25e),
//   o.u(0x78602830, 0x30487828), o.u(0xf86ea137, 0x37cff8a1),
//   o.u(0x11140f0a, 0x0a1b110f), o.u(0xc45eb52f, 0x2febc4b5),
//   o.u(0x1b1c090e, 0x0e151b09), o.u(0x5a483624, 0x247e5a36),
//   o.u(0xb6369b1b, 0x1badb69b), o.u(0x47a53ddf, 0xdf98473d),
//   o.u(0x6a8126cd, 0xcda76a26), o.u(0xbb9c694e, 0x4ef5bb69),
//   o.u(0x4cfecd7f, 0x7f334ccd), o.u(0xbacf9fea, 0xea50ba9f),
//   o.u(0x2d241b12, 0x123f2d1b), o.u(0xb93a9e1d, 0x1da4b99e),
//   o.u(0x9cb07458, 0x58c49c74), o.u(0x72682e34, 0x3446722e),
//   o.u(0x776c2d36, 0x3641772d), o.u(0xcda3b2dc, 0xdc11cdb2),
//   o.u(0x2973eeb4, 0xb49d29ee), o.u(0x16b6fb5b, 0x5b4d16fb),
//   o.u(0x0153f6a4, 0xa4a501f6), o.u(0xd7ec4d76, 0x76a1d74d),
//   o.u(0xa37561b7, 0xb714a361), o.u(0x49face7d, 0x7d3449ce),
//   o.u(0x8da47b52, 0x52df8d7b), o.u(0x42a13edd, 0xdd9f423e),
//   o.u(0x93bc715e, 0x5ecd9371), o.u(0xa2269713, 0x13b1a297),
//   o.u(0x0457f5a6, 0xa6a204f5), o.u(0xb86968b9, 0xb901b868),
//   o.u(0x00000000, 0x00000000), o.u(0x74992cc1, 0xc1b5742c),
//   o.u(0xa0806040, 0x40e0a060), o.u(0x21dd1fe3, 0xe3c2211f),
//   o.u(0x43f2c879, 0x793a43c8), o.u(0x2c77edb6, 0xb69a2ced),
//   o.u(0xd9b3bed4, 0xd40dd9be), o.u(0xca01468d, 0x8d47ca46),
//   o.u(0x70ced967, 0x671770d9), o.u(0xdde44b72, 0x72afdd4b),
//   o.u(0x7933de94, 0x94ed79de), o.u(0x672bd498, 0x98ff67d4),
//   o.u(0x237be8b0, 0xb09323e8), o.u(0xde114a85, 0x855bde4a),
//   o.u(0xbd6d6bbb, 0xbb06bd6b), o.u(0x7e912ac5, 0xc5bb7e2a),
//   o.u(0x349ee54f, 0x4f7b34e5), o.u(0x3ac116ed, 0xedd73a16),
//   o.u(0x5417c586, 0x86d254c5), o.u(0x622fd79a, 0x9af862d7),
//   o.u(0xffcc5566, 0x6699ff55), o.u(0xa7229411, 0x11b6a794),
//   o.u(0x4a0fcf8a, 0x8ac04acf), o.u(0x30c910e9, 0xe9d93010),
//   o.u(0x0a080604, 0x040e0a06), o.u(0x98e781fe, 0xfe669881),
//   o.u(0x0b5bf0a0, 0xa0ab0bf0), o.u(0xccf04478, 0x78b4cc44),
//   o.u(0xd54aba25, 0x25f0d5ba), o.u(0x3e96e34b, 0x4b753ee3),
//   o.u(0x0e5ff3a2, 0xa2ac0ef3), o.u(0x19bafe5d, 0x5d4419fe),
//   o.u(0x5b1bc080, 0x80db5bc0), o.u(0x850a8a05, 0x0580858a),
//   o.u(0xec7ead3f, 0x3fd3ecad), o.u(0xdf42bc21, 0x21fedfbc),
//   o.u(0xd8e04870, 0x70a8d848), o.u(0x0cf904f1, 0xf1fd0c04),
//   o.u(0x7ac6df63, 0x63197adf), o.u(0x58eec177, 0x772f58c1),
//   o.u(0x9f4575af, 0xaf309f75), o.u(0xa5846342, 0x42e7a563),
//   o.u(0x50403020, 0x20705030), o.u(0x2ed11ae5, 0xe5cb2e1a),
//   o.u(0x12e10efd, 0xfdef120e), o.u(0xb7656dbf, 0xbf08b76d),
//   o.u(0xd4194c81, 0x8155d44c), o.u(0x3c301418, 0x18243c14),
//   o.u(0x5f4c3526, 0x26795f35), o.u(0x719d2fc3, 0xc3b2712f),
//   o.u(0x3867e1be, 0xbe8638e1), o.u(0xfd6aa235, 0x35c8fda2),
//   o.u(0x4f0bcc88, 0x88c74fcc), o.u(0x4b5c392e, 0x2e654b39),
//   o.u(0xf93d5793, 0x936af957), o.u(0x0daaf255, 0x55580df2),
//   o.u(0x9de382fc, 0xfc619d82), o.u(0xc9f4477a, 0x7ab3c947),
//   o.u(0xef8bacc8, 0xc827efac), o.u(0x326fe7ba, 0xba8832e7),
//   o.u(0x7d642b32, 0x324f7d2b), o.u(0xa4d795e6, 0xe642a495),
//   o.u(0xfb9ba0c0, 0xc03bfba0), o.u(0xb3329819, 0x19aab398),
//   o.u(0x6827d19e, 0x9ef668d1), o.u(0x815d7fa3, 0xa322817f),
//   o.u(0xaa886644, 0x44eeaa66), o.u(0x82a87e54, 0x54d6827e),
//   o.u(0xe676ab3b, 0x3bdde6ab), o.u(0x9e16830b, 0x0b959e83),
//   o.u(0x4503ca8c, 0x8cc945ca), o.u(0x7b9529c7, 0xc7bc7b29),
//   o.u(0x6ed6d36b, 0x6b056ed3), o.u(0x44503c28, 0x286c443c),
//   o.u(0x8b5579a7, 0xa72c8b79), o.u(0x3d63e2bc, 0xbc813de2),
//   o.u(0x272c1d16, 0x1631271d), o.u(0x9a4176ad, 0xad379a76),
//   o.u(0x4dad3bdb, 0xdb964d3b), o.u(0xfac85664, 0x649efa56),
//   o.u(0xd2e84e74, 0x74a6d24e), o.u(0x22281e14, 0x1436221e),
//   o.u(0x763fdb92, 0x92e476db), o.u(0x1e180a0c, 0x0c121e0a),
//   o.u(0xb4906c48, 0x48fcb46c), o.u(0x376be4b8, 0xb88f37e4),
//   o.u(0xe7255d9f, 0x9f78e75d), o.u(0xb2616ebd, 0xbd0fb26e),
//   o.u(0x2a86ef43, 0x43692aef), o.u(0xf193a6c4, 0xc435f1a6),
//   o.u(0xe372a839, 0x39dae3a8), o.u(0xf762a431, 0x31c6f7a4),
//   o.u(0x59bd37d3, 0xd38a5937), o.u(0x86ff8bf2, 0xf274868b),
//   o.u(0x56b132d5, 0xd5835632), o.u(0xc50d438b, 0x8b4ec543),
//   o.u(0xebdc596e, 0x6e85eb59), o.u(0xc2afb7da, 0xda18c2b7),
//   o.u(0x8f028c01, 0x018e8f8c), o.u(0xac7964b1, 0xb11dac64),
//   o.u(0x6d23d29c, 0x9cf16dd2), o.u(0x3b92e049, 0x49723be0),
//   o.u(0xc7abb4d8, 0xd81fc7b4), o.u(0x1543faac, 0xacb915fa),
//   o.u(0x09fd07f3, 0xf3fa0907), o.u(0x6f8525cf, 0xcfa06f25),
//   o.u(0xea8fafca, 0xca20eaaf), o.u(0x89f38ef4, 0xf47d898e),
//   o.u(0x208ee947, 0x476720e9), o.u(0x28201810, 0x10382818),
//   o.u(0x64ded56f, 0x6f0b64d5), o.u(0x83fb88f0, 0xf0738388),
//   o.u(0xb1946f4a, 0x4afbb16f), o.u(0x96b8725c, 0x5cca9672),
//   o.u(0x6c702438, 0x38546c24), o.u(0x08aef157, 0x575f08f1),
//   o.u(0x52e6c773, 0x732152c7), o.u(0xf3355197, 0x9764f351),
//   o.u(0x658d23cb, 0xcbae6523), o.u(0x84597ca1, 0xa125847c),
//   o.u(0xbfcb9ce8, 0xe857bf9c), o.u(0x637c213e, 0x3e5d6321),
//   o.u(0x7c37dd96, 0x96ea7cdd), o.u(0x7fc2dc61, 0x611e7fdc),
//   o.u(0x911a860d, 0x0d9c9186), o.u(0x941e850f, 0x0f9b9485),
//   o.u(0xabdb90e0, 0xe04bab90), o.u(0xc6f8427c, 0x7cbac642),
//   o.u(0x57e2c471, 0x712657c4), o.u(0xe583aacc, 0xcc29e5aa),
//   o.u(0x733bd890, 0x90e373d8), o.u(0x0f0c0506, 0x06090f05),
//   o.u(0x03f501f7, 0xf7f40301), o.u(0x3638121c, 0x1c2a3612),
//   o.u(0xfe9fa3c2, 0xc23cfea3), o.u(0xe1d45f6a, 0x6a8be15f),
//   o.u(0x1047f9ae, 0xaebe10f9), o.u(0x6bd2d069, 0x69026bd0),
//   o.u(0xa82e9117, 0x17bfa891), o.u(0xe8295899, 0x9971e858),
//   o.u(0x6974273a, 0x3a536927), o.u(0xd04eb927, 0x27f7d0b9),
//   o.u(0x48a938d9, 0xd9914838), o.u(0x35cd13eb, 0xebde3513),
//   o.u(0xce56b32b, 0x2be5ceb3), o.u(0x55443322, 0x22775533),
//   o.u(0xd6bfbbd2, 0xd204d6bb), o.u(0x904970a9, 0xa9399070),
//   o.u(0x800e8907, 0x07878089), o.u(0xf266a733, 0x33c1f2a7),
//   o.u(0xc15ab62d, 0x2decc1b6), o.u(0x6678223c, 0x3c5a6622),
//   o.u(0xad2a9215, 0x15b8ad92), o.u(0x608920c9, 0xc9a96020),
//   o.u(0xdb154987, 0x875cdb49), o.u(0x1a4fffaa, 0xaab01aff),
//   o.u(0x88a07850, 0x50d88878), o.u(0x8e517aa5, 0xa52b8e7a),
//   o.u(0x8a068f03, 0x03898a8f), o.u(0x13b2f859, 0x594a13f8),
//   o.u(0x9b128009, 0x09929b80), o.u(0x3934171a, 0x1a233917),
//   o.u(0x75cada65, 0x651075da), o.u(0x53b531d7, 0xd7845331),
//   o.u(0x5113c684, 0x84d551c6), o.u(0xd3bbb8d0, 0xd003d3b8),
//   o.u(0x5e1fc382, 0x82dc5ec3), o.u(0xcb52b029, 0x29e2cbb0),
//   o.u(0x99b4775a, 0x5ac39977), o.u(0x333c111e, 0x1e2d3311),
//   o.u(0x46f6cb7b, 0x7b3d46cb), o.u(0x1f4bfca8, 0xa8b71ffc),
//   o.u(0x61dad66d, 0x6d0c61d6), o.u(0x4e583a2c, 0x2c624e3a)
// ];

// var T5 = [
//   o.u(0xa5f497a5, 0xc6c632f4), o.u(0x8497eb84, 0xf8f86f97),
//   o.u(0x99b0c799, 0xeeee5eb0), o.u(0x8d8cf78d, 0xf6f67a8c),
//   o.u(0xd17e50d, 0xffffe817), o.u(0xbddcb7bd, 0xd6d60adc),
//   o.u(0xb1c8a7b1, 0xdede16c8), o.u(0x54fc3954, 0x91916dfc),
//   o.u(0x50f0c050, 0x606090f0), o.u(0x3050403, 0x2020705),
//   o.u(0xa9e087a9, 0xcece2ee0), o.u(0x7d87ac7d, 0x5656d187),
//   o.u(0x192bd519, 0xe7e7cc2b), o.u(0x62a67162, 0xb5b513a6),
//   o.u(0xe6319ae6, 0x4d4d7c31), o.u(0x9ab5c39a, 0xecec59b5),
//   o.u(0x45cf0545, 0x8f8f40cf), o.u(0x9dbc3e9d, 0x1f1fa3bc),
//   o.u(0x40c00940, 0x898949c0), o.u(0x8792ef87, 0xfafa6892),
//   o.u(0x153fc515, 0xefefd03f), o.u(0xeb267feb, 0xb2b29426),
//   o.u(0xc94007c9, 0x8e8ece40), o.u(0xb1ded0b, 0xfbfbe61d),
//   o.u(0xec2f82ec, 0x41416e2f), o.u(0x67a97d67, 0xb3b31aa9),
//   o.u(0xfd1cbefd, 0x5f5f431c), o.u(0xea258aea, 0x45456025),
//   o.u(0xbfda46bf, 0x2323f9da), o.u(0xf702a6f7, 0x53535102),
//   o.u(0x96a1d396, 0xe4e445a1), o.u(0x5bed2d5b, 0x9b9b76ed),
//   o.u(0xc25deac2, 0x7575285d), o.u(0x1c24d91c, 0xe1e1c524),
//   o.u(0xaee97aae, 0x3d3dd4e9), o.u(0x6abe986a, 0x4c4cf2be),
//   o.u(0x5aeed85a, 0x6c6c82ee), o.u(0x41c3fc41, 0x7e7ebdc3),
//   o.u(0x206f102, 0xf5f5f306), o.u(0x4fd11d4f, 0x838352d1),
//   o.u(0x5ce4d05c, 0x68688ce4), o.u(0xf407a2f4, 0x51515607),
//   o.u(0x345cb934, 0xd1d18d5c), o.u(0x818e908, 0xf9f9e118),
//   o.u(0x93aedf93, 0xe2e24cae), o.u(0x73954d73, 0xabab3e95),
//   o.u(0x53f5c453, 0x626297f5), o.u(0x3f41543f, 0x2a2a6b41),
//   o.u(0xc14100c, 0x8081c14), o.u(0x52f63152, 0x959563f6),
//   o.u(0x65af8c65, 0x4646e9af), o.u(0x5ee2215e, 0x9d9d7fe2),
//   o.u(0x28786028, 0x30304878), o.u(0xa1f86ea1, 0x3737cff8),
//   o.u(0xf11140f, 0xa0a1b11), o.u(0xb5c45eb5, 0x2f2febc4),
//   o.u(0x91b1c09, 0xe0e151b), o.u(0x365a4836, 0x24247e5a),
//   o.u(0x9bb6369b, 0x1b1badb6), o.u(0x3d47a53d, 0xdfdf9847),
//   o.u(0x266a8126, 0xcdcda76a), o.u(0x69bb9c69, 0x4e4ef5bb),
//   o.u(0xcd4cfecd, 0x7f7f334c), o.u(0x9fbacf9f, 0xeaea50ba),
//   o.u(0x1b2d241b, 0x12123f2d), o.u(0x9eb93a9e, 0x1d1da4b9),
//   o.u(0x749cb074, 0x5858c49c), o.u(0x2e72682e, 0x34344672),
//   o.u(0x2d776c2d, 0x36364177), o.u(0xb2cda3b2, 0xdcdc11cd),
//   o.u(0xee2973ee, 0xb4b49d29), o.u(0xfb16b6fb, 0x5b5b4d16),
//   o.u(0xf60153f6, 0xa4a4a501), o.u(0x4dd7ec4d, 0x7676a1d7),
//   o.u(0x61a37561, 0xb7b714a3), o.u(0xce49face, 0x7d7d3449),
//   o.u(0x7b8da47b, 0x5252df8d), o.u(0x3e42a13e, 0xdddd9f42),
//   o.u(0x7193bc71, 0x5e5ecd93), o.u(0x97a22697, 0x1313b1a2),
//   o.u(0xf50457f5, 0xa6a6a204), o.u(0x68b86968, 0xb9b901b8),
//   o.u(0x0, 0x0), o.u(0x2c74992c, 0xc1c1b574),
//   o.u(0x60a08060, 0x4040e0a0), o.u(0x1f21dd1f, 0xe3e3c221),
//   o.u(0xc843f2c8, 0x79793a43), o.u(0xed2c77ed, 0xb6b69a2c),
//   o.u(0xbed9b3be, 0xd4d40dd9), o.u(0x46ca0146, 0x8d8d47ca),
//   o.u(0xd970ced9, 0x67671770), o.u(0x4bdde44b, 0x7272afdd),
//   o.u(0xde7933de, 0x9494ed79), o.u(0xd4672bd4, 0x9898ff67),
//   o.u(0xe8237be8, 0xb0b09323), o.u(0x4ade114a, 0x85855bde),
//   o.u(0x6bbd6d6b, 0xbbbb06bd), o.u(0x2a7e912a, 0xc5c5bb7e),
//   o.u(0xe5349ee5, 0x4f4f7b34), o.u(0x163ac116, 0xededd73a),
//   o.u(0xc55417c5, 0x8686d254), o.u(0xd7622fd7, 0x9a9af862),
//   o.u(0x55ffcc55, 0x666699ff), o.u(0x94a72294, 0x1111b6a7),
//   o.u(0xcf4a0fcf, 0x8a8ac04a), o.u(0x1030c910, 0xe9e9d930),
//   o.u(0x60a0806, 0x4040e0a), o.u(0x8198e781, 0xfefe6698),
//   o.u(0xf00b5bf0, 0xa0a0ab0b), o.u(0x44ccf044, 0x7878b4cc),
//   o.u(0xbad54aba, 0x2525f0d5), o.u(0xe33e96e3, 0x4b4b753e),
//   o.u(0xf30e5ff3, 0xa2a2ac0e), o.u(0xfe19bafe, 0x5d5d4419),
//   o.u(0xc05b1bc0, 0x8080db5b), o.u(0x8a850a8a, 0x5058085),
//   o.u(0xadec7ead, 0x3f3fd3ec), o.u(0xbcdf42bc, 0x2121fedf),
//   o.u(0x48d8e048, 0x7070a8d8), o.u(0x40cf904, 0xf1f1fd0c),
//   o.u(0xdf7ac6df, 0x6363197a), o.u(0xc158eec1, 0x77772f58),
//   o.u(0x759f4575, 0xafaf309f), o.u(0x63a58463, 0x4242e7a5),
//   o.u(0x30504030, 0x20207050), o.u(0x1a2ed11a, 0xe5e5cb2e),
//   o.u(0xe12e10e, 0xfdfdef12), o.u(0x6db7656d, 0xbfbf08b7),
//   o.u(0x4cd4194c, 0x818155d4), o.u(0x143c3014, 0x1818243c),
//   o.u(0x355f4c35, 0x2626795f), o.u(0x2f719d2f, 0xc3c3b271),
//   o.u(0xe13867e1, 0xbebe8638), o.u(0xa2fd6aa2, 0x3535c8fd),
//   o.u(0xcc4f0bcc, 0x8888c74f), o.u(0x394b5c39, 0x2e2e654b),
//   o.u(0x57f93d57, 0x93936af9), o.u(0xf20daaf2, 0x5555580d),
//   o.u(0x829de382, 0xfcfc619d), o.u(0x47c9f447, 0x7a7ab3c9),
//   o.u(0xacef8bac, 0xc8c827ef), o.u(0xe7326fe7, 0xbaba8832),
//   o.u(0x2b7d642b, 0x32324f7d), o.u(0x95a4d795, 0xe6e642a4),
//   o.u(0xa0fb9ba0, 0xc0c03bfb), o.u(0x98b33298, 0x1919aab3),
//   o.u(0xd16827d1, 0x9e9ef668), o.u(0x7f815d7f, 0xa3a32281),
//   o.u(0x66aa8866, 0x4444eeaa), o.u(0x7e82a87e, 0x5454d682),
//   o.u(0xabe676ab, 0x3b3bdde6), o.u(0x839e1683, 0xb0b959e),
//   o.u(0xca4503ca, 0x8c8cc945), o.u(0x297b9529, 0xc7c7bc7b),
//   o.u(0xd36ed6d3, 0x6b6b056e), o.u(0x3c44503c, 0x28286c44),
//   o.u(0x798b5579, 0xa7a72c8b), o.u(0xe23d63e2, 0xbcbc813d),
//   o.u(0x1d272c1d, 0x16163127), o.u(0x769a4176, 0xadad379a),
//   o.u(0x3b4dad3b, 0xdbdb964d), o.u(0x56fac856, 0x64649efa),
//   o.u(0x4ed2e84e, 0x7474a6d2), o.u(0x1e22281e, 0x14143622),
//   o.u(0xdb763fdb, 0x9292e476), o.u(0xa1e180a, 0xc0c121e),
//   o.u(0x6cb4906c, 0x4848fcb4), o.u(0xe4376be4, 0xb8b88f37),
//   o.u(0x5de7255d, 0x9f9f78e7), o.u(0x6eb2616e, 0xbdbd0fb2),
//   o.u(0xef2a86ef, 0x4343692a), o.u(0xa6f193a6, 0xc4c435f1),
//   o.u(0xa8e372a8, 0x3939dae3), o.u(0xa4f762a4, 0x3131c6f7),
//   o.u(0x3759bd37, 0xd3d38a59), o.u(0x8b86ff8b, 0xf2f27486),
//   o.u(0x3256b132, 0xd5d58356), o.u(0x43c50d43, 0x8b8b4ec5),
//   o.u(0x59ebdc59, 0x6e6e85eb), o.u(0xb7c2afb7, 0xdada18c2),
//   o.u(0x8c8f028c, 0x1018e8f), o.u(0x64ac7964, 0xb1b11dac),
//   o.u(0xd26d23d2, 0x9c9cf16d), o.u(0xe03b92e0, 0x4949723b),
//   o.u(0xb4c7abb4, 0xd8d81fc7), o.u(0xfa1543fa, 0xacacb915),
//   o.u(0x709fd07, 0xf3f3fa09), o.u(0x256f8525, 0xcfcfa06f),
//   o.u(0xafea8faf, 0xcaca20ea), o.u(0x8e89f38e, 0xf4f47d89),
//   o.u(0xe9208ee9, 0x47476720), o.u(0x18282018, 0x10103828),
//   o.u(0xd564ded5, 0x6f6f0b64), o.u(0x8883fb88, 0xf0f07383),
//   o.u(0x6fb1946f, 0x4a4afbb1), o.u(0x7296b872, 0x5c5cca96),
//   o.u(0x246c7024, 0x3838546c), o.u(0xf108aef1, 0x57575f08),
//   o.u(0xc752e6c7, 0x73732152), o.u(0x51f33551, 0x979764f3),
//   o.u(0x23658d23, 0xcbcbae65), o.u(0x7c84597c, 0xa1a12584),
//   o.u(0x9cbfcb9c, 0xe8e857bf), o.u(0x21637c21, 0x3e3e5d63),
//   o.u(0xdd7c37dd, 0x9696ea7c), o.u(0xdc7fc2dc, 0x61611e7f),
//   o.u(0x86911a86, 0xd0d9c91), o.u(0x85941e85, 0xf0f9b94),
//   o.u(0x90abdb90, 0xe0e04bab), o.u(0x42c6f842, 0x7c7cbac6),
//   o.u(0xc457e2c4, 0x71712657), o.u(0xaae583aa, 0xcccc29e5),
//   o.u(0xd8733bd8, 0x9090e373), o.u(0x50f0c05, 0x606090f),
//   o.u(0x103f501, 0xf7f7f403), o.u(0x12363812, 0x1c1c2a36),
//   o.u(0xa3fe9fa3, 0xc2c23cfe), o.u(0x5fe1d45f, 0x6a6a8be1),
//   o.u(0xf91047f9, 0xaeaebe10), o.u(0xd06bd2d0, 0x6969026b),
//   o.u(0x91a82e91, 0x1717bfa8), o.u(0x58e82958, 0x999971e8),
//   o.u(0x27697427, 0x3a3a5369), o.u(0xb9d04eb9, 0x2727f7d0),
//   o.u(0x3848a938, 0xd9d99148), o.u(0x1335cd13, 0xebebde35),
//   o.u(0xb3ce56b3, 0x2b2be5ce), o.u(0x33554433, 0x22227755),
//   o.u(0xbbd6bfbb, 0xd2d204d6), o.u(0x70904970, 0xa9a93990),
//   o.u(0x89800e89, 0x7078780), o.u(0xa7f266a7, 0x3333c1f2),
//   o.u(0xb6c15ab6, 0x2d2decc1), o.u(0x22667822, 0x3c3c5a66),
//   o.u(0x92ad2a92, 0x1515b8ad), o.u(0x20608920, 0xc9c9a960),
//   o.u(0x49db1549, 0x87875cdb), o.u(0xff1a4fff, 0xaaaab01a),
//   o.u(0x7888a078, 0x5050d888), o.u(0x7a8e517a, 0xa5a52b8e),
//   o.u(0x8f8a068f, 0x303898a), o.u(0xf813b2f8, 0x59594a13),
//   o.u(0x809b1280, 0x909929b), o.u(0x17393417, 0x1a1a2339),
//   o.u(0xda75cada, 0x65651075), o.u(0x3153b531, 0xd7d78453),
//   o.u(0xc65113c6, 0x8484d551), o.u(0xb8d3bbb8, 0xd0d003d3),
//   o.u(0xc35e1fc3, 0x8282dc5e), o.u(0xb0cb52b0, 0x2929e2cb),
//   o.u(0x7799b477, 0x5a5ac399), o.u(0x11333c11, 0x1e1e2d33),
//   o.u(0xcb46f6cb, 0x7b7b3d46), o.u(0xfc1f4bfc, 0xa8a8b71f),
//   o.u(0xd661dad6, 0x6d6d0c61), o.u(0x3a4e583a, 0x2c2c624e)
// ];

// var T6 = [
//   o.u(0xf4a5f497, 0xa5c6c632), o.u(0x978497eb, 0x84f8f86f),
//   o.u(0xb099b0c7, 0x99eeee5e), o.u(0x8c8d8cf7, 0x8df6f67a),
//   o.u(0x170d17e5, 0xdffffe8), o.u(0xdcbddcb7, 0xbdd6d60a),
//   o.u(0xc8b1c8a7, 0xb1dede16), o.u(0xfc54fc39, 0x5491916d),
//   o.u(0xf050f0c0, 0x50606090), o.u(0x5030504, 0x3020207),
//   o.u(0xe0a9e087, 0xa9cece2e), o.u(0x877d87ac, 0x7d5656d1),
//   o.u(0x2b192bd5, 0x19e7e7cc), o.u(0xa662a671, 0x62b5b513),
//   o.u(0x31e6319a, 0xe64d4d7c), o.u(0xb59ab5c3, 0x9aecec59),
//   o.u(0xcf45cf05, 0x458f8f40), o.u(0xbc9dbc3e, 0x9d1f1fa3),
//   o.u(0xc040c009, 0x40898949), o.u(0x928792ef, 0x87fafa68),
//   o.u(0x3f153fc5, 0x15efefd0), o.u(0x26eb267f, 0xebb2b294),
//   o.u(0x40c94007, 0xc98e8ece), o.u(0x1d0b1ded, 0xbfbfbe6),
//   o.u(0x2fec2f82, 0xec41416e), o.u(0xa967a97d, 0x67b3b31a),
//   o.u(0x1cfd1cbe, 0xfd5f5f43), o.u(0x25ea258a, 0xea454560),
//   o.u(0xdabfda46, 0xbf2323f9), o.u(0x2f702a6, 0xf7535351),
//   o.u(0xa196a1d3, 0x96e4e445), o.u(0xed5bed2d, 0x5b9b9b76),
//   o.u(0x5dc25dea, 0xc2757528), o.u(0x241c24d9, 0x1ce1e1c5),
//   o.u(0xe9aee97a, 0xae3d3dd4), o.u(0xbe6abe98, 0x6a4c4cf2),
//   o.u(0xee5aeed8, 0x5a6c6c82), o.u(0xc341c3fc, 0x417e7ebd),
//   o.u(0x60206f1, 0x2f5f5f3), o.u(0xd14fd11d, 0x4f838352),
//   o.u(0xe45ce4d0, 0x5c68688c), o.u(0x7f407a2, 0xf4515156),
//   o.u(0x5c345cb9, 0x34d1d18d), o.u(0x180818e9, 0x8f9f9e1),
//   o.u(0xae93aedf, 0x93e2e24c), o.u(0x9573954d, 0x73abab3e),
//   o.u(0xf553f5c4, 0x53626297), o.u(0x413f4154, 0x3f2a2a6b),
//   o.u(0x140c1410, 0xc08081c), o.u(0xf652f631, 0x52959563),
//   o.u(0xaf65af8c, 0x654646e9), o.u(0xe25ee221, 0x5e9d9d7f),
//   o.u(0x78287860, 0x28303048), o.u(0xf8a1f86e, 0xa13737cf),
//   o.u(0x110f1114, 0xf0a0a1b), o.u(0xc4b5c45e, 0xb52f2feb),
//   o.u(0x1b091b1c, 0x90e0e15), o.u(0x5a365a48, 0x3624247e),
//   o.u(0xb69bb636, 0x9b1b1bad), o.u(0x473d47a5, 0x3ddfdf98),
//   o.u(0x6a266a81, 0x26cdcda7), o.u(0xbb69bb9c, 0x694e4ef5),
//   o.u(0x4ccd4cfe, 0xcd7f7f33), o.u(0xba9fbacf, 0x9feaea50),
//   o.u(0x2d1b2d24, 0x1b12123f), o.u(0xb99eb93a, 0x9e1d1da4),
//   o.u(0x9c749cb0, 0x745858c4), o.u(0x722e7268, 0x2e343446),
//   o.u(0x772d776c, 0x2d363641), o.u(0xcdb2cda3, 0xb2dcdc11),
//   o.u(0x29ee2973, 0xeeb4b49d), o.u(0x16fb16b6, 0xfb5b5b4d),
//   o.u(0x1f60153, 0xf6a4a4a5), o.u(0xd74dd7ec, 0x4d7676a1),
//   o.u(0xa361a375, 0x61b7b714), o.u(0x49ce49fa, 0xce7d7d34),
//   o.u(0x8d7b8da4, 0x7b5252df), o.u(0x423e42a1, 0x3edddd9f),
//   o.u(0x937193bc, 0x715e5ecd), o.u(0xa297a226, 0x971313b1),
//   o.u(0x4f50457, 0xf5a6a6a2), o.u(0xb868b869, 0x68b9b901),
//   o.u(0x0, 0x0), o.u(0x742c7499, 0x2cc1c1b5),
//   o.u(0xa060a080, 0x604040e0), o.u(0x211f21dd, 0x1fe3e3c2),
//   o.u(0x43c843f2, 0xc879793a), o.u(0x2ced2c77, 0xedb6b69a),
//   o.u(0xd9bed9b3, 0xbed4d40d), o.u(0xca46ca01, 0x468d8d47),
//   o.u(0x70d970ce, 0xd9676717), o.u(0xdd4bdde4, 0x4b7272af),
//   o.u(0x79de7933, 0xde9494ed), o.u(0x67d4672b, 0xd49898ff),
//   o.u(0x23e8237b, 0xe8b0b093), o.u(0xde4ade11, 0x4a85855b),
//   o.u(0xbd6bbd6d, 0x6bbbbb06), o.u(0x7e2a7e91, 0x2ac5c5bb),
//   o.u(0x34e5349e, 0xe54f4f7b), o.u(0x3a163ac1, 0x16ededd7),
//   o.u(0x54c55417, 0xc58686d2), o.u(0x62d7622f, 0xd79a9af8),
//   o.u(0xff55ffcc, 0x55666699), o.u(0xa794a722, 0x941111b6),
//   o.u(0x4acf4a0f, 0xcf8a8ac0), o.u(0x301030c9, 0x10e9e9d9),
//   o.u(0xa060a08, 0x604040e), o.u(0x988198e7, 0x81fefe66),
//   o.u(0xbf00b5b, 0xf0a0a0ab), o.u(0xcc44ccf0, 0x447878b4),
//   o.u(0xd5bad54a, 0xba2525f0), o.u(0x3ee33e96, 0xe34b4b75),
//   o.u(0xef30e5f, 0xf3a2a2ac), o.u(0x19fe19ba, 0xfe5d5d44),
//   o.u(0x5bc05b1b, 0xc08080db), o.u(0x858a850a, 0x8a050580),
//   o.u(0xecadec7e, 0xad3f3fd3), o.u(0xdfbcdf42, 0xbc2121fe),
//   o.u(0xd848d8e0, 0x487070a8), o.u(0xc040cf9, 0x4f1f1fd),
//   o.u(0x7adf7ac6, 0xdf636319), o.u(0x58c158ee, 0xc177772f),
//   o.u(0x9f759f45, 0x75afaf30), o.u(0xa563a584, 0x634242e7),
//   o.u(0x50305040, 0x30202070), o.u(0x2e1a2ed1, 0x1ae5e5cb),
//   o.u(0x120e12e1, 0xefdfdef), o.u(0xb76db765, 0x6dbfbf08),
//   o.u(0xd44cd419, 0x4c818155), o.u(0x3c143c30, 0x14181824),
//   o.u(0x5f355f4c, 0x35262679), o.u(0x712f719d, 0x2fc3c3b2),
//   o.u(0x38e13867, 0xe1bebe86), o.u(0xfda2fd6a, 0xa23535c8),
//   o.u(0x4fcc4f0b, 0xcc8888c7), o.u(0x4b394b5c, 0x392e2e65),
//   o.u(0xf957f93d, 0x5793936a), o.u(0xdf20daa, 0xf2555558),
//   o.u(0x9d829de3, 0x82fcfc61), o.u(0xc947c9f4, 0x477a7ab3),
//   o.u(0xefacef8b, 0xacc8c827), o.u(0x32e7326f, 0xe7baba88),
//   o.u(0x7d2b7d64, 0x2b32324f), o.u(0xa495a4d7, 0x95e6e642),
//   o.u(0xfba0fb9b, 0xa0c0c03b), o.u(0xb398b332, 0x981919aa),
//   o.u(0x68d16827, 0xd19e9ef6), o.u(0x817f815d, 0x7fa3a322),
//   o.u(0xaa66aa88, 0x664444ee), o.u(0x827e82a8, 0x7e5454d6),
//   o.u(0xe6abe676, 0xab3b3bdd), o.u(0x9e839e16, 0x830b0b95),
//   o.u(0x45ca4503, 0xca8c8cc9), o.u(0x7b297b95, 0x29c7c7bc),
//   o.u(0x6ed36ed6, 0xd36b6b05), o.u(0x443c4450, 0x3c28286c),
//   o.u(0x8b798b55, 0x79a7a72c), o.u(0x3de23d63, 0xe2bcbc81),
//   o.u(0x271d272c, 0x1d161631), o.u(0x9a769a41, 0x76adad37),
//   o.u(0x4d3b4dad, 0x3bdbdb96), o.u(0xfa56fac8, 0x5664649e),
//   o.u(0xd24ed2e8, 0x4e7474a6), o.u(0x221e2228, 0x1e141436),
//   o.u(0x76db763f, 0xdb9292e4), o.u(0x1e0a1e18, 0xa0c0c12),
//   o.u(0xb46cb490, 0x6c4848fc), o.u(0x37e4376b, 0xe4b8b88f),
//   o.u(0xe75de725, 0x5d9f9f78), o.u(0xb26eb261, 0x6ebdbd0f),
//   o.u(0x2aef2a86, 0xef434369), o.u(0xf1a6f193, 0xa6c4c435),
//   o.u(0xe3a8e372, 0xa83939da), o.u(0xf7a4f762, 0xa43131c6),
//   o.u(0x593759bd, 0x37d3d38a), o.u(0x868b86ff, 0x8bf2f274),
//   o.u(0x563256b1, 0x32d5d583), o.u(0xc543c50d, 0x438b8b4e),
//   o.u(0xeb59ebdc, 0x596e6e85), o.u(0xc2b7c2af, 0xb7dada18),
//   o.u(0x8f8c8f02, 0x8c01018e), o.u(0xac64ac79, 0x64b1b11d),
//   o.u(0x6dd26d23, 0xd29c9cf1), o.u(0x3be03b92, 0xe0494972),
//   o.u(0xc7b4c7ab, 0xb4d8d81f), o.u(0x15fa1543, 0xfaacacb9),
//   o.u(0x90709fd, 0x7f3f3fa), o.u(0x6f256f85, 0x25cfcfa0),
//   o.u(0xeaafea8f, 0xafcaca20), o.u(0x898e89f3, 0x8ef4f47d),
//   o.u(0x20e9208e, 0xe9474767), o.u(0x28182820, 0x18101038),
//   o.u(0x64d564de, 0xd56f6f0b), o.u(0x838883fb, 0x88f0f073),
//   o.u(0xb16fb194, 0x6f4a4afb), o.u(0x967296b8, 0x725c5cca),
//   o.u(0x6c246c70, 0x24383854), o.u(0x8f108ae, 0xf157575f),
//   o.u(0x52c752e6, 0xc7737321), o.u(0xf351f335, 0x51979764),
//   o.u(0x6523658d, 0x23cbcbae), o.u(0x847c8459, 0x7ca1a125),
//   o.u(0xbf9cbfcb, 0x9ce8e857), o.u(0x6321637c, 0x213e3e5d),
//   o.u(0x7cdd7c37, 0xdd9696ea), o.u(0x7fdc7fc2, 0xdc61611e),
//   o.u(0x9186911a, 0x860d0d9c), o.u(0x9485941e, 0x850f0f9b),
//   o.u(0xab90abdb, 0x90e0e04b), o.u(0xc642c6f8, 0x427c7cba),
//   o.u(0x57c457e2, 0xc4717126), o.u(0xe5aae583, 0xaacccc29),
//   o.u(0x73d8733b, 0xd89090e3), o.u(0xf050f0c, 0x5060609),
//   o.u(0x30103f5, 0x1f7f7f4), o.u(0x36123638, 0x121c1c2a),
//   o.u(0xfea3fe9f, 0xa3c2c23c), o.u(0xe15fe1d4, 0x5f6a6a8b),
//   o.u(0x10f91047, 0xf9aeaebe), o.u(0x6bd06bd2, 0xd0696902),
//   o.u(0xa891a82e, 0x911717bf), o.u(0xe858e829, 0x58999971),
//   o.u(0x69276974, 0x273a3a53), o.u(0xd0b9d04e, 0xb92727f7),
//   o.u(0x483848a9, 0x38d9d991), o.u(0x351335cd, 0x13ebebde),
//   o.u(0xceb3ce56, 0xb32b2be5), o.u(0x55335544, 0x33222277),
//   o.u(0xd6bbd6bf, 0xbbd2d204), o.u(0x90709049, 0x70a9a939),
//   o.u(0x8089800e, 0x89070787), o.u(0xf2a7f266, 0xa73333c1),
//   o.u(0xc1b6c15a, 0xb62d2dec), o.u(0x66226678, 0x223c3c5a),
//   o.u(0xad92ad2a, 0x921515b8), o.u(0x60206089, 0x20c9c9a9),
//   o.u(0xdb49db15, 0x4987875c), o.u(0x1aff1a4f, 0xffaaaab0),
//   o.u(0x887888a0, 0x785050d8), o.u(0x8e7a8e51, 0x7aa5a52b),
//   o.u(0x8a8f8a06, 0x8f030389), o.u(0x13f813b2, 0xf859594a),
//   o.u(0x9b809b12, 0x80090992), o.u(0x39173934, 0x171a1a23),
//   o.u(0x75da75ca, 0xda656510), o.u(0x533153b5, 0x31d7d784),
//   o.u(0x51c65113, 0xc68484d5), o.u(0xd3b8d3bb, 0xb8d0d003),
//   o.u(0x5ec35e1f, 0xc38282dc), o.u(0xcbb0cb52, 0xb02929e2),
//   o.u(0x997799b4, 0x775a5ac3), o.u(0x3311333c, 0x111e1e2d),
//   o.u(0x46cb46f6, 0xcb7b7b3d), o.u(0x1ffc1f4b, 0xfca8a8b7),
//   o.u(0x61d661da, 0xd66d6d0c), o.u(0x4e3a4e58, 0x3a2c2c62)
// ];

// var T7 = [
//   o.u(0x32f4a5f4, 0x97a5c6c6), o.u(0x6f978497, 0xeb84f8f8),
//   o.u(0x5eb099b0, 0xc799eeee), o.u(0x7a8c8d8c, 0xf78df6f6),
//   o.u(0xe8170d17, 0xe50dffff), o.u(0xadcbddc, 0xb7bdd6d6),
//   o.u(0x16c8b1c8, 0xa7b1dede), o.u(0x6dfc54fc, 0x39549191),
//   o.u(0x90f050f0, 0xc0506060), o.u(0x7050305, 0x4030202),
//   o.u(0x2ee0a9e0, 0x87a9cece), o.u(0xd1877d87, 0xac7d5656),
//   o.u(0xcc2b192b, 0xd519e7e7), o.u(0x13a662a6, 0x7162b5b5),
//   o.u(0x7c31e631, 0x9ae64d4d), o.u(0x59b59ab5, 0xc39aecec),
//   o.u(0x40cf45cf, 0x5458f8f), o.u(0xa3bc9dbc, 0x3e9d1f1f),
//   o.u(0x49c040c0, 0x9408989), o.u(0x68928792, 0xef87fafa),
//   o.u(0xd03f153f, 0xc515efef), o.u(0x9426eb26, 0x7febb2b2),
//   o.u(0xce40c940, 0x7c98e8e), o.u(0xe61d0b1d, 0xed0bfbfb),
//   o.u(0x6e2fec2f, 0x82ec4141), o.u(0x1aa967a9, 0x7d67b3b3),
//   o.u(0x431cfd1c, 0xbefd5f5f), o.u(0x6025ea25, 0x8aea4545),
//   o.u(0xf9dabfda, 0x46bf2323), o.u(0x5102f702, 0xa6f75353),
//   o.u(0x45a196a1, 0xd396e4e4), o.u(0x76ed5bed, 0x2d5b9b9b),
//   o.u(0x285dc25d, 0xeac27575), o.u(0xc5241c24, 0xd91ce1e1),
//   o.u(0xd4e9aee9, 0x7aae3d3d), o.u(0xf2be6abe, 0x986a4c4c),
//   o.u(0x82ee5aee, 0xd85a6c6c), o.u(0xbdc341c3, 0xfc417e7e),
//   o.u(0xf3060206, 0xf102f5f5), o.u(0x52d14fd1, 0x1d4f8383),
//   o.u(0x8ce45ce4, 0xd05c6868), o.u(0x5607f407, 0xa2f45151),
//   o.u(0x8d5c345c, 0xb934d1d1), o.u(0xe1180818, 0xe908f9f9),
//   o.u(0x4cae93ae, 0xdf93e2e2), o.u(0x3e957395, 0x4d73abab),
//   o.u(0x97f553f5, 0xc4536262), o.u(0x6b413f41, 0x543f2a2a),
//   o.u(0x1c140c14, 0x100c0808), o.u(0x63f652f6, 0x31529595),
//   o.u(0xe9af65af, 0x8c654646), o.u(0x7fe25ee2, 0x215e9d9d),
//   o.u(0x48782878, 0x60283030), o.u(0xcff8a1f8, 0x6ea13737),
//   o.u(0x1b110f11, 0x140f0a0a), o.u(0xebc4b5c4, 0x5eb52f2f),
//   o.u(0x151b091b, 0x1c090e0e), o.u(0x7e5a365a, 0x48362424),
//   o.u(0xadb69bb6, 0x369b1b1b), o.u(0x98473d47, 0xa53ddfdf),
//   o.u(0xa76a266a, 0x8126cdcd), o.u(0xf5bb69bb, 0x9c694e4e),
//   o.u(0x334ccd4c, 0xfecd7f7f), o.u(0x50ba9fba, 0xcf9feaea),
//   o.u(0x3f2d1b2d, 0x241b1212), o.u(0xa4b99eb9, 0x3a9e1d1d),
//   o.u(0xc49c749c, 0xb0745858), o.u(0x46722e72, 0x682e3434),
//   o.u(0x41772d77, 0x6c2d3636), o.u(0x11cdb2cd, 0xa3b2dcdc),
//   o.u(0x9d29ee29, 0x73eeb4b4), o.u(0x4d16fb16, 0xb6fb5b5b),
//   o.u(0xa501f601, 0x53f6a4a4), o.u(0xa1d74dd7, 0xec4d7676),
//   o.u(0x14a361a3, 0x7561b7b7), o.u(0x3449ce49, 0xface7d7d),
//   o.u(0xdf8d7b8d, 0xa47b5252), o.u(0x9f423e42, 0xa13edddd),
//   o.u(0xcd937193, 0xbc715e5e), o.u(0xb1a297a2, 0x26971313),
//   o.u(0xa204f504, 0x57f5a6a6), o.u(0x1b868b8, 0x6968b9b9),
//   o.u(0x0, 0x0), o.u(0xb5742c74, 0x992cc1c1),
//   o.u(0xe0a060a0, 0x80604040), o.u(0xc2211f21, 0xdd1fe3e3),
//   o.u(0x3a43c843, 0xf2c87979), o.u(0x9a2ced2c, 0x77edb6b6),
//   o.u(0xdd9bed9, 0xb3bed4d4), o.u(0x47ca46ca, 0x1468d8d),
//   o.u(0x1770d970, 0xced96767), o.u(0xafdd4bdd, 0xe44b7272),
//   o.u(0xed79de79, 0x33de9494), o.u(0xff67d467, 0x2bd49898),
//   o.u(0x9323e823, 0x7be8b0b0), o.u(0x5bde4ade, 0x114a8585),
//   o.u(0x6bd6bbd, 0x6d6bbbbb), o.u(0xbb7e2a7e, 0x912ac5c5),
//   o.u(0x7b34e534, 0x9ee54f4f), o.u(0xd73a163a, 0xc116eded),
//   o.u(0xd254c554, 0x17c58686), o.u(0xf862d762, 0x2fd79a9a),
//   o.u(0x99ff55ff, 0xcc556666), o.u(0xb6a794a7, 0x22941111),
//   o.u(0xc04acf4a, 0xfcf8a8a), o.u(0xd9301030, 0xc910e9e9),
//   o.u(0xe0a060a, 0x8060404), o.u(0x66988198, 0xe781fefe),
//   o.u(0xab0bf00b, 0x5bf0a0a0), o.u(0xb4cc44cc, 0xf0447878),
//   o.u(0xf0d5bad5, 0x4aba2525), o.u(0x753ee33e, 0x96e34b4b),
//   o.u(0xac0ef30e, 0x5ff3a2a2), o.u(0x4419fe19, 0xbafe5d5d),
//   o.u(0xdb5bc05b, 0x1bc08080), o.u(0x80858a85, 0xa8a0505),
//   o.u(0xd3ecadec, 0x7ead3f3f), o.u(0xfedfbcdf, 0x42bc2121),
//   o.u(0xa8d848d8, 0xe0487070), o.u(0xfd0c040c, 0xf904f1f1),
//   o.u(0x197adf7a, 0xc6df6363), o.u(0x2f58c158, 0xeec17777),
//   o.u(0x309f759f, 0x4575afaf), o.u(0xe7a563a5, 0x84634242),
//   o.u(0x70503050, 0x40302020), o.u(0xcb2e1a2e, 0xd11ae5e5),
//   o.u(0xef120e12, 0xe10efdfd), o.u(0x8b76db7, 0x656dbfbf),
//   o.u(0x55d44cd4, 0x194c8181), o.u(0x243c143c, 0x30141818),
//   o.u(0x795f355f, 0x4c352626), o.u(0xb2712f71, 0x9d2fc3c3),
//   o.u(0x8638e138, 0x67e1bebe), o.u(0xc8fda2fd, 0x6aa23535),
//   o.u(0xc74fcc4f, 0xbcc8888), o.u(0x654b394b, 0x5c392e2e),
//   o.u(0x6af957f9, 0x3d579393), o.u(0x580df20d, 0xaaf25555),
//   o.u(0x619d829d, 0xe382fcfc), o.u(0xb3c947c9, 0xf4477a7a),
//   o.u(0x27efacef, 0x8bacc8c8), o.u(0x8832e732, 0x6fe7baba),
//   o.u(0x4f7d2b7d, 0x642b3232), o.u(0x42a495a4, 0xd795e6e6),
//   o.u(0x3bfba0fb, 0x9ba0c0c0), o.u(0xaab398b3, 0x32981919),
//   o.u(0xf668d168, 0x27d19e9e), o.u(0x22817f81, 0x5d7fa3a3),
//   o.u(0xeeaa66aa, 0x88664444), o.u(0xd6827e82, 0xa87e5454),
//   o.u(0xdde6abe6, 0x76ab3b3b), o.u(0x959e839e, 0x16830b0b),
//   o.u(0xc945ca45, 0x3ca8c8c), o.u(0xbc7b297b, 0x9529c7c7),
//   o.u(0x56ed36e, 0xd6d36b6b), o.u(0x6c443c44, 0x503c2828),
//   o.u(0x2c8b798b, 0x5579a7a7), o.u(0x813de23d, 0x63e2bcbc),
//   o.u(0x31271d27, 0x2c1d1616), o.u(0x379a769a, 0x4176adad),
//   o.u(0x964d3b4d, 0xad3bdbdb), o.u(0x9efa56fa, 0xc8566464),
//   o.u(0xa6d24ed2, 0xe84e7474), o.u(0x36221e22, 0x281e1414),
//   o.u(0xe476db76, 0x3fdb9292), o.u(0x121e0a1e, 0x180a0c0c),
//   o.u(0xfcb46cb4, 0x906c4848), o.u(0x8f37e437, 0x6be4b8b8),
//   o.u(0x78e75de7, 0x255d9f9f), o.u(0xfb26eb2, 0x616ebdbd),
//   o.u(0x692aef2a, 0x86ef4343), o.u(0x35f1a6f1, 0x93a6c4c4),
//   o.u(0xdae3a8e3, 0x72a83939), o.u(0xc6f7a4f7, 0x62a43131),
//   o.u(0x8a593759, 0xbd37d3d3), o.u(0x74868b86, 0xff8bf2f2),
//   o.u(0x83563256, 0xb132d5d5), o.u(0x4ec543c5, 0xd438b8b),
//   o.u(0x85eb59eb, 0xdc596e6e), o.u(0x18c2b7c2, 0xafb7dada),
//   o.u(0x8e8f8c8f, 0x28c0101), o.u(0x1dac64ac, 0x7964b1b1),
//   o.u(0xf16dd26d, 0x23d29c9c), o.u(0x723be03b, 0x92e04949),
//   o.u(0x1fc7b4c7, 0xabb4d8d8), o.u(0xb915fa15, 0x43faacac),
//   o.u(0xfa090709, 0xfd07f3f3), o.u(0xa06f256f, 0x8525cfcf),
//   o.u(0x20eaafea, 0x8fafcaca), o.u(0x7d898e89, 0xf38ef4f4),
//   o.u(0x6720e920, 0x8ee94747), o.u(0x38281828, 0x20181010),
//   o.u(0xb64d564, 0xded56f6f), o.u(0x73838883, 0xfb88f0f0),
//   o.u(0xfbb16fb1, 0x946f4a4a), o.u(0xca967296, 0xb8725c5c),
//   o.u(0x546c246c, 0x70243838), o.u(0x5f08f108, 0xaef15757),
//   o.u(0x2152c752, 0xe6c77373), o.u(0x64f351f3, 0x35519797),
//   o.u(0xae652365, 0x8d23cbcb), o.u(0x25847c84, 0x597ca1a1),
//   o.u(0x57bf9cbf, 0xcb9ce8e8), o.u(0x5d632163, 0x7c213e3e),
//   o.u(0xea7cdd7c, 0x37dd9696), o.u(0x1e7fdc7f, 0xc2dc6161),
//   o.u(0x9c918691, 0x1a860d0d), o.u(0x9b948594, 0x1e850f0f),
//   o.u(0x4bab90ab, 0xdb90e0e0), o.u(0xbac642c6, 0xf8427c7c),
//   o.u(0x2657c457, 0xe2c47171), o.u(0x29e5aae5, 0x83aacccc),
//   o.u(0xe373d873, 0x3bd89090), o.u(0x90f050f, 0xc050606),
//   o.u(0xf4030103, 0xf501f7f7), o.u(0x2a361236, 0x38121c1c),
//   o.u(0x3cfea3fe, 0x9fa3c2c2), o.u(0x8be15fe1, 0xd45f6a6a),
//   o.u(0xbe10f910, 0x47f9aeae), o.u(0x26bd06b, 0xd2d06969),
//   o.u(0xbfa891a8, 0x2e911717), o.u(0x71e858e8, 0x29589999),
//   o.u(0x53692769, 0x74273a3a), o.u(0xf7d0b9d0, 0x4eb92727),
//   o.u(0x91483848, 0xa938d9d9), o.u(0xde351335, 0xcd13ebeb),
//   o.u(0xe5ceb3ce, 0x56b32b2b), o.u(0x77553355, 0x44332222),
//   o.u(0x4d6bbd6, 0xbfbbd2d2), o.u(0x39907090, 0x4970a9a9),
//   o.u(0x87808980, 0xe890707), o.u(0xc1f2a7f2, 0x66a73333),
//   o.u(0xecc1b6c1, 0x5ab62d2d), o.u(0x5a662266, 0x78223c3c),
//   o.u(0xb8ad92ad, 0x2a921515), o.u(0xa9602060, 0x8920c9c9),
//   o.u(0x5cdb49db, 0x15498787), o.u(0xb01aff1a, 0x4fffaaaa),
//   o.u(0xd8887888, 0xa0785050), o.u(0x2b8e7a8e, 0x517aa5a5),
//   o.u(0x898a8f8a, 0x68f0303), o.u(0x4a13f813, 0xb2f85959),
//   o.u(0x929b809b, 0x12800909), o.u(0x23391739, 0x34171a1a),
//   o.u(0x1075da75, 0xcada6565), o.u(0x84533153, 0xb531d7d7),
//   o.u(0xd551c651, 0x13c68484), o.u(0x3d3b8d3, 0xbbb8d0d0),
//   o.u(0xdc5ec35e, 0x1fc38282), o.u(0xe2cbb0cb, 0x52b02929),
//   o.u(0xc3997799, 0xb4775a5a), o.u(0x2d331133, 0x3c111e1e),
//   o.u(0x3d46cb46, 0xf6cb7b7b), o.u(0xb71ffc1f, 0x4bfca8a8),
//   o.u(0xc61d661, 0xdad66d6d), o.u(0x624e3a4e, 0x583a2c2c)
// ];

var B64 = function(n, x) {
  if (n === 7) {
    return x.lo & 0xFF;
  }
  var bits = (7 - n) * 8;
  if (bits >= 32) { //faster than >= 32
    return (x.hi >>> (bits - 32)) & 0xFF;
  }
  else {
    var bitsOff32 = 32 - bits,
      toMoveDown = this.hi << bitsOff32 >>> bitsOff32;
    return (x.lo >>> bits | (toMoveDown << bitsOff32)) & 0xFF;
  }
}

var j64 = [o.u(0, 0), o.u(0, 0x10), o.u(0, 0x20), o.u(0, 0x30), o.u(0, 0x40), o.u(0, 0x50), o.u(0, 0x60),
  o.u(0, 0x70), o.u(0, 0x80), o.u(0, 0x90), o.u(0, 0xA0), o.u(0, 0xB0), o.u(0, 0xC0),
  o.u(0, 0xD0), o.u(0, 0xE0), o.u(0, 0xF0)
];

var nj64 = [o.u(0xFFFFFFFF, 0xFFFFFFFF), o.u(0xFFFFFFFF, 0xFFFFFFEF), o.u(0xFFFFFFFF, 0xFFFFFFDF), o.u(0xFFFFFFFF, 0xFFFFFFCF), o.u(0xFFFFFFFF, 0xFFFFFFBF), o.u(0xFFFFFFFF, 0xFFFFFFAF), o.u(0xFFFFFFFF, 0xFFFFFF9F),
  o.u(0xFFFFFFFF, 0xFFFFFF8F), o.u(0xFFFFFFFF, 0xFFFFFF7F), o.u(0xFFFFFFFF, 0xFFFFFF6F), o.u(0xFFFFFFFF, 0xFFFFFF5F), o.u(0xFFFFFFFF, 0xFFFFFF4F), o.u(0xFFFFFFFF, 0xFFFFFF3F),
  o.u(0xFFFFFFFF, 0xFFFFFF2F), o.u(0xFFFFFFFF, 0xFFFFFF1F), o.u(0xFFFFFFFF, 0xFFFFFF0F)
];

var r64 = [o.u(0, 0), o.u(0, 1), o.u(0, 2), o.u(0, 3), o.u(0, 4), o.u(0, 5), o.u(0, 6), o.u(0, 7),
  o.u(0, 8), o.u(0, 9), o.u(0, 10), o.u(0, 11), o.u(0, 12), o.u(0, 13)
];

var compress = function(int64buf, state) {
  var g = new Array(16);
  var m = new Array(16);
  for (var u = 0; u < 16; u++) {
    m[u] = int64buf[u];
    g[u] = m[u].xor(state[u]);
  }
  var t = new Array(16);
  for (var r = 0; r < 14; r++) {
    for (var i = 0; i < 16; i++) {
      g[i].setxor64(j64[i].plus(r64[r]).setShiftLeft(56));
    }

    for (var u = 0; u < 16; u++) {
      t[u] = o.xor64(T0[B64(0, g[u])], T1[B64(1, g[(u + 1) & 0xF])], T2[B64(2, g[(u + 2) & 0xF])], T3[B64(3, g[(u + 3) & 0xF])], T4[B64(4, g[(u + 4) & 0xF])], T5[B64(5, g[(u + 5) & 0xF])], T6[B64(6, g[(u + 6) & 0xF])], T7[B64(7, g[(u + 11) & 0xF])]);
    }
    var temp = g;
    g = t;
    t = temp;
  }
  for (var r = 0; r < 14; r++) {
    for (var i = 0; i < 16; i++) {
      m[i].setxor64(r64[r], nj64[i]);
    }
    for (var u = 0; u < 16; u++) {
      t[u] = o.xor64(T0[B64(0, m[(u + 1) & 0xF])], T1[B64(1, m[(u + 3) & 0xF])], T2[B64(2, m[(u + 5) & 0xF])], T3[B64(3, m[(u + 11) & 0xF])], T4[B64(4, m[(u + 0) & 0xF])], T5[B64(5, m[(u + 2) & 0xF])], T6[B64(6, m[(u + 4) & 0xF])], T7[B64(7, m[(u + 6) & 0xF])]);
    }
    var temp = m;
    m = t;
    t = temp;
  }
  for (var u = 0; u < 16; u++) {
    state[u].setxor64(g[u], m[u]);
  }
}

var final = function(state) {
  var g = new Array(16);
  o.bufferInsert64(g, 0, state, 16);
  var t = new Array(16);
  for (var r = 0; r < 14; r++) {
    
    for (var i = 0; i < 16; i++) {
      g[i].setxor64(j64[i].plus(r64[r]).setShiftLeft(56));
    }

    for (var u = 0; u < 16; u++) {
      t[u] = o.xor64(T0[B64(0, g[u])], T1[B64(1, g[(u + 1) & 0xF])], T2[B64(2, g[(u + 2) & 0xF])], T3[B64(3, g[(u + 3) & 0xF])], T4[B64(4, g[(u + 4) & 0xF])], T5[B64(5, g[(u + 5) & 0xF])], T6[B64(6, g[(u + 6) & 0xF])], T7[B64(7, g[(u + 11) & 0xF])]);
    }
    var temp = g;
    g = t;
    t = temp;
  }
  for (var u = 0; u < 16; u++)
    state[u].setxor64(g[u]);
}

var groestl = function(ctx, data, len) {
  var buf, ptr;
  //create a local copy of states
  var V = new Array(16);
  buf = ctx.buffer;
  ptr = ctx.ptr;
  if (len < ctx.buffer.length - ptr) {
    o.bufferInsert(buf, ptr, data, data.length);
    ptr += data.length;
    ctx.ptr = ptr;
    return;
  }
  //perform a deep copy of current state
  o.bufferInsert(V, 0, ctx.state, 16);
  while (len > 0) {
    var clen = ctx.buffer.length - ptr;
    if (clen > len) clen = len;
    o.bufferInsert(buf, ptr, data, clen);
    ptr += clen;
    data = data.slice(clen);
    len -= clen;
    if (ptr === ctx.buffer.length) {
      var int64Buf = h.bytes2Int64Buffer(buf);
      compress(int64Buf, V);
      ctx.count.addOne();
      ptr = 0;
    }
  }
  ctx.state = V;
  ctx.ptr = ptr;
}

var groestlClose = function(ctx) {
  var buf = ctx.buffer;
  var ptr = ctx.ptr;
  var pad = new Array(136);
  var len = buf.length;
  var padLen;
  var count;
  pad[0] = 0x80;
  if (ptr < 120) {
    padLen = 128 - ptr;
    count = ctx.count.plus(o.u(0, 1));
  }
  else {
    padLen = 256 - ptr;
    count = ctx.count.plus(o.u(0, 2));
  }
  o.bufferSet(pad, 1, 0, padLen - 9);
  h.bufferEncode64(pad, padLen - 8, count);
  groestl(ctx, pad, padLen);
  final(ctx.state);
  var out = new Array(16);
  for (var u = 0, v = 8; u < 8; u++, v++) {
    out[2 * u] = ctx.state[v].hi;
    out[2 * u + 1] = ctx.state[v].lo;
  }
  return out;
}

module.exports = function(input, format, output) {
  var msg;
  if (format === 1) {
    msg = input;
  }
  else if (format === 2) {
    msg = h.int32Buffer2Bytes(input);
  }
  else {
    msg = h.string2bytes(input);
  }
  var ctx = {};
  ctx.state = new Array(16);
  for (var i = 0; i < 15; i++) {
    ctx.state[i] = new o.u64(0, 0);
  }
  ctx.state[15] = new o.u64(0, 512);
  ctx.ptr = 0;
  ctx.count = new o.u64(0,0);
  ctx.buffer = new Array(128);
  groestl(ctx, msg, msg.length);
  var r = groestlClose(ctx, 0, 0);
  var out;
  if (output === 2) {
    out = r;
  }
  else if (output === 1) {
    out = h.int32Buffer2Bytes(r)
  }
  else {
    out = h.int32ArrayToHexString(r)
  }
  return out;
}
},{"./helper":9,"./op":10}],9:[function(require,module,exports){
'use strict';
// String functions

var op = require('./op.js');

module.exports.int8ArrayToHexString = function toString(array) {
	var string = '';

	for (var i = 0; i < array.length; i++) {
		if (array[i] < 16) {
			string += '0' + array[i].toString(16);
		}
		else {
			string += array[i].toString(16);
		}
	}
	return string;
}

module.exports.int32ArrayToHexString = function toString(array) {
	var string = '';
	var len = array.length;
	for (var i = 0; i < len; i++) {
		var s = array[i];
		if (s < 0) {
			s = 0xFFFFFFFF + array[i] + 1;
		}
		var l = s.toString(16);
		var padding = 8;
		while (l.length < padding) {
			l = "0" + l;
		}
		string += l;
	}
	return string;
}

module.exports.hex2string = function toString(s) {
	for (var c = [], len = s.length, i = 0; i < len; i += 2)
		c.push(String.fromCharCode(parseInt(s.substring(i, i + 2), 16)));
	return c.join('');
}

module.exports.hex2bytes = function toString(s) {
	for (var c = [], len = s.length, i = 0; i < len; i += 2)
		c.push(parseInt(s.substring(i, i + 2), 16));
	return c;
}
/*
module.exports.string2hex = function toString(s) {

	for (var p = [], len = s.length, i = 0; i < len; i++) {
		p.push((256 + s.charCodeAt(i)).toString(16).substring(1));
	}
	return p.join('');
}
*/
module.exports.string2bytes = function(s) {
	var len = s.length;
	var b = new Array(len);
	var i = 0;
	while (i < len) {
		b[i] = s.charCodeAt(i);
		i++;
	}
	return b;
}
/*
module.exports.bytes2Int16Buffer = function(b) {
	var len = b.length;
	var bufferLength = len ? (((len - 1) >>> 1) + 1) : 0;
	var buffer = new Array(bufferLength);
	var i = 0;
	var j = 0;
	while (i < len) {
		buffer[j] = (buffer[j] << 8) | b[i];
		i++;
		if (!(i % 2)) j++;
	}
	return buffer;
}
*/

module.exports.bytes2Int32Buffer = function(b) {
	if (!b) return [];
	var len = b.length ? (((b.length - 1) >>> 2) + 1) : 0;
	var buffer = new Array(len);
	var j = 0;
	while (j < len) {
		buffer[j] = (b[j * 4] << 24) | (b[j * 4 + 1] << 16) | (b[j * 4 + 2] << 8) | b[j * 4 + 3];
		j++;
	}
	return buffer;
}
/*
module.exports.bytes2Int32BufferLeAligned = function(b) {
	var len = b.length;
	if (!len) return [];
	var len2 = len ? (((len - 1) >>> 2) + 1) : 0;
	var buffer = new Array(len);
	var j = 0;
	while (j < len2) {
		buffer[j] = (b[j * 4 + 3] << 24) | (b[j * 4 + 2] << 16) | (b[j * 4 + 1] << 8) | b[j * 4];
		j++;
	};
	return buffer;
}
*/
module.exports.bytes2Int64Buffer = function(b) {
	if (!b) return [];
	var len = b.length ? (((b.length - 1) >>> 3) + 1) : 0;
	var buffer = new Array(len);
	var j = 0;
	while (j < len) {
		buffer[j] = new op.u64((b[j * 8] << 24) | (b[j * 8 + 1] << 16) | (b[j * 8 + 2] << 8) | b[j * 8 + 3], (b[j * 8 + 4] << 24) | (b[j * 8 + 5] << 16) | (b[j * 8 + 6] << 8) | b[j * 8 + 7]);
		j++;
	}
	return buffer;
}

module.exports.bytes2Int64BufferLeAligned = function(b) {
	if (!b) return [];
	var len =  b.length ? ((( b.length - 1) >>> 3) + 1) : 0;
	var buffer = new Array(len);
	var j = 0;
	while (j < len) {
		buffer[j] = new op.u64((b[j * 8 + 7] << 24) | (b[j * 8 + 6] << 16) | (b[j * 8 + 5] << 8) | b[j * 8 + 4], (b[j * 8 + 3] << 24) | (b[j * 8 + 2] << 16) | (b[j * 8 + 1] << 8) | b[j * 8]);
		j++;
	}
	return buffer;
}

module.exports.bufferEncode64leAligned = function(buffer, offset, uint64) {
	buffer[offset + 7] = uint64.hi >>> 24;
	buffer[offset + 6] = uint64.hi >>> 16 & 0xFF;
	buffer[offset + 5] = uint64.hi >>> 8 & 0xFF;
	buffer[offset + 4] = uint64.hi & 0xFF;
	buffer[offset + 3] = uint64.lo >>> 24;
	buffer[offset + 2] = uint64.lo >>> 16 & 0xFF;
	buffer[offset + 1] = uint64.lo >>> 8 & 0xFF;
	buffer[offset + 0] = uint64.lo & 0xFF;
}

module.exports.bufferEncode64 = function(buffer, offset, uint64) {
	buffer[offset] = uint64.hi >>> 24;
	buffer[offset + 1] = uint64.hi >>> 16 & 0xFF;
	buffer[offset + 2] = uint64.hi >>> 8 & 0xFF;
	buffer[offset + 3] = uint64.hi & 0xFF;
	buffer[offset + 4] = uint64.lo >>> 24;
	buffer[offset + 5] = uint64.lo >>> 16 & 0xFF;
	buffer[offset + 6] = uint64.lo >>> 8 & 0xFF;
	buffer[offset + 7] = uint64.lo & 0xFF;
}

module.exports.int32Buffer2Bytes = function(b) {
	var buffer = new Array(b.length);
	var len = b.length;
	var i = 0;
	while (i < len) {
		buffer[i * 4] = (b[i] & 0xFF000000) >>> 24;
		buffer[i * 4 + 1] = (b[i] & 0x00FF0000) >>> 16;
		buffer[i * 4 + 2] = (b[i] & 0x0000FF00) >>> 8;
		buffer[i * 4 + 3] = (b[i] & 0x000000FF);
		i++;
	}
	return buffer;
}
/*
module.exports.int64Buffer2Bytes = function(b) {
	var buffer = new Array(b.length);
	var i = 0;
	while (i < b.length) {
		buffer[i * 8] = (b[i].hi & 0xFF000000) >>> 24;
		buffer[i * 8 + 1] = (b[i].hi & 0x00FF0000) >>> 16;
		buffer[i * 8 + 2] = (b[i].hi & 0x0000FF00) >>> 8;
		buffer[i * 8 + 3] = (b[i].hi & 0x000000FF);
		buffer[i * 8 + 4] = (b[i].lo & 0xFF000000) >>> 24;
		buffer[i * 8 + 5] = (b[i].lo & 0x00FF0000) >>> 16;
		buffer[i * 8 + 6] = (b[i].lo & 0x0000FF00) >>> 8;
		buffer[i * 8 + 7] = (b[i].lo & 0x000000FF);
		i++;
	}
	return buffer;
}
*/

module.exports.string2Int32Buffer = function(s) {
	return this.bytes2Int32Buffer(this.string2bytes(s));
}

var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

module.exports.b64Encode = function(input) {
	var output = "";
	var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
	var i = 0;

	while (i < input.length) {

		chr1 = input[i++];
		chr2 = input[i++];
		chr3 = input[i++];

		enc1 = chr1 >> 2;
		enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
		enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
		enc4 = chr3 & 63;

		if (isNaN(chr2)) {
			enc3 = enc4 = 64;
		}
		else if (isNaN(chr3)) {
			enc4 = 64;
		}

		output +=
			keyStr.charAt(enc1) + keyStr.charAt(enc2) +
			keyStr.charAt(enc3) + keyStr.charAt(enc4);
	}

	return output;
};

module.exports.b64Decode = function(input) {
	var output = [];
	var chr1, chr2, chr3;
	var enc1, enc2, enc3, enc4;
	var i = 0;

	input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

	while (i < input.length) {

		enc1 = keyStr.indexOf(input.charAt(i++));
		enc2 = keyStr.indexOf(input.charAt(i++));
		enc3 = keyStr.indexOf(input.charAt(i++));
		enc4 = keyStr.indexOf(input.charAt(i++));

		chr1 = (enc1 << 2) | (enc2 >> 4);
		chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
		chr3 = ((enc3 & 3) << 6) | enc4;

		output.push(chr1);

		if (enc3 != 64) {
			output.push(chr2);
		}
		if (enc4 != 64) {
			output.push(chr3);
		}
	}
	return output;
};
},{"./op.js":10}],10:[function(require,module,exports){
'use strict';
//the right shift is important, it has to do with 32 bit operations in javascript, it will make things faster
function u64(h, l) {
  this.hi = h >>> 0;
  this.lo = l >>> 0;
}

u64.prototype.set = function(oWord) {
  this.lo = oWord.lo;
  this.hi = oWord.hi;
}

u64.prototype.add = function(oWord) {
  var lowest, lowMid, highMid, highest; //four parts of the whole 64 bit number..

  //need to add the respective parts from each number and the carry if on is present..
  lowest = (this.lo & 0XFFFF) + (oWord.lo & 0XFFFF);
  lowMid = (this.lo >>> 16) + (oWord.lo >>> 16) + (lowest >>> 16);
  highMid = (this.hi & 0XFFFF) + (oWord.hi & 0XFFFF) + (lowMid >>> 16);
  highest = (this.hi >>> 16) + (oWord.hi >>> 16) + (highMid >>> 16);

  //now set the hgih and the low accordingly..
  this.lo = (lowMid << 16) | (lowest & 0XFFFF);
  this.hi = (highest << 16) | (highMid & 0XFFFF);

  return this; //for chaining..
};

u64.prototype.addOne = function() {
  if (this.lo === -1 || this.lo === 0xFFFFFFFF) {
    this.lo = 0;
    this.hi++;
  }
  else {
    this.lo++;
  }
}

u64.prototype.plus = function(oWord) {
  var c = new u64(0, 0);
  var lowest, lowMid, highMid, highest; //four parts of the whole 64 bit number..

  //need to add the respective parts from each number and the carry if on is present..
  lowest = (this.lo & 0XFFFF) + (oWord.lo & 0XFFFF);
  lowMid = (this.lo >>> 16) + (oWord.lo >>> 16) + (lowest >>> 16);
  highMid = (this.hi & 0XFFFF) + (oWord.hi & 0XFFFF) + (lowMid >>> 16);
  highest = (this.hi >>> 16) + (oWord.hi >>> 16) + (highMid >>> 16);

  //now set the hgih and the low accordingly..
  c.lo = (lowMid << 16) | (lowest & 0XFFFF);
  c.hi = (highest << 16) | (highMid & 0XFFFF);

  return c; //for chaining..
};

u64.prototype.not = function() {
  return new u64(~this.hi, ~this.lo);
}

u64.prototype.one = function() {
  return new u64(0x0, 0x1);
}

u64.prototype.zero = function() {
  return new u64(0x0, 0x0);
}

u64.prototype.neg = function() {
  return this.not().plus(this.one());
}

u64.prototype.minus = function(oWord) {
  return this.plus(oWord.neg());
};

u64.prototype.isZero = function() {
  return (this.lo === 0) && (this.hi === 0);
}

function isLong(obj) {
  return (obj && obj["__isLong__"]) === true;
}

function fromNumber(value) {
  if (isNaN(value) || !isFinite(value))
    return this.zero();
  var pow32 = (1 << 32);
  return new u64((value % pow32) | 0, (value / pow32) | 0);
}

u64.prototype.multiply = function(multiplier) {
  if (this.isZero())
    return this.zero();
  if (!isLong(multiplier))
    multiplier = fromNumber(multiplier);
  if (multiplier.isZero())
    return this.zero();

  // Divide each long into 4 chunks of 16 bits, and then add up 4x4 products.
  // We can skip products that would overflow.

  var a48 = this.hi >>> 16;
  var a32 = this.hi & 0xFFFF;
  var a16 = this.lo >>> 16;
  var a00 = this.lo & 0xFFFF;

  var b48 = multiplier.hi >>> 16;
  var b32 = multiplier.hi & 0xFFFF;
  var b16 = multiplier.lo >>> 16;
  var b00 = multiplier.lo & 0xFFFF;

  var c48 = 0,
    c32 = 0,
    c16 = 0,
    c00 = 0;
  c00 += a00 * b00;
  c16 += c00 >>> 16;
  c00 &= 0xFFFF;
  c16 += a16 * b00;
  c32 += c16 >>> 16;
  c16 &= 0xFFFF;
  c16 += a00 * b16;
  c32 += c16 >>> 16;
  c16 &= 0xFFFF;
  c32 += a32 * b00;
  c48 += c32 >>> 16;
  c32 &= 0xFFFF;
  c32 += a16 * b16;
  c48 += c32 >>> 16;
  c32 &= 0xFFFF;
  c32 += a00 * b32;
  c48 += c32 >>> 16;
  c32 &= 0xFFFF;
  c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48;
  c48 &= 0xFFFF;
  return new u64((c48 << 16) | c32, (c16 << 16) | c00);
};

u64.prototype.shiftLeft = function(bits) {
  bits = bits % 64;
  var c = new u64(0, 0);
  if (bits === 0) {
    return this.clone();
  }
  else if (bits > 31) {
    c.lo = 0;
    c.hi = this.lo << (bits - 32);
  }
  else {
    var toMoveUp = this.lo >>> 32 - bits;
    c.lo = this.lo << bits;
    c.hi = (this.hi << bits) | toMoveUp;
  }
  return c; //for chaining..
};

u64.prototype.setShiftLeft = function(bits) {
  if (bits === 0) {
    return this;
  }
  if (bits > 63) {
    bits = bits % 64;
  }
  
  if (bits > 31) {
    this.hi = this.lo << (bits - 32);
    this.lo = 0;
  }
  else {
    var toMoveUp = this.lo >>> 32 - bits;
    this.lo <<= bits;
    this.hi = (this.hi << bits) | toMoveUp;
  }
  return this; //for chaining..
};
//Shifts this word by the given number of bits to the right (max 32)..
u64.prototype.shiftRight = function(bits) {
  bits = bits % 64;
  var c = new u64(0, 0);
  if (bits === 0) {
    return this.clone();
  }
  else if (bits >= 32) {
    c.hi = 0;
    c.lo = this.hi >>> (bits - 32);
  }
  else {
    var bitsOff32 = 32 - bits,
      toMoveDown = this.hi << bitsOff32 >>> bitsOff32;
    c.hi = this.hi >>> bits;
    c.lo = this.lo >>> bits | (toMoveDown << bitsOff32);
  }
  return c; //for chaining..
};
//Rotates the bits of this word round to the left (max 32)..
u64.prototype.rotateLeft = function(bits) {
  if (bits > 32) {
    return this.rotateRight(64 - bits);
  }
  var c = new u64(0, 0);
  if (bits === 0) {
    c.lo = this.lo >>> 0;
    c.hi = this.hi >>> 0;
  }
  else if (bits === 32) { //just switch high and low over in this case..
    c.lo = this.hi;
    c.hi = this.lo;
  }
  else {
    c.lo = (this.lo << bits) | (this.hi >>> (32 - bits));
    c.hi = (this.hi << bits) | (this.lo >>> (32 - bits));
  }
  return c; //for chaining..
};

u64.prototype.setRotateLeft = function(bits) {
  if (bits > 32) {
    return this.setRotateRight(64 - bits);
  }
  var newHigh;
  if (bits === 0) {
    return this;
  }
  else if (bits === 32) { //just switch high and low over in this case..
    newHigh = this.lo;
    this.lo = this.hi;
    this.hi = newHigh;
  }
  else {
    newHigh = (this.hi << bits) | (this.lo >>> (32 - bits));
    this.lo = (this.lo << bits) | (this.hi >>> (32 - bits));
    this.hi = newHigh;
  }
  return this; //for chaining..
};
//Rotates the bits of this word round to the right (max 32)..
u64.prototype.rotateRight = function(bits) {
  if (bits > 32) {
    return this.rotateLeft(64 - bits);
  }
  var c = new u64(0, 0);
  if (bits === 0) {
    c.lo = this.lo >>> 0;
    c.hi = this.hi >>> 0;
  }
  else if (bits === 32) { //just switch high and low over in this case..
    c.lo = this.hi;
    c.hi = this.lo;
  }
  else {
    c.lo = (this.hi << (32 - bits)) | (this.lo >>> bits);
    c.hi = (this.lo << (32 - bits)) | (this.hi >>> bits);
  }
  return c; //for chaining..
};
u64.prototype.setFlip = function() {
  var newHigh;
  newHigh = this.lo;
  this.lo = this.hi;
  this.hi = newHigh;
  return this;
};
//Rotates the bits of this word round to the right (max 32)..
u64.prototype.setRotateRight = function(bits) {
  if (bits > 32) {
    return this.setRotateLeft(64 - bits);
  }

  if (bits === 0) {
    return this;
  }
  else if (bits === 32) { //just switch high and low over in this case..
    var newHigh;
    newHigh = this.lo;
    this.lo = this.hi;
    this.hi = newHigh;
  }
  else {
    newHigh = (this.lo << (32 - bits)) | (this.hi >>> bits);
    this.lo = (this.hi << (32 - bits)) | (this.lo >>> bits);
    this.hi = newHigh;
  }
  return this; //for chaining..
};
//Xors this word with the given other..
u64.prototype.xor = function(oWord) {
  var c = new u64(0, 0);
  c.hi = this.hi ^ oWord.hi;
  c.lo = this.lo ^ oWord.lo;
  return c; //for chaining..
};
//Xors this word with the given other..
u64.prototype.setxorOne = function(oWord) {
  this.hi ^= oWord.hi;
  this.lo ^= oWord.lo;
  return this; //for chaining..
};
//Ands this word with the given other..
u64.prototype.and = function(oWord) {
  var c = new u64(0, 0);
  c.hi = this.hi & oWord.hi;
  c.lo = this.lo & oWord.lo;
  return c; //for chaining..
};

//Creates a deep copy of this Word..
u64.prototype.clone = function() {
  return new u64(this.hi, this.lo);
};

u64.prototype.setxor64 = function() {
  var a = arguments;
  var i = a.length;
  while (i--) {
    this.hi ^= a[i].hi;
    this.lo ^= a[i].lo;
  }
  return this;
}

module.exports.u64 = u64;

module.exports.u = function(h, l) {
  return new u64(h, l);
}
/*
module.exports.add64 = function(a, b) {
  var lowest, lowMid, highMid, highest; //four parts of the whole 64 bit number..

  //need to add the respective parts from each number and the carry if on is present..
  lowest = (a.lo & 0XFFFF) + (b.lo & 0XFFFF);
  lowMid = (a.lo >>> 16) + (b.lo >>> 16) + (lowest >>> 16);
  highMid = (a.hi & 0XFFFF) + (b.hi & 0XFFFF) + (lowMid >>> 16);
  highest = (a.hi >>> 16) + (b.hi >>> 16) + (highMid >>> 16);

  var r = new this.u64((highest << 16) | (highMid & 0XFFFF), (lowMid << 16) | (lowest & 0XFFFF));

  return r;
};
*/
module.exports.xor64 = function() {
  var a = arguments,
    h = a[0].hi,
    l = a[0].lo;
      var i = a.length-1;
  do {
    h ^= a[i].hi;
    l ^= a[i].lo;
    i--;
  } while (i>0);
  return new this.u64(h, l);
}

module.exports.clone64Array = function(array) {
  var i = 0;
  var len = array.length;
  var a = new Array(len);
  while(i<len) {
    a[i] = array[i];
    i++;
  }
  return a;
}

//this shouldn't be a problem, but who knows in the future javascript might support 64bits
module.exports.t32 = function(x) {
  return (x & 0xFFFFFFFF)
}

module.exports.rotl32 = function(x, c) {
  return (((x) << (c)) | ((x) >>> (32 - (c)))) & (0xFFFFFFFF);
}

module.exports.rotr32 = function(x, c) {
  return this.rotl32(x, (32 - (c)));
}

module.exports.swap32 = function(val) {
  return ((val & 0xFF) << 24) |
    ((val & 0xFF00) << 8) |
    ((val >>> 8) & 0xFF00) |
    ((val >>> 24) & 0xFF);
}

module.exports.swap32Array = function(a) {
  //can't do this with map because of support for IE8 (Don't hate me plz).
  var i = 0, len = a.length;
  var r = new Array(i);
  while (i<len) {
    r[i] = (this.swap32(a[i]));
    i++;
  }
  return r;
}

module.exports.xnd64 = function(x, y, z) {
  return new this.u64(x.hi ^ ((~y.hi) & z.hi), x.lo ^ ((~y.lo) & z.lo));
}
/*
module.exports.load64 = function(x, i) {
  var l = x[i] | (x[i + 1] << 8) | (x[i + 2] << 16) | (x[i + 3] << 24);
  var h = x[i + 4] | (x[i + 5] << 8) | (x[i + 6] << 16) | (x[i + 7] << 24);
  return new this.u64(h, l);
}
*/
module.exports.bufferInsert = function(buffer, bufferOffset, data, len, dataOffset) {
  dataOffset = dataOffset | 0;
  var i = 0;
  while (i < len) {
    buffer[i + bufferOffset] = data[i + dataOffset];
    i++;
  }
}

module.exports.bufferInsert64 = function(buffer, bufferOffset, data, len) {
  var i = 0;
  while (i < len) {
    buffer[i + bufferOffset] = data[i].clone();
    i++;
  }
}
/*
module.exports.buffer2Insert = function(buffer, bufferOffset, bufferOffset2, data, len, len2) {
  while (len--) {
    var j = len2;
    while (j--) {
      buffer[len + bufferOffset][j + bufferOffset2] = data[len][j];
    }
  }
}
*/
module.exports.bufferInsertBackwards = function(buffer, bufferOffset, data, len) {
  var i = 0;
  while (i < len) {
    buffer[i + bufferOffset] = data[len - 1 - i];
    i++;
  }
}

module.exports.bufferSet = function(buffer, bufferOffset, value, len) {
  var i = 0;
  while (i < len) {
    buffer[i + bufferOffset] = value;
    i++;
  }
}

module.exports.bufferXORInsert = function(buffer, bufferOffset, data, dataOffset, len) {
  var i = 0;
  while (i < len) {
    buffer[i + bufferOffset] ^= data[i + dataOffset];
    i++;
  }
}

module.exports.xORTable = function(d, s1, s2, len) {
  var i = 0;
  while (i < len) {
    d[i] = s1[i] ^ s2[i];
    i++
  }
}

},{}],11:[function(require,module,exports){
'use strict'
var Buffer = require('safe-buffer').Buffer
var Transform = require('stream').Transform
var inherits = require('inherits')

function throwIfNotStringOrBuffer (val, prefix) {
  if (!Buffer.isBuffer(val) && typeof val !== 'string') {
    throw new TypeError(prefix + ' must be a string or a buffer')
  }
}

function HashBase (blockSize) {
  Transform.call(this)

  this._block = Buffer.allocUnsafe(blockSize)
  this._blockSize = blockSize
  this._blockOffset = 0
  this._length = [0, 0, 0, 0]

  this._finalized = false
}

inherits(HashBase, Transform)

HashBase.prototype._transform = function (chunk, encoding, callback) {
  var error = null
  try {
    this.update(chunk, encoding)
  } catch (err) {
    error = err
  }

  callback(error)
}

HashBase.prototype._flush = function (callback) {
  var error = null
  try {
    this.push(this.digest())
  } catch (err) {
    error = err
  }

  callback(error)
}

HashBase.prototype.update = function (data, encoding) {
  throwIfNotStringOrBuffer(data, 'Data')
  if (this._finalized) throw new Error('Digest already called')
  if (!Buffer.isBuffer(data)) data = Buffer.from(data, encoding)

  // consume data
  var block = this._block
  var offset = 0
  while (this._blockOffset + data.length - offset >= this._blockSize) {
    for (var i = this._blockOffset; i < this._blockSize;) block[i++] = data[offset++]
    this._update()
    this._blockOffset = 0
  }
  while (offset < data.length) block[this._blockOffset++] = data[offset++]

  // update length
  for (var j = 0, carry = data.length * 8; carry > 0; ++j) {
    this._length[j] += carry
    carry = (this._length[j] / 0x0100000000) | 0
    if (carry > 0) this._length[j] -= 0x0100000000 * carry
  }

  return this
}

HashBase.prototype._update = function () {
  throw new Error('_update is not implemented')
}

HashBase.prototype.digest = function (encoding) {
  if (this._finalized) throw new Error('Digest already called')
  this._finalized = true

  var digest = this._digest()
  if (encoding !== undefined) digest = digest.toString(encoding)

  // reset state
  this._block.fill(0)
  this._blockOffset = 0
  for (var i = 0; i < 4; ++i) this._length[i] = 0

  return digest
}

HashBase.prototype._digest = function () {
  throw new Error('_digest is not implemented')
}

module.exports = HashBase

},{"inherits":12,"safe-buffer":15,"stream":51}],12:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],13:[function(require,module,exports){
(function (Buffer){
'use strict'
var inherits = require('inherits')
var HashBase = require('hash-base')

var ARRAY16 = new Array(16)

function MD5 () {
  HashBase.call(this, 64)

  // state
  this._a = 0x67452301
  this._b = 0xefcdab89
  this._c = 0x98badcfe
  this._d = 0x10325476
}

inherits(MD5, HashBase)

MD5.prototype._update = function () {
  var M = ARRAY16
  for (var i = 0; i < 16; ++i) M[i] = this._block.readInt32LE(i * 4)

  var a = this._a
  var b = this._b
  var c = this._c
  var d = this._d

  a = fnF(a, b, c, d, M[0], 0xd76aa478, 7)
  d = fnF(d, a, b, c, M[1], 0xe8c7b756, 12)
  c = fnF(c, d, a, b, M[2], 0x242070db, 17)
  b = fnF(b, c, d, a, M[3], 0xc1bdceee, 22)
  a = fnF(a, b, c, d, M[4], 0xf57c0faf, 7)
  d = fnF(d, a, b, c, M[5], 0x4787c62a, 12)
  c = fnF(c, d, a, b, M[6], 0xa8304613, 17)
  b = fnF(b, c, d, a, M[7], 0xfd469501, 22)
  a = fnF(a, b, c, d, M[8], 0x698098d8, 7)
  d = fnF(d, a, b, c, M[9], 0x8b44f7af, 12)
  c = fnF(c, d, a, b, M[10], 0xffff5bb1, 17)
  b = fnF(b, c, d, a, M[11], 0x895cd7be, 22)
  a = fnF(a, b, c, d, M[12], 0x6b901122, 7)
  d = fnF(d, a, b, c, M[13], 0xfd987193, 12)
  c = fnF(c, d, a, b, M[14], 0xa679438e, 17)
  b = fnF(b, c, d, a, M[15], 0x49b40821, 22)

  a = fnG(a, b, c, d, M[1], 0xf61e2562, 5)
  d = fnG(d, a, b, c, M[6], 0xc040b340, 9)
  c = fnG(c, d, a, b, M[11], 0x265e5a51, 14)
  b = fnG(b, c, d, a, M[0], 0xe9b6c7aa, 20)
  a = fnG(a, b, c, d, M[5], 0xd62f105d, 5)
  d = fnG(d, a, b, c, M[10], 0x02441453, 9)
  c = fnG(c, d, a, b, M[15], 0xd8a1e681, 14)
  b = fnG(b, c, d, a, M[4], 0xe7d3fbc8, 20)
  a = fnG(a, b, c, d, M[9], 0x21e1cde6, 5)
  d = fnG(d, a, b, c, M[14], 0xc33707d6, 9)
  c = fnG(c, d, a, b, M[3], 0xf4d50d87, 14)
  b = fnG(b, c, d, a, M[8], 0x455a14ed, 20)
  a = fnG(a, b, c, d, M[13], 0xa9e3e905, 5)
  d = fnG(d, a, b, c, M[2], 0xfcefa3f8, 9)
  c = fnG(c, d, a, b, M[7], 0x676f02d9, 14)
  b = fnG(b, c, d, a, M[12], 0x8d2a4c8a, 20)

  a = fnH(a, b, c, d, M[5], 0xfffa3942, 4)
  d = fnH(d, a, b, c, M[8], 0x8771f681, 11)
  c = fnH(c, d, a, b, M[11], 0x6d9d6122, 16)
  b = fnH(b, c, d, a, M[14], 0xfde5380c, 23)
  a = fnH(a, b, c, d, M[1], 0xa4beea44, 4)
  d = fnH(d, a, b, c, M[4], 0x4bdecfa9, 11)
  c = fnH(c, d, a, b, M[7], 0xf6bb4b60, 16)
  b = fnH(b, c, d, a, M[10], 0xbebfbc70, 23)
  a = fnH(a, b, c, d, M[13], 0x289b7ec6, 4)
  d = fnH(d, a, b, c, M[0], 0xeaa127fa, 11)
  c = fnH(c, d, a, b, M[3], 0xd4ef3085, 16)
  b = fnH(b, c, d, a, M[6], 0x04881d05, 23)
  a = fnH(a, b, c, d, M[9], 0xd9d4d039, 4)
  d = fnH(d, a, b, c, M[12], 0xe6db99e5, 11)
  c = fnH(c, d, a, b, M[15], 0x1fa27cf8, 16)
  b = fnH(b, c, d, a, M[2], 0xc4ac5665, 23)

  a = fnI(a, b, c, d, M[0], 0xf4292244, 6)
  d = fnI(d, a, b, c, M[7], 0x432aff97, 10)
  c = fnI(c, d, a, b, M[14], 0xab9423a7, 15)
  b = fnI(b, c, d, a, M[5], 0xfc93a039, 21)
  a = fnI(a, b, c, d, M[12], 0x655b59c3, 6)
  d = fnI(d, a, b, c, M[3], 0x8f0ccc92, 10)
  c = fnI(c, d, a, b, M[10], 0xffeff47d, 15)
  b = fnI(b, c, d, a, M[1], 0x85845dd1, 21)
  a = fnI(a, b, c, d, M[8], 0x6fa87e4f, 6)
  d = fnI(d, a, b, c, M[15], 0xfe2ce6e0, 10)
  c = fnI(c, d, a, b, M[6], 0xa3014314, 15)
  b = fnI(b, c, d, a, M[13], 0x4e0811a1, 21)
  a = fnI(a, b, c, d, M[4], 0xf7537e82, 6)
  d = fnI(d, a, b, c, M[11], 0xbd3af235, 10)
  c = fnI(c, d, a, b, M[2], 0x2ad7d2bb, 15)
  b = fnI(b, c, d, a, M[9], 0xeb86d391, 21)

  this._a = (this._a + a) | 0
  this._b = (this._b + b) | 0
  this._c = (this._c + c) | 0
  this._d = (this._d + d) | 0
}

MD5.prototype._digest = function () {
  // create padding and handle blocks
  this._block[this._blockOffset++] = 0x80
  if (this._blockOffset > 56) {
    this._block.fill(0, this._blockOffset, 64)
    this._update()
    this._blockOffset = 0
  }

  this._block.fill(0, this._blockOffset, 56)
  this._block.writeUInt32LE(this._length[0], 56)
  this._block.writeUInt32LE(this._length[1], 60)
  this._update()

  // produce result
  var buffer = new Buffer(16)
  buffer.writeInt32LE(this._a, 0)
  buffer.writeInt32LE(this._b, 4)
  buffer.writeInt32LE(this._c, 8)
  buffer.writeInt32LE(this._d, 12)
  return buffer
}

function rotl (x, n) {
  return (x << n) | (x >>> (32 - n))
}

function fnF (a, b, c, d, m, k, s) {
  return (rotl((a + ((b & c) | ((~b) & d)) + m + k) | 0, s) + b) | 0
}

function fnG (a, b, c, d, m, k, s) {
  return (rotl((a + ((b & d) | (c & (~d))) + m + k) | 0, s) + b) | 0
}

function fnH (a, b, c, d, m, k, s) {
  return (rotl((a + (b ^ c ^ d) + m + k) | 0, s) + b) | 0
}

function fnI (a, b, c, d, m, k, s) {
  return (rotl((a + ((c ^ (b | (~d)))) + m + k) | 0, s) + b) | 0
}

module.exports = MD5

}).call(this,require("buffer").Buffer)
},{"buffer":27,"hash-base":11,"inherits":12}],14:[function(require,module,exports){
'use strict'
var Buffer = require('buffer').Buffer
var inherits = require('inherits')
var HashBase = require('hash-base')

var ARRAY16 = new Array(16)

var zl = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
  7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8,
  3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12,
  1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2,
  4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13
]

var zr = [
  5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12,
  6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2,
  15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13,
  8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14,
  12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11
]

var sl = [
  11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8,
  7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12,
  11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5,
  11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12,
  9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6
]

var sr = [
  8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6,
  9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11,
  9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5,
  15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8,
  8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11
]

var hl = [0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e]
var hr = [0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000]

function RIPEMD160 () {
  HashBase.call(this, 64)

  // state
  this._a = 0x67452301
  this._b = 0xefcdab89
  this._c = 0x98badcfe
  this._d = 0x10325476
  this._e = 0xc3d2e1f0
}

inherits(RIPEMD160, HashBase)

RIPEMD160.prototype._update = function () {
  var words = ARRAY16
  for (var j = 0; j < 16; ++j) words[j] = this._block.readInt32LE(j * 4)

  var al = this._a | 0
  var bl = this._b | 0
  var cl = this._c | 0
  var dl = this._d | 0
  var el = this._e | 0

  var ar = this._a | 0
  var br = this._b | 0
  var cr = this._c | 0
  var dr = this._d | 0
  var er = this._e | 0

  // computation
  for (var i = 0; i < 80; i += 1) {
    var tl
    var tr
    if (i < 16) {
      tl = fn1(al, bl, cl, dl, el, words[zl[i]], hl[0], sl[i])
      tr = fn5(ar, br, cr, dr, er, words[zr[i]], hr[0], sr[i])
    } else if (i < 32) {
      tl = fn2(al, bl, cl, dl, el, words[zl[i]], hl[1], sl[i])
      tr = fn4(ar, br, cr, dr, er, words[zr[i]], hr[1], sr[i])
    } else if (i < 48) {
      tl = fn3(al, bl, cl, dl, el, words[zl[i]], hl[2], sl[i])
      tr = fn3(ar, br, cr, dr, er, words[zr[i]], hr[2], sr[i])
    } else if (i < 64) {
      tl = fn4(al, bl, cl, dl, el, words[zl[i]], hl[3], sl[i])
      tr = fn2(ar, br, cr, dr, er, words[zr[i]], hr[3], sr[i])
    } else { // if (i<80) {
      tl = fn5(al, bl, cl, dl, el, words[zl[i]], hl[4], sl[i])
      tr = fn1(ar, br, cr, dr, er, words[zr[i]], hr[4], sr[i])
    }

    al = el
    el = dl
    dl = rotl(cl, 10)
    cl = bl
    bl = tl

    ar = er
    er = dr
    dr = rotl(cr, 10)
    cr = br
    br = tr
  }

  // update state
  var t = (this._b + cl + dr) | 0
  this._b = (this._c + dl + er) | 0
  this._c = (this._d + el + ar) | 0
  this._d = (this._e + al + br) | 0
  this._e = (this._a + bl + cr) | 0
  this._a = t
}

RIPEMD160.prototype._digest = function () {
  // create padding and handle blocks
  this._block[this._blockOffset++] = 0x80
  if (this._blockOffset > 56) {
    this._block.fill(0, this._blockOffset, 64)
    this._update()
    this._blockOffset = 0
  }

  this._block.fill(0, this._blockOffset, 56)
  this._block.writeUInt32LE(this._length[0], 56)
  this._block.writeUInt32LE(this._length[1], 60)
  this._update()

  // produce result
  var buffer = Buffer.alloc ? Buffer.alloc(20) : new Buffer(20)
  buffer.writeInt32LE(this._a, 0)
  buffer.writeInt32LE(this._b, 4)
  buffer.writeInt32LE(this._c, 8)
  buffer.writeInt32LE(this._d, 12)
  buffer.writeInt32LE(this._e, 16)
  return buffer
}

function rotl (x, n) {
  return (x << n) | (x >>> (32 - n))
}

function fn1 (a, b, c, d, e, m, k, s) {
  return (rotl((a + (b ^ c ^ d) + m + k) | 0, s) + e) | 0
}

function fn2 (a, b, c, d, e, m, k, s) {
  return (rotl((a + ((b & c) | ((~b) & d)) + m + k) | 0, s) + e) | 0
}

function fn3 (a, b, c, d, e, m, k, s) {
  return (rotl((a + ((b | (~c)) ^ d) + m + k) | 0, s) + e) | 0
}

function fn4 (a, b, c, d, e, m, k, s) {
  return (rotl((a + ((b & d) | (c & (~d))) + m + k) | 0, s) + e) | 0
}

function fn5 (a, b, c, d, e, m, k, s) {
  return (rotl((a + (b ^ (c | (~d))) + m + k) | 0, s) + e) | 0
}

module.exports = RIPEMD160

},{"buffer":27,"hash-base":11,"inherits":12}],15:[function(require,module,exports){
/* eslint-disable node/no-deprecated-api */
var buffer = require('buffer')
var Buffer = buffer.Buffer

// alternative to using Object.keys for old browsers
function copyProps (src, dst) {
  for (var key in src) {
    dst[key] = src[key]
  }
}
if (Buffer.from && Buffer.alloc && Buffer.allocUnsafe && Buffer.allocUnsafeSlow) {
  module.exports = buffer
} else {
  // Copy properties from require('buffer')
  copyProps(buffer, exports)
  exports.Buffer = SafeBuffer
}

function SafeBuffer (arg, encodingOrOffset, length) {
  return Buffer(arg, encodingOrOffset, length)
}

// Copy static methods from Buffer
copyProps(Buffer, SafeBuffer)

SafeBuffer.from = function (arg, encodingOrOffset, length) {
  if (typeof arg === 'number') {
    throw new TypeError('Argument must not be a number')
  }
  return Buffer(arg, encodingOrOffset, length)
}

SafeBuffer.alloc = function (size, fill, encoding) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  var buf = Buffer(size)
  if (fill !== undefined) {
    if (typeof encoding === 'string') {
      buf.fill(fill, encoding)
    } else {
      buf.fill(fill)
    }
  } else {
    buf.fill(0)
  }
  return buf
}

SafeBuffer.allocUnsafe = function (size) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  return Buffer(size)
}

SafeBuffer.allocUnsafeSlow = function (size) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  return buffer.SlowBuffer(size)
}

},{"buffer":27}],16:[function(require,module,exports){
var Buffer = require('safe-buffer').Buffer

// prototype class for hash functions
function Hash (blockSize, finalSize) {
  this._block = Buffer.alloc(blockSize)
  this._finalSize = finalSize
  this._blockSize = blockSize
  this._len = 0
}

Hash.prototype.update = function (data, enc) {
  if (typeof data === 'string') {
    enc = enc || 'utf8'
    data = Buffer.from(data, enc)
  }

  var block = this._block
  var blockSize = this._blockSize
  var length = data.length
  var accum = this._len

  for (var offset = 0; offset < length;) {
    var assigned = accum % blockSize
    var remainder = Math.min(length - offset, blockSize - assigned)

    for (var i = 0; i < remainder; i++) {
      block[assigned + i] = data[offset + i]
    }

    accum += remainder
    offset += remainder

    if ((accum % blockSize) === 0) {
      this._update(block)
    }
  }

  this._len += length
  return this
}

Hash.prototype.digest = function (enc) {
  var rem = this._len % this._blockSize

  this._block[rem] = 0x80

  // zero (rem + 1) trailing bits, where (rem + 1) is the smallest
  // non-negative solution to the equation (length + 1 + (rem + 1)) === finalSize mod blockSize
  this._block.fill(0, rem + 1)

  if (rem >= this._finalSize) {
    this._update(this._block)
    this._block.fill(0)
  }

  var bits = this._len * 8

  // uint32
  if (bits <= 0xffffffff) {
    this._block.writeUInt32BE(bits, this._blockSize - 4)

  // uint64
  } else {
    var lowBits = (bits & 0xffffffff) >>> 0
    var highBits = (bits - lowBits) / 0x100000000

    this._block.writeUInt32BE(highBits, this._blockSize - 8)
    this._block.writeUInt32BE(lowBits, this._blockSize - 4)
  }

  this._update(this._block)
  var hash = this._hash()

  return enc ? hash.toString(enc) : hash
}

Hash.prototype._update = function () {
  throw new Error('_update must be implemented by subclass')
}

module.exports = Hash

},{"safe-buffer":15}],17:[function(require,module,exports){
var exports = module.exports = function SHA (algorithm) {
  algorithm = algorithm.toLowerCase()

  var Algorithm = exports[algorithm]
  if (!Algorithm) throw new Error(algorithm + ' is not supported (we accept pull requests)')

  return new Algorithm()
}

exports.sha = require('./sha')
exports.sha1 = require('./sha1')
exports.sha224 = require('./sha224')
exports.sha256 = require('./sha256')
exports.sha384 = require('./sha384')
exports.sha512 = require('./sha512')

},{"./sha":18,"./sha1":19,"./sha224":20,"./sha256":21,"./sha384":22,"./sha512":23}],18:[function(require,module,exports){
/*
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-0, as defined
 * in FIPS PUB 180-1
 * This source code is derived from sha1.js of the same repository.
 * The difference between SHA-0 and SHA-1 is just a bitwise rotate left
 * operation was added.
 */

var inherits = require('inherits')
var Hash = require('./hash')
var Buffer = require('safe-buffer').Buffer

var K = [
  0x5a827999, 0x6ed9eba1, 0x8f1bbcdc | 0, 0xca62c1d6 | 0
]

var W = new Array(80)

function Sha () {
  this.init()
  this._w = W

  Hash.call(this, 64, 56)
}

inherits(Sha, Hash)

Sha.prototype.init = function () {
  this._a = 0x67452301
  this._b = 0xefcdab89
  this._c = 0x98badcfe
  this._d = 0x10325476
  this._e = 0xc3d2e1f0

  return this
}

function rotl5 (num) {
  return (num << 5) | (num >>> 27)
}

function rotl30 (num) {
  return (num << 30) | (num >>> 2)
}

function ft (s, b, c, d) {
  if (s === 0) return (b & c) | ((~b) & d)
  if (s === 2) return (b & c) | (b & d) | (c & d)
  return b ^ c ^ d
}

Sha.prototype._update = function (M) {
  var W = this._w

  var a = this._a | 0
  var b = this._b | 0
  var c = this._c | 0
  var d = this._d | 0
  var e = this._e | 0

  for (var i = 0; i < 16; ++i) W[i] = M.readInt32BE(i * 4)
  for (; i < 80; ++i) W[i] = W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16]

  for (var j = 0; j < 80; ++j) {
    var s = ~~(j / 20)
    var t = (rotl5(a) + ft(s, b, c, d) + e + W[j] + K[s]) | 0

    e = d
    d = c
    c = rotl30(b)
    b = a
    a = t
  }

  this._a = (a + this._a) | 0
  this._b = (b + this._b) | 0
  this._c = (c + this._c) | 0
  this._d = (d + this._d) | 0
  this._e = (e + this._e) | 0
}

Sha.prototype._hash = function () {
  var H = Buffer.allocUnsafe(20)

  H.writeInt32BE(this._a | 0, 0)
  H.writeInt32BE(this._b | 0, 4)
  H.writeInt32BE(this._c | 0, 8)
  H.writeInt32BE(this._d | 0, 12)
  H.writeInt32BE(this._e | 0, 16)

  return H
}

module.exports = Sha

},{"./hash":16,"inherits":12,"safe-buffer":15}],19:[function(require,module,exports){
/*
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-1, as defined
 * in FIPS PUB 180-1
 * Version 2.1a Copyright Paul Johnston 2000 - 2002.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for details.
 */

var inherits = require('inherits')
var Hash = require('./hash')
var Buffer = require('safe-buffer').Buffer

var K = [
  0x5a827999, 0x6ed9eba1, 0x8f1bbcdc | 0, 0xca62c1d6 | 0
]

var W = new Array(80)

function Sha1 () {
  this.init()
  this._w = W

  Hash.call(this, 64, 56)
}

inherits(Sha1, Hash)

Sha1.prototype.init = function () {
  this._a = 0x67452301
  this._b = 0xefcdab89
  this._c = 0x98badcfe
  this._d = 0x10325476
  this._e = 0xc3d2e1f0

  return this
}

function rotl1 (num) {
  return (num << 1) | (num >>> 31)
}

function rotl5 (num) {
  return (num << 5) | (num >>> 27)
}

function rotl30 (num) {
  return (num << 30) | (num >>> 2)
}

function ft (s, b, c, d) {
  if (s === 0) return (b & c) | ((~b) & d)
  if (s === 2) return (b & c) | (b & d) | (c & d)
  return b ^ c ^ d
}

Sha1.prototype._update = function (M) {
  var W = this._w

  var a = this._a | 0
  var b = this._b | 0
  var c = this._c | 0
  var d = this._d | 0
  var e = this._e | 0

  for (var i = 0; i < 16; ++i) W[i] = M.readInt32BE(i * 4)
  for (; i < 80; ++i) W[i] = rotl1(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16])

  for (var j = 0; j < 80; ++j) {
    var s = ~~(j / 20)
    var t = (rotl5(a) + ft(s, b, c, d) + e + W[j] + K[s]) | 0

    e = d
    d = c
    c = rotl30(b)
    b = a
    a = t
  }

  this._a = (a + this._a) | 0
  this._b = (b + this._b) | 0
  this._c = (c + this._c) | 0
  this._d = (d + this._d) | 0
  this._e = (e + this._e) | 0
}

Sha1.prototype._hash = function () {
  var H = Buffer.allocUnsafe(20)

  H.writeInt32BE(this._a | 0, 0)
  H.writeInt32BE(this._b | 0, 4)
  H.writeInt32BE(this._c | 0, 8)
  H.writeInt32BE(this._d | 0, 12)
  H.writeInt32BE(this._e | 0, 16)

  return H
}

module.exports = Sha1

},{"./hash":16,"inherits":12,"safe-buffer":15}],20:[function(require,module,exports){
/**
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-256, as defined
 * in FIPS 180-2
 * Version 2.2-beta Copyright Angel Marin, Paul Johnston 2000 - 2009.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 *
 */

var inherits = require('inherits')
var Sha256 = require('./sha256')
var Hash = require('./hash')
var Buffer = require('safe-buffer').Buffer

var W = new Array(64)

function Sha224 () {
  this.init()

  this._w = W // new Array(64)

  Hash.call(this, 64, 56)
}

inherits(Sha224, Sha256)

Sha224.prototype.init = function () {
  this._a = 0xc1059ed8
  this._b = 0x367cd507
  this._c = 0x3070dd17
  this._d = 0xf70e5939
  this._e = 0xffc00b31
  this._f = 0x68581511
  this._g = 0x64f98fa7
  this._h = 0xbefa4fa4

  return this
}

Sha224.prototype._hash = function () {
  var H = Buffer.allocUnsafe(28)

  H.writeInt32BE(this._a, 0)
  H.writeInt32BE(this._b, 4)
  H.writeInt32BE(this._c, 8)
  H.writeInt32BE(this._d, 12)
  H.writeInt32BE(this._e, 16)
  H.writeInt32BE(this._f, 20)
  H.writeInt32BE(this._g, 24)

  return H
}

module.exports = Sha224

},{"./hash":16,"./sha256":21,"inherits":12,"safe-buffer":15}],21:[function(require,module,exports){
/**
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-256, as defined
 * in FIPS 180-2
 * Version 2.2-beta Copyright Angel Marin, Paul Johnston 2000 - 2009.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 *
 */

var inherits = require('inherits')
var Hash = require('./hash')
var Buffer = require('safe-buffer').Buffer

var K = [
  0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5,
  0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5,
  0xD807AA98, 0x12835B01, 0x243185BE, 0x550C7DC3,
  0x72BE5D74, 0x80DEB1FE, 0x9BDC06A7, 0xC19BF174,
  0xE49B69C1, 0xEFBE4786, 0x0FC19DC6, 0x240CA1CC,
  0x2DE92C6F, 0x4A7484AA, 0x5CB0A9DC, 0x76F988DA,
  0x983E5152, 0xA831C66D, 0xB00327C8, 0xBF597FC7,
  0xC6E00BF3, 0xD5A79147, 0x06CA6351, 0x14292967,
  0x27B70A85, 0x2E1B2138, 0x4D2C6DFC, 0x53380D13,
  0x650A7354, 0x766A0ABB, 0x81C2C92E, 0x92722C85,
  0xA2BFE8A1, 0xA81A664B, 0xC24B8B70, 0xC76C51A3,
  0xD192E819, 0xD6990624, 0xF40E3585, 0x106AA070,
  0x19A4C116, 0x1E376C08, 0x2748774C, 0x34B0BCB5,
  0x391C0CB3, 0x4ED8AA4A, 0x5B9CCA4F, 0x682E6FF3,
  0x748F82EE, 0x78A5636F, 0x84C87814, 0x8CC70208,
  0x90BEFFFA, 0xA4506CEB, 0xBEF9A3F7, 0xC67178F2
]

var W = new Array(64)

function Sha256 () {
  this.init()

  this._w = W // new Array(64)

  Hash.call(this, 64, 56)
}

inherits(Sha256, Hash)

Sha256.prototype.init = function () {
  this._a = 0x6a09e667
  this._b = 0xbb67ae85
  this._c = 0x3c6ef372
  this._d = 0xa54ff53a
  this._e = 0x510e527f
  this._f = 0x9b05688c
  this._g = 0x1f83d9ab
  this._h = 0x5be0cd19

  return this
}

function ch (x, y, z) {
  return z ^ (x & (y ^ z))
}

function maj (x, y, z) {
  return (x & y) | (z & (x | y))
}

function sigma0 (x) {
  return (x >>> 2 | x << 30) ^ (x >>> 13 | x << 19) ^ (x >>> 22 | x << 10)
}

function sigma1 (x) {
  return (x >>> 6 | x << 26) ^ (x >>> 11 | x << 21) ^ (x >>> 25 | x << 7)
}

function gamma0 (x) {
  return (x >>> 7 | x << 25) ^ (x >>> 18 | x << 14) ^ (x >>> 3)
}

function gamma1 (x) {
  return (x >>> 17 | x << 15) ^ (x >>> 19 | x << 13) ^ (x >>> 10)
}

Sha256.prototype._update = function (M) {
  var W = this._w

  var a = this._a | 0
  var b = this._b | 0
  var c = this._c | 0
  var d = this._d | 0
  var e = this._e | 0
  var f = this._f | 0
  var g = this._g | 0
  var h = this._h | 0

  for (var i = 0; i < 16; ++i) W[i] = M.readInt32BE(i * 4)
  for (; i < 64; ++i) W[i] = (gamma1(W[i - 2]) + W[i - 7] + gamma0(W[i - 15]) + W[i - 16]) | 0

  for (var j = 0; j < 64; ++j) {
    var T1 = (h + sigma1(e) + ch(e, f, g) + K[j] + W[j]) | 0
    var T2 = (sigma0(a) + maj(a, b, c)) | 0

    h = g
    g = f
    f = e
    e = (d + T1) | 0
    d = c
    c = b
    b = a
    a = (T1 + T2) | 0
  }

  this._a = (a + this._a) | 0
  this._b = (b + this._b) | 0
  this._c = (c + this._c) | 0
  this._d = (d + this._d) | 0
  this._e = (e + this._e) | 0
  this._f = (f + this._f) | 0
  this._g = (g + this._g) | 0
  this._h = (h + this._h) | 0
}

Sha256.prototype._hash = function () {
  var H = Buffer.allocUnsafe(32)

  H.writeInt32BE(this._a, 0)
  H.writeInt32BE(this._b, 4)
  H.writeInt32BE(this._c, 8)
  H.writeInt32BE(this._d, 12)
  H.writeInt32BE(this._e, 16)
  H.writeInt32BE(this._f, 20)
  H.writeInt32BE(this._g, 24)
  H.writeInt32BE(this._h, 28)

  return H
}

module.exports = Sha256

},{"./hash":16,"inherits":12,"safe-buffer":15}],22:[function(require,module,exports){
var inherits = require('inherits')
var SHA512 = require('./sha512')
var Hash = require('./hash')
var Buffer = require('safe-buffer').Buffer

var W = new Array(160)

function Sha384 () {
  this.init()
  this._w = W

  Hash.call(this, 128, 112)
}

inherits(Sha384, SHA512)

Sha384.prototype.init = function () {
  this._ah = 0xcbbb9d5d
  this._bh = 0x629a292a
  this._ch = 0x9159015a
  this._dh = 0x152fecd8
  this._eh = 0x67332667
  this._fh = 0x8eb44a87
  this._gh = 0xdb0c2e0d
  this._hh = 0x47b5481d

  this._al = 0xc1059ed8
  this._bl = 0x367cd507
  this._cl = 0x3070dd17
  this._dl = 0xf70e5939
  this._el = 0xffc00b31
  this._fl = 0x68581511
  this._gl = 0x64f98fa7
  this._hl = 0xbefa4fa4

  return this
}

Sha384.prototype._hash = function () {
  var H = Buffer.allocUnsafe(48)

  function writeInt64BE (h, l, offset) {
    H.writeInt32BE(h, offset)
    H.writeInt32BE(l, offset + 4)
  }

  writeInt64BE(this._ah, this._al, 0)
  writeInt64BE(this._bh, this._bl, 8)
  writeInt64BE(this._ch, this._cl, 16)
  writeInt64BE(this._dh, this._dl, 24)
  writeInt64BE(this._eh, this._el, 32)
  writeInt64BE(this._fh, this._fl, 40)

  return H
}

module.exports = Sha384

},{"./hash":16,"./sha512":23,"inherits":12,"safe-buffer":15}],23:[function(require,module,exports){
var inherits = require('inherits')
var Hash = require('./hash')
var Buffer = require('safe-buffer').Buffer

var K = [
  0x428a2f98, 0xd728ae22, 0x71374491, 0x23ef65cd,
  0xb5c0fbcf, 0xec4d3b2f, 0xe9b5dba5, 0x8189dbbc,
  0x3956c25b, 0xf348b538, 0x59f111f1, 0xb605d019,
  0x923f82a4, 0xaf194f9b, 0xab1c5ed5, 0xda6d8118,
  0xd807aa98, 0xa3030242, 0x12835b01, 0x45706fbe,
  0x243185be, 0x4ee4b28c, 0x550c7dc3, 0xd5ffb4e2,
  0x72be5d74, 0xf27b896f, 0x80deb1fe, 0x3b1696b1,
  0x9bdc06a7, 0x25c71235, 0xc19bf174, 0xcf692694,
  0xe49b69c1, 0x9ef14ad2, 0xefbe4786, 0x384f25e3,
  0x0fc19dc6, 0x8b8cd5b5, 0x240ca1cc, 0x77ac9c65,
  0x2de92c6f, 0x592b0275, 0x4a7484aa, 0x6ea6e483,
  0x5cb0a9dc, 0xbd41fbd4, 0x76f988da, 0x831153b5,
  0x983e5152, 0xee66dfab, 0xa831c66d, 0x2db43210,
  0xb00327c8, 0x98fb213f, 0xbf597fc7, 0xbeef0ee4,
  0xc6e00bf3, 0x3da88fc2, 0xd5a79147, 0x930aa725,
  0x06ca6351, 0xe003826f, 0x14292967, 0x0a0e6e70,
  0x27b70a85, 0x46d22ffc, 0x2e1b2138, 0x5c26c926,
  0x4d2c6dfc, 0x5ac42aed, 0x53380d13, 0x9d95b3df,
  0x650a7354, 0x8baf63de, 0x766a0abb, 0x3c77b2a8,
  0x81c2c92e, 0x47edaee6, 0x92722c85, 0x1482353b,
  0xa2bfe8a1, 0x4cf10364, 0xa81a664b, 0xbc423001,
  0xc24b8b70, 0xd0f89791, 0xc76c51a3, 0x0654be30,
  0xd192e819, 0xd6ef5218, 0xd6990624, 0x5565a910,
  0xf40e3585, 0x5771202a, 0x106aa070, 0x32bbd1b8,
  0x19a4c116, 0xb8d2d0c8, 0x1e376c08, 0x5141ab53,
  0x2748774c, 0xdf8eeb99, 0x34b0bcb5, 0xe19b48a8,
  0x391c0cb3, 0xc5c95a63, 0x4ed8aa4a, 0xe3418acb,
  0x5b9cca4f, 0x7763e373, 0x682e6ff3, 0xd6b2b8a3,
  0x748f82ee, 0x5defb2fc, 0x78a5636f, 0x43172f60,
  0x84c87814, 0xa1f0ab72, 0x8cc70208, 0x1a6439ec,
  0x90befffa, 0x23631e28, 0xa4506ceb, 0xde82bde9,
  0xbef9a3f7, 0xb2c67915, 0xc67178f2, 0xe372532b,
  0xca273ece, 0xea26619c, 0xd186b8c7, 0x21c0c207,
  0xeada7dd6, 0xcde0eb1e, 0xf57d4f7f, 0xee6ed178,
  0x06f067aa, 0x72176fba, 0x0a637dc5, 0xa2c898a6,
  0x113f9804, 0xbef90dae, 0x1b710b35, 0x131c471b,
  0x28db77f5, 0x23047d84, 0x32caab7b, 0x40c72493,
  0x3c9ebe0a, 0x15c9bebc, 0x431d67c4, 0x9c100d4c,
  0x4cc5d4be, 0xcb3e42b6, 0x597f299c, 0xfc657e2a,
  0x5fcb6fab, 0x3ad6faec, 0x6c44198c, 0x4a475817
]

var W = new Array(160)

function Sha512 () {
  this.init()
  this._w = W

  Hash.call(this, 128, 112)
}

inherits(Sha512, Hash)

Sha512.prototype.init = function () {
  this._ah = 0x6a09e667
  this._bh = 0xbb67ae85
  this._ch = 0x3c6ef372
  this._dh = 0xa54ff53a
  this._eh = 0x510e527f
  this._fh = 0x9b05688c
  this._gh = 0x1f83d9ab
  this._hh = 0x5be0cd19

  this._al = 0xf3bcc908
  this._bl = 0x84caa73b
  this._cl = 0xfe94f82b
  this._dl = 0x5f1d36f1
  this._el = 0xade682d1
  this._fl = 0x2b3e6c1f
  this._gl = 0xfb41bd6b
  this._hl = 0x137e2179

  return this
}

function Ch (x, y, z) {
  return z ^ (x & (y ^ z))
}

function maj (x, y, z) {
  return (x & y) | (z & (x | y))
}

function sigma0 (x, xl) {
  return (x >>> 28 | xl << 4) ^ (xl >>> 2 | x << 30) ^ (xl >>> 7 | x << 25)
}

function sigma1 (x, xl) {
  return (x >>> 14 | xl << 18) ^ (x >>> 18 | xl << 14) ^ (xl >>> 9 | x << 23)
}

function Gamma0 (x, xl) {
  return (x >>> 1 | xl << 31) ^ (x >>> 8 | xl << 24) ^ (x >>> 7)
}

function Gamma0l (x, xl) {
  return (x >>> 1 | xl << 31) ^ (x >>> 8 | xl << 24) ^ (x >>> 7 | xl << 25)
}

function Gamma1 (x, xl) {
  return (x >>> 19 | xl << 13) ^ (xl >>> 29 | x << 3) ^ (x >>> 6)
}

function Gamma1l (x, xl) {
  return (x >>> 19 | xl << 13) ^ (xl >>> 29 | x << 3) ^ (x >>> 6 | xl << 26)
}

function getCarry (a, b) {
  return (a >>> 0) < (b >>> 0) ? 1 : 0
}

Sha512.prototype._update = function (M) {
  var W = this._w

  var ah = this._ah | 0
  var bh = this._bh | 0
  var ch = this._ch | 0
  var dh = this._dh | 0
  var eh = this._eh | 0
  var fh = this._fh | 0
  var gh = this._gh | 0
  var hh = this._hh | 0

  var al = this._al | 0
  var bl = this._bl | 0
  var cl = this._cl | 0
  var dl = this._dl | 0
  var el = this._el | 0
  var fl = this._fl | 0
  var gl = this._gl | 0
  var hl = this._hl | 0

  for (var i = 0; i < 32; i += 2) {
    W[i] = M.readInt32BE(i * 4)
    W[i + 1] = M.readInt32BE(i * 4 + 4)
  }
  for (; i < 160; i += 2) {
    var xh = W[i - 15 * 2]
    var xl = W[i - 15 * 2 + 1]
    var gamma0 = Gamma0(xh, xl)
    var gamma0l = Gamma0l(xl, xh)

    xh = W[i - 2 * 2]
    xl = W[i - 2 * 2 + 1]
    var gamma1 = Gamma1(xh, xl)
    var gamma1l = Gamma1l(xl, xh)

    // W[i] = gamma0 + W[i - 7] + gamma1 + W[i - 16]
    var Wi7h = W[i - 7 * 2]
    var Wi7l = W[i - 7 * 2 + 1]

    var Wi16h = W[i - 16 * 2]
    var Wi16l = W[i - 16 * 2 + 1]

    var Wil = (gamma0l + Wi7l) | 0
    var Wih = (gamma0 + Wi7h + getCarry(Wil, gamma0l)) | 0
    Wil = (Wil + gamma1l) | 0
    Wih = (Wih + gamma1 + getCarry(Wil, gamma1l)) | 0
    Wil = (Wil + Wi16l) | 0
    Wih = (Wih + Wi16h + getCarry(Wil, Wi16l)) | 0

    W[i] = Wih
    W[i + 1] = Wil
  }

  for (var j = 0; j < 160; j += 2) {
    Wih = W[j]
    Wil = W[j + 1]

    var majh = maj(ah, bh, ch)
    var majl = maj(al, bl, cl)

    var sigma0h = sigma0(ah, al)
    var sigma0l = sigma0(al, ah)
    var sigma1h = sigma1(eh, el)
    var sigma1l = sigma1(el, eh)

    // t1 = h + sigma1 + ch + K[j] + W[j]
    var Kih = K[j]
    var Kil = K[j + 1]

    var chh = Ch(eh, fh, gh)
    var chl = Ch(el, fl, gl)

    var t1l = (hl + sigma1l) | 0
    var t1h = (hh + sigma1h + getCarry(t1l, hl)) | 0
    t1l = (t1l + chl) | 0
    t1h = (t1h + chh + getCarry(t1l, chl)) | 0
    t1l = (t1l + Kil) | 0
    t1h = (t1h + Kih + getCarry(t1l, Kil)) | 0
    t1l = (t1l + Wil) | 0
    t1h = (t1h + Wih + getCarry(t1l, Wil)) | 0

    // t2 = sigma0 + maj
    var t2l = (sigma0l + majl) | 0
    var t2h = (sigma0h + majh + getCarry(t2l, sigma0l)) | 0

    hh = gh
    hl = gl
    gh = fh
    gl = fl
    fh = eh
    fl = el
    el = (dl + t1l) | 0
    eh = (dh + t1h + getCarry(el, dl)) | 0
    dh = ch
    dl = cl
    ch = bh
    cl = bl
    bh = ah
    bl = al
    al = (t1l + t2l) | 0
    ah = (t1h + t2h + getCarry(al, t1l)) | 0
  }

  this._al = (this._al + al) | 0
  this._bl = (this._bl + bl) | 0
  this._cl = (this._cl + cl) | 0
  this._dl = (this._dl + dl) | 0
  this._el = (this._el + el) | 0
  this._fl = (this._fl + fl) | 0
  this._gl = (this._gl + gl) | 0
  this._hl = (this._hl + hl) | 0

  this._ah = (this._ah + ah + getCarry(this._al, al)) | 0
  this._bh = (this._bh + bh + getCarry(this._bl, bl)) | 0
  this._ch = (this._ch + ch + getCarry(this._cl, cl)) | 0
  this._dh = (this._dh + dh + getCarry(this._dl, dl)) | 0
  this._eh = (this._eh + eh + getCarry(this._el, el)) | 0
  this._fh = (this._fh + fh + getCarry(this._fl, fl)) | 0
  this._gh = (this._gh + gh + getCarry(this._gl, gl)) | 0
  this._hh = (this._hh + hh + getCarry(this._hl, hl)) | 0
}

Sha512.prototype._hash = function () {
  var H = Buffer.allocUnsafe(64)

  function writeInt64BE (h, l, offset) {
    H.writeInt32BE(h, offset)
    H.writeInt32BE(l, offset + 4)
  }

  writeInt64BE(this._ah, this._al, 0)
  writeInt64BE(this._bh, this._bl, 8)
  writeInt64BE(this._ch, this._cl, 16)
  writeInt64BE(this._dh, this._dl, 24)
  writeInt64BE(this._eh, this._el, 32)
  writeInt64BE(this._fh, this._fl, 40)
  writeInt64BE(this._gh, this._gl, 48)
  writeInt64BE(this._hh, this._hl, 56)

  return H
}

module.exports = Sha512

},{"./hash":16,"inherits":12,"safe-buffer":15}],24:[function(require,module,exports){
(function (global,Buffer){

/*
  This script uses version bytes as described in SLIP-132
  https://github.com/satoshilabs/slips/blob/master/slip-0132.md
*/
var b58 = require('bs58grscheck');

const prefixes = new Map(
  [
    ['xpub', '0488b21e'],
    ['ypub', '049d7cb2'],
    ['Ypub', '0295b43f'],
    ['zpub', '04b24746'],
    ['Zpub', '02aa7ed3'],
    ['tpub', '043587cf'],
    ['upub', '044a5262'],
    ['Upub', '024289ef'],
    ['vpub', '045f1cf6'],
    ['Vpub', '02575483'],
  ]
  );

/*
 * This function takes an extended public key (with any version bytes, it doesn't need to be an xpub)
 * and converts it to an extended public key formatted with the desired version bytes
 * @param xpub: an extended public key in base58 format. Example: xpub6CpihtY9HVc1jNJWCiXnRbpXm5BgVNKqZMsM4XqpDcQigJr6AHNwaForLZ3kkisDcRoaXSUms6DJNhxFtQGeZfWAQWCZQe1esNetx5Wqe4M
 * @param targetFormat: a string representing the desired prefix; must exist in the "prefixes" mapping defined above. Example: Zpub
*/
global.changeVersionBytes = function(xpub, targetFormat) {
  if (!prefixes.has(targetFormat)) {
    return "Invalid target version";
  }

  // trim whitespace
  xpub = xpub.trim();

  try {
    var data = b58.decode(xpub);
    data = data.slice(4);
    data = Buffer.concat([Buffer.from(prefixes.get(targetFormat),'hex'), data]);
    return b58.encode(data);
  } catch (err) {
    return "Invalid extended public key! Please double check that you didn't accidentally paste extra data.";
  }
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)
},{"bs58grscheck":4,"buffer":27}],25:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  for (var i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(
      uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)
    ))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}

},{}],26:[function(require,module,exports){

},{}],27:[function(require,module,exports){
(function (Buffer){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = { __proto__: Uint8Array.prototype, foo: function () { return 42 } }
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species != null &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  if (ArrayBuffer.isView(value)) {
    return fromArrayLike(value)
  }

  if (value == null) {
    throw TypeError(
      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      'or Array-like Object. Received type ' + (typeof value)
    )
  }

  if (isInstance(value, ArrayBuffer) ||
      (value && isInstance(value.buffer, ArrayBuffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'number') {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    )
  }

  var valueOf = value.valueOf && value.valueOf()
  if (valueOf != null && valueOf !== value) {
    return Buffer.from(valueOf, encodingOrOffset, length)
  }

  var b = fromObject(value)
  if (b) return b

  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
      typeof value[Symbol.toPrimitive] === 'function') {
    return Buffer.from(
      value[Symbol.toPrimitive]('string'), encodingOrOffset, length
    )
  }

  throw new TypeError(
    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
    'or Array-like Object. Received type ' + (typeof value)
  )
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj.length !== undefined) {
    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      return createBuffer(0)
    }
    return fromArrayLike(obj)
  }

  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data)
  }
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true &&
    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
}

Buffer.compare = function compare (a, b) {
  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength)
  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength)
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    )
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (isInstance(buf, Uint8Array)) {
      buf = Buffer.from(buf)
    }
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
      'Received type ' + typeof string
    )
  }

  var len = string.length
  var mustMatch = (arguments.length > 2 && arguments[2] === true)
  if (!mustMatch && len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
        }
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim()
  if (this.length > max) str += ' ... '
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (isInstance(target, Uint8Array)) {
    target = Buffer.from(target, target.offset, target.byteLength)
  }
  if (!Buffer.isBuffer(target)) {
    throw new TypeError(
      'The "target" argument must be one of type Buffer or Uint8Array. ' +
      'Received type ' + (typeof target)
    )
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  var strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
        : (firstByte > 0xBF) ? 2
          : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (var i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : Buffer.from(val, encoding)
    var len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
// the `instanceof` check but they should be treated as of that type.
// See: https://github.com/feross/buffer/issues/166
function isInstance (obj, type) {
  return obj instanceof type ||
    (obj != null && obj.constructor != null && obj.constructor.name != null &&
      obj.constructor.name === type.name)
}
function numberIsNaN (obj) {
  // For IE11 support
  return obj !== obj // eslint-disable-line no-self-compare
}

}).call(this,require("buffer").Buffer)
},{"base64-js":25,"buffer":27,"ieee754":30}],28:[function(require,module,exports){
(function (Buffer){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.

function isArray(arg) {
  if (Array.isArray) {
    return Array.isArray(arg);
  }
  return objectToString(arg) === '[object Array]';
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = Buffer.isBuffer;

function objectToString(o) {
  return Object.prototype.toString.call(o);
}

}).call(this,{"isBuffer":require("../../is-buffer/index.js")})
},{"../../is-buffer/index.js":32}],29:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var objectCreate = Object.create || objectCreatePolyfill
var objectKeys = Object.keys || objectKeysPolyfill
var bind = Function.prototype.bind || functionBindPolyfill

function EventEmitter() {
  if (!this._events || !Object.prototype.hasOwnProperty.call(this, '_events')) {
    this._events = objectCreate(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

var hasDefineProperty;
try {
  var o = {};
  if (Object.defineProperty) Object.defineProperty(o, 'x', { value: 0 });
  hasDefineProperty = o.x === 0;
} catch (err) { hasDefineProperty = false }
if (hasDefineProperty) {
  Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
    enumerable: true,
    get: function() {
      return defaultMaxListeners;
    },
    set: function(arg) {
      // check whether the input is a positive number (whose value is zero or
      // greater and not a NaN).
      if (typeof arg !== 'number' || arg < 0 || arg !== arg)
        throw new TypeError('"defaultMaxListeners" must be a positive number');
      defaultMaxListeners = arg;
    }
  });
} else {
  EventEmitter.defaultMaxListeners = defaultMaxListeners;
}

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || isNaN(n))
    throw new TypeError('"n" argument must be a positive number');
  this._maxListeners = n;
  return this;
};

function $getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return $getMaxListeners(this);
};

// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.
function emitNone(handler, isFn, self) {
  if (isFn)
    handler.call(self);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self);
  }
}
function emitOne(handler, isFn, self, arg1) {
  if (isFn)
    handler.call(self, arg1);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1);
  }
}
function emitTwo(handler, isFn, self, arg1, arg2) {
  if (isFn)
    handler.call(self, arg1, arg2);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2);
  }
}
function emitThree(handler, isFn, self, arg1, arg2, arg3) {
  if (isFn)
    handler.call(self, arg1, arg2, arg3);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2, arg3);
  }
}

function emitMany(handler, isFn, self, args) {
  if (isFn)
    handler.apply(self, args);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].apply(self, args);
  }
}

EventEmitter.prototype.emit = function emit(type) {
  var er, handler, len, args, i, events;
  var doError = (type === 'error');

  events = this._events;
  if (events)
    doError = (doError && events.error == null);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    if (arguments.length > 1)
      er = arguments[1];
    if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      // At least give some kind of context to the user
      var err = new Error('Unhandled "error" event. (' + er + ')');
      err.context = er;
      throw err;
    }
    return false;
  }

  handler = events[type];

  if (!handler)
    return false;

  var isFn = typeof handler === 'function';
  len = arguments.length;
  switch (len) {
      // fast cases
    case 1:
      emitNone(handler, isFn, this);
      break;
    case 2:
      emitOne(handler, isFn, this, arguments[1]);
      break;
    case 3:
      emitTwo(handler, isFn, this, arguments[1], arguments[2]);
      break;
    case 4:
      emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
      break;
      // slower
    default:
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];
      emitMany(handler, isFn, this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');

  events = target._events;
  if (!events) {
    events = target._events = objectCreate(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener) {
      target.emit('newListener', type,
          listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (!existing) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
          prepend ? [listener, existing] : [existing, listener];
    } else {
      // If we've already got an array, just append.
      if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }
    }

    // Check for listener leak
    if (!existing.warned) {
      m = $getMaxListeners(target);
      if (m && m > 0 && existing.length > m) {
        existing.warned = true;
        var w = new Error('Possible EventEmitter memory leak detected. ' +
            existing.length + ' "' + String(type) + '" listeners ' +
            'added. Use emitter.setMaxListeners() to ' +
            'increase limit.');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        if (typeof console === 'object' && console.warn) {
          console.warn('%s: %s', w.name, w.message);
        }
      }
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    switch (arguments.length) {
      case 0:
        return this.listener.call(this.target);
      case 1:
        return this.listener.call(this.target, arguments[0]);
      case 2:
        return this.listener.call(this.target, arguments[0], arguments[1]);
      case 3:
        return this.listener.call(this.target, arguments[0], arguments[1],
            arguments[2]);
      default:
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; ++i)
          args[i] = arguments[i];
        this.listener.apply(this.target, args);
    }
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = bind.call(onceWrapper, state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');

      events = this._events;
      if (!events)
        return this;

      list = events[type];
      if (!list)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = objectCreate(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else
          spliceOne(list, position);

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (!events)
        return this;

      // not listening for removeListener, no need to emit
      if (!events.removeListener) {
        if (arguments.length === 0) {
          this._events = objectCreate(null);
          this._eventsCount = 0;
        } else if (events[type]) {
          if (--this._eventsCount === 0)
            this._events = objectCreate(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = objectKeys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = objectCreate(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (!events)
    return [];

  var evlistener = events[type];
  if (!evlistener)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ? unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};

// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
  for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
    list[i] = list[k];
  list.pop();
}

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function objectCreatePolyfill(proto) {
  var F = function() {};
  F.prototype = proto;
  return new F;
}
function objectKeysPolyfill(obj) {
  var keys = [];
  for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) {
    keys.push(k);
  }
  return k;
}
function functionBindPolyfill(context) {
  var fn = this;
  return function () {
    return fn.apply(context, arguments);
  };
}

},{}],30:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],31:[function(require,module,exports){
arguments[4][12][0].apply(exports,arguments)
},{"dup":12}],32:[function(require,module,exports){
/*!
 * Determine if an object is a Buffer
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */

// The _isBuffer check is for Safari 5-7 support, because it's missing
// Object.prototype.constructor. Remove this eventually
module.exports = function (obj) {
  return obj != null && (isBuffer(obj) || isSlowBuffer(obj) || !!obj._isBuffer)
}

function isBuffer (obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

// For Node v0.10 support. Remove this eventually.
function isSlowBuffer (obj) {
  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isBuffer(obj.slice(0, 0))
}

},{}],33:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],34:[function(require,module,exports){
(function (process){
'use strict';

if (!process.version ||
    process.version.indexOf('v0.') === 0 ||
    process.version.indexOf('v1.') === 0 && process.version.indexOf('v1.8.') !== 0) {
  module.exports = { nextTick: nextTick };
} else {
  module.exports = process
}

function nextTick(fn, arg1, arg2, arg3) {
  if (typeof fn !== 'function') {
    throw new TypeError('"callback" argument must be a function');
  }
  var len = arguments.length;
  var args, i;
  switch (len) {
  case 0:
  case 1:
    return process.nextTick(fn);
  case 2:
    return process.nextTick(function afterTickOne() {
      fn.call(null, arg1);
    });
  case 3:
    return process.nextTick(function afterTickTwo() {
      fn.call(null, arg1, arg2);
    });
  case 4:
    return process.nextTick(function afterTickThree() {
      fn.call(null, arg1, arg2, arg3);
    });
  default:
    args = new Array(len - 1);
    i = 0;
    while (i < args.length) {
      args[i++] = arguments[i];
    }
    return process.nextTick(function afterTick() {
      fn.apply(null, args);
    });
  }
}


}).call(this,require('_process'))
},{"_process":35}],35:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],36:[function(require,module,exports){
module.exports = require('./lib/_stream_duplex.js');

},{"./lib/_stream_duplex.js":37}],37:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a duplex stream is just a stream that is both readable and writable.
// Since JS doesn't have multiple prototypal inheritance, this class
// prototypally inherits from Readable, and then parasitically from
// Writable.

'use strict';

/*<replacement>*/

var pna = require('process-nextick-args');
/*</replacement>*/

/*<replacement>*/
var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    keys.push(key);
  }return keys;
};
/*</replacement>*/

module.exports = Duplex;

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var Readable = require('./_stream_readable');
var Writable = require('./_stream_writable');

util.inherits(Duplex, Readable);

{
  // avoid scope creep, the keys array can then be collected
  var keys = objectKeys(Writable.prototype);
  for (var v = 0; v < keys.length; v++) {
    var method = keys[v];
    if (!Duplex.prototype[method]) Duplex.prototype[method] = Writable.prototype[method];
  }
}

function Duplex(options) {
  if (!(this instanceof Duplex)) return new Duplex(options);

  Readable.call(this, options);
  Writable.call(this, options);

  if (options && options.readable === false) this.readable = false;

  if (options && options.writable === false) this.writable = false;

  this.allowHalfOpen = true;
  if (options && options.allowHalfOpen === false) this.allowHalfOpen = false;

  this.once('end', onend);
}

Object.defineProperty(Duplex.prototype, 'writableHighWaterMark', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function () {
    return this._writableState.highWaterMark;
  }
});

// the no-half-open enforcer
function onend() {
  // if we allow half-open state, or if the writable side ended,
  // then we're ok.
  if (this.allowHalfOpen || this._writableState.ended) return;

  // no more data can be written.
  // But allow more writes to happen in this tick.
  pna.nextTick(onEndNT, this);
}

function onEndNT(self) {
  self.end();
}

Object.defineProperty(Duplex.prototype, 'destroyed', {
  get: function () {
    if (this._readableState === undefined || this._writableState === undefined) {
      return false;
    }
    return this._readableState.destroyed && this._writableState.destroyed;
  },
  set: function (value) {
    // we ignore the value if the stream
    // has not been initialized yet
    if (this._readableState === undefined || this._writableState === undefined) {
      return;
    }

    // backward compatibility, the user is explicitly
    // managing destroyed
    this._readableState.destroyed = value;
    this._writableState.destroyed = value;
  }
});

Duplex.prototype._destroy = function (err, cb) {
  this.push(null);
  this.end();

  pna.nextTick(cb, err);
};
},{"./_stream_readable":39,"./_stream_writable":41,"core-util-is":28,"inherits":31,"process-nextick-args":34}],38:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a passthrough stream.
// basically just the most minimal sort of Transform stream.
// Every written chunk gets output as-is.

'use strict';

module.exports = PassThrough;

var Transform = require('./_stream_transform');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(PassThrough, Transform);

function PassThrough(options) {
  if (!(this instanceof PassThrough)) return new PassThrough(options);

  Transform.call(this, options);
}

PassThrough.prototype._transform = function (chunk, encoding, cb) {
  cb(null, chunk);
};
},{"./_stream_transform":40,"core-util-is":28,"inherits":31}],39:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

/*<replacement>*/

var pna = require('process-nextick-args');
/*</replacement>*/

module.exports = Readable;

/*<replacement>*/
var isArray = require('isarray');
/*</replacement>*/

/*<replacement>*/
var Duplex;
/*</replacement>*/

Readable.ReadableState = ReadableState;

/*<replacement>*/
var EE = require('events').EventEmitter;

var EElistenerCount = function (emitter, type) {
  return emitter.listeners(type).length;
};
/*</replacement>*/

/*<replacement>*/
var Stream = require('./internal/streams/stream');
/*</replacement>*/

/*<replacement>*/

var Buffer = require('safe-buffer').Buffer;
var OurUint8Array = global.Uint8Array || function () {};
function _uint8ArrayToBuffer(chunk) {
  return Buffer.from(chunk);
}
function _isUint8Array(obj) {
  return Buffer.isBuffer(obj) || obj instanceof OurUint8Array;
}

/*</replacement>*/

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

/*<replacement>*/
var debugUtil = require('util');
var debug = void 0;
if (debugUtil && debugUtil.debuglog) {
  debug = debugUtil.debuglog('stream');
} else {
  debug = function () {};
}
/*</replacement>*/

var BufferList = require('./internal/streams/BufferList');
var destroyImpl = require('./internal/streams/destroy');
var StringDecoder;

util.inherits(Readable, Stream);

var kProxyEvents = ['error', 'close', 'destroy', 'pause', 'resume'];

function prependListener(emitter, event, fn) {
  // Sadly this is not cacheable as some libraries bundle their own
  // event emitter implementation with them.
  if (typeof emitter.prependListener === 'function') return emitter.prependListener(event, fn);

  // This is a hack to make sure that our error handler is attached before any
  // userland ones.  NEVER DO THIS. This is here only because this code needs
  // to continue to work with older versions of Node.js that do not include
  // the prependListener() method. The goal is to eventually remove this hack.
  if (!emitter._events || !emitter._events[event]) emitter.on(event, fn);else if (isArray(emitter._events[event])) emitter._events[event].unshift(fn);else emitter._events[event] = [fn, emitter._events[event]];
}

function ReadableState(options, stream) {
  Duplex = Duplex || require('./_stream_duplex');

  options = options || {};

  // Duplex streams are both readable and writable, but share
  // the same options object.
  // However, some cases require setting options to different
  // values for the readable and the writable sides of the duplex stream.
  // These options can be provided separately as readableXXX and writableXXX.
  var isDuplex = stream instanceof Duplex;

  // object stream flag. Used to make read(n) ignore n and to
  // make all the buffer merging and length checks go away
  this.objectMode = !!options.objectMode;

  if (isDuplex) this.objectMode = this.objectMode || !!options.readableObjectMode;

  // the point at which it stops calling _read() to fill the buffer
  // Note: 0 is a valid value, means "don't call _read preemptively ever"
  var hwm = options.highWaterMark;
  var readableHwm = options.readableHighWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;

  if (hwm || hwm === 0) this.highWaterMark = hwm;else if (isDuplex && (readableHwm || readableHwm === 0)) this.highWaterMark = readableHwm;else this.highWaterMark = defaultHwm;

  // cast to ints.
  this.highWaterMark = Math.floor(this.highWaterMark);

  // A linked list is used to store data chunks instead of an array because the
  // linked list can remove elements from the beginning faster than
  // array.shift()
  this.buffer = new BufferList();
  this.length = 0;
  this.pipes = null;
  this.pipesCount = 0;
  this.flowing = null;
  this.ended = false;
  this.endEmitted = false;
  this.reading = false;

  // a flag to be able to tell if the event 'readable'/'data' is emitted
  // immediately, or on a later tick.  We set this to true at first, because
  // any actions that shouldn't happen until "later" should generally also
  // not happen before the first read call.
  this.sync = true;

  // whenever we return null, then we set a flag to say
  // that we're awaiting a 'readable' event emission.
  this.needReadable = false;
  this.emittedReadable = false;
  this.readableListening = false;
  this.resumeScheduled = false;

  // has it been destroyed
  this.destroyed = false;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // the number of writers that are awaiting a drain event in .pipe()s
  this.awaitDrain = 0;

  // if true, a maybeReadMore has been scheduled
  this.readingMore = false;

  this.decoder = null;
  this.encoding = null;
  if (options.encoding) {
    if (!StringDecoder) StringDecoder = require('string_decoder/').StringDecoder;
    this.decoder = new StringDecoder(options.encoding);
    this.encoding = options.encoding;
  }
}

function Readable(options) {
  Duplex = Duplex || require('./_stream_duplex');

  if (!(this instanceof Readable)) return new Readable(options);

  this._readableState = new ReadableState(options, this);

  // legacy
  this.readable = true;

  if (options) {
    if (typeof options.read === 'function') this._read = options.read;

    if (typeof options.destroy === 'function') this._destroy = options.destroy;
  }

  Stream.call(this);
}

Object.defineProperty(Readable.prototype, 'destroyed', {
  get: function () {
    if (this._readableState === undefined) {
      return false;
    }
    return this._readableState.destroyed;
  },
  set: function (value) {
    // we ignore the value if the stream
    // has not been initialized yet
    if (!this._readableState) {
      return;
    }

    // backward compatibility, the user is explicitly
    // managing destroyed
    this._readableState.destroyed = value;
  }
});

Readable.prototype.destroy = destroyImpl.destroy;
Readable.prototype._undestroy = destroyImpl.undestroy;
Readable.prototype._destroy = function (err, cb) {
  this.push(null);
  cb(err);
};

// Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more.
Readable.prototype.push = function (chunk, encoding) {
  var state = this._readableState;
  var skipChunkCheck;

  if (!state.objectMode) {
    if (typeof chunk === 'string') {
      encoding = encoding || state.defaultEncoding;
      if (encoding !== state.encoding) {
        chunk = Buffer.from(chunk, encoding);
        encoding = '';
      }
      skipChunkCheck = true;
    }
  } else {
    skipChunkCheck = true;
  }

  return readableAddChunk(this, chunk, encoding, false, skipChunkCheck);
};

// Unshift should *always* be something directly out of read()
Readable.prototype.unshift = function (chunk) {
  return readableAddChunk(this, chunk, null, true, false);
};

function readableAddChunk(stream, chunk, encoding, addToFront, skipChunkCheck) {
  var state = stream._readableState;
  if (chunk === null) {
    state.reading = false;
    onEofChunk(stream, state);
  } else {
    var er;
    if (!skipChunkCheck) er = chunkInvalid(state, chunk);
    if (er) {
      stream.emit('error', er);
    } else if (state.objectMode || chunk && chunk.length > 0) {
      if (typeof chunk !== 'string' && !state.objectMode && Object.getPrototypeOf(chunk) !== Buffer.prototype) {
        chunk = _uint8ArrayToBuffer(chunk);
      }

      if (addToFront) {
        if (state.endEmitted) stream.emit('error', new Error('stream.unshift() after end event'));else addChunk(stream, state, chunk, true);
      } else if (state.ended) {
        stream.emit('error', new Error('stream.push() after EOF'));
      } else {
        state.reading = false;
        if (state.decoder && !encoding) {
          chunk = state.decoder.write(chunk);
          if (state.objectMode || chunk.length !== 0) addChunk(stream, state, chunk, false);else maybeReadMore(stream, state);
        } else {
          addChunk(stream, state, chunk, false);
        }
      }
    } else if (!addToFront) {
      state.reading = false;
    }
  }

  return needMoreData(state);
}

function addChunk(stream, state, chunk, addToFront) {
  if (state.flowing && state.length === 0 && !state.sync) {
    stream.emit('data', chunk);
    stream.read(0);
  } else {
    // update the buffer info.
    state.length += state.objectMode ? 1 : chunk.length;
    if (addToFront) state.buffer.unshift(chunk);else state.buffer.push(chunk);

    if (state.needReadable) emitReadable(stream);
  }
  maybeReadMore(stream, state);
}

function chunkInvalid(state, chunk) {
  var er;
  if (!_isUint8Array(chunk) && typeof chunk !== 'string' && chunk !== undefined && !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  return er;
}

// if it's past the high water mark, we can push in some more.
// Also, if we have no data yet, we can stand some
// more bytes.  This is to work around cases where hwm=0,
// such as the repl.  Also, if the push() triggered a
// readable event, and the user called read(largeNumber) such that
// needReadable was set, then we ought to push more, so that another
// 'readable' event will be triggered.
function needMoreData(state) {
  return !state.ended && (state.needReadable || state.length < state.highWaterMark || state.length === 0);
}

Readable.prototype.isPaused = function () {
  return this._readableState.flowing === false;
};

// backwards compatibility.
Readable.prototype.setEncoding = function (enc) {
  if (!StringDecoder) StringDecoder = require('string_decoder/').StringDecoder;
  this._readableState.decoder = new StringDecoder(enc);
  this._readableState.encoding = enc;
  return this;
};

// Don't raise the hwm > 8MB
var MAX_HWM = 0x800000;
function computeNewHighWaterMark(n) {
  if (n >= MAX_HWM) {
    n = MAX_HWM;
  } else {
    // Get the next highest power of 2 to prevent increasing hwm excessively in
    // tiny amounts
    n--;
    n |= n >>> 1;
    n |= n >>> 2;
    n |= n >>> 4;
    n |= n >>> 8;
    n |= n >>> 16;
    n++;
  }
  return n;
}

// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function howMuchToRead(n, state) {
  if (n <= 0 || state.length === 0 && state.ended) return 0;
  if (state.objectMode) return 1;
  if (n !== n) {
    // Only flow one buffer at a time
    if (state.flowing && state.length) return state.buffer.head.data.length;else return state.length;
  }
  // If we're asking for more than the current hwm, then raise the hwm.
  if (n > state.highWaterMark) state.highWaterMark = computeNewHighWaterMark(n);
  if (n <= state.length) return n;
  // Don't have enough
  if (!state.ended) {
    state.needReadable = true;
    return 0;
  }
  return state.length;
}

// you can override either this method, or the async _read(n) below.
Readable.prototype.read = function (n) {
  debug('read', n);
  n = parseInt(n, 10);
  var state = this._readableState;
  var nOrig = n;

  if (n !== 0) state.emittedReadable = false;

  // if we're doing read(0) to trigger a readable event, but we
  // already have a bunch of data in the buffer, then just trigger
  // the 'readable' event and move on.
  if (n === 0 && state.needReadable && (state.length >= state.highWaterMark || state.ended)) {
    debug('read: emitReadable', state.length, state.ended);
    if (state.length === 0 && state.ended) endReadable(this);else emitReadable(this);
    return null;
  }

  n = howMuchToRead(n, state);

  // if we've ended, and we're now clear, then finish it up.
  if (n === 0 && state.ended) {
    if (state.length === 0) endReadable(this);
    return null;
  }

  // All the actual chunk generation logic needs to be
  // *below* the call to _read.  The reason is that in certain
  // synthetic stream cases, such as passthrough streams, _read
  // may be a completely synchronous operation which may change
  // the state of the read buffer, providing enough data when
  // before there was *not* enough.
  //
  // So, the steps are:
  // 1. Figure out what the state of things will be after we do
  // a read from the buffer.
  //
  // 2. If that resulting state will trigger a _read, then call _read.
  // Note that this may be asynchronous, or synchronous.  Yes, it is
  // deeply ugly to write APIs this way, but that still doesn't mean
  // that the Readable class should behave improperly, as streams are
  // designed to be sync/async agnostic.
  // Take note if the _read call is sync or async (ie, if the read call
  // has returned yet), so that we know whether or not it's safe to emit
  // 'readable' etc.
  //
  // 3. Actually pull the requested chunks out of the buffer and return.

  // if we need a readable event, then we need to do some reading.
  var doRead = state.needReadable;
  debug('need readable', doRead);

  // if we currently have less than the highWaterMark, then also read some
  if (state.length === 0 || state.length - n < state.highWaterMark) {
    doRead = true;
    debug('length less than watermark', doRead);
  }

  // however, if we've ended, then there's no point, and if we're already
  // reading, then it's unnecessary.
  if (state.ended || state.reading) {
    doRead = false;
    debug('reading or ended', doRead);
  } else if (doRead) {
    debug('do read');
    state.reading = true;
    state.sync = true;
    // if the length is currently zero, then we *need* a readable event.
    if (state.length === 0) state.needReadable = true;
    // call internal read method
    this._read(state.highWaterMark);
    state.sync = false;
    // If _read pushed data synchronously, then `reading` will be false,
    // and we need to re-evaluate how much data we can return to the user.
    if (!state.reading) n = howMuchToRead(nOrig, state);
  }

  var ret;
  if (n > 0) ret = fromList(n, state);else ret = null;

  if (ret === null) {
    state.needReadable = true;
    n = 0;
  } else {
    state.length -= n;
  }

  if (state.length === 0) {
    // If we have nothing in the buffer, then we want to know
    // as soon as we *do* get something into the buffer.
    if (!state.ended) state.needReadable = true;

    // If we tried to read() past the EOF, then emit end on the next tick.
    if (nOrig !== n && state.ended) endReadable(this);
  }

  if (ret !== null) this.emit('data', ret);

  return ret;
};

function onEofChunk(stream, state) {
  if (state.ended) return;
  if (state.decoder) {
    var chunk = state.decoder.end();
    if (chunk && chunk.length) {
      state.buffer.push(chunk);
      state.length += state.objectMode ? 1 : chunk.length;
    }
  }
  state.ended = true;

  // emit 'readable' now to make sure it gets picked up.
  emitReadable(stream);
}

// Don't emit readable right away in sync mode, because this can trigger
// another read() call => stack overflow.  This way, it might trigger
// a nextTick recursion warning, but that's not so bad.
function emitReadable(stream) {
  var state = stream._readableState;
  state.needReadable = false;
  if (!state.emittedReadable) {
    debug('emitReadable', state.flowing);
    state.emittedReadable = true;
    if (state.sync) pna.nextTick(emitReadable_, stream);else emitReadable_(stream);
  }
}

function emitReadable_(stream) {
  debug('emit readable');
  stream.emit('readable');
  flow(stream);
}

// at this point, the user has presumably seen the 'readable' event,
// and called read() to consume some data.  that may have triggered
// in turn another _read(n) call, in which case reading = true if
// it's in progress.
// However, if we're not ended, or reading, and the length < hwm,
// then go ahead and try to read some more preemptively.
function maybeReadMore(stream, state) {
  if (!state.readingMore) {
    state.readingMore = true;
    pna.nextTick(maybeReadMore_, stream, state);
  }
}

function maybeReadMore_(stream, state) {
  var len = state.length;
  while (!state.reading && !state.flowing && !state.ended && state.length < state.highWaterMark) {
    debug('maybeReadMore read 0');
    stream.read(0);
    if (len === state.length)
      // didn't get any data, stop spinning.
      break;else len = state.length;
  }
  state.readingMore = false;
}

// abstract method.  to be overridden in specific implementation classes.
// call cb(er, data) where data is <= n in length.
// for virtual (non-string, non-buffer) streams, "length" is somewhat
// arbitrary, and perhaps not very meaningful.
Readable.prototype._read = function (n) {
  this.emit('error', new Error('_read() is not implemented'));
};

Readable.prototype.pipe = function (dest, pipeOpts) {
  var src = this;
  var state = this._readableState;

  switch (state.pipesCount) {
    case 0:
      state.pipes = dest;
      break;
    case 1:
      state.pipes = [state.pipes, dest];
      break;
    default:
      state.pipes.push(dest);
      break;
  }
  state.pipesCount += 1;
  debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);

  var doEnd = (!pipeOpts || pipeOpts.end !== false) && dest !== process.stdout && dest !== process.stderr;

  var endFn = doEnd ? onend : unpipe;
  if (state.endEmitted) pna.nextTick(endFn);else src.once('end', endFn);

  dest.on('unpipe', onunpipe);
  function onunpipe(readable, unpipeInfo) {
    debug('onunpipe');
    if (readable === src) {
      if (unpipeInfo && unpipeInfo.hasUnpiped === false) {
        unpipeInfo.hasUnpiped = true;
        cleanup();
      }
    }
  }

  function onend() {
    debug('onend');
    dest.end();
  }

  // when the dest drains, it reduces the awaitDrain counter
  // on the source.  This would be more elegant with a .once()
  // handler in flow(), but adding and removing repeatedly is
  // too slow.
  var ondrain = pipeOnDrain(src);
  dest.on('drain', ondrain);

  var cleanedUp = false;
  function cleanup() {
    debug('cleanup');
    // cleanup event handlers once the pipe is broken
    dest.removeListener('close', onclose);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', unpipe);
    src.removeListener('data', ondata);

    cleanedUp = true;

    // if the reader is waiting for a drain event from this
    // specific writer, then it would cause it to never start
    // flowing again.
    // So, if this is awaiting a drain, then we just call it now.
    // If we don't know, then assume that we are waiting for one.
    if (state.awaitDrain && (!dest._writableState || dest._writableState.needDrain)) ondrain();
  }

  // If the user pushes more data while we're writing to dest then we'll end up
  // in ondata again. However, we only want to increase awaitDrain once because
  // dest will only emit one 'drain' event for the multiple writes.
  // => Introduce a guard on increasing awaitDrain.
  var increasedAwaitDrain = false;
  src.on('data', ondata);
  function ondata(chunk) {
    debug('ondata');
    increasedAwaitDrain = false;
    var ret = dest.write(chunk);
    if (false === ret && !increasedAwaitDrain) {
      // If the user unpiped during `dest.write()`, it is possible
      // to get stuck in a permanently paused state if that write
      // also returned false.
      // => Check whether `dest` is still a piping destination.
      if ((state.pipesCount === 1 && state.pipes === dest || state.pipesCount > 1 && indexOf(state.pipes, dest) !== -1) && !cleanedUp) {
        debug('false write response, pause', src._readableState.awaitDrain);
        src._readableState.awaitDrain++;
        increasedAwaitDrain = true;
      }
      src.pause();
    }
  }

  // if the dest has an error, then stop piping into it.
  // however, don't suppress the throwing behavior for this.
  function onerror(er) {
    debug('onerror', er);
    unpipe();
    dest.removeListener('error', onerror);
    if (EElistenerCount(dest, 'error') === 0) dest.emit('error', er);
  }

  // Make sure our error handler is attached before userland ones.
  prependListener(dest, 'error', onerror);

  // Both close and finish should trigger unpipe, but only once.
  function onclose() {
    dest.removeListener('finish', onfinish);
    unpipe();
  }
  dest.once('close', onclose);
  function onfinish() {
    debug('onfinish');
    dest.removeListener('close', onclose);
    unpipe();
  }
  dest.once('finish', onfinish);

  function unpipe() {
    debug('unpipe');
    src.unpipe(dest);
  }

  // tell the dest that it's being piped to
  dest.emit('pipe', src);

  // start the flow if it hasn't been started already.
  if (!state.flowing) {
    debug('pipe resume');
    src.resume();
  }

  return dest;
};

function pipeOnDrain(src) {
  return function () {
    var state = src._readableState;
    debug('pipeOnDrain', state.awaitDrain);
    if (state.awaitDrain) state.awaitDrain--;
    if (state.awaitDrain === 0 && EElistenerCount(src, 'data')) {
      state.flowing = true;
      flow(src);
    }
  };
}

Readable.prototype.unpipe = function (dest) {
  var state = this._readableState;
  var unpipeInfo = { hasUnpiped: false };

  // if we're not piping anywhere, then do nothing.
  if (state.pipesCount === 0) return this;

  // just one destination.  most common case.
  if (state.pipesCount === 1) {
    // passed in one, but it's not the right one.
    if (dest && dest !== state.pipes) return this;

    if (!dest) dest = state.pipes;

    // got a match.
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;
    if (dest) dest.emit('unpipe', this, unpipeInfo);
    return this;
  }

  // slow case. multiple pipe destinations.

  if (!dest) {
    // remove all.
    var dests = state.pipes;
    var len = state.pipesCount;
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;

    for (var i = 0; i < len; i++) {
      dests[i].emit('unpipe', this, unpipeInfo);
    }return this;
  }

  // try to find the right one.
  var index = indexOf(state.pipes, dest);
  if (index === -1) return this;

  state.pipes.splice(index, 1);
  state.pipesCount -= 1;
  if (state.pipesCount === 1) state.pipes = state.pipes[0];

  dest.emit('unpipe', this, unpipeInfo);

  return this;
};

// set up data events if they are asked for
// Ensure readable listeners eventually get something
Readable.prototype.on = function (ev, fn) {
  var res = Stream.prototype.on.call(this, ev, fn);

  if (ev === 'data') {
    // Start flowing on next tick if stream isn't explicitly paused
    if (this._readableState.flowing !== false) this.resume();
  } else if (ev === 'readable') {
    var state = this._readableState;
    if (!state.endEmitted && !state.readableListening) {
      state.readableListening = state.needReadable = true;
      state.emittedReadable = false;
      if (!state.reading) {
        pna.nextTick(nReadingNextTick, this);
      } else if (state.length) {
        emitReadable(this);
      }
    }
  }

  return res;
};
Readable.prototype.addListener = Readable.prototype.on;

function nReadingNextTick(self) {
  debug('readable nexttick read 0');
  self.read(0);
}

// pause() and resume() are remnants of the legacy readable stream API
// If the user uses them, then switch into old mode.
Readable.prototype.resume = function () {
  var state = this._readableState;
  if (!state.flowing) {
    debug('resume');
    state.flowing = true;
    resume(this, state);
  }
  return this;
};

function resume(stream, state) {
  if (!state.resumeScheduled) {
    state.resumeScheduled = true;
    pna.nextTick(resume_, stream, state);
  }
}

function resume_(stream, state) {
  if (!state.reading) {
    debug('resume read 0');
    stream.read(0);
  }

  state.resumeScheduled = false;
  state.awaitDrain = 0;
  stream.emit('resume');
  flow(stream);
  if (state.flowing && !state.reading) stream.read(0);
}

Readable.prototype.pause = function () {
  debug('call pause flowing=%j', this._readableState.flowing);
  if (false !== this._readableState.flowing) {
    debug('pause');
    this._readableState.flowing = false;
    this.emit('pause');
  }
  return this;
};

function flow(stream) {
  var state = stream._readableState;
  debug('flow', state.flowing);
  while (state.flowing && stream.read() !== null) {}
}

// wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.
Readable.prototype.wrap = function (stream) {
  var _this = this;

  var state = this._readableState;
  var paused = false;

  stream.on('end', function () {
    debug('wrapped end');
    if (state.decoder && !state.ended) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length) _this.push(chunk);
    }

    _this.push(null);
  });

  stream.on('data', function (chunk) {
    debug('wrapped data');
    if (state.decoder) chunk = state.decoder.write(chunk);

    // don't skip over falsy values in objectMode
    if (state.objectMode && (chunk === null || chunk === undefined)) return;else if (!state.objectMode && (!chunk || !chunk.length)) return;

    var ret = _this.push(chunk);
    if (!ret) {
      paused = true;
      stream.pause();
    }
  });

  // proxy all the other methods.
  // important when wrapping filters and duplexes.
  for (var i in stream) {
    if (this[i] === undefined && typeof stream[i] === 'function') {
      this[i] = function (method) {
        return function () {
          return stream[method].apply(stream, arguments);
        };
      }(i);
    }
  }

  // proxy certain important events.
  for (var n = 0; n < kProxyEvents.length; n++) {
    stream.on(kProxyEvents[n], this.emit.bind(this, kProxyEvents[n]));
  }

  // when we try to consume some more bytes, simply unpause the
  // underlying stream.
  this._read = function (n) {
    debug('wrapped _read', n);
    if (paused) {
      paused = false;
      stream.resume();
    }
  };

  return this;
};

Object.defineProperty(Readable.prototype, 'readableHighWaterMark', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function () {
    return this._readableState.highWaterMark;
  }
});

// exposed for testing purposes only.
Readable._fromList = fromList;

// Pluck off n bytes from an array of buffers.
// Length is the combined lengths of all the buffers in the list.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function fromList(n, state) {
  // nothing buffered
  if (state.length === 0) return null;

  var ret;
  if (state.objectMode) ret = state.buffer.shift();else if (!n || n >= state.length) {
    // read it all, truncate the list
    if (state.decoder) ret = state.buffer.join('');else if (state.buffer.length === 1) ret = state.buffer.head.data;else ret = state.buffer.concat(state.length);
    state.buffer.clear();
  } else {
    // read part of list
    ret = fromListPartial(n, state.buffer, state.decoder);
  }

  return ret;
}

// Extracts only enough buffered data to satisfy the amount requested.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function fromListPartial(n, list, hasStrings) {
  var ret;
  if (n < list.head.data.length) {
    // slice is the same for buffers and strings
    ret = list.head.data.slice(0, n);
    list.head.data = list.head.data.slice(n);
  } else if (n === list.head.data.length) {
    // first chunk is a perfect match
    ret = list.shift();
  } else {
    // result spans more than one buffer
    ret = hasStrings ? copyFromBufferString(n, list) : copyFromBuffer(n, list);
  }
  return ret;
}

// Copies a specified amount of characters from the list of buffered data
// chunks.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function copyFromBufferString(n, list) {
  var p = list.head;
  var c = 1;
  var ret = p.data;
  n -= ret.length;
  while (p = p.next) {
    var str = p.data;
    var nb = n > str.length ? str.length : n;
    if (nb === str.length) ret += str;else ret += str.slice(0, n);
    n -= nb;
    if (n === 0) {
      if (nb === str.length) {
        ++c;
        if (p.next) list.head = p.next;else list.head = list.tail = null;
      } else {
        list.head = p;
        p.data = str.slice(nb);
      }
      break;
    }
    ++c;
  }
  list.length -= c;
  return ret;
}

// Copies a specified amount of bytes from the list of buffered data chunks.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function copyFromBuffer(n, list) {
  var ret = Buffer.allocUnsafe(n);
  var p = list.head;
  var c = 1;
  p.data.copy(ret);
  n -= p.data.length;
  while (p = p.next) {
    var buf = p.data;
    var nb = n > buf.length ? buf.length : n;
    buf.copy(ret, ret.length - n, 0, nb);
    n -= nb;
    if (n === 0) {
      if (nb === buf.length) {
        ++c;
        if (p.next) list.head = p.next;else list.head = list.tail = null;
      } else {
        list.head = p;
        p.data = buf.slice(nb);
      }
      break;
    }
    ++c;
  }
  list.length -= c;
  return ret;
}

function endReadable(stream) {
  var state = stream._readableState;

  // If we get here before consuming all the bytes, then that is a
  // bug in node.  Should never happen.
  if (state.length > 0) throw new Error('"endReadable()" called on non-empty stream');

  if (!state.endEmitted) {
    state.ended = true;
    pna.nextTick(endReadableNT, state, stream);
  }
}

function endReadableNT(state, stream) {
  // Check that we didn't get one last unshift.
  if (!state.endEmitted && state.length === 0) {
    state.endEmitted = true;
    stream.readable = false;
    stream.emit('end');
  }
}

function indexOf(xs, x) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (xs[i] === x) return i;
  }
  return -1;
}
}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./_stream_duplex":37,"./internal/streams/BufferList":42,"./internal/streams/destroy":43,"./internal/streams/stream":44,"_process":35,"core-util-is":28,"events":29,"inherits":31,"isarray":33,"process-nextick-args":34,"safe-buffer":50,"string_decoder/":45,"util":26}],40:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a transform stream is a readable/writable stream where you do
// something with the data.  Sometimes it's called a "filter",
// but that's not a great name for it, since that implies a thing where
// some bits pass through, and others are simply ignored.  (That would
// be a valid example of a transform, of course.)
//
// While the output is causally related to the input, it's not a
// necessarily symmetric or synchronous transformation.  For example,
// a zlib stream might take multiple plain-text writes(), and then
// emit a single compressed chunk some time in the future.
//
// Here's how this works:
//
// The Transform stream has all the aspects of the readable and writable
// stream classes.  When you write(chunk), that calls _write(chunk,cb)
// internally, and returns false if there's a lot of pending writes
// buffered up.  When you call read(), that calls _read(n) until
// there's enough pending readable data buffered up.
//
// In a transform stream, the written data is placed in a buffer.  When
// _read(n) is called, it transforms the queued up data, calling the
// buffered _write cb's as it consumes chunks.  If consuming a single
// written chunk would result in multiple output chunks, then the first
// outputted bit calls the readcb, and subsequent chunks just go into
// the read buffer, and will cause it to emit 'readable' if necessary.
//
// This way, back-pressure is actually determined by the reading side,
// since _read has to be called to start processing a new chunk.  However,
// a pathological inflate type of transform can cause excessive buffering
// here.  For example, imagine a stream where every byte of input is
// interpreted as an integer from 0-255, and then results in that many
// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
// 1kb of data being output.  In this case, you could write a very small
// amount of input, and end up with a very large amount of output.  In
// such a pathological inflating mechanism, there'd be no way to tell
// the system to stop doing the transform.  A single 4MB write could
// cause the system to run out of memory.
//
// However, even in such a pathological case, only a single written chunk
// would be consumed, and then the rest would wait (un-transformed) until
// the results of the previous transformed chunk were consumed.

'use strict';

module.exports = Transform;

var Duplex = require('./_stream_duplex');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(Transform, Duplex);

function afterTransform(er, data) {
  var ts = this._transformState;
  ts.transforming = false;

  var cb = ts.writecb;

  if (!cb) {
    return this.emit('error', new Error('write callback called multiple times'));
  }

  ts.writechunk = null;
  ts.writecb = null;

  if (data != null) // single equals check for both `null` and `undefined`
    this.push(data);

  cb(er);

  var rs = this._readableState;
  rs.reading = false;
  if (rs.needReadable || rs.length < rs.highWaterMark) {
    this._read(rs.highWaterMark);
  }
}

function Transform(options) {
  if (!(this instanceof Transform)) return new Transform(options);

  Duplex.call(this, options);

  this._transformState = {
    afterTransform: afterTransform.bind(this),
    needTransform: false,
    transforming: false,
    writecb: null,
    writechunk: null,
    writeencoding: null
  };

  // start out asking for a readable event once data is transformed.
  this._readableState.needReadable = true;

  // we have implemented the _read method, and done the other things
  // that Readable wants before the first _read call, so unset the
  // sync guard flag.
  this._readableState.sync = false;

  if (options) {
    if (typeof options.transform === 'function') this._transform = options.transform;

    if (typeof options.flush === 'function') this._flush = options.flush;
  }

  // When the writable side finishes, then flush out anything remaining.
  this.on('prefinish', prefinish);
}

function prefinish() {
  var _this = this;

  if (typeof this._flush === 'function') {
    this._flush(function (er, data) {
      done(_this, er, data);
    });
  } else {
    done(this, null, null);
  }
}

Transform.prototype.push = function (chunk, encoding) {
  this._transformState.needTransform = false;
  return Duplex.prototype.push.call(this, chunk, encoding);
};

// This is the part where you do stuff!
// override this function in implementation classes.
// 'chunk' is an input chunk.
//
// Call `push(newChunk)` to pass along transformed output
// to the readable side.  You may call 'push' zero or more times.
//
// Call `cb(err)` when you are done with this chunk.  If you pass
// an error, then that'll put the hurt on the whole operation.  If you
// never call cb(), then you'll never get another chunk.
Transform.prototype._transform = function (chunk, encoding, cb) {
  throw new Error('_transform() is not implemented');
};

Transform.prototype._write = function (chunk, encoding, cb) {
  var ts = this._transformState;
  ts.writecb = cb;
  ts.writechunk = chunk;
  ts.writeencoding = encoding;
  if (!ts.transforming) {
    var rs = this._readableState;
    if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
  }
};

// Doesn't matter what the args are here.
// _transform does all the work.
// That we got here means that the readable side wants more data.
Transform.prototype._read = function (n) {
  var ts = this._transformState;

  if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
    ts.transforming = true;
    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
  } else {
    // mark that we need a transform, so that any data that comes in
    // will get processed, now that we've asked for it.
    ts.needTransform = true;
  }
};

Transform.prototype._destroy = function (err, cb) {
  var _this2 = this;

  Duplex.prototype._destroy.call(this, err, function (err2) {
    cb(err2);
    _this2.emit('close');
  });
};

function done(stream, er, data) {
  if (er) return stream.emit('error', er);

  if (data != null) // single equals check for both `null` and `undefined`
    stream.push(data);

  // if there's nothing in the write buffer, then that means
  // that nothing more will ever be provided
  if (stream._writableState.length) throw new Error('Calling transform done when ws.length != 0');

  if (stream._transformState.transforming) throw new Error('Calling transform done when still transforming');

  return stream.push(null);
}
},{"./_stream_duplex":37,"core-util-is":28,"inherits":31}],41:[function(require,module,exports){
(function (process,global,setImmediate){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// A bit simpler than readable streams.
// Implement an async ._write(chunk, encoding, cb), and it'll handle all
// the drain event emission and buffering.

'use strict';

/*<replacement>*/

var pna = require('process-nextick-args');
/*</replacement>*/

module.exports = Writable;

/* <replacement> */
function WriteReq(chunk, encoding, cb) {
  this.chunk = chunk;
  this.encoding = encoding;
  this.callback = cb;
  this.next = null;
}

// It seems a linked list but it is not
// there will be only 2 of these for each stream
function CorkedRequest(state) {
  var _this = this;

  this.next = null;
  this.entry = null;
  this.finish = function () {
    onCorkedFinish(_this, state);
  };
}
/* </replacement> */

/*<replacement>*/
var asyncWrite = !process.browser && ['v0.10', 'v0.9.'].indexOf(process.version.slice(0, 5)) > -1 ? setImmediate : pna.nextTick;
/*</replacement>*/

/*<replacement>*/
var Duplex;
/*</replacement>*/

Writable.WritableState = WritableState;

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

/*<replacement>*/
var internalUtil = {
  deprecate: require('util-deprecate')
};
/*</replacement>*/

/*<replacement>*/
var Stream = require('./internal/streams/stream');
/*</replacement>*/

/*<replacement>*/

var Buffer = require('safe-buffer').Buffer;
var OurUint8Array = global.Uint8Array || function () {};
function _uint8ArrayToBuffer(chunk) {
  return Buffer.from(chunk);
}
function _isUint8Array(obj) {
  return Buffer.isBuffer(obj) || obj instanceof OurUint8Array;
}

/*</replacement>*/

var destroyImpl = require('./internal/streams/destroy');

util.inherits(Writable, Stream);

function nop() {}

function WritableState(options, stream) {
  Duplex = Duplex || require('./_stream_duplex');

  options = options || {};

  // Duplex streams are both readable and writable, but share
  // the same options object.
  // However, some cases require setting options to different
  // values for the readable and the writable sides of the duplex stream.
  // These options can be provided separately as readableXXX and writableXXX.
  var isDuplex = stream instanceof Duplex;

  // object stream flag to indicate whether or not this stream
  // contains buffers or objects.
  this.objectMode = !!options.objectMode;

  if (isDuplex) this.objectMode = this.objectMode || !!options.writableObjectMode;

  // the point at which write() starts returning false
  // Note: 0 is a valid value, means that we always return false if
  // the entire buffer is not flushed immediately on write()
  var hwm = options.highWaterMark;
  var writableHwm = options.writableHighWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;

  if (hwm || hwm === 0) this.highWaterMark = hwm;else if (isDuplex && (writableHwm || writableHwm === 0)) this.highWaterMark = writableHwm;else this.highWaterMark = defaultHwm;

  // cast to ints.
  this.highWaterMark = Math.floor(this.highWaterMark);

  // if _final has been called
  this.finalCalled = false;

  // drain event flag.
  this.needDrain = false;
  // at the start of calling end()
  this.ending = false;
  // when end() has been called, and returned
  this.ended = false;
  // when 'finish' is emitted
  this.finished = false;

  // has it been destroyed
  this.destroyed = false;

  // should we decode strings into buffers before passing to _write?
  // this is here so that some node-core streams can optimize string
  // handling at a lower level.
  var noDecode = options.decodeStrings === false;
  this.decodeStrings = !noDecode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // not an actual buffer we keep track of, but a measurement
  // of how much we're waiting to get pushed to some underlying
  // socket or file.
  this.length = 0;

  // a flag to see when we're in the middle of a write.
  this.writing = false;

  // when true all writes will be buffered until .uncork() call
  this.corked = 0;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // a flag to know if we're processing previously buffered items, which
  // may call the _write() callback in the same tick, so that we don't
  // end up in an overlapped onwrite situation.
  this.bufferProcessing = false;

  // the callback that's passed to _write(chunk,cb)
  this.onwrite = function (er) {
    onwrite(stream, er);
  };

  // the callback that the user supplies to write(chunk,encoding,cb)
  this.writecb = null;

  // the amount that is being written when _write is called.
  this.writelen = 0;

  this.bufferedRequest = null;
  this.lastBufferedRequest = null;

  // number of pending user-supplied write callbacks
  // this must be 0 before 'finish' can be emitted
  this.pendingcb = 0;

  // emit prefinish if the only thing we're waiting for is _write cbs
  // This is relevant for synchronous Transform streams
  this.prefinished = false;

  // True if the error was already emitted and should not be thrown again
  this.errorEmitted = false;

  // count buffered requests
  this.bufferedRequestCount = 0;

  // allocate the first CorkedRequest, there is always
  // one allocated and free to use, and we maintain at most two
  this.corkedRequestsFree = new CorkedRequest(this);
}

WritableState.prototype.getBuffer = function getBuffer() {
  var current = this.bufferedRequest;
  var out = [];
  while (current) {
    out.push(current);
    current = current.next;
  }
  return out;
};

(function () {
  try {
    Object.defineProperty(WritableState.prototype, 'buffer', {
      get: internalUtil.deprecate(function () {
        return this.getBuffer();
      }, '_writableState.buffer is deprecated. Use _writableState.getBuffer ' + 'instead.', 'DEP0003')
    });
  } catch (_) {}
})();

// Test _writableState for inheritance to account for Duplex streams,
// whose prototype chain only points to Readable.
var realHasInstance;
if (typeof Symbol === 'function' && Symbol.hasInstance && typeof Function.prototype[Symbol.hasInstance] === 'function') {
  realHasInstance = Function.prototype[Symbol.hasInstance];
  Object.defineProperty(Writable, Symbol.hasInstance, {
    value: function (object) {
      if (realHasInstance.call(this, object)) return true;
      if (this !== Writable) return false;

      return object && object._writableState instanceof WritableState;
    }
  });
} else {
  realHasInstance = function (object) {
    return object instanceof this;
  };
}

function Writable(options) {
  Duplex = Duplex || require('./_stream_duplex');

  // Writable ctor is applied to Duplexes, too.
  // `realHasInstance` is necessary because using plain `instanceof`
  // would return false, as no `_writableState` property is attached.

  // Trying to use the custom `instanceof` for Writable here will also break the
  // Node.js LazyTransform implementation, which has a non-trivial getter for
  // `_writableState` that would lead to infinite recursion.
  if (!realHasInstance.call(Writable, this) && !(this instanceof Duplex)) {
    return new Writable(options);
  }

  this._writableState = new WritableState(options, this);

  // legacy.
  this.writable = true;

  if (options) {
    if (typeof options.write === 'function') this._write = options.write;

    if (typeof options.writev === 'function') this._writev = options.writev;

    if (typeof options.destroy === 'function') this._destroy = options.destroy;

    if (typeof options.final === 'function') this._final = options.final;
  }

  Stream.call(this);
}

// Otherwise people can pipe Writable streams, which is just wrong.
Writable.prototype.pipe = function () {
  this.emit('error', new Error('Cannot pipe, not readable'));
};

function writeAfterEnd(stream, cb) {
  var er = new Error('write after end');
  // TODO: defer error events consistently everywhere, not just the cb
  stream.emit('error', er);
  pna.nextTick(cb, er);
}

// Checks that a user-supplied chunk is valid, especially for the particular
// mode the stream is in. Currently this means that `null` is never accepted
// and undefined/non-string values are only allowed in object mode.
function validChunk(stream, state, chunk, cb) {
  var valid = true;
  var er = false;

  if (chunk === null) {
    er = new TypeError('May not write null values to stream');
  } else if (typeof chunk !== 'string' && chunk !== undefined && !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  if (er) {
    stream.emit('error', er);
    pna.nextTick(cb, er);
    valid = false;
  }
  return valid;
}

Writable.prototype.write = function (chunk, encoding, cb) {
  var state = this._writableState;
  var ret = false;
  var isBuf = !state.objectMode && _isUint8Array(chunk);

  if (isBuf && !Buffer.isBuffer(chunk)) {
    chunk = _uint8ArrayToBuffer(chunk);
  }

  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (isBuf) encoding = 'buffer';else if (!encoding) encoding = state.defaultEncoding;

  if (typeof cb !== 'function') cb = nop;

  if (state.ended) writeAfterEnd(this, cb);else if (isBuf || validChunk(this, state, chunk, cb)) {
    state.pendingcb++;
    ret = writeOrBuffer(this, state, isBuf, chunk, encoding, cb);
  }

  return ret;
};

Writable.prototype.cork = function () {
  var state = this._writableState;

  state.corked++;
};

Writable.prototype.uncork = function () {
  var state = this._writableState;

  if (state.corked) {
    state.corked--;

    if (!state.writing && !state.corked && !state.finished && !state.bufferProcessing && state.bufferedRequest) clearBuffer(this, state);
  }
};

Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
  // node::ParseEncoding() requires lower case.
  if (typeof encoding === 'string') encoding = encoding.toLowerCase();
  if (!(['hex', 'utf8', 'utf-8', 'ascii', 'binary', 'base64', 'ucs2', 'ucs-2', 'utf16le', 'utf-16le', 'raw'].indexOf((encoding + '').toLowerCase()) > -1)) throw new TypeError('Unknown encoding: ' + encoding);
  this._writableState.defaultEncoding = encoding;
  return this;
};

function decodeChunk(state, chunk, encoding) {
  if (!state.objectMode && state.decodeStrings !== false && typeof chunk === 'string') {
    chunk = Buffer.from(chunk, encoding);
  }
  return chunk;
}

Object.defineProperty(Writable.prototype, 'writableHighWaterMark', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function () {
    return this._writableState.highWaterMark;
  }
});

// if we're already writing something, then just put this
// in the queue, and wait our turn.  Otherwise, call _write
// If we return false, then we need a drain event, so set that flag.
function writeOrBuffer(stream, state, isBuf, chunk, encoding, cb) {
  if (!isBuf) {
    var newChunk = decodeChunk(state, chunk, encoding);
    if (chunk !== newChunk) {
      isBuf = true;
      encoding = 'buffer';
      chunk = newChunk;
    }
  }
  var len = state.objectMode ? 1 : chunk.length;

  state.length += len;

  var ret = state.length < state.highWaterMark;
  // we must ensure that previous needDrain will not be reset to false.
  if (!ret) state.needDrain = true;

  if (state.writing || state.corked) {
    var last = state.lastBufferedRequest;
    state.lastBufferedRequest = {
      chunk: chunk,
      encoding: encoding,
      isBuf: isBuf,
      callback: cb,
      next: null
    };
    if (last) {
      last.next = state.lastBufferedRequest;
    } else {
      state.bufferedRequest = state.lastBufferedRequest;
    }
    state.bufferedRequestCount += 1;
  } else {
    doWrite(stream, state, false, len, chunk, encoding, cb);
  }

  return ret;
}

function doWrite(stream, state, writev, len, chunk, encoding, cb) {
  state.writelen = len;
  state.writecb = cb;
  state.writing = true;
  state.sync = true;
  if (writev) stream._writev(chunk, state.onwrite);else stream._write(chunk, encoding, state.onwrite);
  state.sync = false;
}

function onwriteError(stream, state, sync, er, cb) {
  --state.pendingcb;

  if (sync) {
    // defer the callback if we are being called synchronously
    // to avoid piling up things on the stack
    pna.nextTick(cb, er);
    // this can emit finish, and it will always happen
    // after error
    pna.nextTick(finishMaybe, stream, state);
    stream._writableState.errorEmitted = true;
    stream.emit('error', er);
  } else {
    // the caller expect this to happen before if
    // it is async
    cb(er);
    stream._writableState.errorEmitted = true;
    stream.emit('error', er);
    // this can emit finish, but finish must
    // always follow error
    finishMaybe(stream, state);
  }
}

function onwriteStateUpdate(state) {
  state.writing = false;
  state.writecb = null;
  state.length -= state.writelen;
  state.writelen = 0;
}

function onwrite(stream, er) {
  var state = stream._writableState;
  var sync = state.sync;
  var cb = state.writecb;

  onwriteStateUpdate(state);

  if (er) onwriteError(stream, state, sync, er, cb);else {
    // Check if we're actually ready to finish, but don't emit yet
    var finished = needFinish(state);

    if (!finished && !state.corked && !state.bufferProcessing && state.bufferedRequest) {
      clearBuffer(stream, state);
    }

    if (sync) {
      /*<replacement>*/
      asyncWrite(afterWrite, stream, state, finished, cb);
      /*</replacement>*/
    } else {
      afterWrite(stream, state, finished, cb);
    }
  }
}

function afterWrite(stream, state, finished, cb) {
  if (!finished) onwriteDrain(stream, state);
  state.pendingcb--;
  cb();
  finishMaybe(stream, state);
}

// Must force callback to be called on nextTick, so that we don't
// emit 'drain' before the write() consumer gets the 'false' return
// value, and has a chance to attach a 'drain' listener.
function onwriteDrain(stream, state) {
  if (state.length === 0 && state.needDrain) {
    state.needDrain = false;
    stream.emit('drain');
  }
}

// if there's something in the buffer waiting, then process it
function clearBuffer(stream, state) {
  state.bufferProcessing = true;
  var entry = state.bufferedRequest;

  if (stream._writev && entry && entry.next) {
    // Fast case, write everything using _writev()
    var l = state.bufferedRequestCount;
    var buffer = new Array(l);
    var holder = state.corkedRequestsFree;
    holder.entry = entry;

    var count = 0;
    var allBuffers = true;
    while (entry) {
      buffer[count] = entry;
      if (!entry.isBuf) allBuffers = false;
      entry = entry.next;
      count += 1;
    }
    buffer.allBuffers = allBuffers;

    doWrite(stream, state, true, state.length, buffer, '', holder.finish);

    // doWrite is almost always async, defer these to save a bit of time
    // as the hot path ends with doWrite
    state.pendingcb++;
    state.lastBufferedRequest = null;
    if (holder.next) {
      state.corkedRequestsFree = holder.next;
      holder.next = null;
    } else {
      state.corkedRequestsFree = new CorkedRequest(state);
    }
    state.bufferedRequestCount = 0;
  } else {
    // Slow case, write chunks one-by-one
    while (entry) {
      var chunk = entry.chunk;
      var encoding = entry.encoding;
      var cb = entry.callback;
      var len = state.objectMode ? 1 : chunk.length;

      doWrite(stream, state, false, len, chunk, encoding, cb);
      entry = entry.next;
      state.bufferedRequestCount--;
      // if we didn't call the onwrite immediately, then
      // it means that we need to wait until it does.
      // also, that means that the chunk and cb are currently
      // being processed, so move the buffer counter past them.
      if (state.writing) {
        break;
      }
    }

    if (entry === null) state.lastBufferedRequest = null;
  }

  state.bufferedRequest = entry;
  state.bufferProcessing = false;
}

Writable.prototype._write = function (chunk, encoding, cb) {
  cb(new Error('_write() is not implemented'));
};

Writable.prototype._writev = null;

Writable.prototype.end = function (chunk, encoding, cb) {
  var state = this._writableState;

  if (typeof chunk === 'function') {
    cb = chunk;
    chunk = null;
    encoding = null;
  } else if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (chunk !== null && chunk !== undefined) this.write(chunk, encoding);

  // .end() fully uncorks
  if (state.corked) {
    state.corked = 1;
    this.uncork();
  }

  // ignore unnecessary end() calls.
  if (!state.ending && !state.finished) endWritable(this, state, cb);
};

function needFinish(state) {
  return state.ending && state.length === 0 && state.bufferedRequest === null && !state.finished && !state.writing;
}
function callFinal(stream, state) {
  stream._final(function (err) {
    state.pendingcb--;
    if (err) {
      stream.emit('error', err);
    }
    state.prefinished = true;
    stream.emit('prefinish');
    finishMaybe(stream, state);
  });
}
function prefinish(stream, state) {
  if (!state.prefinished && !state.finalCalled) {
    if (typeof stream._final === 'function') {
      state.pendingcb++;
      state.finalCalled = true;
      pna.nextTick(callFinal, stream, state);
    } else {
      state.prefinished = true;
      stream.emit('prefinish');
    }
  }
}

function finishMaybe(stream, state) {
  var need = needFinish(state);
  if (need) {
    prefinish(stream, state);
    if (state.pendingcb === 0) {
      state.finished = true;
      stream.emit('finish');
    }
  }
  return need;
}

function endWritable(stream, state, cb) {
  state.ending = true;
  finishMaybe(stream, state);
  if (cb) {
    if (state.finished) pna.nextTick(cb);else stream.once('finish', cb);
  }
  state.ended = true;
  stream.writable = false;
}

function onCorkedFinish(corkReq, state, err) {
  var entry = corkReq.entry;
  corkReq.entry = null;
  while (entry) {
    var cb = entry.callback;
    state.pendingcb--;
    cb(err);
    entry = entry.next;
  }
  if (state.corkedRequestsFree) {
    state.corkedRequestsFree.next = corkReq;
  } else {
    state.corkedRequestsFree = corkReq;
  }
}

Object.defineProperty(Writable.prototype, 'destroyed', {
  get: function () {
    if (this._writableState === undefined) {
      return false;
    }
    return this._writableState.destroyed;
  },
  set: function (value) {
    // we ignore the value if the stream
    // has not been initialized yet
    if (!this._writableState) {
      return;
    }

    // backward compatibility, the user is explicitly
    // managing destroyed
    this._writableState.destroyed = value;
  }
});

Writable.prototype.destroy = destroyImpl.destroy;
Writable.prototype._undestroy = destroyImpl.undestroy;
Writable.prototype._destroy = function (err, cb) {
  this.end();
  cb(err);
};
}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("timers").setImmediate)
},{"./_stream_duplex":37,"./internal/streams/destroy":43,"./internal/streams/stream":44,"_process":35,"core-util-is":28,"inherits":31,"process-nextick-args":34,"safe-buffer":50,"timers":53,"util-deprecate":54}],42:[function(require,module,exports){
'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Buffer = require('safe-buffer').Buffer;
var util = require('util');

function copyBuffer(src, target, offset) {
  src.copy(target, offset);
}

module.exports = function () {
  function BufferList() {
    _classCallCheck(this, BufferList);

    this.head = null;
    this.tail = null;
    this.length = 0;
  }

  BufferList.prototype.push = function push(v) {
    var entry = { data: v, next: null };
    if (this.length > 0) this.tail.next = entry;else this.head = entry;
    this.tail = entry;
    ++this.length;
  };

  BufferList.prototype.unshift = function unshift(v) {
    var entry = { data: v, next: this.head };
    if (this.length === 0) this.tail = entry;
    this.head = entry;
    ++this.length;
  };

  BufferList.prototype.shift = function shift() {
    if (this.length === 0) return;
    var ret = this.head.data;
    if (this.length === 1) this.head = this.tail = null;else this.head = this.head.next;
    --this.length;
    return ret;
  };

  BufferList.prototype.clear = function clear() {
    this.head = this.tail = null;
    this.length = 0;
  };

  BufferList.prototype.join = function join(s) {
    if (this.length === 0) return '';
    var p = this.head;
    var ret = '' + p.data;
    while (p = p.next) {
      ret += s + p.data;
    }return ret;
  };

  BufferList.prototype.concat = function concat(n) {
    if (this.length === 0) return Buffer.alloc(0);
    if (this.length === 1) return this.head.data;
    var ret = Buffer.allocUnsafe(n >>> 0);
    var p = this.head;
    var i = 0;
    while (p) {
      copyBuffer(p.data, ret, i);
      i += p.data.length;
      p = p.next;
    }
    return ret;
  };

  return BufferList;
}();

if (util && util.inspect && util.inspect.custom) {
  module.exports.prototype[util.inspect.custom] = function () {
    var obj = util.inspect({ length: this.length });
    return this.constructor.name + ' ' + obj;
  };
}
},{"safe-buffer":50,"util":26}],43:[function(require,module,exports){
'use strict';

/*<replacement>*/

var pna = require('process-nextick-args');
/*</replacement>*/

// undocumented cb() API, needed for core, not for public API
function destroy(err, cb) {
  var _this = this;

  var readableDestroyed = this._readableState && this._readableState.destroyed;
  var writableDestroyed = this._writableState && this._writableState.destroyed;

  if (readableDestroyed || writableDestroyed) {
    if (cb) {
      cb(err);
    } else if (err && (!this._writableState || !this._writableState.errorEmitted)) {
      pna.nextTick(emitErrorNT, this, err);
    }
    return this;
  }

  // we set destroyed to true before firing error callbacks in order
  // to make it re-entrance safe in case destroy() is called within callbacks

  if (this._readableState) {
    this._readableState.destroyed = true;
  }

  // if this is a duplex stream mark the writable part as destroyed as well
  if (this._writableState) {
    this._writableState.destroyed = true;
  }

  this._destroy(err || null, function (err) {
    if (!cb && err) {
      pna.nextTick(emitErrorNT, _this, err);
      if (_this._writableState) {
        _this._writableState.errorEmitted = true;
      }
    } else if (cb) {
      cb(err);
    }
  });

  return this;
}

function undestroy() {
  if (this._readableState) {
    this._readableState.destroyed = false;
    this._readableState.reading = false;
    this._readableState.ended = false;
    this._readableState.endEmitted = false;
  }

  if (this._writableState) {
    this._writableState.destroyed = false;
    this._writableState.ended = false;
    this._writableState.ending = false;
    this._writableState.finished = false;
    this._writableState.errorEmitted = false;
  }
}

function emitErrorNT(self, err) {
  self.emit('error', err);
}

module.exports = {
  destroy: destroy,
  undestroy: undestroy
};
},{"process-nextick-args":34}],44:[function(require,module,exports){
module.exports = require('events').EventEmitter;

},{"events":29}],45:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

/*<replacement>*/

var Buffer = require('safe-buffer').Buffer;
/*</replacement>*/

var isEncoding = Buffer.isEncoding || function (encoding) {
  encoding = '' + encoding;
  switch (encoding && encoding.toLowerCase()) {
    case 'hex':case 'utf8':case 'utf-8':case 'ascii':case 'binary':case 'base64':case 'ucs2':case 'ucs-2':case 'utf16le':case 'utf-16le':case 'raw':
      return true;
    default:
      return false;
  }
};

function _normalizeEncoding(enc) {
  if (!enc) return 'utf8';
  var retried;
  while (true) {
    switch (enc) {
      case 'utf8':
      case 'utf-8':
        return 'utf8';
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return 'utf16le';
      case 'latin1':
      case 'binary':
        return 'latin1';
      case 'base64':
      case 'ascii':
      case 'hex':
        return enc;
      default:
        if (retried) return; // undefined
        enc = ('' + enc).toLowerCase();
        retried = true;
    }
  }
};

// Do not cache `Buffer.isEncoding` when checking encoding names as some
// modules monkey-patch it to support additional encodings
function normalizeEncoding(enc) {
  var nenc = _normalizeEncoding(enc);
  if (typeof nenc !== 'string' && (Buffer.isEncoding === isEncoding || !isEncoding(enc))) throw new Error('Unknown encoding: ' + enc);
  return nenc || enc;
}

// StringDecoder provides an interface for efficiently splitting a series of
// buffers into a series of JS strings without breaking apart multi-byte
// characters.
exports.StringDecoder = StringDecoder;
function StringDecoder(encoding) {
  this.encoding = normalizeEncoding(encoding);
  var nb;
  switch (this.encoding) {
    case 'utf16le':
      this.text = utf16Text;
      this.end = utf16End;
      nb = 4;
      break;
    case 'utf8':
      this.fillLast = utf8FillLast;
      nb = 4;
      break;
    case 'base64':
      this.text = base64Text;
      this.end = base64End;
      nb = 3;
      break;
    default:
      this.write = simpleWrite;
      this.end = simpleEnd;
      return;
  }
  this.lastNeed = 0;
  this.lastTotal = 0;
  this.lastChar = Buffer.allocUnsafe(nb);
}

StringDecoder.prototype.write = function (buf) {
  if (buf.length === 0) return '';
  var r;
  var i;
  if (this.lastNeed) {
    r = this.fillLast(buf);
    if (r === undefined) return '';
    i = this.lastNeed;
    this.lastNeed = 0;
  } else {
    i = 0;
  }
  if (i < buf.length) return r ? r + this.text(buf, i) : this.text(buf, i);
  return r || '';
};

StringDecoder.prototype.end = utf8End;

// Returns only complete characters in a Buffer
StringDecoder.prototype.text = utf8Text;

// Attempts to complete a partial non-UTF-8 character using bytes from a Buffer
StringDecoder.prototype.fillLast = function (buf) {
  if (this.lastNeed <= buf.length) {
    buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed);
    return this.lastChar.toString(this.encoding, 0, this.lastTotal);
  }
  buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, buf.length);
  this.lastNeed -= buf.length;
};

// Checks the type of a UTF-8 byte, whether it's ASCII, a leading byte, or a
// continuation byte. If an invalid byte is detected, -2 is returned.
function utf8CheckByte(byte) {
  if (byte <= 0x7F) return 0;else if (byte >> 5 === 0x06) return 2;else if (byte >> 4 === 0x0E) return 3;else if (byte >> 3 === 0x1E) return 4;
  return byte >> 6 === 0x02 ? -1 : -2;
}

// Checks at most 3 bytes at the end of a Buffer in order to detect an
// incomplete multi-byte UTF-8 character. The total number of bytes (2, 3, or 4)
// needed to complete the UTF-8 character (if applicable) are returned.
function utf8CheckIncomplete(self, buf, i) {
  var j = buf.length - 1;
  if (j < i) return 0;
  var nb = utf8CheckByte(buf[j]);
  if (nb >= 0) {
    if (nb > 0) self.lastNeed = nb - 1;
    return nb;
  }
  if (--j < i || nb === -2) return 0;
  nb = utf8CheckByte(buf[j]);
  if (nb >= 0) {
    if (nb > 0) self.lastNeed = nb - 2;
    return nb;
  }
  if (--j < i || nb === -2) return 0;
  nb = utf8CheckByte(buf[j]);
  if (nb >= 0) {
    if (nb > 0) {
      if (nb === 2) nb = 0;else self.lastNeed = nb - 3;
    }
    return nb;
  }
  return 0;
}

// Validates as many continuation bytes for a multi-byte UTF-8 character as
// needed or are available. If we see a non-continuation byte where we expect
// one, we "replace" the validated continuation bytes we've seen so far with
// a single UTF-8 replacement character ('\ufffd'), to match v8's UTF-8 decoding
// behavior. The continuation byte check is included three times in the case
// where all of the continuation bytes for a character exist in the same buffer.
// It is also done this way as a slight performance increase instead of using a
// loop.
function utf8CheckExtraBytes(self, buf, p) {
  if ((buf[0] & 0xC0) !== 0x80) {
    self.lastNeed = 0;
    return '\ufffd';
  }
  if (self.lastNeed > 1 && buf.length > 1) {
    if ((buf[1] & 0xC0) !== 0x80) {
      self.lastNeed = 1;
      return '\ufffd';
    }
    if (self.lastNeed > 2 && buf.length > 2) {
      if ((buf[2] & 0xC0) !== 0x80) {
        self.lastNeed = 2;
        return '\ufffd';
      }
    }
  }
}

// Attempts to complete a multi-byte UTF-8 character using bytes from a Buffer.
function utf8FillLast(buf) {
  var p = this.lastTotal - this.lastNeed;
  var r = utf8CheckExtraBytes(this, buf, p);
  if (r !== undefined) return r;
  if (this.lastNeed <= buf.length) {
    buf.copy(this.lastChar, p, 0, this.lastNeed);
    return this.lastChar.toString(this.encoding, 0, this.lastTotal);
  }
  buf.copy(this.lastChar, p, 0, buf.length);
  this.lastNeed -= buf.length;
}

// Returns all complete UTF-8 characters in a Buffer. If the Buffer ended on a
// partial character, the character's bytes are buffered until the required
// number of bytes are available.
function utf8Text(buf, i) {
  var total = utf8CheckIncomplete(this, buf, i);
  if (!this.lastNeed) return buf.toString('utf8', i);
  this.lastTotal = total;
  var end = buf.length - (total - this.lastNeed);
  buf.copy(this.lastChar, 0, end);
  return buf.toString('utf8', i, end);
}

// For UTF-8, a replacement character is added when ending on a partial
// character.
function utf8End(buf) {
  var r = buf && buf.length ? this.write(buf) : '';
  if (this.lastNeed) return r + '\ufffd';
  return r;
}

// UTF-16LE typically needs two bytes per character, but even if we have an even
// number of bytes available, we need to check if we end on a leading/high
// surrogate. In that case, we need to wait for the next two bytes in order to
// decode the last character properly.
function utf16Text(buf, i) {
  if ((buf.length - i) % 2 === 0) {
    var r = buf.toString('utf16le', i);
    if (r) {
      var c = r.charCodeAt(r.length - 1);
      if (c >= 0xD800 && c <= 0xDBFF) {
        this.lastNeed = 2;
        this.lastTotal = 4;
        this.lastChar[0] = buf[buf.length - 2];
        this.lastChar[1] = buf[buf.length - 1];
        return r.slice(0, -1);
      }
    }
    return r;
  }
  this.lastNeed = 1;
  this.lastTotal = 2;
  this.lastChar[0] = buf[buf.length - 1];
  return buf.toString('utf16le', i, buf.length - 1);
}

// For UTF-16LE we do not explicitly append special replacement characters if we
// end on a partial character, we simply let v8 handle that.
function utf16End(buf) {
  var r = buf && buf.length ? this.write(buf) : '';
  if (this.lastNeed) {
    var end = this.lastTotal - this.lastNeed;
    return r + this.lastChar.toString('utf16le', 0, end);
  }
  return r;
}

function base64Text(buf, i) {
  var n = (buf.length - i) % 3;
  if (n === 0) return buf.toString('base64', i);
  this.lastNeed = 3 - n;
  this.lastTotal = 3;
  if (n === 1) {
    this.lastChar[0] = buf[buf.length - 1];
  } else {
    this.lastChar[0] = buf[buf.length - 2];
    this.lastChar[1] = buf[buf.length - 1];
  }
  return buf.toString('base64', i, buf.length - n);
}

function base64End(buf) {
  var r = buf && buf.length ? this.write(buf) : '';
  if (this.lastNeed) return r + this.lastChar.toString('base64', 0, 3 - this.lastNeed);
  return r;
}

// Pass bytes on through for single-byte encodings (e.g. ascii, latin1, hex)
function simpleWrite(buf) {
  return buf.toString(this.encoding);
}

function simpleEnd(buf) {
  return buf && buf.length ? this.write(buf) : '';
}
},{"safe-buffer":50}],46:[function(require,module,exports){
module.exports = require('./readable').PassThrough

},{"./readable":47}],47:[function(require,module,exports){
exports = module.exports = require('./lib/_stream_readable.js');
exports.Stream = exports;
exports.Readable = exports;
exports.Writable = require('./lib/_stream_writable.js');
exports.Duplex = require('./lib/_stream_duplex.js');
exports.Transform = require('./lib/_stream_transform.js');
exports.PassThrough = require('./lib/_stream_passthrough.js');

},{"./lib/_stream_duplex.js":37,"./lib/_stream_passthrough.js":38,"./lib/_stream_readable.js":39,"./lib/_stream_transform.js":40,"./lib/_stream_writable.js":41}],48:[function(require,module,exports){
module.exports = require('./readable').Transform

},{"./readable":47}],49:[function(require,module,exports){
module.exports = require('./lib/_stream_writable.js');

},{"./lib/_stream_writable.js":41}],50:[function(require,module,exports){
arguments[4][15][0].apply(exports,arguments)
},{"buffer":27,"dup":15}],51:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

module.exports = Stream;

var EE = require('events').EventEmitter;
var inherits = require('inherits');

inherits(Stream, EE);
Stream.Readable = require('readable-stream/readable.js');
Stream.Writable = require('readable-stream/writable.js');
Stream.Duplex = require('readable-stream/duplex.js');
Stream.Transform = require('readable-stream/transform.js');
Stream.PassThrough = require('readable-stream/passthrough.js');

// Backwards-compat with node 0.4.x
Stream.Stream = Stream;



// old-style streams.  Note that the pipe method (the only relevant
// part of this class) is overridden in the Readable class.

function Stream() {
  EE.call(this);
}

Stream.prototype.pipe = function(dest, options) {
  var source = this;

  function ondata(chunk) {
    if (dest.writable) {
      if (false === dest.write(chunk) && source.pause) {
        source.pause();
      }
    }
  }

  source.on('data', ondata);

  function ondrain() {
    if (source.readable && source.resume) {
      source.resume();
    }
  }

  dest.on('drain', ondrain);

  // If the 'end' option is not supplied, dest.end() will be called when
  // source gets the 'end' or 'close' events.  Only dest.end() once.
  if (!dest._isStdio && (!options || options.end !== false)) {
    source.on('end', onend);
    source.on('close', onclose);
  }

  var didOnEnd = false;
  function onend() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest.end();
  }


  function onclose() {
    if (didOnEnd) return;
    didOnEnd = true;

    if (typeof dest.destroy === 'function') dest.destroy();
  }

  // don't leave dangling pipes when there are errors.
  function onerror(er) {
    cleanup();
    if (EE.listenerCount(this, 'error') === 0) {
      throw er; // Unhandled stream error in pipe.
    }
  }

  source.on('error', onerror);
  dest.on('error', onerror);

  // remove all the event listeners that were added.
  function cleanup() {
    source.removeListener('data', ondata);
    dest.removeListener('drain', ondrain);

    source.removeListener('end', onend);
    source.removeListener('close', onclose);

    source.removeListener('error', onerror);
    dest.removeListener('error', onerror);

    source.removeListener('end', cleanup);
    source.removeListener('close', cleanup);

    dest.removeListener('close', cleanup);
  }

  source.on('end', cleanup);
  source.on('close', cleanup);

  dest.on('close', cleanup);

  dest.emit('pipe', source);

  // Allow for unix-like usage: A.pipe(B).pipe(C)
  return dest;
};

},{"events":29,"inherits":31,"readable-stream/duplex.js":36,"readable-stream/passthrough.js":46,"readable-stream/readable.js":47,"readable-stream/transform.js":48,"readable-stream/writable.js":49}],52:[function(require,module,exports){
arguments[4][45][0].apply(exports,arguments)
},{"dup":45,"safe-buffer":50}],53:[function(require,module,exports){
(function (setImmediate,clearImmediate){
var nextTick = require('process/browser.js').nextTick;
var apply = Function.prototype.apply;
var slice = Array.prototype.slice;
var immediateIds = {};
var nextImmediateId = 0;

// DOM APIs, for completeness

exports.setTimeout = function() {
  return new Timeout(apply.call(setTimeout, window, arguments), clearTimeout);
};
exports.setInterval = function() {
  return new Timeout(apply.call(setInterval, window, arguments), clearInterval);
};
exports.clearTimeout =
exports.clearInterval = function(timeout) { timeout.close(); };

function Timeout(id, clearFn) {
  this._id = id;
  this._clearFn = clearFn;
}
Timeout.prototype.unref = Timeout.prototype.ref = function() {};
Timeout.prototype.close = function() {
  this._clearFn.call(window, this._id);
};

// Does not start the time, just sets up the members needed.
exports.enroll = function(item, msecs) {
  clearTimeout(item._idleTimeoutId);
  item._idleTimeout = msecs;
};

exports.unenroll = function(item) {
  clearTimeout(item._idleTimeoutId);
  item._idleTimeout = -1;
};

exports._unrefActive = exports.active = function(item) {
  clearTimeout(item._idleTimeoutId);

  var msecs = item._idleTimeout;
  if (msecs >= 0) {
    item._idleTimeoutId = setTimeout(function onTimeout() {
      if (item._onTimeout)
        item._onTimeout();
    }, msecs);
  }
};

// That's not how node.js implements it but the exposed api is the same.
exports.setImmediate = typeof setImmediate === "function" ? setImmediate : function(fn) {
  var id = nextImmediateId++;
  var args = arguments.length < 2 ? false : slice.call(arguments, 1);

  immediateIds[id] = true;

  nextTick(function onNextTick() {
    if (immediateIds[id]) {
      // fn.call() is faster so we optimize for the common use-case
      // @see http://jsperf.com/call-apply-segu
      if (args) {
        fn.apply(null, args);
      } else {
        fn.call(null);
      }
      // Prevent ids from leaking
      exports.clearImmediate(id);
    }
  });

  return id;
};

exports.clearImmediate = typeof clearImmediate === "function" ? clearImmediate : function(id) {
  delete immediateIds[id];
};
}).call(this,require("timers").setImmediate,require("timers").clearImmediate)
},{"process/browser.js":35,"timers":53}],54:[function(require,module,exports){
(function (global){

/**
 * Module exports.
 */

module.exports = deprecate;

/**
 * Mark that a method should not be used.
 * Returns a modified function which warns once by default.
 *
 * If `localStorage.noDeprecation = true` is set, then it is a no-op.
 *
 * If `localStorage.throwDeprecation = true` is set, then deprecated functions
 * will throw an Error when invoked.
 *
 * If `localStorage.traceDeprecation = true` is set, then deprecated functions
 * will invoke `console.trace()` instead of `console.error()`.
 *
 * @param {Function} fn - the function to deprecate
 * @param {String} msg - the string to print to the console when `fn` is invoked
 * @returns {Function} a new "deprecated" version of `fn`
 * @api public
 */

function deprecate (fn, msg) {
  if (config('noDeprecation')) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (config('throwDeprecation')) {
        throw new Error(msg);
      } else if (config('traceDeprecation')) {
        console.trace(msg);
      } else {
        console.warn(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
}

/**
 * Checks `localStorage` for boolean values for the given `name`.
 *
 * @param {String} name
 * @returns {Boolean}
 * @api private
 */

function config (name) {
  // accessing global.localStorage can trigger a DOMException in sandboxed iframes
  try {
    if (!global.localStorage) return false;
  } catch (_) {
    return false;
  }
  var val = global.localStorage[name];
  if (null == val) return false;
  return String(val).toLowerCase() === 'true';
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}]},{},[24]);
