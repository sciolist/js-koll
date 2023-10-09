/**
 * Creates a new random id string
 *
 * @param length Number of bytes to create
 * @returns Random string
 */
export function id(length: number) {
    let result = '';
    for (let i = 0; i < length; ++i) {
        result += ((Math.random() * 0xff) | 0).toString(16).padStart(2, '0');
    }
    return result;
}

/**
 * Creates a fake nanosecond timestamp of the current timestamp
 * @returns Nanosecond time
 */
export function now() {
    return millitime(Date.now());
}

/**
 * Take a millisecond time, and add six zeroes onto the end. :)
 *
 * @param time Millisecond time
 * @returns Nanosecond time
 */
export function millitime(time: number) {
    return String(time) + '000000';
}
