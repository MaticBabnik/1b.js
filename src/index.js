import { OneBitMachine } from "./1b.js";
import { readFileSync } from "fs";

function devSlashNull() {
    return () => 0;
}

function devSlashStdout() {
    const { stdout } = process;
    let bc = 0,
        u8 = 0;

    return (v) => {
        u8 = (u8 << 1) | (v ? 1 : 0);
        if (++bc == 8) {
            stdout.write(String.fromCharCode(u8));
            bc = u8 = 0;
        }
    };
}

function readProgram(name) {
    const file = readFileSync(name);
    const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
    const u16a = new Uint16Array(file.length / Uint16Array.BYTES_PER_ELEMENT);

    for (let i = 0; i < u16a.length; i++)
        u16a[i] = view.getUint16(i * Uint16Array.BYTES_PER_ELEMENT, false);

    return u16a;
}

function main(file) {
    const vm = new OneBitMachine(
        readProgram(file),
        devSlashNull(),
        devSlashStdout(),
        /*enablePages: */ false
    );

    while (1) {
        vm.cycle();
    }
}

main(...process.argv.slice(2));
