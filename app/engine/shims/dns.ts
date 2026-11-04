// Name lookups happen in the relay (which refuses private addresses); here we only need the call to succeed.
export const lookup = async () => [{ address: "93.184.216.34", family: 4 }];
export default { lookup };
