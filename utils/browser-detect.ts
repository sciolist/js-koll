/**
 * Attempts to determine some information about the useragent, without doing too much work
 *
 * @returns User agent data
 */
export function lightBrowserDetect() {
    const result = {
        name: 'Unknown',
        version: '',
        mobile: false,
        os: navigator.platform,
    };
    const userAgentData = (navigator as any).userAgentData;
    const ua = navigator.userAgent;

    // get useragentdata for new browsers
    if (userAgentData) {
        const brand = userAgentData.brands[0];
        if (brand) {
            result.name = brand.brand;
            result.version = brand.version;
        }
        result.mobile = userAgentData.mobile;
        return result;
    }

    // detect safari / mobile safari
    if (navigator.vendor === 'Apple Computer, Inc.') {
        const version = ua.match(/\sVersion\/([\d.]+)\s/);
        result.name = /iPod|iPad|iPhone/.test(ua) ? 'Mobile Safari' : 'Safari';
        result.mobile = navigator.platform === 'iPhone' || navigator.platform === 'iPod';
        result.version = version ? version[1] : '';
        return result;
    }

    // use last useragent segment as a fallback
    const segments = ua.split(' ');
    const last = segments[segments.length - 1].split('/', 2);
    result.name = last[0];
    result.mobile = /Android/.test(ua);
    result.version = last[1];
    result.os = navigator.platform;
    return result;
}
