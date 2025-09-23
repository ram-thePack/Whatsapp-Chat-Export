require('dotenv').config();
const axios = require('axios');

module.exports.analyzeMessage = async function (message) {
  const prompt = `
You're a dog nutrition expert. Analyze the message below.

Message: "${message}"

1. Return True if the question is only related to dog nutrition. Return True even if the question just contains a food ingredient. Else return False. 
If the input is related to fussy eating behaviour or medical issues return False.
2. List any ingredients or food items mentioned in the message in singular tense. ex: mangoes should return mango, dehydrated apples should return apple.

Respond in JSON format with keys: is_nutrition_question (bool), ingredients (character).
`;
  //console.log(prompt);
  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'mistralai/mistral-7b-instruct',
        messages: [{ role: 'user', content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MISTRAL7B_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const content = response.data.choices[0].message.content;
    //console.log('content:' + content);

    try {
      // Clean the response by removing markdown code blocks
      let cleanedContent = content.trim();

      // Remove ```json and ``` markers if present
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent
          .replace(/^```json\s*/, '')
          .replace(/\s*```$/, '');
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent
          .replace(/^```\s*/, '')
          .replace(/\s*```$/, '');
      }

      const result = JSON.parse(cleanedContent);
      //console.log('result: ' + JSON.stringify(result));
      const isNutrition = result.is_nutrition_question;
      //console.log(isNutrition);

      const ingredients = Array.isArray(result.ingredients)
        ? result.ingredients[0] || null
        : result.ingredients;
      //console.log(ingredients);
      return { isNutrition, ingredients };
    } catch (e) {
      console.log('JSON parsing error:', e);
      //console.log('Cleaned content:', cleanedContent);
      return { isNutrition: false, ingredients: null };
    }
  } catch (err) {
    console.log('API error:', err);
    return { isNutrition: false, ingredients: null };
  }
};
