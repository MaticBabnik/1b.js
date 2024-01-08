/**
 * @template {T}
 * @param {T | Promise<T>} v
 * @param {(x:T)=>any} cb
 */
function when(a, cb) {
    if (a instanceof Promise) a.then(cb);
    else cb(a);
}

export class OneBitMachine {
    static #ADDR1_MASK = 0b1111_1110_0000_0000;
    static #ADDR2_MASK = 0b0000_0001_1111_1100;
    static #OPCODE_MASK = 0b11;

    static #IN_REG = 16;
    static #IN_REG_A = 17;
    static #OUT_REG = 18;
    static #OUT_REG_A = 19;

    #regFile = new Uint8Array(128 + 15);

    /**
     * @type {(v: boolean)=>void}
     */
    #output;

    /**
     * @type {()=>boolean|Promise<boolean>}
     */
    #input;

    /**
     * @type {Uint16Array}
     */
    #rom;

    /**
     * @type {Record<0|1|2|3, (this:OneBitMachine,a:number,b:number)=>void>}
     */
    #exec;

    #waitingForInput;

    /**
     * @param {Uint16Array} rom
     * @param {()=>boolean|Promise<boolean>} inCb
     * @param {(v: boolean)=>void} outCb
     */
    constructor(rom, inCb, outCb, enablePages = true) {
        if (!(inCb instanceof Function)) throw new Error("invalid inCb");
        if (!(outCb instanceof Function)) throw new Error("invalid outCb");
        if (!(rom instanceof Uint16Array)) throw new Error("ROM must be U16[]");

        this.enablePages = !!enablePages;

        this.#rom = rom;
        this.#input = inCb;
        this.#output = outCb;

        this.#waitingForInput = true;
        when(this.#input(), (x) => this.#readCallback(x));

        this.#exec = [this.#copy, this.#load, this.#nand, this.#xor].map((x) =>
            x.bind(this)
        );
    }

    #get16(offset = 0) {
        let pc = 0;
        for (let i = 0; i < 16; i++) {
            pc <<= 1;
            pc |= this.#regFile[i + offset] ? 1 : 0;
        }
        return pc;
    }

    #set16(val, offset = 0) {
        for (let i = offset, j = 1 << 15; j; i++, j >>= 1) {
            this.#regFile[i] = val & j ? 0xff : 0;
        }
    }

    get #pc() {
        return this.#get16();
    }

    set #pc(pc) {
        return this.#set16(pc);
    }

    #copy(a, b) {
        this.#set16(this.#get16(a), b);
    }

    #load(a, b) {
        let page = 0;
        if (this.enablePages) {
            const hiddenRegs = this.#get16(128) & 0x7fff; // discard reg128
            page = (hiddenRegs & 0x7fc0) << 1; // take first 9 hidden regs; shift em over to make space for the 7 bits of 'a'
        }

        this.#set16(this.#rom.at(page | a), b);
    }

    #nand(a, b) {
        this.#regFile[b] = ~(this.#regFile[a] & this.#regFile[b]);
    }

    #xor(a, b) {
        this.#regFile[b] = this.#regFile[a] ^ this.#regFile[b];
    }

    #readCallback(x) {
        this.#waitingForInput = false;
        this.#regFile[OneBitMachine.#IN_REG_A] = 1;
        this.#regFile[OneBitMachine.#IN_REG] = x ? 0xff : 0;
    }

    #handleIO() {
        if (this.#regFile[OneBitMachine.#OUT_REG_A]) {
            this.#output(this.#regFile[OneBitMachine.#OUT_REG] != 0);
            this.#regFile[OneBitMachine.#OUT_REG_A] = 0;
        }

        if (!this.#regFile[OneBitMachine.#IN_REG_A] && !this.#waitingForInput) {
            this.#waitingForInput = true;
            when(this.#input(), (x) => this.#readCallback(x));
        }
    }

    cycle() {
        // get PC and then increment it
        const oldPc = this.#pc;
        this.#pc = oldPc + 1;

        // load and execute instruction
        const instruction = this.#rom[oldPc];
        const a1 = (instruction & OneBitMachine.#ADDR1_MASK) >> 9;
        const a2 = (instruction & OneBitMachine.#ADDR2_MASK) >> 2;
        const opcode = instruction & OneBitMachine.#OPCODE_MASK;

        this.#exec[opcode](a1, a2);

        // halt?
        if (oldPc == this.#pc) throw new Error("HALT");

        this.#handleIO();
    }
}
