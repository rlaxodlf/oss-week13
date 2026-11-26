// The only file that talks to the LLM provider.
// The provider, the model and the key come from .env:
//   process.env.LLM_BASE_URL, process.env.LLM_MODEL, process.env.LLM_API_KEY

// TODO P4: make a constant SYSTEM here: the rules for every answer (tone, length, format).
//          Then send it as the first message, before the user's message, in ask().

// ask("a question")  ->  the model's answer, as a string
const SYSTEM = `답변은 아래의 기준을 지킨다.
- 말투: 존댓말(해요체)로 답한다.
- 길이: 한 문단, 세 문장 이내로 답한다.
- 형식: 목록, 제목, 굵은 글씨 같은 마크다운을 쓰지 않는다.`;

const SYSTEM_JSON = `반드시 JSON 객체 하나로만 답하고, 다른 말은 덧붙이지 않는다.
키는 정확히 아래 세 개이며, 세 키를 모두 반드시 채운다.
- sentiment: 문자열. "positive", "negative", "neutral" 중 하나
- score: 정수. 1 이상 5 이하 (1 은 매우 부정, 5 는 매우 긍정)
- summary: 문자열. 리뷰를 요약한 짧은 한 문장, 말투: 존댓말
예: {"sentiment":"positive","score":5,"summary":"소리가 좋고 배터리가 오래간다."}`;

async function send(messages) {
  const res = await fetch(`${process.env.LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.LLM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL,
      messages,
    }),
  });

  if (!res.ok) {
    throw new Error(`LLM: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.choices[0].message.content.trim();
}

export async function ask(question) {
  return send([
    { role: "system", content: SYSTEM },
    { role: "user", content: question },
  ]);
}

// chat([{ role: "user", content: "..." }, { role: "assistant", content: "..." }, ...])
//   ->  the model's next answer, as a string
export async function chat(history) {
  return send([
    { role: "system", content: SYSTEM },
    ...history,
  ]);
}

// analyze("a review")  ->  an object, not a sentence:
//   { sentiment: "positive" | "negative" | "neutral", score: 1..5, summary: "one short sentence" }
export async function analyze(text) {
  const res = await fetch(`${process.env.LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.LLM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL,
      messages: [
        { role: "system", content: SYSTEM_JSON },
        { role: "user", content: text },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    throw new Error(`LLM: HTTP ${res.status}`);
  }

  const data = await res.json();
  const { sentiment, score, summary } = JSON.parse(data.choices[0].message.content);

  if (
    !["positive", "negative", "neutral"].includes(sentiment) ||
    !(Number.isInteger(score) && score >= 1 && score <= 5) ||
    typeof summary !== "string"
  ) {
    throw new Error("LLM: the answer has the wrong shape");
  }

  return { sentiment, score, summary };
}
