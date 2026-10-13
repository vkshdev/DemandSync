import json
import logging
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.core.security import sanitize_prompt_input
from app.schemas.copilot import (
    CopilotBriefingRequest,
    CopilotBriefingResponse,
    CopilotChatRequest,
    CopilotChatResponse,
    CopilotStatusResponse,
    SHAPFeature,
)

logger = logging.getLogger("demandsync.copilot")
logging.basicConfig(level=logging.INFO)


class LocalQwenEngine:
    """
    On-Device Inference Engine for Qwen/Qwen2.5-1.5B-Instruct.
    Runs 100% locally on CPU with zero network egress for maximum data sovereignty.
    """
    _instance: Optional["LocalQwenEngine"] = None
    _model = None
    _tokenizer = None
    _is_loaded: bool = False

    @classmethod
    def get_instance(cls) -> "LocalQwenEngine":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def load_model(self):
        """Lazy load the model weights only upon first inference call to save startup RAM."""
        if self._is_loaded:
            return

        try:
            import torch
            from transformers import AutoModelForCausalLM, AutoTokenizer

            model_id = settings.LOCAL_MODEL_ID
            logger.info(f"Loading local on-device model: {model_id} on {settings.DEVICE}...")

            self._tokenizer = AutoTokenizer.from_pretrained(
                model_id,
                trust_remote_code=True,
                local_files_only=True,
            )
            self._model = AutoModelForCausalLM.from_pretrained(
                model_id,
                torch_dtype=torch.float32,
                low_cpu_mem_usage=settings.LOW_CPU_MEM_USAGE,
                device_map=settings.DEVICE,
                trust_remote_code=True,
                local_files_only=True,
            )
            self._is_loaded = True
            logger.info(f"Successfully loaded {model_id} locally. Zero data will leave this machine.")
        except Exception as e:
            logger.warning(
                f"Local model {settings.LOCAL_MODEL_ID} could not be loaded directly ({str(e)}). "
                "The engine will use the high-assurance deterministic template fallback."
            )
            self._is_loaded = False

    def generate(self, messages: List[Dict[str, str]], max_tokens: int = 256) -> str:
        """Runs on-device autoregressive token generation using CPU."""
        if not self._is_loaded:
            self.load_model()

        if self._is_loaded and self._model is not None and self._tokenizer is not None:
            import torch
            prompt = self._tokenizer.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=True,
            )
            model_inputs = self._tokenizer([prompt], return_tensors="pt").to(settings.DEVICE)

            with torch.no_grad():
                generated_ids = self._model.generate(
                    **model_inputs,
                    max_new_tokens=max_tokens,
                    temperature=settings.TEMPERATURE,
                    do_sample=settings.TEMPERATURE > 0.0,
                    top_p=0.9,
                )

            input_length = model_inputs.input_ids.shape[1]
            generated_ids = [
                output_ids[input_length:] for output_ids in generated_ids
            ]

            response = self._tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0]
            return response.strip()
        else:
            raise RuntimeError("Local model weights not loaded.")


def generate_deterministic_briefing(req: CopilotBriefingRequest) -> CopilotBriefingResponse:
    """
    Deterministic rule-based executive brief generator.
    Guarantees the system never crashes even before model weights are downloaded.
    """
    p50_val = req.p50_forecast if req.p50_forecast > 0.0 else req.baseline_p50_total
    deficit = max(0.0, p50_val - float(req.current_stock))
    stockout_loss = round(deficit * req.unit_margin_usd, 2)

    risk_pct = req.stockout_risk_pct if req.stockout_risk_pct > 0.0 else req.simulated_stockout_risk_pct
    if risk_pct >= 70.0:
        risk_level = "CRITICAL"
    elif risk_pct >= 40.0 or deficit > 0:
        risk_level = "WARNING"
    else:
        risk_level = "HEALTHY"

    driver_strs = [
        f"{d.feature} ({d.impact})"
        if d.impact
        else f"{d.feature} ({d.attribution_value})"
        for d in req.top_drivers
    ]
    drivers_formatted = ", ".join(driver_strs) if driver_strs else "baseline trend"

    effective_ss = req.safety_stock if req.safety_stock > 0 else req.revised_safety_stock_units
    effective_rop = req.reorder_point if req.reorder_point > 0 else req.revised_reorder_point_units

    rec_action = (
        f"Immediately advance purchase reorder by {max(1, req.lead_time_days - 1)} days for at least "
        f"{int(deficit + effective_ss)} units to prevent inventory rupture."
        if risk_level != "HEALTHY"
        else "Maintain current replenishment schedule; stock levels align with P50 median demand."
    )

    stock_status = (
        f"Current on-hand inventory ({req.current_stock}) is below reorder point ({effective_rop})"
        if req.current_stock < effective_rop or deficit > 0
        else f"Current on-hand inventory ({req.current_stock}) is above reorder point ({effective_rop})"
    )

    summary = (
        f"Alert for {req.sku_name} ({req.sku_id}) at {req.store_id}: Projected demand volatility shows a "
        f"{risk_pct:.1f}% stockout risk driven by {drivers_formatted}. "
        f"{stock_status}, posing an estimated ${stockout_loss:,.2f} margin loss."
    )

    return CopilotBriefingResponse(
        sku_id=req.sku_id,
        store_id=req.store_id,
        risk_level=risk_level,
        projected_stockout_loss_usd=stockout_loss,
        recommended_action=rec_action,
        executive_summary=summary,
        key_drivers=driver_strs,
        action_recommendations=[rec_action],
        model_used="deterministic-rule-engine (local)",
    )


