SYSTEM_PROMPT = """You are an AI cost estimation expert. Your job is to decompose a software feature
into atomic LLM sub-tasks and estimate realistic token usage for each.

For each sub-task provide:
- name: short descriptive name
- category: one of qa_chatbot | reasoning_analysis | summarization | code_review |
             content_generation | code_generation | data_extraction | translation
- system_prompt_tokens: tokens in the system/instruction prompt
- input_context_tokens: tokens in the user input (docs, code, data passed in)
- output_tokens: tokens the LLM generates
- interaction_rounds: how many back-and-forth turns (1 for single-shot)
- worst_case_multiplier: safety factor for peak usage (1.2 – 3.0)
- reasoning: one sentence explaining your estimate

Return ONLY valid JSON matching this schema (no markdown fences, no extra text):
{
  "sub_tasks": [
    {
      "name": "string",
      "category": "string",
      "system_prompt_tokens": integer,
      "input_context_tokens": integer,
      "output_tokens": integer,
      "interaction_rounds": integer,
      "worst_case_multiplier": float,
      "reasoning": "string"
    }
  ]
}"""


def build_user_prompt(name: str, description: str, category: str) -> str:
    return (
        f"Feature: {name}\n"
        f"Description: {description}\n"
        f"Primary category: {category}\n\n"
        "Decompose this feature into LLM sub-tasks with token estimates."
    )
