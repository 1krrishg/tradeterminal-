"""
Runpod Flash Endpoint — Qwen3.5-2B Trade Data Extractor
Deploy this as a Runpod serverless endpoint (no Docker required with Flash).

Input:  {
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "query + context chunks"}
  ],
  "max_new_tokens": 2048,
  "temperature": 0.1
}
Output: {"text": "<raw JSON string>"}

Model: Qwen/Qwen3.5-2B — fast, multilingual, good structured extraction
"""
import runpod
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL_ID = "Qwen/Qwen3.5-2B"

print(f"[extractor] Loading {MODEL_ID}...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
    device_map="auto",
    trust_remote_code=True,
)
model.eval()
print(f"[extractor] {MODEL_ID} loaded")


def handler(job: dict) -> dict:
    inp = job.get("input", {})
    messages = inp.get("messages", [])
    max_new_tokens = inp.get("max_new_tokens", 2048)
    temperature = inp.get("temperature", 0.1)

    if not messages:
        return {"error": "messages field is required"}

    # Apply chat template
    text = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
    )
    inputs = tokenizer([text], return_tensors="pt")
    if torch.cuda.is_available():
        inputs = {k: v.cuda() for k, v in inputs.items()}

    with torch.no_grad():
        output_ids = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            temperature=temperature,
            do_sample=temperature > 0,
            pad_token_id=tokenizer.eos_token_id,
        )

    # Decode only the generated tokens (not the prompt)
    generated = output_ids[0][inputs["input_ids"].shape[1]:]
    output_text = tokenizer.decode(generated, skip_special_tokens=True)

    return {"text": output_text.strip()}


runpod.serverless.start({"handler": handler})