class CopilotService:
    @staticmethod
    def generate_briefing(request: CopilotBriefingRequest) -> CopilotBriefingResponse:
        """Generates an executive briefing using local Qwen2.5-1.5B with fallback."""
        if settings.COPILOT_PROVIDER == "local_qwen":
            try:
                engine = LocalQwenEngine.get_instance()

                driver_list = [
                    f"{d.feature} ({d.impact})" if d.impact else f"{d.feature} ({d.attribution_value})"
                    for d in request.top_drivers
                ]
                drivers_desc = ", ".join(driver_list)
                p50_val = request.p50_forecast if request.p50_forecast > 0.0 else request.baseline_p50_total
                deficit = max(0.0, p50_val - float(request.current_stock))
                est_loss = round(deficit * request.unit_margin_usd, 2)

                messages = [
                    {
                        "role": "system",
                        "content": (
                            "You are DemandSync's Executive Retail Copilot. You analyze probabilistic demand "
                            "forecasts and prescriptive inventory metrics. You must return ONLY valid JSON with keys: "
                            "'risk_level' ('CRITICAL'|'WARNING'|'HEALTHY'), 'recommended_action', and 'executive_summary'."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Analyze this SKU state:\n"
                            f"- SKU: {request.sku_name} ({request.sku_id})\n"
                            f"- Location: {request.store_id}\n"
                            f"- Current Stock: {request.current_stock} units\n"
                            f"- 14-Day Median Forecast (P50): {p50_val} units\n"
                            f"- Surge Demand Forecast (P90): {request.p90_forecast} units\n"
                            f"- Reorder Point (ROP): {request.reorder_point} units\n"
                            f"- Safety Stock: {request.safety_stock} units\n"
                            f"- Stockout Probability: {request.stockout_risk_pct:.1f}%\n"
                            f"- Key SHAP Drivers: {drivers_desc}\n"
                            f"- Lead Time: {request.lead_time_days} days\n"
                            f"- Projected Margin Loss: ${est_loss:,.2f}\n\n"
                            "Respond with a concise, professional JSON briefing."
                        ),
                    },
                ]

                raw_output = engine.generate(messages, max_tokens=settings.MAX_NEW_TOKENS)

                clean_json = raw_output
                if "```json" in clean_json:
                    clean_json = clean_json.split("```json")[1].split("```")[0].strip()
                elif "```" in clean_json:
                    clean_json = clean_json.split("```")[1].split("```")[0].strip()

                parsed = json.loads(clean_json)
                rec = parsed.get("recommended_action", "Review reorder timeline.")
                return CopilotBriefingResponse(
                    sku_id=request.sku_id,
                    store_id=request.store_id,
                    risk_level=parsed.get("risk_level", "WARNING"),
                    projected_stockout_loss_usd=est_loss,
                    recommended_action=rec,
                    executive_summary=parsed.get("executive_summary", raw_output),
                    key_drivers=driver_list,
                    action_recommendations=[rec],
                    model_used=f"local-{settings.LOCAL_MODEL_ID}",
                )
            except Exception as e:
                logger.warning(f"Local Qwen generation defaulted to rule-based engine: {e}")
                return generate_deterministic_briefing(request)
        else:
            return generate_deterministic_briefing(request)

    @staticmethod
    def chat(request: CopilotChatRequest) -> CopilotChatResponse:
        """Handles conversational queries from category managers."""
        sanitized_query = sanitize_prompt_input(request.query)

        if settings.COPILOT_PROVIDER == "local_qwen":
            try:
                engine = LocalQwenEngine.get_instance()
                context_str = json.dumps(request.context or {}, indent=2)

                messages = [
                    {
                        "role": "system",
                        "content": (
                            "You are DemandSync's Retail Supply Chain Copilot. Answer the store manager's question "
                            "concisely and factually using the provided retail context."
                        ),
                    },
                    {
                        "role": "user",
                        "content": f"Context:\n{context_str}\n\nQuestion: {sanitized_query}",
                    },
                ]

                ans = engine.generate(messages, max_tokens=settings.MAX_NEW_TOKENS)
                return CopilotChatResponse(answer=ans, model_used=f"local-{settings.LOCAL_MODEL_ID}")
            except Exception as e:
                logger.warning(f"Chat generation fallback: {e}")
                return CopilotChatResponse(
                    answer=(
                        f"Automated Assistant: DemandSync analyzed your query '{sanitized_query}'. "
                        "Please verify current inventory buffers and P50 median forecasts in the dashboard explorer."
                    ),
                    model_used="deterministic-rule-engine (local)",
                )
        else:
            return CopilotChatResponse(
                answer=(
                    f"Automated Assistant: DemandSync analyzed your query '{sanitized_query}'. "
                    "Please verify current inventory buffers and P50 median forecasts in the dashboard explorer."
                ),
                model_used="deterministic-rule-engine (local)",
            )
