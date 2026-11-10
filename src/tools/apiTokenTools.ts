const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}(\/([0-9]|[12]\d|3[0-2]))?$/;
const IPV6 = /^[0-9A-Fa-f:.]*:[0-9A-Fa-f:.]*(\/(\d|[1-9]\d|1[01]\d|12[0-8]))?$/;

/** Client-side check; the backend validates the network again. */
export function isValidNetwork(value: string | undefined): boolean {
    if (!value) return false;
    const text = value.trim();
    return IPV4.test(text) || IPV6.test(text);
}
