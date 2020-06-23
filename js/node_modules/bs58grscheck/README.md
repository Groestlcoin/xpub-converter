# bs58grscheck

A straight forward implementation of base58grscheck extending upon bs58.


## Example

```javascript
var bs58grscheck = require('bs58grscheck')

var decoded = bs58grscheck.decode('5KNSiE1em23byTDTToLyd6aBbqKdSZsvG4iQkMwYuxvc7MeHSke')

console.log(decoded)
// => <Buffer 80 cc b6 a4 01 f2 5a 90 59 8e 85 16 3f fd 1b 29 67 2f a8 59 1b da ef 18 a3 4f f1 e8 eb 8b 75 98 de>

console.log(bs58grscheck.encode(decoded))
// => 5KNSiE1em23byTDTToLyd6aBbqKdSZsvG4iQkMwYuxvc7MeHSke
```


## LICENSE [MIT](LICENSE)
