export const PLANNER_PROMPT = `You are the planning module for Shop Lens, a mobile visual shopping demo.

Given a user prompt and image count, produce a compact shopping/design plan as JSON.
The user input is free-form. Do not require budget, headcount, room dimensions, or structured fields.
Bias toward action. Choose product categories and search queries that can produce real purchasable products.
Keep the plan broad enough to feel imaginative, but concrete enough for live product search.
For event/party prompts, plan a visually varied assortment across surfaces, lighting, props, tableware, serveware, and interaction pieces when relevant.
Return JSON only.`

export function buildGenerationPrompt(args: {
  userPrompt: string
  generationGoal: string
  sceneDescription: string
  products: Array<{ title: string; merchant: string | null; role: string; quantity: number }>
  aspectRatio: string
}): string {
  const productList = args.products
    .map((item, index) => `${index + 1}. ${item.title}${item.merchant ? ` from ${item.merchant}` : ''} (${item.role}, qty ${item.quantity})`)
    .join('\n')

  return `Create a polished mobile-first ${args.aspectRatio} visual shopping preview.

User request:
${args.userPrompt}

Design goal:
${args.generationGoal}

Scene concept:
${args.sceneDescription}

Use the uploaded scene image as the base setting. Use the product reference images as purchasable items in the scene. Preserve rough product likeness while composing a coherent, aspirational result.

Important composition rules:
- Every visually prominent added object must correspond to one of the listed products.
- Do not invent major props, weapons, bowls, serveware, furniture, signs, or decorations that are not represented by the product references.
- You may add subtle atmospheric effects, lighting, shadows, and small non-salient filler only when they support the listed products.
- Keep the original scene recognizable.
- Favor product variety over repeating the same item many times.

Products:
${productList}

Output only the final composed image.`
}

export function buildSceneDescription(args: {
  userPrompt: string
  generationGoal: string
  products: Array<{ title: string; merchant: string | null; role: string; quantity: number }>
}): string {
  const heroProducts = args.products
    .filter((product) => product.role === 'hero')
    .map((product) => product.title)
    .slice(0, 3)
  const supportingProducts = args.products
    .filter((product) => product.role !== 'hero')
    .map((product) => product.title)
    .slice(0, 5)
  const productPhrase = [...heroProducts, ...supportingProducts].join(', ')

  return [
    args.generationGoal,
    productPhrase
      ? `The proposal layers ${productPhrase} into the uploaded scene as the purchasable visual ingredients.`
      : `The proposal uses the selected purchasable items as the visual ingredients.`,
    `The final image should feel imaginative and polished while staying grounded in the available product set.`,
  ].join(' ')
}
