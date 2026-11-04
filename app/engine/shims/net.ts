export const isIPv4 = (s: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(s);
export const isIP = (s: string) => (isIPv4(s) ? 4 : s.includes(":") ? 6 : 0);
export default { isIP, isIPv4 };
