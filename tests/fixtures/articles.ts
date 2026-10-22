import type { AnalysisInput } from "../../src/domain/analysis.js";

export const paragraph = (text: string, style = "normal") => ({
  _type: "block",
  style,
  children: [{ _type: "span", text, marks: [] as string[] }],
  markDefs: [] as { _key: string; _type: string; href: string }[],
});
export function linked(text: string, href: string) {
  const block = paragraph(text);
  const span = block.children[0];
  if (!span) throw new Error("Missing fixture span");
  span.marks = ["link"];
  block.markDefs = [{ _key: "link", _type: "link", href }];
  return block;
}
export const garden: AnalysisInput = {
  title: "Care for a balcony garden",
  description:
    "Learn when to water balcony plants, how to check the soil and where to find advice for your growing conditions.",
  url: "https://example.com/garden",
  body: [
    paragraph(
      "Check the soil before watering your balcony plants. Push a finger below the surface and water only when the soil feels dry.",
    ),
    paragraph(
      "Choose a pot with drainage holes so extra water can leave the roots. Place a tray below it to protect the balcony floor.",
    ),
    paragraph(
      "Watch how much sun reaches the plants during the day. Move sensitive plants into shade when the leaves begin to curl in strong afternoon sunlight.",
    ),
  ],
  keyphrases: [],
  locale: "en",
  readability: true,
  language: "auto",
};
// Independent reconstruction of the reported shape, NOT the user's actual text.
export const checkout: AnalysisInput = {
  ...garden,
  title: "How to Improve WooCommerce Checkout Conversion",
  description:
    "Improve WooCommerce checkout with a simpler form, clearer delivery information and payment options that work for your customers.",
  url: "https://example.com/how-to-improve-woocommerce-checkout-conversion",
  body: [
    paragraph(
      "WooCommerce checkout should help customers finish their orders without confusion. Start by reviewing the purchase journey on a phone and a desktop, and note any fields or messages that make the process harder to understand.",
    ),
    paragraph(
      "Keep the form focused on information needed to process the order. Offer guest checkout when an account is unnecessary, and explain why you need details such as a telephone number before asking customers to provide them.",
    ),
    paragraph(
      "Show delivery charges and expected delivery times before the final payment step. Customers should be able to understand the total cost without returning to an earlier screen or searching another page for an explanation.",
    ),
    paragraph(
      "Provide payment methods that suit your customers and test each one yourself. Make error messages specific enough to help someone correct a failed payment without losing the information they have already entered into the form.",
    ),
    paragraph(
      "Finally, review customer feedback and checkout errors regularly. Change one source of friction at a time so you can evaluate the result and keep improvements that help customers complete their purchases with confidence.",
    ),
  ],
};
