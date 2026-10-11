// Manual address entry, normalised in the browser. Normalisation is for display only; it never verifies an address.
import { z } from "zod";
import { normalisePostcode } from "./postcode.mjs";

export const ManualAddress = z.object({
  line1: z.string().trim().min(1, "Enter the first line of your address").max(120),
  line2: z.string().trim().max(120).optional().default(""),
  town: z.string().trim().min(1, "Enter your town").max(80),
  postcode: z.string().trim().refine((v) => !!normalisePostcode(v), "Enter a full UK postcode, e.g. SW1A 1AA"),
});
export const ADDRESS_NOTE = "We tidy the format but do not verify your address. The provider confirms the address and availability.";
export function basicNormalise(a) {
  const tidy = (s) => s.replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").trim();
  const title = (s) => tidy(s).toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
  return { line1: title(a.line1), line2: a.line2 ? title(a.line2) : "", town: tidy(a.town).toUpperCase(), postcode: normalisePostcode(a.postcode) };
}
export function normaliseAddress(input) {
  return { normalised: basicNormalise(ManualAddress.parse(input)), engine: "basic (in your browser)", verified: false, note: ADDRESS_NOTE };
}
