// Money in integer pence via dinero.js (no floating point in the cost engine).
import { dinero, add, multiply, subtract, toDecimal, compare, GBP } from "dinero.js";
export const gbp = (pence) => dinero({ amount: Math.round(pence), currency: GBP });
export const zero = () => gbp(0);
export const sum = (xs) => xs.reduce((a, b) => add(a, b), zero());
export const times = (d, n) => multiply(d, n);
export const minus = (a, b) => subtract(a, b);
export const pence = (d) => d.toJSON().amount;
export const fmt = (d) => { const v = toDecimal(d); return (v.startsWith("-") ? "-£" + v.slice(1) : "£" + v); };
export const cmp = compare;
export const toPence = (pounds) => { if (typeof pounds === "number") return Math.round(pounds * 100); const m = String(pounds).trim().replace(/^£/, "").match(/^(\d+)(?:\.(\d{1,2}))?$/); if (!m) throw new Error(`Bad money value: ${pounds}`); return Number(m[1]) * 100 + Number((m[2] || "0").padEnd(2, "0")); };
