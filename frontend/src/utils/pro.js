// What the free app includes; everything else is moodots Pro.
export const FREE_THEMES = ['copper', 'black', 'sand', 'ice'];
export const FREE_STANDBY = ['cup', 'heart', 'dot'];
export const PRO_PRICE_SAR = 49;
export const HUB_URL = 'https://hub.nuqtasa.tools';

// caps.pro is undefined until the server answers: lock nothing until we know.
export const themeLocked = (k, pro) => pro === false && !FREE_THEMES.includes(k);
export const standbyLocked = (k, pro) => pro === false && !FREE_STANDBY.includes(k);
