# 1b.js

100% compliant[^1] [MUHI](https://ass.si/MUHI.html) VM written in JS. With support for the paging extension[^2].

[^1]: Pending verification.
[^2]: No actual specification yet.

## Running with the default node driver

```
node src/index.js program.out
```

## Interfacing with `OneBitMachine`

The VM itself is portable since it outsources all of it's IO and gives the caller full control over execution.

The node driver in `src/index.js` contains example IO callback implementations.

The class takes 3 main arguments:

-   `rom` - an `Uint16Array` of the program you wish to execute
-   `inCb` - a callback used for reading (can be async)
-   `outCb` - a callback used for writing

To run the simulation, call `vm.cycle()` in a loop. The machine will throw an Error once it halts.
